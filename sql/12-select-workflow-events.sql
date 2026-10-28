-- Checkpoint 03 | Read-only. Prior events must not repeat after restart.
SELECT id, request_id, message, created_at
FROM public.workflow_events
WHERE request_id = (
  SELECT id FROM public.funding_requests WHERE project_id = 1
)
ORDER BY id;
