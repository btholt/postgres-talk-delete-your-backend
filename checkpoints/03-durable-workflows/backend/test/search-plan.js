import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import pg from 'pg';

test('prepared SQL spotlight uses a real GIN plan without forcing the planner', async () => {
  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL || 'postgresql://kickstopper:kickstopper-local@localhost:54320/kickstopper',
  });
  await client.connect();
  const sql = async name => readFile(new URL(`../../scripts/sql/${name}.sql`, import.meta.url), 'utf8');
  const explain = text => text.replace('EXPLAIN (ANALYZE, BUFFERS)', 'EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)');
  const select = text => text.replace('EXPLAIN (ANALYZE, BUFFERS)', '');
  function nodes(plan) { return [plan, ...(plan.Plans || []).flatMap(nodes)]; }
  try {
    await client.query(await sql('01-prepare'));
    const beforeSql = await sql('02-before');
    const afterSql = await sql('04-after');
    const before = (await client.query(explain(beforeSql))).rows[0]['QUERY PLAN'][0];
    await client.query(await sql('03-improve'));
    const after = (await client.query(explain(afterSql))).rows[0]['QUERY PLAN'][0];
    const expected = [{ id: 2 }, { id: 7 }];
    assert.deepEqual((await client.query(select(beforeSql))).rows.sort((a, b) => a.id - b.id), expected);
    assert.deepEqual((await client.query(select(afterSql))).rows.sort((a, b) => a.id - b.id), expected);
    assert.ok(nodes(before.Plan).some(plan => plan['Node Type'] === 'Seq Scan'));
    assert.ok(nodes(after.Plan).some(plan => plan['Index Name'] === 'search_demo_projects_document_idx'));
    assert.ok(after['Execution Time'] < before['Execution Time'], 'The prepared improvement should be faster on this fixture.');
    console.log(JSON.stringify({
      fixtureRows: 40008, matches: expected.map(row => row.id),
      beforeMilliseconds: before['Execution Time'], afterMilliseconds: after['Execution Time'],
      beforePlan: nodes(before.Plan).map(plan => plan['Node Type']),
      afterPlan: nodes(after.Plan).map(plan => plan['Node Type']),
    }));
  } finally {
    await client.end();
  }
});
