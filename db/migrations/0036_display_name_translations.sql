-- Issue #866: owner-specific additive display names, no original-name backfill.
CREATE TABLE project_master_items_translations (
  owner_id INTEGER NOT NULL REFERENCES project_master_items(id) ON DELETE CASCADE,
  locale TEXT NOT NULL CHECK(locale IN ('ko','en','vi')),
  name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 200),
  PRIMARY KEY (owner_id, locale)
) STRICT;
CREATE TABLE logistics_equipment_types_translations (
  owner_code TEXT NOT NULL REFERENCES logistics_equipment_types(code) ON DELETE CASCADE,
  locale TEXT NOT NULL CHECK(locale IN ('ko','en','vi')),
  name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 200),
  PRIMARY KEY (owner_code, locale)
) STRICT;
CREATE TABLE logistics_system_types_translations (
  owner_code TEXT NOT NULL REFERENCES logistics_system_types(code) ON DELETE CASCADE,
  locale TEXT NOT NULL CHECK(locale IN ('ko','en','vi')),
  name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 200),
  PRIMARY KEY (owner_code, locale)
) STRICT;
CREATE TABLE process_types_translations (
  owner_id INTEGER NOT NULL REFERENCES process_types(id) ON DELETE CASCADE,
  locale TEXT NOT NULL CHECK(locale IN ('ko','en','vi')),
  name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 200),
  PRIMARY KEY (owner_id, locale)
) STRICT;
CREATE TABLE product_standard_processes_translations (
  owner_id INTEGER NOT NULL REFERENCES product_standard_processes(id) ON DELETE CASCADE,
  locale TEXT NOT NULL CHECK(locale IN ('ko','en','vi')),
  name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 200),
  PRIMARY KEY (owner_id, locale)
) STRICT;
CREATE TABLE site_product_processes_translations (
  owner_id INTEGER NOT NULL REFERENCES site_product_processes(id) ON DELETE CASCADE,
  locale TEXT NOT NULL CHECK(locale IN ('ko','en','vi')),
  name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 200),
  PRIMARY KEY (owner_id, locale)
) STRICT;
CREATE TABLE work_areas_translations (
  owner_id INTEGER NOT NULL REFERENCES work_areas(id) ON DELETE CASCADE,
  locale TEXT NOT NULL CHECK(locale IN ('ko','en','vi')),
  name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 200),
  PRIMARY KEY (owner_id, locale)
) STRICT;
CREATE TABLE project_work_areas_translations (
  owner_id INTEGER NOT NULL REFERENCES project_work_areas(id) ON DELETE CASCADE,
  locale TEXT NOT NULL CHECK(locale IN ('ko','en','vi')),
  name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 200),
  PRIMARY KEY (owner_id, locale)
) STRICT;
CREATE TABLE project_processes_translations (
  owner_id INTEGER NOT NULL REFERENCES project_processes(id) ON DELETE CASCADE,
  locale TEXT NOT NULL CHECK(locale IN ('ko','en','vi')),
  name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 200),
  PRIMARY KEY (owner_id, locale)
) STRICT;
CREATE TABLE project_equipment_translations (
  owner_id INTEGER NOT NULL REFERENCES project_equipment(id) ON DELETE CASCADE,
  locale TEXT NOT NULL CHECK(locale IN ('ko','en','vi')),
  name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 200),
  PRIMARY KEY (owner_id, locale)
) STRICT;
CREATE TABLE project_logistics_systems_translations (
  owner_id INTEGER NOT NULL REFERENCES project_logistics_systems(id) ON DELETE CASCADE,
  locale TEXT NOT NULL CHECK(locale IN ('ko','en','vi')),
  name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 200),
  PRIMARY KEY (owner_id, locale)
) STRICT;
CREATE TABLE resource_groups_translations (
  owner_id INTEGER NOT NULL REFERENCES resource_groups(id) ON DELETE CASCADE,
  locale TEXT NOT NULL CHECK(locale IN ('ko','en','vi')),
  name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 200),
  PRIMARY KEY (owner_id, locale)
) STRICT;
