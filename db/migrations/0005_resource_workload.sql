ALTER TABLE task_assignments
  ADD COLUMN assignment_start TEXT
  CHECK (assignment_start IS NULL OR length(assignment_start) = 10);

ALTER TABLE task_assignments
  ADD COLUMN assignment_end TEXT
  CHECK (assignment_end IS NULL OR length(assignment_end) = 10);

ALTER TABLE task_assignments
  ADD COLUMN allocation_percent REAL
  CHECK (allocation_percent IS NULL OR (allocation_percent > 0 AND allocation_percent <= 100));

CREATE INDEX task_assignments_resource_workload_idx
  ON task_assignments(project_id, resource_id, assignment_start, assignment_end)
  WHERE resource_id IS NOT NULL;
