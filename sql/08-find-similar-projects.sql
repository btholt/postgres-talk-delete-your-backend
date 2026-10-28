-- Checkpoint 02 | Read-only. BreadOps is ID 2; Crumb & Go (ID 7) should rank first.
SELECT id, name,
  1 - (embedding <=> (SELECT embedding FROM public.projects WHERE id = 2)) AS similarity
FROM public.projects
WHERE id <> 2
ORDER BY embedding <=> (SELECT embedding FROM public.projects WHERE id = 2), id
LIMIT 4;
