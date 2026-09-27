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
  FOREIGN KEY (resource_id)
    REFERENCES resources(id) ON DELETE NO ACTION,
  UNIQUE (project_id, equipment_id, resource_id, role),
  CHECK (is_primary = 0 OR role = 'owner')
) STRICT;

CREATE INDEX project_equipment_resource_roles_resource_idx
  ON project_equipment_resource_roles(resource_id);
CREATE INDEX project_equipment_resource_roles_equipment_idx
  ON project_equipment_resource_roles(project_id, equipment_id);
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
  FOREIGN KEY (resource_id)
    REFERENCES resources(id) ON DELETE NO ACTION,
  UNIQUE (project_id, system_id, resource_id, role),
  CHECK (is_primary = 0 OR role = 'pi')
) STRICT;

CREATE INDEX project_system_resource_roles_resource_idx
  ON project_system_resource_roles(resource_id);
CREATE INDEX project_system_resource_roles_system_idx
  ON project_system_resource_roles(project_id, system_id);
CREATE UNIQUE INDEX system_resource_one_primary
  ON project_system_resource_roles(project_id, system_id)
  WHERE is_primary = 1;
