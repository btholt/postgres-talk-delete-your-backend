import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { api, http, token, actorA, actorB, until } from '../client.js';

const connectionString = process.env.DATABASE_URL || 'postgresql://kickstopper:kickstopper-local@localhost:54320/kickstopper';
const compose = fileURLToPath(new URL('../../compose.yaml', import.meta.url));

test('PostgREST preserves the product with limited roles and owner-scoped commands', async t => {
  const client = new pg.Client({ connectionString });
  await client.connect();
  let funding;
  let backingKey;
  try {
    await t.test('generated resources, OpenAPI and public project detail are real', async () => {
      assert.equal((await api('/health')).checkpoint, '06-react-in-postgres');
      const schema = await http('/', { authorization: null });
      assert.equal(schema.status, 200);
      assert.ok(schema.data.paths['/projects']);
      assert.ok(schema.data.paths['/rpc/back_project']);
      const projects = await http('/projects', { authorization: null });
      assert.equal(projects.status, 200);
      assert.equal(projects.data.length, 8);
      assert.ok(!('owner_id' in projects.data[0]));
      assert.ok(!('embedding' in projects.data[0]));
      assert.equal((await api('/projects/1')).name, 'Honk');
      assert.deepEqual((await api('/semantic-queries')).map(q => q.id), ['meetings', 'bread', 'geese', 'subscriptions']);
    });
    await t.test('cache, ranked full-text search and six-dimensional similarities are retained', async () => {
      await client.query('DELETE FROM public.project_summary_cache');
      assert.equal((await api('/projects')).cache, 'miss');
      const cached = await http('/rpc/project_summaries', { method: 'POST', body: {} });
      assert.equal(cached.headers.get('X-Cache'), 'hit');
      assert.equal(cached.data.cache, 'hit');
      assert.deepEqual(new Set((await api('/projects?q=sourdough')).projects.map(p => p.id)), new Set([2, 7]));
      assert.equal((await api('/projects?category=Food%20%26%20Drink')).projects.length, 2);
      assert.equal((await api('/projects?q=zzzznonexistent')).projects.length, 0);
      assert.equal((await http('/rpc/project_summaries', { method: 'POST', body: { q: 'a'.repeat(161) } })).status, 400);
      const expected = { meetings: [4, 6, 3, 2], bread: [2, 7, 4, 6], geese: [1, 5, 8, 7], subscriptions: [3, 4, 8, 6] };
      for (const [query, ids] of Object.entries(expected)) {
        assert.deepEqual((await api(`/similar?query=${query}`)).projects.map(p => p.id), ids);
      }
      const related = await api('/similar?projectId=2');
      assert.equal(related.projects[0].id, 7);
      assert.ok(!related.projects.some(p => p.id === 2));
      const neighbors = { 1: [5,8,7,6], 2: [7,4,6,3], 3: [4,8,6,2], 4: [6,3,2,8],
        5: [1,7,2,8], 6: [4,3,2,8], 7: [2,5,4,3], 8: [3,1,4,6] };
      for (const [id, ids] of Object.entries(neighbors)) {
        assert.deepEqual((await api(`/similar?projectId=${id}`)).projects.map(p => p.id), ids);
      }
      await assert.rejects(api('/similar?query=unknown'), { status: 400 });
      await client.query("UPDATE public.project_summary_cache SET expires_at=clock_timestamp()-interval '1 second'");
      assert.equal((await api('/projects')).cache, 'miss');
    });
    await t.test('backing is atomic, retry-safe, typed and validated inside the SQL command', async () => {
      const before = await api('/projects/1');
      backingKey = randomUUID();
      const command = () => http('/rpc/back_project', { method: 'POST', key: backingKey, body: { project_id: 1, amount_cents: 2500 } });
      const responses = await Promise.all([command(), command()]);
      assert.ok(responses.every(r => r.status === 201), JSON.stringify(responses));
      const after = await api('/projects/1');
      assert.equal(after.pledged_cents, before.pledged_cents + 2500);
      assert.equal(after.backers_count, before.backers_count + 1);
      assert.equal((await api('/projects')).projects[0].pledged_cents, after.pledged_cents);
      assert.equal((await http('/rpc/back_project', { method: 'POST', key: backingKey, body: { project_id: 1, amount_cents: 2600 } })).status, 409);
      for (const amount of [499, 1000001, -1, 12.5, '500', null]) {
        assert.equal((await http('/rpc/back_project', { method: 'POST', key: randomUUID(), body: { project_id: 1, amount_cents: amount } })).status, 400);
      }
      assert.equal((await http('/rpc/back_project', { method: 'POST', body: { project_id: 1, amount_cents: 500 } })).status, 400);
    });
    await t.test('funding, human decisions, rejection and ineligibility remain durable', async () => {
      funding = await api('/projects/1/funding', { method: 'POST', headers: { 'Idempotency-Key': randomUUID() }, body: '{}' });
      assert.match(funding.workflow_instance_id, /^[0-9a-f]{8}$/);
      const waiting = await until(() => api(`/funding/${funding.id}`), row => row.status === 'awaiting_approval', 'eligibility');
      assert.equal(waiting.risk_score, 32);
      assert.equal((await client.query('SELECT submitted_by::regrole::text AS role FROM df.instances WHERE id=$1', [funding.workflow_instance_id])).rows[0].role, 'api_owner');
      const stranger = token(actorB);
      assert.deepEqual((await http('/funding', { authorization: stranger })).data, []);
      assert.deepEqual((await http(`/events?request_id=eq.${funding.id}`, { authorization: stranger })).data, []);
      assert.equal((await http('/rpc/decide_funding', { method: 'POST', authorization: stranger, body: { request_id: funding.id, decision: 'approve' } })).status, 404);
      assert.equal((await http('/rpc/request_funding', { method: 'POST', authorization: stranger, key: randomUUID(), body: { project_id: 1 } })).status, 403);
      await api(`/funding/${funding.id}/decision`, { method: 'POST', body: '{"decision":"approve"}' });
      const done = await until(() => api(`/funding/${funding.id}`), row => row.status === 'completed', 'approval');
      assert.equal(done.grant_cents, 250000);
      assert.equal(done.events.length, 6);
      await api(`/funding/${funding.id}/decision`, { method: 'POST', body: '{"decision":"approve"}' });
      assert.equal((await api(`/funding/${funding.id}`)).events.length, 6);
      await assert.rejects(api(`/funding/${funding.id}/decision`, { method: 'POST', body: '{"decision":"reject"}' }), { status: 409 });
      const rejected = await api('/projects/3/funding', { method: 'POST', headers: { 'Idempotency-Key': randomUUID() }, body: '{}' });
      await until(() => api(`/funding/${rejected.id}`), row => row.status === 'awaiting_approval', 'rejection readiness');
      await api(`/funding/${rejected.id}/decision`, { method: 'POST', body: '{"decision":"reject"}' });
      assert.equal((await until(() => api(`/funding/${rejected.id}`), row => row.status === 'rejected', 'rejection')).grant_cents, 0);
      const ineligible = await api('/projects/8/funding', { method: 'POST', headers: { 'Idempotency-Key': randomUUID() }, body: '{}' });
      await until(() => api(`/funding/${ineligible.id}`), row => row.status === 'ineligible', 'ineligibility');
    });
    await t.test('the same analytics data still uses safe read-only DuckDB execution', async () => {
      const analytics = await api('/analytics');
      assert.equal(analytics.totals.pledged_cents, 12384500);
      assert.equal(analytics.totals.backers, 875);
      assert.equal(analytics.daily.length, 14);
      assert.equal(analytics.categories.length, 4);
      assert.equal(analytics.source, 'Postgres + pg_duckdb');
      assert.equal((await client.query("SELECT current_setting('duckdb.unsafe_allow_execution_inside_functions')::boolean AS enabled")).rows[0].enabled, false);
      const source = (await client.query("SELECT pg_get_functiondef('api.analytics()'::regprocedure) AS source")).rows[0].source;
      const queries = [...source.matchAll(/public\.dblink\('analytics',\s*'((?:[^']|'')*)'\)/g)].map(match => match[1].replaceAll("''", "'"));
      assert.equal(queries.length, 3);
      for (const query of queries) {
        const output = execFileSync('docker', ['compose', '-f', compose, 'exec', '-T', 'postgres', 'psql', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-U', 'analytics_executor', '-d', 'kickstopper', '-c', `EXPLAIN (ANALYZE,FORMAT JSON) ${query}`], { encoding: 'utf8' });
        const plan = JSON.parse(output)[0];
        const nodes = p => [p, ...(p.Plans || []).flatMap(nodes)];
        assert.ok(nodes(plan.Plan).some(p => p['Custom Plan Provider'] === 'DuckDBScan'));
      }
      const expected = (await client.query('SELECT sum(pledged_cents)::double precision AS cents,sum(backers_count)::double precision AS backers FROM public.projects')).rows[0];
      assert.equal(analytics.totals.pledged_cents, expected.cents);
      assert.equal(analytics.totals.backers, expected.backers);
    });
    await t.test('JWTs, roles, private schemas and direct writes cannot bypass the command boundary', async () => {
      for (const authorization of ['invalid', token(actorA, 'web_user', { exp: 1 })]) {
        assert.equal((await http('/projects', { authorization })).status, 401);
      }
      for (const role of ['api_owner', 'analytics_executor', 'kickstopper']) {
        assert.equal((await http('/projects', { authorization: token(actorA, role) })).status, 403);
      }
      assert.equal((await http('/rpc/back_project', { authorization: null, method: 'POST', key: randomUUID(), body: { project_id: 1, amount_cents: 500 } })).status, 401);
      assert.equal((await http('/rpc/back_project', { authorization: token(actorB), method: 'POST', key: backingKey, body: { project_id: 1, amount_cents: 2500 } })).status, 409);
      for (const path of ['/backings', '/scheduled_work', '/rpc/start_funding_workflow', '/rpc/finish_funding', '/rpc/dblink']) {
        assert.equal((await http(path)).status, 404, path);
      }
      assert.equal((await http('/projects', { headers: { 'Accept-Profile': 'public' } })).status, 406);
      const before = await api('/projects/1');
      assert.ok((await http('/projects?id=eq.1', { method: 'PATCH', body: { pledged_cents: 1 } })).status >= 400);
      assert.equal((await api('/projects/1')).pledged_cents, before.pledged_cents);
      const roles = (await client.query("SELECT rolname,rolsuper,rolcreaterole,rolbypassrls FROM pg_roles WHERE rolname IN ('api_authenticator','api_owner','analytics_executor')")).rows;
      assert.ok(roles.every(role => !role.rolsuper && !role.rolcreaterole && !role.rolbypassrls));
    });
    await t.test('campaign expiration and expired-cache cleanup still have a durable owner', async () => {
      await api('/demo/expire', { method: 'POST', body: '{}' });
      await until(() => api('/projects/8'), row => row.status === 'expired', 'expiration');
      await assert.rejects(api('/projects/8/back', { method: 'POST', headers: { 'Idempotency-Key': randomUUID() }, body: '{"amount_cents":500}' }), { status: 409 });
      await client.query("INSERT INTO public.project_summary_cache(key,value,expires_at) VALUES('test:expired','[]',clock_timestamp()-interval '1 second')");
      await until(async () => (await client.query("SELECT count(*) FROM public.project_summary_cache WHERE key='test:expired'")).rows[0].count, count => count === '0', 'cache cleanup');
      assert.equal((await api('/analytics')).totals.expired, 1);
      assert.equal((await client.query("SELECT count(*) FROM df.instances WHERE label='maintenance'")).rows[0].count, '1');
    });
  } finally {
    await client.end();
  }
});
