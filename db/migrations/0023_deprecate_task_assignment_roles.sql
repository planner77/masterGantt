-- Issue #485: Global Resource Role is the single role authority.
-- Keep the legacy column for SQLite/backward compatibility, but remove all
-- Task-specific role data and guards so assignments no longer own a role.
UPDATE task_assignments
SET assignment_role = NULL
WHERE assignment_role IS NOT NULL;

DROP INDEX IF EXISTS task_assignments_resource_role_idx;
DROP TRIGGER IF EXISTS task_assignments_role_insert_guard;
DROP TRIGGER IF EXISTS task_assignments_role_update_guard;
DROP TRIGGER IF EXISTS resource_roles_assignment_delete_guard;
