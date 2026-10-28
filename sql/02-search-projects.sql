-- Checkpoint 01 | Read-only.
SELECT id, name
FROM public.projects
WHERE search_document @@ websearch_to_tsquery('english', 'sourdough')
ORDER BY ts_rank(search_document, websearch_to_tsquery('english', 'sourdough')) DESC, id
LIMIT 50;
