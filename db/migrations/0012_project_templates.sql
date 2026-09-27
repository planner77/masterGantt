-- 0012_project_templates.sql
-- Project template registration, management, and instantiation support (Issue #195)

CREATE TABLE IF NOT EXISTS project_templates (
  id INTEGER PRIMARY KEY,
  public_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  source_project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
  source_project_name TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  task_count INTEGER NOT NULL DEFAULT 0,
  milestone_count INTEGER NOT NULL DEFAULT 0,
  content_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS project_templates_active_idx ON project_templates(active);
CREATE INDEX IF NOT EXISTS project_templates_created_at_idx ON project_templates(created_at);
