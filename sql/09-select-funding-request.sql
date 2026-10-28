-- Checkpoint 03 | Read-only. Run before/after restart and again after approval.
-- Before requesting funding for Honk on fresh data, expect no rows.
SELECT id AS request_uuid, workflow_instance_id, status, risk_score, grant_cents
FROM public.funding_requests
WHERE project_id = 1;
