import type Database from "better-sqlite3";
import type { ProjectMasterCategory } from "../../contracts/project-master";

export interface ProjectMasterRecord {
  id: number;
  publicId: string;
  category: ProjectMasterCategory;
  code: string;
  name: string;
  active: boolean;
  sortOrder: number;
}

interface ItemRow {
  id: number;
  public_id: string;
  category: ProjectMasterCategory;
  code: string;
  name: string;
  active: number;
  sort_order: number;
}

function mapItem(row: ItemRow): ProjectMasterRecord {
  return {
    id: row.id,
    publicId: row.public_id,
    category: row.category,
    code: row.code,
    name: row.name,
    active: row.active === 1,
    sortOrder: row.sort_order,
  };
}

export class ProjectMasterRepository {
  constructor(private readonly database: Database.Database) {}

  getRevision(): number {
    const row = this.database.prepare("SELECT revision FROM project_master_catalog_state WHERE id = 1").get() as { revision: number } | undefined;
    if (!row) throw new Error("Project master catalog state is missing.");
    return row.revision;
  }

  advanceRevision(expectedRevision: number, updatedAt: string): boolean {
    return this.database.prepare(
      "UPDATE project_master_catalog_state SET revision = revision + 1, updated_at = ? WHERE id = 1 AND revision = ?",
    ).run(updatedAt, expectedRevision).changes === 1;
  }

  listItems(activeOnly = false): ProjectMasterRecord[] {
    const rows = this.database.prepare(`
      SELECT id, public_id, category, code, name, active, sort_order
      FROM project_master_items
      ${activeOnly ? "WHERE active = 1" : ""}
      ORDER BY category, sort_order, lower(name), public_id
    `).all() as ItemRow[];
    return rows.map(mapItem);
  }

  findItemByPublicId(publicId: string): ProjectMasterRecord | undefined {
    const row = this.database.prepare(
      "SELECT id, public_id, category, code, name, active, sort_order FROM project_master_items WHERE public_id = ?",
    ).get(publicId) as ItemRow | undefined;
    return row ? mapItem(row) : undefined;
  }

  findItemById(id: number): ProjectMasterRecord | undefined {
    const row = this.database.prepare(
      "SELECT id, public_id, category, code, name, active, sort_order FROM project_master_items WHERE id = ?",
    ).get(id) as ItemRow | undefined;
    return row ? mapItem(row) : undefined;
  }

  insertItem(input: {
    publicId: string; category: ProjectMasterCategory; code: string; name: string;
    active: boolean; sortOrder: number; now: string;
  }): ProjectMasterRecord {
    const result = this.database.prepare(`
      INSERT INTO project_master_items
        (public_id, category, code, name, active, sort_order, created_at, updated_at)
      VALUES (@publicId, @category, @code, @name, @active, @sortOrder, @now, @now)
    `).run({ ...input, active: input.active ? 1 : 0 });
    const item = this.findItemById(Number(result.lastInsertRowid));
    if (!item) throw new Error("Inserted project master item could not be read back.");
    return item;
  }

  updateItem(id: number, input: { code?: string; name?: string; active?: boolean; sortOrder?: number }, now: string): void {
    const sets: string[] = [];
    const values: unknown[] = [];
    if (input.code !== undefined) { sets.push("code = ?"); values.push(input.code); }
    if (input.name !== undefined) { sets.push("name = ?"); values.push(input.name); }
    if (input.active !== undefined) { sets.push("active = ?"); values.push(input.active ? 1 : 0); }
    if (input.sortOrder !== undefined) { sets.push("sort_order = ?"); values.push(input.sortOrder); }
    if (sets.length === 0) return;
    sets.push("updated_at = ?");
    values.push(now, id);
    this.database.prepare(`UPDATE project_master_items SET ${sets.join(", ")} WHERE id = ?`).run(...values);
  }

  usageCount(itemId: number): number {
    const row = this.database.prepare(`
      SELECT
        (SELECT count(*) FROM projects WHERE business_unit_id = @id) +
        (SELECT count(*) FROM projects WHERE product_id = @id) +
        (SELECT count(*) FROM projects WHERE site_entity_id = @id) AS count
    `).get({ id: itemId }) as { count: number };
    return row.count;
  }

  listRelations(): Array<{ businessUnitId: string; productId: string; siteEntityId: string | null }> {
    return this.database.prepare(`
      SELECT b.public_id AS businessUnitId,p.public_id AS productId,NULL AS siteEntityId
      FROM business_unit_products rel JOIN project_master_items b ON b.id=rel.business_unit_id
      JOIN project_master_items p ON p.id=rel.product_id
      UNION ALL
      SELECT b.public_id AS businessUnitId,p.public_id AS productId,s.public_id AS siteEntityId
      FROM business_unit_product_sites rel JOIN project_master_items b ON b.id=rel.business_unit_id
      JOIN project_master_items p ON p.id=rel.product_id
      JOIN project_master_items s ON s.id=rel.site_entity_id
      ORDER BY businessUnitId,productId,siteEntityId
    `).all() as Array<{ businessUnitId: string; productId: string; siteEntityId: string | null }>;
  }

  relationExists(b: number,p: number,s: number | null = null): boolean {
    return s === null ?
      !!this.database.prepare("SELECT 1 FROM business_unit_products WHERE business_unit_id=? AND product_id=?").get(b,p) :
      !!this.database.prepare("SELECT 1 FROM business_unit_product_sites WHERE business_unit_id=? AND product_id=? AND site_entity_id=?").get(b,p,s);
  }
  relationSiteCount(b: number,p: number): number {
    return (this.database.prepare("SELECT count(*) AS count FROM business_unit_product_sites WHERE business_unit_id=? AND product_id=?")
      .get(b,p) as {count:number}).count;
  }
  relationProjectUsage(b: number,p: number,s: number | null): number {
    return s === null ?
      (this.database.prepare("SELECT count(*) AS count FROM projects WHERE business_unit_id=? AND product_id=?").get(b,p) as {count:number}).count :
      (this.database.prepare("SELECT count(*) AS count FROM projects WHERE business_unit_id=? AND product_id=? AND site_entity_id=?").get(b,p,s) as {count:number}).count;
  }
  addRelation(b: number,p: number,s: number | null): void {
    if(s === null) this.database.prepare("INSERT INTO business_unit_products (business_unit_id,product_id) VALUES (?,?)").run(b,p);
    else this.database.prepare("INSERT INTO business_unit_product_sites (business_unit_id,product_id,site_entity_id) VALUES (?,?,?)").run(b,p,s);
  }
  removeRelation(b: number,p: number,s: number | null): void {
    if(s === null) this.database.prepare("DELETE FROM business_unit_products WHERE business_unit_id=? AND product_id=?").run(b,p);
    else this.database.prepare("DELETE FROM business_unit_product_sites WHERE business_unit_id=? AND product_id=? AND site_entity_id=?").run(b,p,s);
  }

  getProjectSelection(projectId: number): {
    businessUnit: ProjectMasterRecord | null;
    product: ProjectMasterRecord | null;
    siteEntity: ProjectMasterRecord | null;
  } {
    const row = this.database.prepare(`
      SELECT business_unit_id, product_id, site_entity_id FROM projects WHERE id = ?
    `).get(projectId) as { business_unit_id: number | null; product_id: number | null; site_entity_id: number | null } | undefined;
    if (!row) throw new Error("Project not found.");
    return {
      businessUnit: row.business_unit_id === null ? null : this.findItemById(row.business_unit_id) ?? null,
      product: row.product_id === null ? null : this.findItemById(row.product_id) ?? null,
      siteEntity: row.site_entity_id === null ? null : this.findItemById(row.site_entity_id) ?? null,
    };
  }

  setProjectSelection(projectId: number, input: {
    businessUnitId?: number | null; productId?: number | null; siteEntityId?: number | null;
  }): void {
    const sets: string[] = [];
    const values: Array<number | null> = [];
    if (input.businessUnitId !== undefined) { sets.push("business_unit_id = ?"); values.push(input.businessUnitId); }
    if (input.productId !== undefined) { sets.push("product_id = ?"); values.push(input.productId); }
    if (input.siteEntityId !== undefined) { sets.push("site_entity_id = ?"); values.push(input.siteEntityId); }
    if (sets.length === 0) return;
    values.push(projectId);
    this.database.prepare(`UPDATE projects SET ${sets.join(", ")} WHERE id = ?`).run(...values);
  }

  getAdminCredential(): { passwordSalt: Buffer; passwordHash: Buffer } | undefined {
    const row = this.database.prepare(
      "SELECT password_salt, password_hash FROM project_master_admin_credentials WHERE id = 1",
    ).get() as { password_salt: Buffer; password_hash: Buffer } | undefined;
    return row ? { passwordSalt: row.password_salt, passwordHash: row.password_hash } : undefined;
  }

  seedAdminCredential(input: { passwordSalt: Buffer; passwordHash: Buffer; updatedAt: string }): boolean {
    return this.database.prepare(`
      INSERT OR IGNORE INTO project_master_admin_credentials
        (id, password_kdf, password_salt, password_hash, updated_at)
      VALUES (1, 'scrypt', @passwordSalt, @passwordHash, @updatedAt)
    `).run(input).changes === 1;
  }

  replaceAdminCredential(input: { passwordSalt: Buffer; passwordHash: Buffer; updatedAt: string }): void {
    this.database.prepare(`
      INSERT INTO project_master_admin_credentials
        (id, password_kdf, password_salt, password_hash, updated_at)
      VALUES (1, 'scrypt', @passwordSalt, @passwordHash, @updatedAt)
      ON CONFLICT(id) DO UPDATE SET
        password_kdf = excluded.password_kdf,
        password_salt = excluded.password_salt,
        password_hash = excluded.password_hash,
        updated_at = excluded.updated_at
    `).run(input);
  }

  insertAdminSession(input: { tokenHash: Buffer; createdAt: string; expiresAt: string }): number {
    const result = this.database.prepare(`
      INSERT INTO project_master_admin_sessions (token_hash, created_at, expires_at)
      VALUES (@tokenHash, @createdAt, @expiresAt)
    `).run(input);
    return Number(result.lastInsertRowid);
  }

  findAdminSessionByHash(tokenHash: Buffer): { id: number; expiresAt: string; revokedAt: string | null } | undefined {
    const row = this.database.prepare(
      "SELECT id, expires_at, revoked_at FROM project_master_admin_sessions WHERE token_hash = ?",
    ).get(tokenHash) as { id: number; expires_at: string; revoked_at: string | null } | undefined;
    return row ? { id: row.id, expiresAt: row.expires_at, revokedAt: row.revoked_at } : undefined;
  }

  revokeAdminSession(id: number, revokedAt: string): void {
    this.database.prepare(
      "UPDATE project_master_admin_sessions SET revoked_at = COALESCE(revoked_at, ?) WHERE id = ?",
    ).run(revokedAt, id);
  }

  revokeAllAdminSessions(revokedAt: string): void {
    this.database.prepare(
      "UPDATE project_master_admin_sessions SET revoked_at = COALESCE(revoked_at, ?) WHERE revoked_at IS NULL",
    ).run(revokedAt);
  }
}
