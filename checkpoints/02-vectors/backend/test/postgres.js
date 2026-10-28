import test from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout } from 'node:timers/promises';
import pg from 'pg';

const base = process.env.BASE_URL || 'http://localhost:3000';

test('Postgres owns the disposable summary-cache lifecycle', async t => {
  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL || 'postgresql://kickstopper:kickstopper-local@localhost:54320/kickstopper',
  });
  await client.connect();
  async function browse() {
    const response = await fetch(`${base}/api/projects`);
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.equal(response.headers.get('X-Cache'), data.cache);
    return data;
  }
  try {
    const checkpoint = await fetch('http://localhost:3001/health').then(response => response.json());
    assert.equal(checkpoint.checkpoint, '02-vectors', 'Start checkpoint 02 before running these tests.');
    await t.test('UNLOGGED cache refills once for concurrent requests with the same response shape', async () => {
      const persistence = await client.query("SELECT relpersistence FROM pg_class WHERE oid='project_summary_cache'::regclass");
      assert.equal(persistence.rows[0].relpersistence, 'u');
      await client.query('DELETE FROM project_summary_cache');
      const responses = await Promise.all(Array.from({ length: 6 }, browse));
      assert.equal(responses.filter(result => result.cache === 'miss').length, 1);
      for (const result of responses) assert.deepEqual(result.projects, responses[0].projects);
      const ttl = await client.query('SELECT extract(epoch FROM expires_at - clock_timestamp()) AS seconds FROM project_summary_cache');
      assert.ok(Number(ttl.rows[0].seconds) > 15 && Number(ttl.rows[0].seconds) <= 20);
    });
    await t.test('expired values are never served, even before scheduled cleanup', async () => {
      await client.query("UPDATE project_summary_cache SET value='[]', expires_at=clock_timestamp()-interval '1 second'");
      const result = await browse();
      assert.equal(result.cache, 'miss');
      assert.equal(result.projects.length, 8);
      assert.equal((await browse()).cache, 'hit');
    });
    await t.test('SQL writes invalidate transactionally, update the search document, and roll back cleanly', async () => {
      const before = await browse();
      await client.query('BEGIN');
      try {
        await client.query("UPDATE projects SET tagline='A rehearsal-only capybara service' WHERE id=1");
        assert.equal((await client.query('SELECT count(*) FROM project_summary_cache')).rows[0].count, '0');
        const current = (await client.query('SELECT * FROM project_summaries()')).rows[0];
        assert.equal(current.cache, 'miss');
        assert.equal(current.projects[0].tagline, 'A rehearsal-only capybara service');
        const matches = await client.query("SELECT id FROM projects WHERE search_document @@ websearch_to_tsquery('english', 'capybara')");
        assert.deepEqual(matches.rows, [{ id: 1 }]);
      } finally {
        await client.query('ROLLBACK');
      }
      assert.deepEqual((await browse()).projects, before.projects);
    });
    await t.test('no-op scheduler updates do not invalidate a live cache', async () => {
      const before = await client.query("SELECT value, expires_at FROM project_summary_cache WHERE key='projects:summary:v1'");
      await client.query("UPDATE projects SET status='expired' WHERE false");
      const after = await client.query("SELECT value, expires_at FROM project_summary_cache WHERE key='projects:summary:v1'");
      assert.deepEqual(after.rows, before.rows);
    });
    await t.test('the existing scheduler removes expired cache rows', async () => {
      await client.query(`INSERT INTO project_summary_cache (key, value, expires_at)
        VALUES ('test:expired', '[]', clock_timestamp()-interval '1 second')`);
      const deadline = Date.now() + 20000;
      let remaining;
      do {
        remaining = await client.query("SELECT count(*) FROM project_summary_cache WHERE key='test:expired'");
        if (remaining.rows[0].count === '0') break;
        await setTimeout(200);
      } while (Date.now() < deadline);
      assert.equal(remaining.rows[0].count, '0', 'Scheduler did not remove the expired row.');
    });
  } finally {
    await client.query("DELETE FROM project_summary_cache WHERE key='test:expired'");
    await client.end();
  }
});
