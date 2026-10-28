import { createServer } from 'node:http';
import { setTimeout } from 'node:timers/promises';
import { pool } from './database.js';
import { syncWarehouse } from './integrations.js';

let lastSuccess = 0;
createServer((_request, response) => {
  const healthy = Date.now() - lastSuccess < 30000;
  response.writeHead(healthy ? 200 : 503).end(healthy ? 'ok' : 'scheduler has not completed a tick');
}).listen(3003);

console.log('Scheduler owns campaign expiration, expired-cache cleanup, and five-second ClickHouse replication.');
while (true) {
  try {
    const result = await pool.query(`UPDATE projects SET status='expired'
      WHERE deadline<=now() AND pledged_cents<goal_cents AND status='active' RETURNING id, name`);
    if (result.rowCount) {
      console.log('Expired campaigns:', result.rows);
    }
    await pool.query('DELETE FROM project_summary_cache WHERE expires_at <= clock_timestamp()');
    await syncWarehouse();
    lastSuccess = Date.now();
  } catch (error) {
    console.error('Scheduler tick failed; health reports stale state until recovery:', error);
  }
  await setTimeout(5000);
}
