CREATE TABLE projects (
  id INTEGER PRIMARY KEY,
  public_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  description TEXT NOT NULL DEFAULT '',
  password_kdf TEXT NOT NULL CHECK (password_kdf = 'scrypt'),
  password_salt BLOB NOT NULL CHECK (length(password_salt) >= 16),
  password_hash BLOB NOT NULL CHECK (length(password_hash) > 0),
  scrypt_n INTEGER NOT NULL CHECK (scrypt_n > 1),
  scrypt_r INTEGER NOT NULL CHECK (scrypt_r > 0),
  scrypt_p INTEGER NOT NULL CHECK (scrypt_p > 0),
  scrypt_key_length INTEGER NOT NULL CHECK (scrypt_key_length > 0),
  auth_version INTEGER NOT NULL DEFAULT 1 CHECK (auth_version >= 1),
  calendar_timezone TEXT NOT NULL DEFAULT 'Asia/Seoul'
    CHECK (calendar_timezone = 'Asia/Seoul'),
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision >= 1),
  created_at TEXT NOT NULL CHECK (length(created_at) > 0),
  updated_at TEXT NOT NULL CHECK (length(updated_at) > 0)
) STRICT;

CREATE TABLE project_holidays (
  id INTEGER PRIMARY KEY,
  project_id INTEGER NOT NULL,
  holiday_date TEXT NOT NULL,
  name TEXT,
  created_at TEXT NOT NULL CHECK (length(created_at) > 0),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  UNIQUE (project_id, holiday_date)
) STRICT;

CREATE TABLE tasks (
  id INTEGER PRIMARY KEY,
  project_id INTEGER NOT NULL,
  external_id TEXT NOT NULL CHECK (
    length(external_id) > 0
    AND external_id = trim(external_id)
  ),
  public_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  type TEXT NOT NULL CHECK (type IN ('task', 'summary', 'milestone')),
  schedule_mode TEXT NOT NULL CHECK (schedule_mode IN ('auto', 'manual')),
  requested_start TEXT,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  duration INTEGER NOT NULL CHECK (duration >= 0),
  progress REAL NOT NULL CHECK (progress >= 0 AND progress <= 100),
  parent_id INTEGER,
  sort_order INTEGER NOT NULL CHECK (sort_order >= 0),
  created_at TEXT NOT NULL CHECK (length(created_at) > 0),
  updated_at TEXT NOT NULL CHECK (length(updated_at) > 0),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (project_id, parent_id)
    REFERENCES tasks(project_id, id)
    ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED,
  UNIQUE (project_id, id),
  UNIQUE (project_id, external_id),
  CHECK (type <> 'milestone' OR (duration = 0 AND start_date = end_date)),
  CHECK (type <> 'task' OR duration BETWEEN 1 AND 10000),
  CHECK (type <> 'summary' OR (schedule_mode = 'auto' AND requested_start IS NULL))
) STRICT;

CREATE TABLE links (
  id INTEGER PRIMARY KEY,
  public_id TEXT NOT NULL UNIQUE,
  project_id INTEGER NOT NULL,
  predecessor_task_id INTEGER NOT NULL,
  successor_task_id INTEGER NOT NULL,
  type TEXT NOT NULL CHECK (type = 'FS'),
  lag INTEGER NOT NULL CHECK (lag = 0),
  created_at TEXT NOT NULL CHECK (length(created_at) > 0),
  updated_at TEXT NOT NULL CHECK (length(updated_at) > 0),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (project_id, predecessor_task_id)
    REFERENCES tasks(project_id, id) ON DELETE CASCADE,
  FOREIGN KEY (project_id, successor_task_id)
    REFERENCES tasks(project_id, id) ON DELETE CASCADE,
  UNIQUE (project_id, predecessor_task_id, successor_task_id, type),
  CHECK (predecessor_task_id <> successor_task_id)
) STRICT;

CREATE TABLE edit_sessions (
  id INTEGER PRIMARY KEY,
  project_id INTEGER NOT NULL,
  token_hash BLOB NOT NULL UNIQUE CHECK (length(token_hash) = 32),
  auth_version INTEGER NOT NULL CHECK (auth_version >= 1),
  created_at TEXT NOT NULL CHECK (length(created_at) > 0),
  expires_at TEXT NOT NULL CHECK (length(expires_at) > 0),
  last_used_at TEXT,
  revoked_at TEXT,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
) STRICT;

CREATE INDEX tasks_project_parent_idx
  ON tasks(project_id, parent_id);
CREATE INDEX tasks_project_sort_order_idx
  ON tasks(project_id, sort_order);
CREATE INDEX links_project_predecessor_idx
  ON links(project_id, predecessor_task_id);
CREATE INDEX links_project_successor_idx
  ON links(project_id, successor_task_id);
CREATE INDEX edit_sessions_project_expires_idx
  ON edit_sessions(project_id, expires_at);
