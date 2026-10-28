-- Checkpoint 02 | Read-only.
SELECT extname, extversion
FROM pg_extension
WHERE extname = 'vector';
