-- requires-foreign-keys-off: referenced-table-rebuild
CREATE TABLE tasks_new (
  id INTEGER PRIMARY KEY,
  project_id INTEGER NOT NULL,
  external_id TEXT NOT NULL CHECK (
    length(external_id) > 0
    AND external_id = trim(external_id)
  ),
  public_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  description TEXT,
  url TEXT,
  baseline_start TEXT,
  baseline_duration INTEGER,
  baseline_end TEXT,
  type TEXT NOT NULL CHECK (type IN ('task', 'summary', 'milestone')),
  schedule_mode TEXT NOT NULL CHECK (schedule_mode IN ('auto', 'manual')),
  requested_start TEXT,
  start_date TEXT,
  end_date TEXT,
  duration INTEGER CHECK (duration >= 0),
  progress REAL CHECK (progress >= 0 AND progress <= 100),
  parent_id INTEGER,
  sort_order INTEGER NOT NULL CHECK (sort_order >= 0),
  created_at TEXT NOT NULL CHECK (length(created_at) > 0),
  updated_at TEXT NOT NULL CHECK (length(updated_at) > 0),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (project_id, parent_id)
    REFERENCES tasks(project_id, id)
    ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED,
  UNIQUE (project_id, id),
  UNIQUE (project_id, external_id),
  CHECK (type <> 'milestone' OR (duration = 0 AND start_date = end_date)),
  CHECK (type <> 'task' OR duration BETWEEN 1 AND 10000),
  CHECK (type <> 'summary' OR (schedule_mode = 'auto' AND requested_start IS NULL)),
  CHECK (
    (type = 'summary' AND start_date IS NULL AND end_date IS NULL AND duration IS NULL AND progress IS NULL)
    OR (start_date IS NOT NULL AND end_date IS NOT NULL AND duration IS NOT NULL AND progress IS NOT NULL)
  )
) STRICT;

INSERT INTO tasks_new (id, project_id, external_id, public_id, name, description, url, type, schedule_mode, requested_start, start_date, end_date, duration, progress, parent_id, sort_order, baseline_start, baseline_duration, baseline_end, created_at, updated_at) SELECT id, project_id, external_id, public_id, name, description, url, type, schedule_mode, requested_start, start_date, end_date, duration, progress, parent_id, sort_order, baseline_start, baseline_duration, baseline_end, created_at, updated_at FROM tasks;
DROP TABLE tasks;
ALTER TABLE tasks_new RENAME TO tasks;
CREATE INDEX tasks_project_parent_idx ON tasks(project_id, parent_id);
CREATE INDEX tasks_project_sort_order_idx ON tasks(project_id, sort_order);
