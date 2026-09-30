import type Database from "better-sqlite3";
import type { LogisticsTypeKind } from "../../contracts/logistics";

export interface LogisticsTypeRecord {
  code: string;
  name: string;
  active: boolean;
  sortOrder: number;
  usageCount: number;
}

interface TypeRow {
  code: string;
  name: string;
  active: number;
  sort_order: number;
  usage_count: number;
}

function table(kind: LogisticsTypeKind): string {
  return kind === "equipment" ? "logistics_equipment_types" : "logistics_system_types";
}

function usageSql(kind: LogisticsTypeKind): string {
  return kind === "equipment"
    ? "(SELECT COUNT(*) FROM project_equipment e WHERE e.equipment_type = t.code)"
    : "(SELECT COUNT(*) FROM project_logistics_systems s WHERE s.system_type = t.code)";
}

function map(row: TypeRow): LogisticsTypeRecord {
  return { code: row.code, name: row.name, active: row.active === 1, sortOrder: row.sort_order, usageCount: row.usage_count };
}

export class LogisticsTypeCatalogRepository {
  constructor(private readonly database: Database.Database) {}

  getRevision(): number {
    const row=this.database.prepare("SELECT revision FROM logistics_type_catalog_state WHERE id=1").get() as {revision:number}|undefined;
    if(!row) throw new Error("Logistics type catalog state is missing.");
    return row.revision;
  }

  advanceRevision(expected:number, updatedAt:string): boolean {
    return this.database.prepare("UPDATE logistics_type_catalog_state SET revision=revision+1, updated_at=? WHERE id=1 AND revision=?").run(updatedAt,expected).changes===1;
  }

  list(kind: LogisticsTypeKind, activeOnly=false): LogisticsTypeRecord[] {
    const rows=this.database.prepare(`SELECT t.code,t.name,t.active,t.sort_order,${usageSql(kind)} AS usage_count FROM ${table(kind)} t ${activeOnly?"WHERE t.active=1":""} ORDER BY t.sort_order, lower(t.name), t.code`).all() as TypeRow[];
    return rows.map(map);
  }

  find(kind: LogisticsTypeKind, code:string): LogisticsTypeRecord|undefined {
    const row=this.database.prepare(`SELECT t.code,t.name,t.active,t.sort_order,${usageSql(kind)} AS usage_count FROM ${table(kind)} t WHERE t.code=?`).get(code) as TypeRow|undefined;
    return row?map(row):undefined;
  }

  insert(kind: LogisticsTypeKind, input:{code:string;name:string;active:boolean;sortOrder:number;now:string}): void {
    this.database.prepare(`INSERT INTO ${table(kind)} (code,name,active,sort_order,created_at,updated_at) VALUES (@code,@name,@active,@sortOrder,@now,@now)`).run({...input,active:input.active?1:0});
  }

  update(kind: LogisticsTypeKind, code:string, input:{name?:string;active?:boolean;sortOrder?:number;now:string}): void {
    const current=this.find(kind,code);
    if(!current) return;
    this.database.prepare(`UPDATE ${table(kind)} SET name=?,active=?,sort_order=?,updated_at=? WHERE code=?`).run(
      input.name??current.name,
      input.active===undefined?(current.active?1:0):(input.active?1:0),
      input.sortOrder??current.sortOrder,
      input.now,
      code,
    );
  }

  getAdminCredential(): {passwordSalt:Buffer;passwordHash:Buffer}|undefined {
    const row=this.database.prepare("SELECT password_salt,password_hash FROM logistics_catalog_admin_credentials WHERE id=1").get() as {password_salt:Buffer;password_hash:Buffer}|undefined;
    return row?{passwordSalt:row.password_salt,passwordHash:row.password_hash}:undefined;
  }
  seedAdminCredential(input:{passwordSalt:Buffer;passwordHash:Buffer;updatedAt:string}): boolean {
    return this.database.prepare("INSERT OR IGNORE INTO logistics_catalog_admin_credentials (id,password_kdf,password_salt,password_hash,updated_at) VALUES (1,'scrypt',@passwordSalt,@passwordHash,@updatedAt)").run(input).changes===1;
  }
  replaceAdminCredential(input:{passwordSalt:Buffer;passwordHash:Buffer;updatedAt:string}): void {
    this.database.prepare(`INSERT INTO logistics_catalog_admin_credentials (id,password_kdf,password_salt,password_hash,updated_at) VALUES (1,'scrypt',@passwordSalt,@passwordHash,@updatedAt)
    ON CONFLICT(id) DO UPDATE SET password_salt=excluded.password_salt,password_hash=excluded.password_hash,updated_at=excluded.updated_at`).run(input);
  }
  insertAdminSession(input:{tokenHash:Buffer;createdAt:string;expiresAt:string}): number {
    return Number(this.database.prepare("INSERT INTO logistics_catalog_admin_sessions (token_hash,created_at,expires_at) VALUES (@tokenHash,@createdAt,@expiresAt)").run(input).lastInsertRowid);
  }
  findAdminSessionByHash(tokenHash:Buffer): {id:number;expiresAt:string;revokedAt:string|null}|undefined {
    const row=this.database.prepare("SELECT id,expires_at,revoked_at FROM logistics_catalog_admin_sessions WHERE token_hash=?").get(tokenHash) as {id:number;expires_at:string;revoked_at:string|null}|undefined;
    return row?{id:row.id,expiresAt:row.expires_at,revokedAt:row.revoked_at}:undefined;
  }
  revokeAdminSession(id:number,revokedAt:string):void{this.database.prepare("UPDATE logistics_catalog_admin_sessions SET revoked_at=COALESCE(revoked_at,?) WHERE id=?").run(revokedAt,id);}
  revokeAllAdminSessions(revokedAt:string):void{this.database.prepare("UPDATE logistics_catalog_admin_sessions SET revoked_at=COALESCE(revoked_at,?) WHERE revoked_at IS NULL").run(revokedAt);}
}
