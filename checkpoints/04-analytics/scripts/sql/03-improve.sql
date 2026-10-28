CREATE INDEX search_demo_projects_document_idx ON search_demo.projects USING gin (search_document);
ANALYZE search_demo.projects;
