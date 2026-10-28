import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { setTimeout } from 'node:timers/promises';
import pg from 'pg';

const base = process.env.BASE_URL || 'http://localhost:3000';
const database = process.env.DATABASE_URL || 'postgresql://kickstopper:kickstopper-local@localhost:54320/kickstopper';

test('funding rules moved into idempotent SQL activities', async t => {
  const client = new pg.Client({ connectionString: database });
  await client.connect();
  try {
    for (const scenario of [
      { name: '20% support is eligible', pledged: 200000, eligible: true, grant: 100000 },
      { name: 'less than 20% is ineligible', pledged: 199999, eligible: false },
      { name: 'an expired campaign is ineligible', pledged: 200000, status: 'expired', eligible: false },
      { name: 'a past deadline is ineligible', pledged: 200000, past: true, eligible: false },
      { name: 'fake grants are capped', goal: 99999999, pledged: 20000000, eligible: true, grant: 500000 },
      { name: 'rejection records no money', pledged: 200000, eligible: true, decision: 'reject', grant: 0 },
    ]) {
      await t.test(scenario.name, async () => {
        const id = randomUUID();
        await client.query('BEGIN');
        try {
          await client.query(`UPDATE projects SET goal_cents=$1, pledged_cents=$2, status=$3,
            deadline=clock_timestamp()+$4::interval WHERE id=6`, [
            scenario.goal ?? 1000000, scenario.pledged, scenario.status ?? 'active',
            scenario.past ? '-1 day' : '1 day',
          ]);
          await client.query(`INSERT INTO funding_requests (id, project_id, workflow_instance_id)
            VALUES ($1,6,'sql-test')`, [id]);
          for (let attempt = 0; attempt < 2; attempt++) {
            const eligibility = await client.query('SELECT check_funding_eligibility($1) AS eligible', [id]);
            assert.equal(eligibility.rows[0].eligible, scenario.eligible);
            assert.equal((await client.query('SELECT calculate_funding_risk($1) AS score', [id])).rows[0].score, 56);
          }
          let funding = (await client.query('SELECT * FROM funding_requests WHERE id=$1', [id])).rows[0];
          assert.equal(funding.status, scenario.eligible ? 'awaiting_approval' : 'ineligible');
          if (scenario.eligible) {
            await client.query("UPDATE funding_requests SET status='approval_queued', decision=$2 WHERE id=$1", [id, scenario.decision ?? 'approve']);
            for (let attempt = 0; attempt < 2; attempt++) {
              assert.equal((await client.query('SELECT finish_funding($1) AS grant', [id])).rows[0].grant, scenario.grant);
            }
            funding = (await client.query('SELECT * FROM funding_requests WHERE id=$1', [id])).rows[0];
            assert.equal(funding.status, scenario.decision === 'reject' ? 'rejected' : 'completed');
          }
          const events = await client.query('SELECT message FROM workflow_events WHERE request_id=$1 ORDER BY id', [id]);
          assert.equal(events.rows.length, scenario.eligible ? 4 : 2, 'Replayed SQL activities must not duplicate events.');
        } finally {
          await client.query('ROLLBACK');
        }
      });
    }
    await t.test('the obsolete warehouse activity endpoint is gone', async () => {
      const response = await fetch('http://localhost:3001/internal/analytics/refresh', { method: 'POST' });
      assert.equal(response.status, 404);
    });
    await t.test('a rolled-back durable signal handoff does not approve a request', async () => {
      const id = randomUUID();
      const response = await fetch(`${base}/api/projects/7/funding`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': id }, body: '{}',
      });
      assert.equal(response.status, 202);
      const funding = await response.json();
      const deadline = Date.now() + 30000;
      let state;
      do {
        state = (await client.query('SELECT * FROM funding_requests WHERE id=$1', [id])).rows[0];
        if (state.status === 'awaiting_approval') break;
        await setTimeout(100);
      } while (Date.now() < deadline);
      assert.equal(state.status, 'awaiting_approval');
      await client.query('BEGIN');
      await client.query("UPDATE funding_requests SET status='approval_queued', decision='approve' WHERE id=$1", [id]);
      const handoff = await client.query('SELECT start_funding_decision_handoff($1) AS id', [id]);
      await client.query('ROLLBACK');
      assert.equal((await client.query('SELECT count(*) FROM df.instances WHERE id=$1', [handoff.rows[0].id])).rows[0].count, '0');
      const observationEnd = Date.now() + 2000;
      while (Date.now() < observationEnd) {
        const request = (await client.query('SELECT status, decision FROM funding_requests WHERE id=$1', [id])).rows[0];
        assert.deepEqual(request, { status: 'awaiting_approval', decision: null });
        assert.equal((await client.query('SELECT status FROM df.instances WHERE id=$1', [funding.workflow_instance_id])).rows[0].status, 'running');
        await setTimeout(100);
      }
    });
    await t.test('cancelled durable workflows reject new human decisions', async () => {
      const funding = (await client.query('SELECT * FROM funding_requests WHERE project_id=7')).rows[0];
      await client.query("SELECT df.cancel($1, 'Checkpoint cancellation test')", [funding.workflow_instance_id]);
      const deadline = Date.now() + 20000;
      let status;
      do {
        status = (await client.query('SELECT status FROM df.instances WHERE id=$1', [funding.workflow_instance_id])).rows[0].status;
        if (status === 'cancelled') break;
        await setTimeout(100);
      } while (Date.now() < deadline);
      assert.equal(status, 'cancelled');
      const response = await fetch(`${base}/api/funding/${funding.id}/decision`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"decision":"approve"}',
      });
      assert.equal(response.status, 409);
      assert.match((await response.json()).error, /cancelled/);
      assert.equal((await client.query('SELECT decision FROM funding_requests WHERE id=$1', [funding.id])).rows[0].decision, null);
    });
  } finally {
    await client.end();
  }
});
