-- Checkpoint 01 | Read-only.
SELECT id, name, search_document
FROM public.projects
WHERE id IN (2, 7)
ORDER BY id;
