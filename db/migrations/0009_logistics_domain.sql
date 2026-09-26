CREATE TABLE project_processes (
  id INTEGER PRIMARY KEY,
  public_id TEXT NOT NULL UNIQUE,
  project_id INTEGER NOT NULL,
  code TEXT NOT NULL CHECK (length(trim(code)) > 0 AND length(code) <= 64),
  name TEXT NOT NULL CHECK (length(trim(name)) > 0 AND length(name) <= 200),
  parent_id INTEGER,
  sort_order INTEGER NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at TEXT NOT NULL CHECK (length(created_at) > 0),
  updated_at TEXT NOT NULL CHECK (length(updated_at) > 0),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (project_id, parent_id)
    REFERENCES project_processes(project_id, id)
    ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED,
  UNIQUE (project_id, id),
  UNIQUE (project_id, code)
) STRICT;

CREATE INDEX project_processes_project_parent_idx
  ON project_processes(project_id, parent_id);
CREATE INDEX project_processes_project_sort_order_idx
  ON project_processes(project_id, sort_order);

CREATE TABLE project_equipment (
  id INTEGER PRIMARY KEY,
  public_id TEXT NOT NULL UNIQUE,
  project_id INTEGER NOT NULL,
  process_id INTEGER NOT NULL,
  code TEXT NOT NULL CHECK (length(trim(code)) > 0 AND length(code) <= 64),
  name TEXT NOT NULL CHECK (length(trim(name)) > 0 AND length(name) <= 200),
  equipment_type TEXT NOT NULL CHECK (
    equipment_type IN ('stocker', 'agv', 'amr', 'oht', 'conveyor', 'other')
  ),
  management_unit TEXT NOT NULL CHECK (
    management_unit IN ('unit', 'fleet')
  ),
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
  system_type TEXT NOT NULL CHECK (
    system_type IN ('scs', 'acs', 'ocs', 'lcs', 'mcs', 'other')
  ),
  layer TEXT NOT NULL CHECK (layer IN ('controller', 'coordinator')),
  scope TEXT NOT NULL CHECK (scope IN ('project', 'processes')),
  vendor TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '' CHECK (length(description) <= 4000),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at TEXT NOT NULL CHECK (length(created_at) > 0),
  updated_at TEXT NOT NULL CHECK (length(updated_at) > 0),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  UNIQUE (project_id, id),
  UNIQUE (project_id, code)
) STRICT;

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

CREATE INDEX project_system_processes_system_idx
  ON project_system_processes(project_id, system_id);
CREATE INDEX project_system_processes_process_idx
  ON project_system_processes(project_id, process_id);

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

CREATE INDEX project_equipment_systems_equipment_idx
  ON project_equipment_systems(project_id, equipment_id);
CREATE INDEX project_equipment_systems_system_idx
  ON project_equipment_systems(project_id, system_id);
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

CREATE INDEX project_system_links_source_idx
  ON project_system_links(project_id, source_system_id);
CREATE INDEX project_system_links_target_idx
  ON project_system_links(project_id, target_system_id);
