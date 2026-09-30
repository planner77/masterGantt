CREATE TABLE project_master_catalog_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  revision INTEGER NOT NULL CHECK (revision >= 1),
  updated_at TEXT NOT NULL
) STRICT;

INSERT INTO project_master_catalog_state (id, revision, updated_at)
VALUES (1, 1, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));

CREATE TABLE project_master_items (
  id INTEGER PRIMARY KEY,
  public_id TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL CHECK (category IN ('BUSINESS_UNIT', 'PRODUCT', 'SITE_ENTITY')),
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (category, code)
) STRICT;

CREATE INDEX project_master_items_category_active_sort_idx
  ON project_master_items(category, active, sort_order, lower(name), public_id);

ALTER TABLE projects ADD COLUMN business_unit_id INTEGER REFERENCES project_master_items(id) ON DELETE RESTRICT;
ALTER TABLE projects ADD COLUMN product_id INTEGER REFERENCES project_master_items(id) ON DELETE RESTRICT;
ALTER TABLE projects ADD COLUMN site_entity_id INTEGER REFERENCES project_master_items(id) ON DELETE RESTRICT;

CREATE INDEX projects_business_unit_idx ON projects(business_unit_id);
CREATE INDEX projects_product_idx ON projects(product_id);
CREATE INDEX projects_site_entity_idx ON projects(site_entity_id);

CREATE TRIGGER projects_business_unit_category_insert
BEFORE INSERT ON projects
WHEN NEW.business_unit_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM project_master_items WHERE id = NEW.business_unit_id AND category = 'BUSINESS_UNIT')
BEGIN
  SELECT RAISE(ABORT, 'INVALID_BUSINESS_UNIT_REFERENCE');
END;

CREATE TRIGGER projects_business_unit_category_update
BEFORE UPDATE OF business_unit_id ON projects
WHEN NEW.business_unit_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM project_master_items WHERE id = NEW.business_unit_id AND category = 'BUSINESS_UNIT')
BEGIN
  SELECT RAISE(ABORT, 'INVALID_BUSINESS_UNIT_REFERENCE');
END;

CREATE TRIGGER projects_product_category_insert
BEFORE INSERT ON projects
WHEN NEW.product_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM project_master_items WHERE id = NEW.product_id AND category = 'PRODUCT')
BEGIN
  SELECT RAISE(ABORT, 'INVALID_PRODUCT_REFERENCE');
END;

CREATE TRIGGER projects_product_category_update
BEFORE UPDATE OF product_id ON projects
WHEN NEW.product_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM project_master_items WHERE id = NEW.product_id AND category = 'PRODUCT')
BEGIN
  SELECT RAISE(ABORT, 'INVALID_PRODUCT_REFERENCE');
END;

CREATE TRIGGER projects_site_entity_category_insert
BEFORE INSERT ON projects
WHEN NEW.site_entity_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM project_master_items WHERE id = NEW.site_entity_id AND category = 'SITE_ENTITY')
BEGIN
  SELECT RAISE(ABORT, 'INVALID_SITE_ENTITY_REFERENCE');
END;

CREATE TRIGGER projects_site_entity_category_update
BEFORE UPDATE OF site_entity_id ON projects
WHEN NEW.site_entity_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM project_master_items WHERE id = NEW.site_entity_id AND category = 'SITE_ENTITY')
BEGIN
  SELECT RAISE(ABORT, 'INVALID_SITE_ENTITY_REFERENCE');
END;

CREATE TABLE project_master_admin_credentials (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  password_kdf TEXT NOT NULL CHECK (password_kdf = 'scrypt'),
  password_salt BLOB NOT NULL,
  password_hash BLOB NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;

CREATE TABLE project_master_admin_sessions (
  id INTEGER PRIMARY KEY,
  token_hash BLOB NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  revoked_at TEXT
) STRICT;

CREATE INDEX project_master_admin_sessions_expiry_idx
  ON project_master_admin_sessions(expires_at, revoked_at);
