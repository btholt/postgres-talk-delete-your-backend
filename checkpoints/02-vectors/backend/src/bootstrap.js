import { pool } from './database.js';
import { warehouse, syncWarehouse } from './integrations.js';

try {
  await warehouse(`CREATE TABLE IF NOT EXISTS projects (
    id UInt32, name String, category String, goal_cents UInt64, pledged_cents UInt64,
    backers_count UInt32, status String, version UInt64
  ) ENGINE = ReplacingMergeTree(version) ORDER BY id`);
  await warehouse(`CREATE TABLE IF NOT EXISTS backings (
    id UUID, project_id UInt32, amount_cents UInt64, created_at DateTime('UTC')
  ) ENGINE = ReplacingMergeTree ORDER BY id`);
  await warehouse('CREATE TABLE IF NOT EXISTS refreshes (id UInt8, version UInt64) ENGINE = ReplacingMergeTree(version) ORDER BY id');
  await syncWarehouse();
  console.log('Prepared ClickHouse. Search, cache, and vectors live in Postgres.');
} finally {
  await pool.end();
}
