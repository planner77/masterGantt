CREATE TABLE resource_roles (
  resource_id INTEGER NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('PI', 'DEVELOPER', 'EQUIPMENT_OWNER')),
  created_at TEXT NOT NULL CHECK (length(created_at) > 0),
  PRIMARY KEY (resource_id, role),
  FOREIGN KEY (resource_id) REFERENCES resources(id) ON DELETE CASCADE
) WITHOUT ROWID, STRICT;

CREATE INDEX resource_roles_role_resource_idx
  ON resource_roles(role, resource_id);
