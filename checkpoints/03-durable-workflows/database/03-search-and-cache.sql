ALTER TABLE projects ADD COLUMN search_document tsvector GENERATED ALWAYS AS (
  setweight(to_tsvector('english', name), 'A') ||
  setweight(to_tsvector('english', tagline), 'B') ||
  setweight(to_tsvector('english', description), 'C') ||
  setweight(to_tsvector('english', category), 'B')
) STORED;
CREATE INDEX projects_search_document_idx ON projects USING gin (search_document);

CREATE UNLOGGED TABLE project_summary_cache (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  expires_at timestamptz NOT NULL
);

CREATE FUNCTION project_summaries() RETURNS TABLE (projects jsonb, cache text)
LANGUAGE plpgsql AS $$
DECLARE
  summary jsonb;
BEGIN
  -- Serialize refills and invalidation so a concurrent write cannot leave stale summaries.
  PERFORM pg_advisory_xact_lock(hashtextextended('kickstopper:project-summaries', 0));
  SELECT value INTO summary FROM project_summary_cache
    WHERE key = 'projects:summary:v1' AND expires_at > clock_timestamp();
  IF FOUND THEN
    RETURN QUERY SELECT summary, 'hit'::text;
    RETURN;
  END IF;

  SELECT coalesce(jsonb_agg(to_jsonb(p) ORDER BY p.id), '[]'::jsonb) INTO summary
  FROM (
    SELECT id, name, tagline, category, founder, location, goal_cents, pledged_cents,
      backers_count, deadline, status, color FROM public.projects
  ) p;
  INSERT INTO project_summary_cache (key, value, expires_at)
    VALUES ('projects:summary:v1', summary, clock_timestamp() + interval '20 seconds')
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, expires_at = EXCLUDED.expires_at;
  RETURN QUERY SELECT summary, 'miss'::text;
END;
$$;

CREATE FUNCTION invalidate_project_summaries() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('kickstopper:project-summaries', 0));
  DELETE FROM project_summary_cache WHERE key = 'projects:summary:v1';
  RETURN NULL;
END;
$$;

CREATE TRIGGER projects_invalidate_summary_cache
AFTER INSERT OR UPDATE OR DELETE ON projects
FOR EACH ROW EXECUTE FUNCTION invalidate_project_summaries();

CREATE TRIGGER projects_truncate_summary_cache
AFTER TRUNCATE ON projects
FOR EACH STATEMENT EXECUTE FUNCTION invalidate_project_summaries();

ANALYZE projects;
