-- Checkpoint 01 | Read-only; the CREATE below is illustrative, not executed.
-- CREATE UNLOGGED TABLE project_summary_cache (
--   key text PRIMARY KEY,
--   value jsonb NOT NULL,
--   expires_at timestamptz NOT NULL
-- );
SELECT relname AS table_name,
  CASE relpersistence WHEN 'u' THEN 'UNLOGGED' ELSE 'LOGGED' END AS storage
FROM pg_class
WHERE oid = 'public.project_summary_cache'::regclass;
