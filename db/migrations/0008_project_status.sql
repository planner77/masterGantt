ALTER TABLE projects ADD COLUMN status TEXT NOT NULL DEFAULT 'planned'
  CHECK (status IN ('planned', 'in_progress', 'completed'));

UPDATE projects SET status = 'in_progress';
