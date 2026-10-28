-- Checkpoint 01 | Read-only.
SELECT indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname = 'projects_search_document_idx';
