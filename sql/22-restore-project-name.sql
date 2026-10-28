-- Checkpoint 06 | WRITE: restores only the name changed by 21-rename-project.sql.
-- Zero returned rows means the demonstration name was not present; inspect 17-select-project.sql.
UPDATE public.projects
SET name = 'Honk'
WHERE id = 1 AND name = 'Honk: now rendered in Postgres'
RETURNING id, name;
