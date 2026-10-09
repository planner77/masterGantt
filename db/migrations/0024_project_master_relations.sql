-- Issue #538: reusable hierarchy mappings; never rewrite existing projects.
CREATE TABLE business_unit_products (
  business_unit_id INTEGER NOT NULL REFERENCES project_master_items(id) ON DELETE RESTRICT,
  product_id INTEGER NOT NULL REFERENCES project_master_items(id) ON DELETE RESTRICT,
  PRIMARY KEY (business_unit_id, product_id)
) STRICT;
CREATE INDEX business_unit_products_product_idx ON business_unit_products(product_id);
CREATE TABLE business_unit_product_sites (
  business_unit_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  site_entity_id INTEGER NOT NULL REFERENCES project_master_items(id) ON DELETE RESTRICT,
  PRIMARY KEY (business_unit_id, product_id, site_entity_id),
  FOREIGN KEY (business_unit_id, product_id) REFERENCES business_unit_products(business_unit_id, product_id) ON DELETE RESTRICT
) STRICT;
CREATE INDEX business_unit_product_sites_site_idx ON business_unit_product_sites(site_entity_id);
CREATE TRIGGER business_unit_products_categories_insert BEFORE INSERT ON business_unit_products
WHEN NOT EXISTS (SELECT 1 FROM project_master_items WHERE id=NEW.business_unit_id AND category='BUSINESS_UNIT')
  OR NOT EXISTS (SELECT 1 FROM project_master_items WHERE id=NEW.product_id AND category='PRODUCT')
BEGIN SELECT RAISE(ABORT,'INVALID_PROJECT_MASTER_RELATION'); END;
CREATE TRIGGER business_unit_product_sites_category_insert BEFORE INSERT ON business_unit_product_sites
WHEN NOT EXISTS (SELECT 1 FROM project_master_items WHERE id=NEW.site_entity_id AND category='SITE_ENTITY')
BEGIN SELECT RAISE(ABORT,'INVALID_PROJECT_MASTER_RELATION'); END;
-- Backfill only combinations proven by complete existing Project references.
INSERT OR IGNORE INTO business_unit_products(business_unit_id,product_id)
SELECT business_unit_id,product_id FROM projects
WHERE business_unit_id IS NOT NULL AND product_id IS NOT NULL;
INSERT OR IGNORE INTO business_unit_product_sites(business_unit_id,product_id,site_entity_id)
SELECT business_unit_id,product_id,site_entity_id FROM projects
WHERE business_unit_id IS NOT NULL AND product_id IS NOT NULL AND site_entity_id IS NOT NULL;
