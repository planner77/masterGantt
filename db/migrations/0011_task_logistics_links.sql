CREATE TABLE task_equipment_links (
  id INTEGER PRIMARY KEY,
  project_id INTEGER NOT NULL,
  task_id INTEGER NOT NULL,
  equipment_id INTEGER NOT NULL,
  scope TEXT NOT NULL CHECK (scope IN ('self', 'subtree')),
  created_at TEXT NOT NULL CHECK (length(created_at) > 0),
  updated_at TEXT NOT NULL CHECK (length(updated_at) > 0),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (project_id, task_id)
    REFERENCES tasks(project_id, id) ON DELETE CASCADE,
  FOREIGN KEY (project_id, equipment_id)
    REFERENCES project_equipment(project_id, id)
    ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED,
  UNIQUE (project_id, task_id, equipment_id)
) STRICT;

CREATE INDEX task_equipment_links_equipment_idx
  ON task_equipment_links(project_id, equipment_id);
CREATE INDEX task_equipment_links_task_idx
  ON task_equipment_links(project_id, task_id);

CREATE TABLE task_system_links (
  id INTEGER PRIMARY KEY,
  project_id INTEGER NOT NULL,
  task_id INTEGER NOT NULL,
  system_id INTEGER NOT NULL,
  scope TEXT NOT NULL CHECK (scope IN ('self', 'subtree')),
  created_at TEXT NOT NULL CHECK (length(created_at) > 0),
  updated_at TEXT NOT NULL CHECK (length(updated_at) > 0),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (project_id, task_id)
    REFERENCES tasks(project_id, id) ON DELETE CASCADE,
  FOREIGN KEY (project_id, system_id)
    REFERENCES project_logistics_systems(project_id, id)
    ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED,
  UNIQUE (project_id, task_id, system_id)
) STRICT;

CREATE INDEX task_system_links_system_idx
  ON task_system_links(project_id, system_id);
CREATE INDEX task_system_links_task_idx
  ON task_system_links(project_id, task_id);
