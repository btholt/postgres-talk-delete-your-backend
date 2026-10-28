import test from 'node:test';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';

process.env.DATABASE_URL ??= 'postgresql://kickstopper:kickstopper-local@localhost:54320/kickstopper';
const { analyticsQueries, projectAnalytics } = await import('../src/integrations.js');
const { pool } = await import('../src/database.js');
const base = process.env.BASE_URL || 'http://localhost:3000';

async function expectedDashboard() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const { rows: projects } = await client.query('SELECT pledged_cents, backers_count, status, category FROM projects');
    const { rows: backings } = await client.query('SELECT amount_cents, created_at FROM backings');
    const { rows: dates } = await client.query("SELECT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date::text AS today");
    await client.query('COMMIT');
    const cutoff = new Date(`${dates[0].today}T00:00:00Z`);
    cutoff.setUTCDate(cutoff.getUTCDate() - 13);
    const totals = {
      pledged_cents: 0, backers: 0, projects: projects.length, funded: 0, expired: 0,
    };
    const categories = new Map();
    const daily = new Map();
    for (const project of projects) {
      totals.pledged_cents += project.pledged_cents;
      totals.backers += project.backers_count;
      totals.funded += Number(project.status === 'funded');
      totals.expired += Number(project.status === 'expired');
      categories.set(project.category, (categories.get(project.category) || 0) + project.pledged_cents);
    }
    for (const backing of backings) {
      if (backing.created_at < cutoff) continue;
      const day = backing.created_at.toISOString().slice(0, 10);
      const row = daily.get(day) || { day, amount_cents: 0, backings: 0 };
      row.amount_cents += backing.amount_cents;
      row.backings++;
      daily.set(day, row);
    }
    return {
      totals,
      daily: [...daily.values()].sort((a, b) => a.day.localeCompare(b.day)),
      categories: [...categories].map(([category, pledged_cents]) => ({ category, pledged_cents }))
        .sort((a, b) => b.pledged_cents - a.pledged_cents || a.category.localeCompare(b.category)),
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

function nodes(plan) { return [plan, ...(plan.Plans || []).flatMap(nodes)]; }

test('the existing dashboard runs through pg_duckdb without a warehouse', async t => {
  try {
    await t.test('every production aggregate uses a real DuckDB custom scan', async () => {
      const client = await pool.connect();
      try {
        await client.query('BEGIN READ ONLY');
        await client.query('SET LOCAL duckdb.force_execution=true');
        for (const [name, query] of Object.entries(analyticsQueries)) {
          const plan = (await client.query(`EXPLAIN (ANALYZE, FORMAT JSON) ${query}`)).rows[0]['QUERY PLAN'][0];
          assert.ok(nodes(plan.Plan).some(node => node['Custom Plan Provider'] === 'DuckDBScan'), name);
        }
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    });
    await t.test('all data and JSON number shapes match an independent calculation', async () => {
      const expected = await expectedDashboard();
      assert.deepEqual(await projectAnalytics(), expected);
      const response = await fetch(`${base}/api/analytics`);
      assert.equal(response.status, 200);
      const { source, refreshed_at, refresh_interval_seconds, ...actual } = await response.json();
      assert.equal(source, 'Postgres + pg_duckdb');
      assert.equal(typeof refreshed_at, 'number');
      assert.ok(Date.now() - refreshed_at < 10000);
      assert.equal(refresh_interval_seconds, 5);
      assert.deepEqual(actual, expected);
    });
    await t.test('the fourteen-day chart keeps UTC semantics in another session timezone', async () => {
      const expected = await expectedDashboard();
      const timezone = new Date().getUTCHours() >= 10 ? 'Pacific/Kiritimati' : 'Pacific/Honolulu';
      await pool.query("SELECT set_config('TimeZone', $1, false)", [timezone]);
      try {
        const date = await pool.query("SELECT current_date <> (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date AS different");
        assert.equal(date.rows[0].different, true, 'Exercise a different calendar date, not just a different UTC offset.');
        assert.deepEqual(await projectAnalytics(), expected);
      } finally {
        await pool.query('RESET TIME ZONE');
      }
    });
    await t.test('routing is transaction-local and resets after both success and failure', async () => {
      await projectAnalytics();
      const settings = async () => (await pool.query(`SELECT pg_backend_pid() AS pid,
        current_setting('duckdb.force_execution')::boolean AS forced,
        current_setting('transaction_read_only')::boolean AS read_only`)).rows[0];
      const before = await settings();
      assert.equal(before.forced, false);
      assert.equal(before.read_only, false);
      await pool.query('SET search_path=pg_catalog');
      try {
        await assert.rejects(projectAnalytics(), { code: '42P01' });
        assert.deepEqual(await settings(), before, 'The same pooled connection must not keep DuckDB routing after rollback.');
      } finally {
        await pool.query('RESET search_path');
      }
      assert.deepEqual(await projectAnalytics(), await expectedDashboard());
    });
    await t.test('cloud access and implicit extension downloads are disabled', async () => {
      for (const setting of ['duckdb.enable_external_access', 'duckdb.autoinstall_known_extensions', 'duckdb.autoload_known_extensions', 'duckdb.unsafe_allow_execution_inside_functions']) {
        assert.equal((await pool.query('SELECT current_setting($1)::boolean AS enabled', [setting])).rows[0].enabled, false, setting);
      }
      assert.equal((await pool.query("SELECT current_setting('pg_durable.http_security') AS mode")).rows[0].mode, 'disabled');
      assert.equal((await pool.query("SELECT extversion FROM pg_extension WHERE extname='pg_duckdb'")).rows[0].extversion, '1.1.0');
    });
    await t.test('the actual prepared dataset stays responsive without a speedup claim', async () => {
      await projectAnalytics();
      const milliseconds = [];
      for (let i = 0; i < 5; i++) {
        const start = performance.now();
        await projectAnalytics();
        milliseconds.push(performance.now() - start);
      }
      assert.ok(Math.max(...milliseconds) < 2000, 'Warm dashboard queries should fit comfortably within the five-second UI polling interval.');
      console.log(JSON.stringify({ dataset: 'eight projects and prepared backings', milliseconds }));
    });
  } finally {
    await pool.end();
  }
});
