-- Checkpoint 01 | Read-only. Refresh Discover first if the cache has expired.
SELECT key, value, expires_at
FROM public.project_summary_cache;
