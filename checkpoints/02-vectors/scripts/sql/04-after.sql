-- Same matching documents, now using the stored vector and its GIN index.
EXPLAIN (ANALYZE, BUFFERS)
SELECT id FROM search_demo.projects
WHERE search_document @@ websearch_to_tsquery('english', 'sourdough');
