ALTER TABLE projects
ADD COLUMN owner_name TEXT
  CHECK (
    owner_name IS NULL OR (
      owner_name = trim(owner_name)
      AND length(owner_name) BETWEEN 1 AND 100
    )
  );
