-- Checkpoint 06 | WRITE: changes only the seed Honk name. Run 22-restore-project-name.sql afterward.
-- Zero returned rows means the name was not Honk; inspect 17-select-project.sql before proceeding.
UPDATE public.projects
SET name = 'Honk: now rendered in Postgres'
WHERE id = 1 AND name = 'Honk'
RETURNING id, name;
