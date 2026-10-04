ALTER TABLE task_assignments
  ADD COLUMN assignment_role TEXT
  CHECK (
    assignment_role IS NULL OR
    assignment_role IN ('PI', 'DEVELOPER', 'EQUIPMENT_OWNER')
  );

CREATE INDEX task_assignments_resource_role_idx
  ON task_assignments(resource_id, assignment_role)
  WHERE resource_id IS NOT NULL AND assignment_role IS NOT NULL;

CREATE TRIGGER task_assignments_role_insert_guard
BEFORE INSERT ON task_assignments
WHEN NEW.assignment_role IS NOT NULL AND (
  NEW.resource_id IS NULL OR
  NOT EXISTS (
    SELECT 1
      FROM resource_roles rr
     WHERE rr.resource_id = NEW.resource_id
       AND rr.role = NEW.assignment_role
  )
)
BEGIN
  SELECT RAISE(ABORT, 'task assignment role is not held by resource');
END;

CREATE TRIGGER task_assignments_role_update_guard
BEFORE UPDATE OF resource_id, group_id, assignment_role ON task_assignments
WHEN NEW.assignment_role IS NOT NULL AND (
  NEW.resource_id IS NULL OR
  NOT EXISTS (
    SELECT 1
      FROM resource_roles rr
     WHERE rr.resource_id = NEW.resource_id
       AND rr.role = NEW.assignment_role
  )
)
BEGIN
  SELECT RAISE(ABORT, 'task assignment role is not held by resource');
END;

CREATE TRIGGER resource_roles_assignment_delete_guard
BEFORE DELETE ON resource_roles
WHEN EXISTS (
  SELECT 1
    FROM task_assignments a
   WHERE a.resource_id = OLD.resource_id
     AND a.assignment_role = OLD.role
)
BEGIN
  SELECT RAISE(ABORT, 'resource role is used by task assignment');
END;
