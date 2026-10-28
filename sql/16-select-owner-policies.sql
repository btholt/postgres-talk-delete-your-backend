-- Checkpoint 05 | Read-only.
SELECT schemaname, tablename, policyname, roles, cmd, qual
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('funding_requests', 'workflow_events')
ORDER BY tablename, policyname;
