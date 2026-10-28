import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { setTimeout } from 'node:timers/promises';
import pg from 'pg';
import { api as screenApi } from '../client.js';

const base = process.env.BASE_URL || 'http://localhost:3000';
const compose = fileURLToPath(new URL('../../compose.yaml', import.meta.url));
const database = process.env.DATABASE_URL || 'postgresql://kickstopper:kickstopper-local@localhost:54320/kickstopper';

async function query(sql, params) {
  const client = new pg.Client({ connectionString: database, connectionTimeoutMillis: 3000 });
  try { await client.connect(); return (await client.query(sql, params)).rows; }
  finally { await client.end(); }
}
async function api(path, body, key) {
  return screenApi(path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'Content-Type': 'application/json', Connection: 'close', ...(key ? { 'Idempotency-Key': key } : {}) },
    signal: AbortSignal.timeout(10000),
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
async function until(load, check, label, retryConnection = false) {
  const deadline = Date.now() + 90000;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const value = await load();
      if (check(value)) return value;
    } catch (error) {
      const reconnecting = ['ECONNREFUSED', 'ECONNRESET', '57P03', '57P01', '08006'].includes(error.code)
        || error.message === 'Connection terminated unexpectedly'
        || error.message === 'Connection terminated due to connection timeout';
      if (!retryConnection || !reconnecting) throw error;
      lastError = error;
    }
    await setTimeout(200);
  }
  assert.fail(`Timed out waiting for ${label}${lastError ? `: ${lastError.message}` : ''}`);
}

test('the same pg_durable instance survives a same-volume Postgres restart and completes after approval', { timeout: 180000 }, async () => {
  const id = randomUUID();
  const funding = await api('/projects/2/funding', {}, id);
  assert.equal(funding.id, id, 'Reset checkpoint 06 before running this demonstration again.');
  assert.match(funding.workflow_instance_id, /^[0-9a-f]{8}$/);
  await until(() => api(`/funding/${id}`), row => row.status === 'awaiting_approval', 'human approval wait');
  await until(() => query('SELECT df.status($1) AS status', [funding.workflow_instance_id]),
    rows => rows[0]?.status === 'running', 'running durable instance');
  const [instance] = await query('SELECT id, root_node, created_at FROM df.instances WHERE id=$1', [funding.workflow_instance_id]);
  const [maintenance] = await query("SELECT workflow_instance_id, last_success_at FROM scheduled_work WHERE name='maintenance'");
  const [before] = await query('SELECT pg_postmaster_start_time() AS started');
  const containerId = execFileSync('docker', ['compose', '-f', compose, 'ps', '-q', 'postgres'], { encoding: 'utf8' }).trim();
  const mount = () => JSON.parse(execFileSync('docker', ['inspect', containerId], { encoding: 'utf8' }))[0]
    .Mounts.find(item => item.Destination === '/var/lib/postgresql/data').Name;
  const volume = mount();
  console.log(JSON.stringify({ requestId: id, durableInstanceId: instance.id, volume, before: before.started }));
  execFileSync('docker', ['compose', '-f', compose, 'restart', 'postgres'], { stdio: 'inherit', timeout: 90000 });
  const restarted = await until(() => query('SELECT pg_postmaster_start_time() AS started'),
    rows => rows[0].started > before.started, 'new Postgres process', true);
  await until(() => query("SELECT last_success_at FROM scheduled_work WHERE name='maintenance'"),
    rows => rows[0].last_success_at > restarted[0].started && rows[0].last_success_at > maintenance.last_success_at,
    'durable maintenance resuming', true);
  assert.equal(mount(), volume);
  assert.equal(execFileSync('docker', ['compose', '-f', compose, 'ps', '-q', 'postgres'], { encoding: 'utf8' }).trim(), containerId);
  assert.deepEqual((await query('SELECT id, root_node, created_at FROM df.instances WHERE id=$1', [instance.id]))[0], instance);
  assert.equal((await query("SELECT workflow_instance_id FROM scheduled_work WHERE name='maintenance'"))[0].workflow_instance_id, maintenance.workflow_instance_id);
  const waiting = await api(`/funding/${id}`);
  assert.equal(waiting.workflow_instance_id, instance.id);
  assert.equal(waiting.status, 'awaiting_approval');
  assert.equal(waiting.risk_score, 49);
  assert.equal(waiting.events.length, 4, 'Restart must not repeat completed eligibility/risk steps.');
  await api(`/funding/${id}/decision`, { decision: 'approve' });
  const done = await until(() => api(`/funding/${id}`), row => row.status === 'completed', 'fake grant completion');
  await until(() => query('SELECT df.status($1) AS status', [instance.id]),
    rows => rows[0]?.status === 'completed', 'actual durable workflow completion');
  assert.equal(done.grant_cents, 180000);
  assert.equal(done.events.length, 6);
  await api(`/funding/${id}/decision`, { decision: 'approve' });
  assert.equal((await api(`/funding/${id}`)).events.length, 6);
  assert.equal((await query("SELECT count(*) FROM df.instances WHERE label='maintenance'"))[0].count, '1');
  const rendered = await fetch(`${base}/project/2`, { headers: { Connection: 'close' } });
  assert.equal(rendered.status, 200);
  assert.ok((await rendered.text()).includes('Back this questionable idea'), 'Real SSR must also recover after the same database restart.');
  console.log(JSON.stringify({ sameDurableInstanceId: instance.id, sameVolume: volume, grantCents: done.grant_cents, events: done.events.length, status: 'completed' }));
});
