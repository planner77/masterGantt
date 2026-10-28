-- #838: project-scoped issue ledger, independent from canonical WBS scheduling.
-- Deleting a referenced Task/resource clears only the canonical association;
-- names and notes remain in the issue audit record.
CREATE TABLE project_issues (
  id INTEGER PRIMARY KEY,
  public_id TEXT NOT NULL UNIQUE,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 160),
  description TEXT NOT NULL DEFAULT '' CHECK (length(description) <= 4000),
  reporter_name TEXT NOT NULL DEFAULT '' CHECK (length(reporter_name) <= 120),
  reporter_resource_public_id TEXT REFERENCES resources(public_id) ON DELETE SET NULL,
  assignee_name TEXT NOT NULL DEFAULT '' CHECK (length(assignee_name) <= 120),
  assignee_resource_public_id TEXT REFERENCES resources(public_id) ON DELETE SET NULL,
  occurred_on TEXT NOT NULL CHECK (length(occurred_on) = 10),
  completed INTEGER NOT NULL DEFAULT 0 CHECK (completed IN (0, 1)),
  completed_on TEXT CHECK (completed_on IS NULL OR length(completed_on) = 10),
  related_task_public_id TEXT REFERENCES tasks(public_id) ON DELETE SET NULL,
  related_task_text TEXT NOT NULL DEFAULT '' CHECK (length(related_task_text) <= 200),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK ((completed = 0 AND completed_on IS NULL) OR (completed = 1 AND completed_on IS NOT NULL))
) STRICT;
CREATE INDEX project_issues_created_idx ON project_issues(project_id, created_at DESC, id DESC);
CREATE INDEX project_issues_status_idx ON project_issues(project_id, completed, id DESC);
