import test from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import { semanticQueries } from '../src/domain.js';

const base = process.env.BASE_URL || 'http://localhost:3000';
// Recorded against checkpoint 01's real Qdrant collection before removing it.
const presetOrder = {
  meetings: [4, 6, 3, 2],
  bread: [2, 7, 4, 6],
  geese: [1, 5, 8, 7],
  subscriptions: [3, 4, 8, 6],
};
const projectOrder = {
  1: [5, 8, 7, 6], 2: [7, 4, 6, 3], 3: [4, 8, 6, 2], 4: [6, 3, 2, 8],
  5: [1, 7, 2, 8], 6: [4, 3, 2, 8], 7: [2, 5, 4, 3], 8: [3, 1, 4, 6],
};

function cosine(left, right) {
  const dot = left.reduce((sum, value, index) => sum + value * right[index], 0);
  return dot / Math.hypot(...left) / Math.hypot(...right);
}

test('pgvector preserves prepared Qdrant rankings and cosine similarity', async t => {
  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL || 'postgresql://kickstopper:kickstopper-local@localhost:54320/kickstopper',
  });
  await client.connect();
  try {
    await t.test('the extension and fixed-dimensional vectors live in the app database', async () => {
      const extension = await client.query("SELECT extversion FROM pg_extension WHERE extname='vector'");
      assert.equal(extension.rows[0]?.extversion, '0.8.1');
      const column = await client.query(`SELECT format_type(atttypid, atttypmod) AS type
        FROM pg_attribute WHERE attrelid='projects'::regclass AND attname='embedding'`);
      assert.equal(column.rows[0].type, 'vector(6)');
    });
    const { rows } = await client.query('SELECT id, embedding::text AS embedding FROM projects ORDER BY id');
    const embeddings = new Map(rows.map(row => [row.id, JSON.parse(row.embedding)]));
    assert.equal(embeddings.size, 8);

    async function check(path, vector, expected, exclude) {
      const response = await fetch(`${base}/api${path}`);
      assert.equal(response.status, 200);
      const data = await response.json();
      assert.equal(data.source, 'Postgres + pgvector · prepared vectors, no inference');
      assert.deepEqual(data.projects.map(project => project.id), expected);
      for (const project of data.projects) {
        assert.notEqual(project.id, exclude);
        assert.ok(Number.isFinite(project.similarity));
        const score = cosine(vector, embeddings.get(project.id));
        assert.ok(Math.abs(project.similarity - score) < 1e-6, `Incorrect cosine score for project ${project.id}`);
        assert.ok(!Object.hasOwn(project, 'embedding'));
      }
    }

    for (const query of semanticQueries) {
      await t.test(`prepared query: ${query.id}`, () =>
        check(`/similar?query=${query.id}`, query.vector, presetOrder[query.id]));
    }
    for (const [id, vector] of embeddings) {
      await t.test(`project ${id}: exclude self and return the same four neighbors`, () =>
        check(`/similar?projectId=${id}`, vector, projectOrder[id], id));
    }
    await t.test('invalid and missing queries still surface explicit errors', async () => {
      for (const [path, status] of [
        ['/similar', 400], ['/similar?query=unknown', 400],
        ['/similar?projectId=invalid', 400], ['/similar?projectId=999', 404],
      ]) {
        const response = await fetch(`${base}/api${path}`);
        assert.equal(response.status, status);
        assert.equal(typeof (await response.json()).error, 'string');
      }
    });
  } finally {
    await client.end();
  }
});
