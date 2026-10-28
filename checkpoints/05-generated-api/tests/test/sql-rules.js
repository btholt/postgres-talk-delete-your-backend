import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';

test('the non-superuser workflow owner preserves the original SQL funding rules', async t => {
  const c = new pg.Client({ connectionString: process.env.DATABASE_URL || 'postgresql://kickstopper:kickstopper-local@localhost:54320/kickstopper' });
  await c.connect();
  try {
    for (const scenario of [
      { name: '20% support', pledged: 200000, eligible: true, grant: 100000 },
      { name: 'below 20%', pledged: 199999, eligible: false },
      { name: 'expired campaign', pledged: 200000, status: 'expired', eligible: false },
      { name: 'past deadline', pledged: 200000, past: true, eligible: false },
      { name: 'grant cap', goal: 99999999, pledged: 20000000, eligible: true, grant: 500000 },
      { name: 'rejection', pledged: 200000, eligible: true, decision: 'reject', grant: 0 },
    ]) {
      await t.test(scenario.name, async () => {
        const id = randomUUID();
        await c.query('BEGIN');
        try {
          await c.query('SET LOCAL ROLE api_owner');
          await c.query(`UPDATE public.projects SET goal_cents=$1,pledged_cents=$2,status=$3,
            deadline=clock_timestamp()+$4::interval WHERE id=6`,
          [scenario.goal ?? 1000000,scenario.pledged,scenario.status ?? 'active',scenario.past ? '-1 day' : '1 day']);
          await c.query("INSERT INTO public.funding_requests(id,project_id,workflow_instance_id) VALUES($1,6,'sql-test')", [id]);
          for (let attempt=0;attempt<2;attempt++) {
            assert.equal((await c.query('SELECT public.check_funding_eligibility($1) AS eligible',[id])).rows[0].eligible,scenario.eligible);
            assert.equal((await c.query('SELECT public.calculate_funding_risk($1) AS score',[id])).rows[0].score,56);
          }
          if (scenario.eligible) {
            await c.query("UPDATE public.funding_requests SET status='approval_queued',decision=$2 WHERE id=$1",[id,scenario.decision ?? 'approve']);
            for(let attempt=0;attempt<2;attempt++) assert.equal((await c.query('SELECT public.finish_funding($1) AS grant',[id])).rows[0].grant,scenario.grant);
          }
          assert.equal((await c.query('SELECT count(*) FROM public.workflow_events WHERE request_id=$1',[id])).rows[0].count,scenario.eligible ? '4' : '2');
        } finally { await c.query('ROLLBACK'); }
      });
    }
  } finally { await c.end(); }
});
