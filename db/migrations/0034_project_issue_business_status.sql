-- Issue #849: Project Issue business status is distinct from #846 tombstones.
-- Historical completed=0 cannot be inferred as in_progress: migrate to registered.
ALTER TABLE project_issues ADD COLUMN issue_status TEXT NOT NULL DEFAULT 'registered'
  CHECK (issue_status IN ('registered', 'in_progress', 'completed'));
UPDATE project_issues SET issue_status='completed' WHERE completed=1;
CREATE INDEX project_issues_business_status_idx
  ON project_issues(project_id, lifecycle_state, issue_status, created_at DESC, id DESC);

-- Preserve legacy completed/completed_on for old consumers, but prevent divergence.
CREATE TRIGGER project_issues_849_insert_guard BEFORE INSERT ON project_issues
WHEN (NEW.issue_status='completed') != (NEW.completed=1)
  OR (NEW.issue_status='completed') != (NEW.completed_on IS NOT NULL)
BEGIN SELECT RAISE(ABORT, 'invalid project issue business status'); END;
CREATE TRIGGER project_issues_849_update_guard BEFORE UPDATE ON project_issues
WHEN (NEW.issue_status='completed') != (NEW.completed=1)
  OR (NEW.issue_status='completed') != (NEW.completed_on IS NOT NULL)
BEGIN SELECT RAISE(ABORT, 'invalid project issue business status'); END;
