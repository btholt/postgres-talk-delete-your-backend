-- Deliberately recompute every document at read time, as an unindexed implementation might.
EXPLAIN (ANALYZE, BUFFERS)
SELECT id FROM search_demo.projects
WHERE to_tsvector('english', name || ' ' || tagline || ' ' || description || ' ' || category)
  @@ websearch_to_tsquery('english', 'sourdough');
