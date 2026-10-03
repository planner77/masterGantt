ALTER TABLE tasks
ADD COLUMN status TEXT NOT NULL DEFAULT 'not_started'
CHECK (status IN ('not_started', 'in_progress', 'completed'));

UPDATE tasks
SET status = CASE
  WHEN progress = 100 THEN 'completed'
  WHEN progress > 0 THEN 'in_progress'
  ELSE 'not_started'
END;
