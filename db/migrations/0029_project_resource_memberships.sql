-- Explicit participation only; existing assignments and responsibility roles remain independent.
CREATE TABLE project_resource_memberships (
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  resource_id INTEGER NOT NULL REFERENCES resources(id) ON DELETE RESTRICT,
  created_at TEXT NOT NULL CHECK (length(created_at) > 0),
  PRIMARY KEY (project_id, resource_id)
) WITHOUT ROWID, STRICT;
CREATE INDEX project_resource_memberships_resource_idx
  ON project_resource_memberships(resource_id, project_id);
