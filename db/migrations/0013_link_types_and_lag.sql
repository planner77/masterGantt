PRAGMA foreign_keys = OFF;

CREATE TABLE links_new (
  id INTEGER PRIMARY KEY,
  public_id TEXT NOT NULL UNIQUE,
  project_id INTEGER NOT NULL,
  predecessor_task_id INTEGER NOT NULL,
  successor_task_id INTEGER NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('FS', 'SS', 'FF', 'SF')),
  lag INTEGER NOT NULL CHECK (lag BETWEEN -10000 AND 10000),
  created_at TEXT NOT NULL CHECK (length(created_at) > 0),
  updated_at TEXT NOT NULL CHECK (length(updated_at) > 0),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (project_id, predecessor_task_id)
    REFERENCES tasks(project_id, id) ON DELETE CASCADE,
  FOREIGN KEY (project_id, successor_task_id)
    REFERENCES tasks(project_id, id) ON DELETE CASCADE,
  UNIQUE (project_id, predecessor_task_id, successor_task_id),
  CHECK (predecessor_task_id <> successor_task_id)
) STRICT;

INSERT INTO links_new (
  id, public_id, project_id, predecessor_task_id, successor_task_id,
  type, lag, created_at, updated_at
)
SELECT
  id, public_id, project_id, predecessor_task_id, successor_task_id,
  type, lag, created_at, updated_at
FROM links;

DROP TABLE links;

ALTER TABLE links_new RENAME TO links;

CREATE INDEX links_project_predecessor_idx
  ON links(project_id, predecessor_task_id);

CREATE INDEX links_project_successor_idx
  ON links(project_id, successor_task_id);

PRAGMA foreign_keys = ON;
