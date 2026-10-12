-- Issue #615: explicit shared process catalog; never infer mappings from legacy names.
CREATE TABLE process_catalog_state (
  id INTEGER PRIMARY KEY CHECK(id=1), revision INTEGER NOT NULL CHECK(revision>=1),
  updated_at TEXT NOT NULL CHECK(length(updated_at)>0)
) STRICT;
INSERT INTO process_catalog_state VALUES(1,1,strftime('%Y-%m-%dT%H:%M:%fZ','now'));

CREATE TABLE process_types (
  id INTEGER PRIMARY KEY, public_id TEXT NOT NULL UNIQUE,
  code TEXT NOT NULL UNIQUE CHECK(length(trim(code)) BETWEEN 1 AND 64),
  name TEXT NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 200),
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN(0,1)),
  sort_order INTEGER NOT NULL DEFAULT 0 CHECK(sort_order BETWEEN 0 AND 1000000),
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
) STRICT;
CREATE TABLE product_standard_processes (
  id INTEGER PRIMARY KEY, public_id TEXT NOT NULL UNIQUE,
  product_id INTEGER NOT NULL REFERENCES project_master_items(id) ON DELETE RESTRICT,
  process_type_id INTEGER NOT NULL REFERENCES process_types(id) ON DELETE RESTRICT,
  code TEXT NOT NULL CHECK(length(trim(code)) BETWEEN 1 AND 64),
  name TEXT NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 200),
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN(0,1)),
  sort_order INTEGER NOT NULL DEFAULT 0 CHECK(sort_order BETWEEN 0 AND 1000000),
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  UNIQUE(product_id,code), UNIQUE(id,product_id,process_type_id)
) STRICT;
CREATE INDEX product_standard_processes_type_idx ON product_standard_processes(process_type_id);
CREATE TRIGGER product_standard_processes_category_insert BEFORE INSERT ON product_standard_processes
WHEN NOT EXISTS(SELECT 1 FROM project_master_items WHERE id=NEW.product_id AND category='PRODUCT')
BEGIN SELECT RAISE(ABORT,'INVALID_PROCESS_PRODUCT'); END;
CREATE TRIGGER product_standard_processes_category_update BEFORE UPDATE OF product_id ON product_standard_processes
WHEN NOT EXISTS(SELECT 1 FROM project_master_items WHERE id=NEW.product_id AND category='PRODUCT')
BEGIN SELECT RAISE(ABORT,'INVALID_PROCESS_PRODUCT'); END;

CREATE TABLE site_product_processes (
  id INTEGER PRIMARY KEY, public_id TEXT NOT NULL UNIQUE,
  business_unit_id INTEGER NOT NULL, product_id INTEGER NOT NULL, site_entity_id INTEGER NOT NULL,
  process_type_id INTEGER NOT NULL REFERENCES process_types(id) ON DELETE RESTRICT,
  standard_process_id INTEGER,
  code TEXT NOT NULL CHECK(length(trim(code)) BETWEEN 1 AND 64),
  name TEXT NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 200),
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN(0,1)),
  sort_order INTEGER NOT NULL DEFAULT 0 CHECK(sort_order BETWEEN 0 AND 1000000),
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  FOREIGN KEY(business_unit_id,product_id,site_entity_id) REFERENCES business_unit_product_sites(business_unit_id,product_id,site_entity_id) ON DELETE RESTRICT,
  FOREIGN KEY(standard_process_id,product_id,process_type_id) REFERENCES product_standard_processes(id,product_id,process_type_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  UNIQUE(business_unit_id,product_id,site_entity_id,code),
  UNIQUE(business_unit_id,product_id,site_entity_id,standard_process_id),
  UNIQUE(id,business_unit_id,product_id,site_entity_id)
) STRICT;
CREATE INDEX site_product_processes_type_idx ON site_product_processes(process_type_id);
CREATE INDEX site_product_processes_standard_idx ON site_product_processes(standard_process_id);
CREATE TABLE work_areas (
  id INTEGER PRIMARY KEY, public_id TEXT NOT NULL UNIQUE,
  occurrence_id INTEGER NOT NULL REFERENCES site_product_processes(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  code TEXT NOT NULL CHECK(length(trim(code)) BETWEEN 1 AND 64),
  name TEXT NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 200),
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN(0,1)),
  sort_order INTEGER NOT NULL DEFAULT 0 CHECK(sort_order BETWEEN 0 AND 1000000),
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  UNIQUE(occurrence_id,code), UNIQUE(occurrence_id,id)
) STRICT;
CREATE TRIGGER work_areas_no_reparent BEFORE UPDATE OF occurrence_id ON work_areas
WHEN NEW.occurrence_id<>OLD.occurrence_id
BEGIN SELECT RAISE(ABORT,'WORK_AREA_REPARENT_FORBIDDEN'); END;

CREATE TABLE project_process_occurrence_mappings (
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  project_process_id INTEGER NOT NULL, occurrence_id INTEGER NOT NULL,
  business_unit_id INTEGER NOT NULL, product_id INTEGER NOT NULL, site_entity_id INTEGER NOT NULL,
  work_area_id INTEGER, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  PRIMARY KEY(project_id,project_process_id),
  UNIQUE(project_id,project_process_id,occurrence_id),
  FOREIGN KEY(project_id,project_process_id) REFERENCES project_processes(project_id,id) ON DELETE CASCADE,
  FOREIGN KEY(occurrence_id,business_unit_id,product_id,site_entity_id) REFERENCES site_product_processes(id,business_unit_id,product_id,site_entity_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  FOREIGN KEY(occurrence_id,work_area_id) REFERENCES work_areas(occurrence_id,id) ON UPDATE RESTRICT ON DELETE RESTRICT
) STRICT;
CREATE INDEX project_process_occurrence_mappings_occurrence_idx ON project_process_occurrence_mappings(occurrence_id);
CREATE INDEX project_process_occurrence_mappings_work_area_idx ON project_process_occurrence_mappings(work_area_id);
CREATE TRIGGER process_mapping_triple_insert BEFORE INSERT ON project_process_occurrence_mappings
WHEN NOT EXISTS(SELECT 1 FROM projects WHERE id=NEW.project_id AND business_unit_id=NEW.business_unit_id AND product_id=NEW.product_id AND site_entity_id=NEW.site_entity_id)
BEGIN SELECT RAISE(ABORT,'PROJECT_PROCESS_MAPPING_TRIPLE_MISMATCH'); END;
CREATE TRIGGER process_mapping_triple_update BEFORE UPDATE ON project_process_occurrence_mappings
WHEN NOT EXISTS(SELECT 1 FROM projects WHERE id=NEW.project_id AND business_unit_id=NEW.business_unit_id AND product_id=NEW.product_id AND site_entity_id=NEW.site_entity_id)
BEGIN SELECT RAISE(ABORT,'PROJECT_PROCESS_MAPPING_TRIPLE_MISMATCH'); END;
CREATE TRIGGER projects_process_mapping_triple_guard BEFORE UPDATE OF business_unit_id,product_id,site_entity_id ON projects
WHEN EXISTS(SELECT 1 FROM project_process_occurrence_mappings WHERE project_id=OLD.id AND (business_unit_id IS NOT NEW.business_unit_id OR product_id IS NOT NEW.product_id OR site_entity_id IS NOT NEW.site_entity_id))
BEGIN SELECT RAISE(ABORT,'PROJECT_PROCESS_MAPPING_IN_USE'); END;
