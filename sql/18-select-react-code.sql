-- Checkpoint 06 | Read-only. Rehearsal/debug only: compiled React/app SSR JavaScript, not original JSX.
SELECT prosrc AS react_bundle
FROM pg_proc
WHERE oid = 'internal.load_react()'::regprocedure;
