import { setTimeout } from 'node:timers/promises';
import { pool, transaction } from './database.js';

try {
  const deadline = Date.now() + 60000;
  while (!(await pool.query('SELECT durable_ready() AS ready')).rows[0].ready) {
    if (Date.now() >= deadline) throw new Error('pg_durable did not become ready within 60 seconds.');
    await setTimeout(100);
  }
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
  console.log('Prepared pg_durable maintenance. Analytics reads Postgres through pg_duckdb.');
} finally {
  await pool.end();
}
