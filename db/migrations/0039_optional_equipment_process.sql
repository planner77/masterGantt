-- Issue #917: equipment is project-owned; its primary process is optional.
-- requires-foreign-keys-off: referenced-table-rebuild
-- The runner disables FK enforcement before BEGIN and checks the entire graph
-- before COMMIT. Keep child tables untouched, including their integer IDs.
CREATE TEMP TABLE issue917_equipment_backup AS SELECT * FROM project_equipment;
DROP TABLE project_equipment;

CREATE TABLE project_equipment (
  id INTEGER PRIMARY KEY,
  public_id TEXT NOT NULL UNIQUE,
  project_id INTEGER NOT NULL,
  process_id INTEGER,
  code TEXT NOT NULL CHECK (length(trim(code)) > 0 AND length(code) <= 64),
  name TEXT NOT NULL CHECK (length(trim(name)) > 0 AND length(name) <= 200),
  equipment_type TEXT NOT NULL CHECK (length(trim(equipment_type)) BETWEEN 1 AND 64),
  management_unit TEXT NOT NULL CHECK (management_unit IN ('unit', 'fleet')),
  quantity INTEGER NOT NULL CHECK (quantity >= 1),
  manufacturer TEXT NOT NULL DEFAULT '',
  model TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '' CHECK (length(description) <= 4000),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at TEXT NOT NULL CHECK (length(created_at) > 0),
  updated_at TEXT NOT NULL CHECK (length(updated_at) > 0),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (project_id, process_id)
    REFERENCES project_processes(project_id, id)
    ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED,
  FOREIGN KEY (equipment_type) REFERENCES logistics_equipment_types(code)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  UNIQUE (project_id, id),
  UNIQUE (project_id, code),
  CHECK (management_unit <> 'unit' OR quantity = 1),
  CHECK (management_unit <> 'fleet' OR quantity >= 1)
) STRICT;

CREATE INDEX project_equipment_project_process_idx
  ON project_equipment(project_id, process_id);

INSERT INTO project_equipment (
  id, public_id, project_id, process_id, code, name, equipment_type,
  management_unit, quantity, manufacturer, model, description, active, created_at, updated_at
)
SELECT id, public_id, project_id, process_id, code, name, equipment_type,
  management_unit, quantity, manufacturer, model, description, active, created_at, updated_at
FROM issue917_equipment_backup;
DROP TABLE issue917_equipment_backup;

-- SQL NULL must not bypass the legacy Target's process consistency guard.
CREATE TRIGGER equipment_target_process_guard BEFORE UPDATE OF process_id ON project_equipment
WHEN EXISTS(SELECT 1 FROM logistics_target_members m JOIN logistics_targets t
 ON t.project_id=m.project_id AND t.id=m.target_id
 WHERE m.project_id=OLD.project_id AND m.equipment_id=OLD.id
 AND (t.scope<>'process' OR t.project_process_id IS NOT NEW.process_id))
BEGIN SELECT RAISE(ABORT,'TARGET_EQUIPMENT_PROCESS_MISMATCH'); END;

CREATE TRIGGER equipment_binding_coverage_guard BEFORE UPDATE OF quantity ON project_equipment
WHEN EXISTS(SELECT 1 FROM logistics_target_members m JOIN task_target_binding_members bm
 ON bm.project_id=m.project_id AND bm.target_id=m.target_id AND bm.member_id=m.id
 WHERE m.project_id=OLD.project_id AND m.equipment_id=OLD.id AND bm.coverage>NEW.quantity)
BEGIN SELECT RAISE(ABORT,'TARGET_COVERAGE_EXCEEDS_QUANTITY'); END;

