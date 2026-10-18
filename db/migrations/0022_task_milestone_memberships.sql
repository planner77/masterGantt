CREATE TABLE task_milestone_memberships (
  project_id INTEGER NOT NULL,
  member_task_id INTEGER NOT NULL,
  milestone_task_id INTEGER NOT NULL,
  PRIMARY KEY (project_id, member_task_id),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (project_id, member_task_id) REFERENCES tasks(project_id, id) ON DELETE CASCADE,
  FOREIGN KEY (project_id, milestone_task_id) REFERENCES tasks(project_id, id) ON DELETE CASCADE,
  CHECK (member_task_id <> milestone_task_id)
) STRICT;
CREATE INDEX task_milestone_memberships_target_idx
  ON task_milestone_memberships(project_id, milestone_task_id);
CREATE TRIGGER task_milestone_memberships_insert_types
BEFORE INSERT ON task_milestone_memberships
WHEN NOT EXISTS (SELECT 1 FROM tasks WHERE project_id = NEW.project_id AND id = NEW.member_task_id AND type IN ('task','summary'))
  OR NOT EXISTS (SELECT 1 FROM tasks WHERE project_id = NEW.project_id AND id = NEW.milestone_task_id AND type = 'milestone')
BEGIN
  SELECT RAISE(ABORT, 'Invalid milestone membership types');
END;
CREATE TRIGGER task_milestone_memberships_update_types
BEFORE UPDATE ON task_milestone_memberships
WHEN NOT EXISTS (SELECT 1 FROM tasks WHERE project_id = NEW.project_id AND id = NEW.member_task_id AND type IN ('task','summary'))
  OR NOT EXISTS (SELECT 1 FROM tasks WHERE project_id = NEW.project_id AND id = NEW.milestone_task_id AND type = 'milestone')
BEGIN
  SELECT RAISE(ABORT, 'Invalid milestone membership types');
END;

CREATE TRIGGER tasks_membership_type_integrity
BEFORE UPDATE OF type ON tasks
WHEN (NEW.type = 'milestone' AND EXISTS (SELECT 1 FROM task_milestone_memberships WHERE project_id = NEW.project_id AND member_task_id = NEW.id))
  OR (NEW.type <> 'milestone' AND EXISTS (SELECT 1 FROM task_milestone_memberships WHERE project_id = NEW.project_id AND milestone_task_id = NEW.id))
BEGIN
  SELECT RAISE(ABORT, 'Task type conflicts with milestone membership');
END;
