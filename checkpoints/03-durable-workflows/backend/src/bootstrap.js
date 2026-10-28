import { setTimeout } from 'node:timers/promises';
import { pool, transaction } from './database.js';
import { warehouse, syncWarehouse } from './integrations.js';

try {
  const deadline = Date.now() + 60000;
  while (!(await pool.query('SELECT durable_ready() AS ready')).rows[0].ready) {
    if (Date.now() >= deadline) throw new Error('pg_durable did not become ready within 60 seconds.');
    await setTimeout(100);
  }
  await warehouse(`CREATE TABLE IF NOT EXISTS projects (
    id UInt32, name String, category String, goal_cents UInt64, pledged_cents UInt64,
    backers_count UInt32, status String, version UInt64
  ) ENGINE = ReplacingMergeTree(version) ORDER BY id`);
  await warehouse(`CREATE TABLE IF NOT EXISTS backings (
    id UUID, project_id UInt32, amount_cents UInt64, created_at DateTime('UTC')
  ) ENGINE = ReplacingMergeTree ORDER BY id`);
  await warehouse('CREATE TABLE IF NOT EXISTS refreshes (id UInt8, version UInt64) ENGINE = ReplacingMergeTree(version) ORDER BY id');
  await syncWarehouse();
  await transaction(async client => {
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended('kickstopper:maintenance', 0))");
    const existing = await client.query(`SELECT s.workflow_instance_id, i.status FROM scheduled_work s
      JOIN df.instances i ON i.id=s.workflow_instance_id WHERE s.name='maintenance'`);
    if (existing.rows.length) {
      if (['failed', 'cancelled', 'completed'].includes(existing.rows[0].status)) {
        throw new Error(`Maintenance workflow ${existing.rows[0].workflow_instance_id} is ${existing.rows[0].status}; inspect it in VS Code.`);
      }
      return;
    }
    await client.query(`INSERT INTO scheduled_work (name, workflow_instance_id)
      VALUES ('maintenance', start_maintenance_workflow())`);
  });
  console.log('Prepared ClickHouse and pg_durable maintenance. Funding and timers live in Postgres.');
} finally {
  await pool.end();
}
