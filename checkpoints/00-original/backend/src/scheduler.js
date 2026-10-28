import { createServer } from 'node:http';
import { setTimeout } from 'node:timers/promises';
import { pool } from './database.js';
import { cache, invalidateProjects, syncWarehouse } from './integrations.js';

await cache.connect();
let lastSuccess = 0;
createServer((_request, response) => {
  const healthy = Date.now() - lastSuccess < 30000;
  response.writeHead(healthy ? 200 : 503).end(healthy ? 'ok' : 'scheduler has not completed a tick');
}).listen(3003);

console.log('Scheduler owns campaign expiration and five-second ClickHouse replication.');
while (true) {
  try {
    const result = await pool.query(`UPDATE projects SET status='expired'
      WHERE deadline<=now() AND pledged_cents<goal_cents AND status='active' RETURNING id, name`);
    if (result.rowCount) {
      await invalidateProjects();
      console.log('Expired campaigns:', result.rows);
    }
    await syncWarehouse();
    lastSuccess = Date.now();
  } catch (error) {
    console.error('Scheduler tick failed; health reports stale state until recovery:', error);
  }
  await setTimeout(5000);
}
