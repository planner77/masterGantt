-- Issue #881: project-scoped navigation visibility; existing and new projects default ON.
-- These are presentation settings, not authorization rules.
ALTER TABLE projects ADD COLUMN workspace_issue_visible INTEGER NOT NULL DEFAULT 1 CHECK (workspace_issue_visible IN (0, 1));
ALTER TABLE projects ADD COLUMN workspace_dashboard_visible INTEGER NOT NULL DEFAULT 1 CHECK (workspace_dashboard_visible IN (0, 1));
ALTER TABLE projects ADD COLUMN workspace_master_visible INTEGER NOT NULL DEFAULT 1 CHECK (workspace_master_visible IN (0, 1));
