-- Issue #616: project-local Target identity and typed references to existing instances.
CREATE TABLE logistics_targets (
  id INTEGER PRIMARY KEY,
  public_id TEXT NOT NULL UNIQUE,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  -- Deferred composite FK makes an empty persisted Target impossible, while
  -- permitting an atomic reparent + replacement within a single transaction.
  anchor_member_id INTEGER NOT NULL DEFAULT -1,
  code TEXT NOT NULL CHECK(length(trim(code)) BETWEEN 1 AND 64),
  name TEXT NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 200),
  scope TEXT NOT NULL CHECK(scope IN ('process','project_common')),
  project_process_id INTEGER,
  occurrence_id INTEGER,
  work_area_id INTEGER,
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
  description TEXT NOT NULL DEFAULT '' CHECK(length(description) <= 4000),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(project_id,id),
  UNIQUE(project_id,code),
  FOREIGN KEY(project_id,id,anchor_member_id)
    REFERENCES logistics_target_members(project_id,target_id,id)
    DEFERRABLE INITIALLY DEFERRED,
  FOREIGN KEY(project_id,project_process_id) REFERENCES project_processes(project_id,id) ON DELETE RESTRICT,
  FOREIGN KEY(project_id,project_process_id,occurrence_id)
    REFERENCES project_process_occurrence_mappings(project_id,project_process_id,occurrence_id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  FOREIGN KEY(occurrence_id,work_area_id) REFERENCES work_areas(occurrence_id,id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CHECK(
    (scope='process' AND project_process_id IS NOT NULL AND occurrence_id IS NOT NULL)
    OR (scope='project_common' AND project_process_id IS NULL AND occurrence_id IS NULL AND work_area_id IS NULL)
  )
) STRICT;
CREATE INDEX logistics_targets_project_scope_idx ON logistics_targets(project_id,scope,active,code);
CREATE INDEX logistics_targets_process_idx ON logistics_targets(project_id,project_process_id);
CREATE INDEX logistics_targets_work_area_idx ON logistics_targets(work_area_id);

CREATE TABLE logistics_target_members (
  id INTEGER PRIMARY KEY,
  public_id TEXT NOT NULL UNIQUE,
  project_id INTEGER NOT NULL,
  target_id INTEGER NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('equipment','system')),
  equipment_id INTEGER,
  system_id INTEGER,
  created_at TEXT NOT NULL,
  UNIQUE(project_id,target_id,id),
  FOREIGN KEY(project_id,target_id) REFERENCES logistics_targets(project_id,id) ON DELETE CASCADE,
  FOREIGN KEY(project_id,equipment_id) REFERENCES project_equipment(project_id,id) ON DELETE RESTRICT,
  FOREIGN KEY(project_id,system_id) REFERENCES project_logistics_systems(project_id,id) ON DELETE RESTRICT,
  CHECK((kind='equipment' AND equipment_id IS NOT NULL AND system_id IS NULL)
    OR (kind='system' AND equipment_id IS NULL AND system_id IS NOT NULL))
) STRICT;
CREATE UNIQUE INDEX logistics_target_member_equipment_uq ON logistics_target_members(project_id,target_id,equipment_id) WHERE equipment_id IS NOT NULL;
CREATE UNIQUE INDEX logistics_target_member_system_uq ON logistics_target_members(project_id,target_id,system_id) WHERE system_id IS NOT NULL;
CREATE INDEX logistics_target_member_equipment_usage_idx ON logistics_target_members(project_id,equipment_id);
CREATE INDEX logistics_target_member_system_usage_idx ON logistics_target_members(project_id,system_id);

-- Composite FKs block cross-project refs. Triggers protect scope and internal process consistency.
CREATE TRIGGER target_equipment_scope_insert BEFORE INSERT ON logistics_target_members
WHEN NEW.kind='equipment' AND NOT EXISTS(
 SELECT 1 FROM logistics_targets t JOIN project_equipment e
 ON e.project_id=t.project_id AND e.id=NEW.equipment_id
 WHERE t.project_id=NEW.project_id AND t.id=NEW.target_id
 AND t.scope='process' AND e.process_id=t.project_process_id)
BEGIN SELECT RAISE(ABORT,'TARGET_EQUIPMENT_PROCESS_MISMATCH'); END;
CREATE TRIGGER target_system_scope_insert BEFORE INSERT ON logistics_target_members
WHEN NEW.kind='system' AND NOT EXISTS(
 SELECT 1 FROM logistics_targets t JOIN project_logistics_systems s
 ON s.project_id=t.project_id AND s.id=NEW.system_id
 WHERE t.project_id=NEW.project_id AND t.id=NEW.target_id
 AND (t.scope='process' OR s.scope='project'))
BEGIN SELECT RAISE(ABORT,'TARGET_SYSTEM_SCOPE_MISMATCH'); END;

-- Membership is immutable: remove/re-add with a fresh member public ID.
-- Nonempty at COMMIT is enforced by logistics_targets.anchor_member_id deferred FK.
CREATE TRIGGER target_member_no_reparent BEFORE UPDATE ON logistics_target_members
BEGIN SELECT RAISE(ABORT,'TARGET_MEMBER_IMMUTABLE'); END;
CREATE TRIGGER target_process_guard BEFORE UPDATE OF scope,project_process_id ON logistics_targets
WHEN EXISTS(SELECT 1 FROM logistics_target_members m JOIN project_equipment e
  ON e.project_id=m.project_id AND e.id=m.equipment_id
  WHERE m.project_id=OLD.project_id AND m.target_id=OLD.id
  AND (NEW.scope<>'process' OR NEW.project_process_id<>e.process_id))
BEGIN SELECT RAISE(ABORT,'TARGET_EQUIPMENT_PROCESS_MISMATCH'); END;
CREATE TRIGGER equipment_target_process_guard BEFORE UPDATE OF process_id ON project_equipment
WHEN EXISTS(SELECT 1 FROM logistics_target_members m JOIN logistics_targets t
 ON t.project_id=m.project_id AND t.id=m.target_id
 WHERE m.project_id=OLD.project_id AND m.equipment_id=OLD.id
 AND (t.scope<>'process' OR t.project_process_id<>NEW.process_id))
BEGIN SELECT RAISE(ABORT,'TARGET_EQUIPMENT_PROCESS_MISMATCH'); END;
CREATE TRIGGER system_target_scope_guard BEFORE UPDATE OF scope ON project_logistics_systems
WHEN NEW.scope<>'project' AND EXISTS(SELECT 1 FROM logistics_target_members m JOIN logistics_targets t
 ON t.project_id=m.project_id AND t.id=m.target_id
 WHERE m.project_id=OLD.project_id AND m.system_id=OLD.id AND t.scope='project_common')
BEGIN SELECT RAISE(ABORT,'TARGET_SYSTEM_SCOPE_MISMATCH'); END;
