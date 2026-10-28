CREATE EXTENSION vector WITH VERSION '0.8.1';

ALTER TABLE projects ALTER COLUMN embedding TYPE vector(6)
  USING embedding::text::vector(6);
