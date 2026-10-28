-- Checkpoint 03 | Read-only. Expect running while waiting, then completed after approval.
SELECT df.status(workflow_instance_id) AS engine_status
FROM public.funding_requests
WHERE project_id = 1;
