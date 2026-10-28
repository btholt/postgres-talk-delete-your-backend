-- Checkpoint 04 | Read-only. Execute the whole file, including BEGIN and COMMIT.
-- On an error, run 99-rollback.sql before retrying.
BEGIN READ ONLY;
SET LOCAL duckdb.force_execution = true;

EXPLAIN (ANALYZE, BUFFERS)
SELECT (created_at AT TIME ZONE 'UTC')::date::text AS day,
  sum(amount_cents)::double precision AS amount_cents, count(*)::double precision AS backings
FROM backings
WHERE created_at >= (date_trunc('day', CURRENT_TIMESTAMP AT TIME ZONE 'UTC') - interval '13 days') AT TIME ZONE 'UTC'
GROUP BY day ORDER BY day;

COMMIT;
