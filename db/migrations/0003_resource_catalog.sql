CREATE TABLE resource_catalog_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  revision INTEGER NOT NULL CHECK (revision >= 1),
  updated_at TEXT NOT NULL CHECK (length(updated_at) > 0)
) STRICT;

INSERT INTO resource_catalog_state (id, revision, updated_at)
VALUES (1, 1, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));

CREATE TABLE resources (
  id INTEGER PRIMARY KEY,
  public_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 200),
  code TEXT UNIQUE CHECK (code IS NULL OR length(trim(code)) BETWEEN 1 AND 64),
  description TEXT NOT NULL DEFAULT '' CHECK (length(description) <= 2000),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at TEXT NOT NULL CHECK (length(created_at) > 0),
  updated_at TEXT NOT NULL CHECK (length(updated_at) > 0)
) STRICT;

CREATE TABLE resource_groups (
  id INTEGER PRIMARY KEY,
  public_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 200),
  code TEXT UNIQUE CHECK (code IS NULL OR length(trim(code)) BETWEEN 1 AND 64),
  description TEXT NOT NULL DEFAULT '' CHECK (length(description) <= 2000),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at TEXT NOT NULL CHECK (length(created_at) > 0),
  updated_at TEXT NOT NULL CHECK (length(updated_at) > 0)
) STRICT;

CREATE TABLE resource_group_members (
  group_id INTEGER NOT NULL,
  resource_id INTEGER NOT NULL,
  created_at TEXT NOT NULL CHECK (length(created_at) > 0),
  PRIMARY KEY (group_id, resource_id),
  FOREIGN KEY (group_id) REFERENCES resource_groups(id) ON DELETE RESTRICT,
  FOREIGN KEY (resource_id) REFERENCES resources(id) ON DELETE RESTRICT
) WITHOUT ROWID, STRICT;

CREATE TABLE resource_catalog_admin_sessions (
  id INTEGER PRIMARY KEY,
  token_hash BLOB NOT NULL UNIQUE CHECK (length(token_hash) = 32),
  created_at TEXT NOT NULL CHECK (length(created_at) > 0),
  expires_at TEXT NOT NULL CHECK (length(expires_at) > 0),
  revoked_at TEXT
) STRICT;

CREATE TABLE task_assignments (
  id INTEGER PRIMARY KEY,
  public_id TEXT NOT NULL UNIQUE,
  project_id INTEGER NOT NULL,
  task_id INTEGER NOT NULL,
  resource_id INTEGER,
  group_id INTEGER,
  created_at TEXT NOT NULL CHECK (length(created_at) > 0),
  updated_at TEXT NOT NULL CHECK (length(updated_at) > 0),
  FOREIGN KEY (project_id, task_id)
    REFERENCES tasks(project_id, id) ON DELETE CASCADE,
  FOREIGN KEY (resource_id) REFERENCES resources(id) ON DELETE RESTRICT,
  FOREIGN KEY (group_id) REFERENCES resource_groups(id) ON DELETE RESTRICT,
  CHECK ((resource_id IS NOT NULL) <> (group_id IS NOT NULL))
) STRICT;

CREATE UNIQUE INDEX task_assignments_resource_unique_idx
  ON task_assignments(project_id, task_id, resource_id)
  WHERE resource_id IS NOT NULL;
CREATE UNIQUE INDEX task_assignments_group_unique_idx
  ON task_assignments(project_id, task_id, group_id)
  WHERE group_id IS NOT NULL;
CREATE INDEX task_assignments_project_task_idx
  ON task_assignments(project_id, task_id);
CREATE INDEX task_assignments_resource_idx
  ON task_assignments(resource_id)
  WHERE resource_id IS NOT NULL;
CREATE INDEX task_assignments_group_idx
  ON task_assignments(group_id)
  WHERE group_id IS NOT NULL;
CREATE INDEX resource_group_members_resource_idx
  ON resource_group_members(resource_id, group_id);
CREATE INDEX resource_admin_sessions_expiry_idx
  ON resource_catalog_admin_sessions(expires_at, revoked_at);
