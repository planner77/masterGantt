-- 0015_logistics_type_catalog.sql
-- Global managed equipment/system type catalogs and dedicated logistics catalog admin (Issue #280).

CREATE TABLE logistics_type_catalog_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  revision INTEGER NOT NULL CHECK (revision >= 1),
  updated_at TEXT NOT NULL CHECK (length(updated_at) > 0)
) STRICT;

INSERT INTO logistics_type_catalog_state (id, revision, updated_at)
VALUES (1, 1, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));

CREATE TABLE logistics_equipment_types (
  code TEXT PRIMARY KEY CHECK (length(trim(code)) BETWEEN 1 AND 64),
  name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 200),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  sort_order INTEGER NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  created_at TEXT NOT NULL CHECK (length(created_at) > 0),
  updated_at TEXT NOT NULL CHECK (length(updated_at) > 0)
) STRICT;

CREATE TABLE logistics_system_types (
  code TEXT PRIMARY KEY CHECK (length(trim(code)) BETWEEN 1 AND 64),
  name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 200),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  sort_order INTEGER NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  created_at TEXT NOT NULL CHECK (length(created_at) > 0),
  updated_at TEXT NOT NULL CHECK (length(updated_at) > 0)
) STRICT;

INSERT INTO logistics_equipment_types (code, name, active, sort_order, created_at, updated_at) VALUES
  ('stocker', 'Stocker (보관설비)', 1, 10, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('agv', 'AGV (무인운반차)', 1, 20, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('amr', 'AMR (자율이동로봇)', 1, 30, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('oht', 'OHT (천장운반차)', 1, 40, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('conveyor', 'Conveyor (컨베이어)', 1, 50, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('other', '기타 설비', 1, 60, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));

INSERT INTO logistics_system_types (code, name, active, sort_order, created_at, updated_at) VALUES
  ('mcs', 'MCS (통합 조율 시스템)', 1, 10, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('acs', 'ACS (AGV/AMR 제어 시스템)', 1, 20, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('scs', 'SCS (Stocker 제어 시스템)', 1, 30, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('ocs', 'OCS (OHT 제어 시스템)', 1, 40, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('lcs', 'LCS (반송 제어 시스템)', 1, 50, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('other', '기타 시스템', 1, 60, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));

CREATE TABLE logistics_catalog_admin_sessions (
  id INTEGER PRIMARY KEY,
  token_hash BLOB NOT NULL UNIQUE CHECK (length(token_hash) = 32),
  created_at TEXT NOT NULL CHECK (length(created_at) > 0),
  expires_at TEXT NOT NULL CHECK (length(expires_at) > 0),
  revoked_at TEXT
) STRICT;

CREATE INDEX logistics_catalog_admin_sessions_expiry_idx
  ON logistics_catalog_admin_sessions(expires_at, revoked_at);

CREATE TABLE logistics_catalog_admin_credentials (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  password_kdf TEXT NOT NULL CHECK (password_kdf = 'scrypt'),
  password_salt BLOB NOT NULL CHECK (length(password_salt) >= 16),
  password_hash BLOB NOT NULL CHECK (length(password_hash) = 32),
  updated_at TEXT NOT NULL CHECK (length(updated_at) > 0)
) STRICT;

-- Rebuild the logistics parent tables so type values are catalog-backed rather
-- than constrained by the fixed allowlists introduced in migration 0009.
-- Child rows are staged first because foreign_keys remains enabled throughout
-- the migration transaction.
CREATE TEMP TABLE issue280_equipment_backup AS SELECT * FROM project_equipment;
CREATE TEMP TABLE issue280_system_backup AS SELECT * FROM project_logistics_systems;
CREATE TEMP TABLE issue280_system_processes_backup AS SELECT * FROM project_system_processes;
CREATE TEMP TABLE issue280_equipment_systems_backup AS SELECT * FROM project_equipment_systems;
CREATE TEMP TABLE issue280_system_links_backup AS SELECT * FROM project_system_links;
CREATE TEMP TABLE issue280_equipment_roles_backup AS SELECT * FROM project_equipment_resource_roles;
CREATE TEMP TABLE issue280_system_roles_backup AS SELECT * FROM project_system_resource_roles;
CREATE TEMP TABLE issue280_task_equipment_links_backup AS SELECT * FROM task_equipment_links;
CREATE TEMP TABLE issue280_task_system_links_backup AS SELECT * FROM task_system_links;

DROP TABLE task_equipment_links;
DROP TABLE task_system_links;
DROP TABLE project_equipment_resource_roles;
DROP TABLE project_system_resource_roles;
DROP TABLE project_equipment_systems;
DROP TABLE project_system_processes;
DROP TABLE project_system_links;
DROP TABLE project_equipment;
DROP TABLE project_logistics_systems;

CREATE TABLE project_equipment (
  id INTEGER PRIMARY KEY,
  public_id TEXT NOT NULL UNIQUE,
  project_id INTEGER NOT NULL,
  process_id INTEGER NOT NULL,
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

CREATE TABLE project_logistics_systems (
  id INTEGER PRIMARY KEY,
  public_id TEXT NOT NULL UNIQUE,
  project_id INTEGER NOT NULL,
  code TEXT NOT NULL CHECK (length(trim(code)) > 0 AND length(code) <= 64),
  name TEXT NOT NULL CHECK (length(trim(name)) > 0 AND length(name) <= 200),
  system_type TEXT NOT NULL CHECK (length(trim(system_type)) BETWEEN 1 AND 64),
  layer TEXT NOT NULL CHECK (layer IN ('controller', 'coordinator')),
  scope TEXT NOT NULL CHECK (scope IN ('project', 'processes')),
  vendor TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '' CHECK (length(description) <= 4000),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at TEXT NOT NULL CHECK (length(created_at) > 0),
  updated_at TEXT NOT NULL CHECK (length(updated_at) > 0),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (system_type) REFERENCES logistics_system_types(code)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  UNIQUE (project_id, id),
  UNIQUE (project_id, code)
) STRICT;

INSERT INTO project_equipment (
  id, public_id, project_id, process_id, code, name, equipment_type,
  management_unit, quantity, manufacturer, model, description, active,
  created_at, updated_at
)
SELECT
  id, public_id, project_id, process_id, code, name, equipment_type,
  management_unit, quantity, manufacturer, model, description, active,
  created_at, updated_at
FROM issue280_equipment_backup;

INSERT INTO project_logistics_systems (
  id, public_id, project_id, code, name, system_type, layer, scope,
  vendor, description, active, created_at, updated_at
)
SELECT
  id, public_id, project_id, code, name, system_type, layer, scope,
  vendor, description, active, created_at, updated_at
FROM issue280_system_backup;

CREATE TABLE project_system_processes (
  id INTEGER PRIMARY KEY,
  project_id INTEGER NOT NULL,
  system_id INTEGER NOT NULL,
  process_id INTEGER NOT NULL,
  created_at TEXT NOT NULL CHECK (length(created_at) > 0),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (project_id, system_id)
    REFERENCES project_logistics_systems(project_id, id) ON DELETE CASCADE,
  FOREIGN KEY (project_id, process_id)
    REFERENCES project_processes(project_id, id) ON DELETE CASCADE,
  UNIQUE (project_id, system_id, process_id)
) STRICT;
CREATE INDEX project_system_processes_system_idx ON project_system_processes(project_id, system_id);
CREATE INDEX project_system_processes_process_idx ON project_system_processes(project_id, process_id);

CREATE TABLE project_equipment_systems (
  id INTEGER PRIMARY KEY,
  project_id INTEGER NOT NULL,
  equipment_id INTEGER NOT NULL,
  system_id INTEGER NOT NULL,
  control_role TEXT NOT NULL CHECK (control_role IN ('primary', 'supporting')),
  created_at TEXT NOT NULL CHECK (length(created_at) > 0),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (project_id, equipment_id)
    REFERENCES project_equipment(project_id, id) ON DELETE CASCADE,
  FOREIGN KEY (project_id, system_id)
    REFERENCES project_logistics_systems(project_id, id) ON DELETE CASCADE,
  UNIQUE (project_id, equipment_id, system_id)
) STRICT;
CREATE INDEX project_equipment_systems_equipment_idx ON project_equipment_systems(project_id, equipment_id);
CREATE INDEX project_equipment_systems_system_idx ON project_equipment_systems(project_id, system_id);
CREATE UNIQUE INDEX equipment_systems_one_primary
  ON project_equipment_systems(project_id, equipment_id)
  WHERE control_role = 'primary';

CREATE TABLE project_system_links (
  id INTEGER PRIMARY KEY,
  project_id INTEGER NOT NULL,
  source_system_id INTEGER NOT NULL,
  target_system_id INTEGER NOT NULL,
  relation_type TEXT NOT NULL CHECK (relation_type = 'coordinates'),
  created_at TEXT NOT NULL CHECK (length(created_at) > 0),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (project_id, source_system_id)
    REFERENCES project_logistics_systems(project_id, id) ON DELETE CASCADE,
  FOREIGN KEY (project_id, target_system_id)
    REFERENCES project_logistics_systems(project_id, id) ON DELETE CASCADE,
  UNIQUE (project_id, source_system_id, target_system_id),
  CHECK (source_system_id <> target_system_id)
) STRICT;
CREATE INDEX project_system_links_source_idx ON project_system_links(project_id, source_system_id);
CREATE INDEX project_system_links_target_idx ON project_system_links(project_id, target_system_id);

CREATE TABLE project_equipment_resource_roles (
  id INTEGER PRIMARY KEY,
  project_id INTEGER NOT NULL,
  equipment_id INTEGER NOT NULL,
  resource_id INTEGER NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner', 'contributor')),
  is_primary INTEGER NOT NULL DEFAULT 0 CHECK (is_primary IN (0, 1)),
  created_at TEXT NOT NULL CHECK (length(created_at) > 0),
  updated_at TEXT NOT NULL CHECK (length(updated_at) > 0),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (project_id, equipment_id)
    REFERENCES project_equipment(project_id, id) ON DELETE CASCADE,
  FOREIGN KEY (resource_id) REFERENCES resources(id) ON DELETE NO ACTION,
  UNIQUE (project_id, equipment_id, resource_id, role),
  CHECK (is_primary = 0 OR role = 'owner')
) STRICT;
CREATE INDEX project_equipment_resource_roles_resource_idx ON project_equipment_resource_roles(resource_id);
CREATE INDEX project_equipment_resource_roles_equipment_idx ON project_equipment_resource_roles(project_id, equipment_id);
CREATE UNIQUE INDEX equipment_resource_one_primary
  ON project_equipment_resource_roles(project_id, equipment_id)
  WHERE is_primary = 1;

CREATE TABLE project_system_resource_roles (
  id INTEGER PRIMARY KEY,
  project_id INTEGER NOT NULL,
  system_id INTEGER NOT NULL,
  resource_id INTEGER NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('pi', 'developer')),
  is_primary INTEGER NOT NULL DEFAULT 0 CHECK (is_primary IN (0, 1)),
  created_at TEXT NOT NULL CHECK (length(created_at) > 0),
  updated_at TEXT NOT NULL CHECK (length(updated_at) > 0),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (project_id, system_id)
    REFERENCES project_logistics_systems(project_id, id) ON DELETE CASCADE,
  FOREIGN KEY (resource_id) REFERENCES resources(id) ON DELETE NO ACTION,
  UNIQUE (project_id, system_id, resource_id, role),
  CHECK (is_primary = 0 OR role = 'pi')
) STRICT;
CREATE INDEX project_system_resource_roles_resource_idx ON project_system_resource_roles(resource_id);
CREATE INDEX project_system_resource_roles_system_idx ON project_system_resource_roles(project_id, system_id);
CREATE UNIQUE INDEX system_resource_one_primary
  ON project_system_resource_roles(project_id, system_id)
  WHERE is_primary = 1;

CREATE TABLE task_equipment_links (
  id INTEGER PRIMARY KEY,
  project_id INTEGER NOT NULL,
  task_id INTEGER NOT NULL,
  equipment_id INTEGER NOT NULL,
  scope TEXT NOT NULL CHECK (scope IN ('self', 'subtree')),
  created_at TEXT NOT NULL CHECK (length(created_at) > 0),
  updated_at TEXT NOT NULL CHECK (length(updated_at) > 0),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (project_id, task_id) REFERENCES tasks(project_id, id) ON DELETE CASCADE,
  FOREIGN KEY (project_id, equipment_id)
    REFERENCES project_equipment(project_id, id)
    ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED,
  UNIQUE (project_id, task_id, equipment_id)
) STRICT;
CREATE INDEX task_equipment_links_equipment_idx ON task_equipment_links(project_id, equipment_id);
CREATE INDEX task_equipment_links_task_idx ON task_equipment_links(project_id, task_id);

CREATE TABLE task_system_links (
  id INTEGER PRIMARY KEY,
  project_id INTEGER NOT NULL,
  task_id INTEGER NOT NULL,
  system_id INTEGER NOT NULL,
  scope TEXT NOT NULL CHECK (scope IN ('self', 'subtree')),
  created_at TEXT NOT NULL CHECK (length(created_at) > 0),
  updated_at TEXT NOT NULL CHECK (length(updated_at) > 0),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (project_id, task_id) REFERENCES tasks(project_id, id) ON DELETE CASCADE,
  FOREIGN KEY (project_id, system_id)
    REFERENCES project_logistics_systems(project_id, id)
    ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED,
  UNIQUE (project_id, task_id, system_id)
) STRICT;
CREATE INDEX task_system_links_system_idx ON task_system_links(project_id, system_id);
CREATE INDEX task_system_links_task_idx ON task_system_links(project_id, task_id);

INSERT INTO project_system_processes SELECT * FROM issue280_system_processes_backup;
INSERT INTO project_equipment_systems SELECT * FROM issue280_equipment_systems_backup;
INSERT INTO project_system_links SELECT * FROM issue280_system_links_backup;
INSERT INTO project_equipment_resource_roles SELECT * FROM issue280_equipment_roles_backup;
INSERT INTO project_system_resource_roles SELECT * FROM issue280_system_roles_backup;
INSERT INTO task_equipment_links SELECT * FROM issue280_task_equipment_links_backup;
INSERT INTO task_system_links SELECT * FROM issue280_task_system_links_backup;

DROP TABLE issue280_equipment_backup;
DROP TABLE issue280_system_backup;
DROP TABLE issue280_system_processes_backup;
DROP TABLE issue280_equipment_systems_backup;
DROP TABLE issue280_system_links_backup;
DROP TABLE issue280_equipment_roles_backup;
DROP TABLE issue280_system_roles_backup;
DROP TABLE issue280_task_equipment_links_backup;
DROP TABLE issue280_task_system_links_backup;
