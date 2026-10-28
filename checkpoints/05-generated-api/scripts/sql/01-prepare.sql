-- This search-only fixture is outside the product tables. Re-running resets only this fixture.
CREATE SCHEMA IF NOT EXISTS search_demo;
DROP TABLE IF EXISTS search_demo.projects;
CREATE TABLE search_demo.projects AS
SELECT id, name, tagline, description, category, search_document FROM public.projects;

WITH filler AS (
  SELECT n + 8 AS id, 'Ordinary startup ' || n AS name,
    'A very conventional neighborhood business' AS tagline,
    repeat('Local shops connect neighborhood customers with everyday products and friendly service. ', 12) AS description,
    'Technology' AS category
  FROM generate_series(1, 40000) n
)
INSERT INTO search_demo.projects
SELECT id, name, tagline, description, category,
  to_tsvector('english', name || ' ' || tagline || ' ' || description || ' ' || category)
FROM filler;

ANALYZE search_demo.projects;
