-- Issue #617: explicit WBS bindings, with project/Target-scoped subset references.
CREATE TABLE task_target_bindings (
  id INTEGER PRIMARY KEY,
  public_id TEXT NOT NULL UNIQUE,
  project_id INTEGER NOT NULL,
  task_id INTEGER NOT NULL,
  target_id INTEGER NOT NULL,
  scope TEXT NOT NULL DEFAULT 'self' CHECK(scope IN ('self','subtree')),
  selection TEXT NOT NULL CHECK(selection IN ('whole','subset')),
  anchor_member_id INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(project_id,task_id,target_id),
  UNIQUE(project_id,id,target_id),
  FOREIGN KEY(project_id,task_id) REFERENCES tasks(project_id,id) ON DELETE CASCADE,
  FOREIGN KEY(project_id,target_id) REFERENCES logistics_targets(project_id,id) ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED,
  FOREIGN KEY(project_id,id,target_id,anchor_member_id)
    REFERENCES task_target_binding_members(project_id,binding_id,target_id,member_id)
    DEFERRABLE INITIALLY DEFERRED,
  CHECK((selection='whole' AND anchor_member_id IS NULL)
    OR (selection='subset' AND anchor_member_id IS NOT NULL))
) STRICT;
CREATE INDEX task_target_binding_target_idx ON task_target_bindings(project_id,target_id);
CREATE TABLE task_target_binding_members (
  id INTEGER PRIMARY KEY,
  project_id INTEGER NOT NULL,
  binding_id INTEGER NOT NULL,
  target_id INTEGER NOT NULL,
  member_id INTEGER NOT NULL,
  coverage INTEGER CHECK(coverage IS NULL OR coverage > 0),
  UNIQUE(binding_id,member_id),
  UNIQUE(project_id,binding_id,target_id,member_id),
  FOREIGN KEY(project_id,binding_id,target_id)
    REFERENCES task_target_bindings(project_id,id,target_id) ON DELETE CASCADE,
  FOREIGN KEY(project_id,target_id,member_id)
    REFERENCES logistics_target_members(project_id,target_id,id) ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED
) STRICT;
CREATE INDEX task_target_binding_member_usage_idx ON task_target_binding_members(project_id,target_id,member_id);
CREATE TRIGGER task_target_subtree_insert BEFORE INSERT ON task_target_bindings
WHEN NEW.scope='subtree' AND NOT EXISTS(SELECT 1 FROM tasks WHERE project_id=NEW.project_id AND id=NEW.task_id AND type='summary')
BEGIN SELECT RAISE(ABORT,'SUBTREE_REQUIRES_SUMMARY'); END;
CREATE TRIGGER task_target_subtree_update BEFORE UPDATE OF scope,task_id ON task_target_bindings
WHEN NEW.scope='subtree' AND NOT EXISTS(SELECT 1 FROM tasks WHERE project_id=NEW.project_id AND id=NEW.task_id AND type='summary')
BEGIN SELECT RAISE(ABORT,'SUBTREE_REQUIRES_SUMMARY'); END;
CREATE TRIGGER task_target_summary_type_guard BEFORE UPDATE OF type ON tasks
WHEN NEW.type<>'summary' AND EXISTS(SELECT 1 FROM task_target_bindings WHERE project_id=OLD.project_id AND task_id=OLD.id AND scope='subtree')
BEGIN SELECT RAISE(ABORT,'SUBTREE_REQUIRES_SUMMARY'); END;
CREATE TRIGGER task_target_member_insert BEFORE INSERT ON task_target_binding_members
WHEN NOT EXISTS(SELECT 1 FROM task_target_bindings b WHERE b.project_id=NEW.project_id AND b.id=NEW.binding_id AND b.target_id=NEW.target_id AND b.selection='subset')
BEGIN SELECT RAISE(ABORT,'WHOLE_MEMBERS_MUST_BE_EMPTY'); END;
CREATE TRIGGER task_target_member_update BEFORE UPDATE ON task_target_binding_members
BEGIN SELECT RAISE(ABORT,'BINDING_MEMBER_IMMUTABLE'); END;
CREATE TRIGGER task_target_coverage_insert BEFORE INSERT ON task_target_binding_members
WHEN NEW.coverage IS NOT NULL AND NOT EXISTS(
 SELECT 1 FROM logistics_target_members m JOIN project_equipment e ON e.project_id=m.project_id AND e.id=m.equipment_id
 WHERE m.project_id=NEW.project_id AND m.target_id=NEW.target_id AND m.id=NEW.member_id AND NEW.coverage<=e.quantity)
BEGIN SELECT RAISE(ABORT,'TARGET_COVERAGE_EXCEEDS_QUANTITY'); END;
CREATE TRIGGER equipment_binding_coverage_guard BEFORE UPDATE OF quantity ON project_equipment
WHEN EXISTS(SELECT 1 FROM logistics_target_members m JOIN task_target_binding_members bm
 ON bm.project_id=m.project_id AND bm.target_id=m.target_id AND bm.member_id=m.id
 WHERE m.project_id=OLD.project_id AND m.equipment_id=OLD.id AND bm.coverage>NEW.quantity)
BEGIN SELECT RAISE(ABORT,'TARGET_COVERAGE_EXCEEDS_QUANTITY'); END;

-- Preserve project graph cascade while preventing isolated deletion at COMMIT.
-- Binding identity survives Task moves and cannot be reassigned by SQL updates.
CREATE TRIGGER task_target_binding_identity_guard BEFORE UPDATE OF public_id,project_id,task_id,target_id ON task_target_bindings
WHEN NEW.public_id<>OLD.public_id OR NEW.project_id<>OLD.project_id OR NEW.task_id<>OLD.task_id OR NEW.target_id<>OLD.target_id
BEGIN SELECT RAISE(ABORT,'TARGET_BINDING_IDENTITY_IMMUTABLE'); END;
CREATE TRIGGER task_target_binding_selection_guard BEFORE UPDATE OF selection ON task_target_bindings
WHEN NEW.selection='whole' AND EXISTS(SELECT 1 FROM task_target_binding_members WHERE project_id=OLD.project_id AND binding_id=OLD.id)
BEGIN SELECT RAISE(ABORT,'WHOLE_MEMBERS_MUST_BE_EMPTY'); END;
