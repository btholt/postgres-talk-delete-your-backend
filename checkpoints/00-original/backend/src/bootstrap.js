import { setTimeout } from 'node:timers/promises';
import { pool } from './database.js';
import { search, vectors, warehouse, syncWarehouse } from './integrations.js';

async function waitForTask(task) {
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    const result = await search(`/tasks/${task.taskUid}`);
    if (result.status === 'succeeded') return;
    if (result.status === 'failed' || result.status === 'canceled') throw new Error(`Search indexing failed: ${JSON.stringify(result.error)}`);
    await setTimeout(100);
  }
  throw new Error('Search indexing did not finish within 60 seconds.');
}

try {
  const { rows: projects } = await pool.query('SELECT * FROM projects ORDER BY id');
  await waitForTask(await search('/indexes/projects/documents?primaryKey=id', {
    method: 'POST', body: JSON.stringify(projects.map(({ id, name, tagline, description, category }) => ({ id, name, tagline, description, category }))),
  }));
  await waitForTask(await search('/indexes/projects/settings', {
    method: 'PATCH', body: JSON.stringify({ searchableAttributes: ['name', 'tagline', 'description', 'category'] }),
  }));
  await jsonVectorSetup(projects);
  await warehouse(`CREATE TABLE IF NOT EXISTS projects (
    id UInt32, name String, category String, goal_cents UInt64, pledged_cents UInt64,
    backers_count UInt32, status String, version UInt64
  ) ENGINE = ReplacingMergeTree(version) ORDER BY id`);
  await warehouse(`CREATE TABLE IF NOT EXISTS backings (
    id UUID, project_id UInt32, amount_cents UInt64, created_at DateTime('UTC')
  ) ENGINE = ReplacingMergeTree ORDER BY id`);
  await warehouse('CREATE TABLE IF NOT EXISTS refreshes (id UInt8, version UInt64) ENGINE = ReplacingMergeTree(version) ORDER BY id');
  await syncWarehouse();
  console.log(`Prepared ${projects.length} projects in Meilisearch, Qdrant, and ClickHouse.`);
} finally {
  await pool.end();
}

async function jsonVectorSetup(projects) {
  const ready = await fetch(`${process.env.VECTOR_URL}/readyz`, { signal: AbortSignal.timeout(5000) });
  if (!ready.ok) throw new Error(`Qdrant readiness failed: HTTP ${ready.status}`);
  const collections = await vectors('/collections');
  if (!collections.result.collections.some(collection => collection.name === 'projects')) {
    await vectors('/collections/projects', { method: 'PUT', body: JSON.stringify({ vectors: { size: 6, distance: 'Cosine' } }) });
  }
  await vectors('/collections/projects/points?wait=true', {
    method: 'PUT',
    body: JSON.stringify({ points: projects.map(project => ({ id: project.id, vector: project.embedding, payload: { name: project.name } })) }),
  });
}
