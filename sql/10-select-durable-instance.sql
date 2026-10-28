-- Checkpoint 03 | Read-only. The instance, root node, and creation time must survive restart.
SELECT id, root_node, created_at, status
FROM df.instances
WHERE id = (
  SELECT workflow_instance_id FROM public.funding_requests WHERE project_id = 1
);
