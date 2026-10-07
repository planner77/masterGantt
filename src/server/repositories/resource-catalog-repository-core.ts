import type Database from "better-sqlite3";
import type { DeveloperGrade, ResourceRole } from "../../contracts/resources";

export interface CatalogTargetRecord {
  id: number;
  publicId: string;
  name: string;
  code: string | null;
  description: string;
  active: boolean;
  developerGrade: DeveloperGrade | null;
  roles: ResourceRole[];
}

export interface CatalogGroupRecord extends CatalogTargetRecord {
  memberResourceIds: string[];
}

export interface AssignmentRecord {
  id: number;
  publicId: string;
  projectId: number;
  taskId: number;
  taskPublicId: string;
  kind: "resource" | "group";
  targetInternalId: number;
  targetPublicId: string;
  assignmentStart: string | null;
  assignmentEnd: string | null;
  allocationPercent: number | null;
  assignmentRole: ResourceRole | null;
}

export interface CatalogTargetProjectUsage {
  projectCount: number;
  taskAssignmentProjectCount: number;
  equipmentRoleProjectCount: number;
  systemRoleProjectCount: number;
  calendarProjectCount: number;
}

interface ProjectUsageRow {
  target_id: number;
  project_count: number;
  task_assignment_project_count: number;
  equipment_role_project_count: number;
  system_role_project_count: number;
  calendar_project_count: number;
}

function mapProjectUsage(rows: readonly ProjectUsageRow[]): Map<number, CatalogTargetProjectUsage> {
  return new Map(rows.map((row) => [row.target_id, {
    projectCount: row.project_count,
    taskAssignmentProjectCount: row.task_assignment_project_count,
    equipmentRoleProjectCount: row.equipment_role_project_count,
    systemRoleProjectCount: row.system_role_project_count,
    calendarProjectCount: row.calendar_project_count,
  }]));
}

interface TargetRow {
  id: number;
  public_id: string;
  name: string;
  code: string | null;
  description: string;
  active: number;
  developer_grade: DeveloperGrade | null;
}

function mapTarget(row: TargetRow): CatalogTargetRecord {
  return {
    id: row.id,
    publicId: row.public_id,
    name: row.name,
    code: row.code,
    description: row.description,
    active: row.active === 1,
    developerGrade: row.developer_grade,
    roles: [],
  };
}

interface ResourceRoleRow {
  resource_id: number;
  role: ResourceRole;
}

function resourceRolesById(rows: readonly ResourceRoleRow[]): Map<number, ResourceRole[]> {
  const roles = new Map<number, ResourceRole[]>();
  for (const row of rows) {
    const current = roles.get(row.resource_id) ?? [];
    current.push(row.role);
    roles.set(row.resource_id, current);
  }
  return roles;
}

export class ResourceCatalogRepository {
  constructor(private readonly database: Database.Database) {}

  getRevision(): number {
    const row = this.database.prepare("SELECT revision FROM resource_catalog_state WHERE id = 1").get() as { revision: number } | undefined;
    if (!row) throw new Error("Resource catalog state is missing.");
    return row.revision;
  }

  advanceRevision(expectedRevision: number, updatedAt: string): number | undefined {
    const result = this.database.prepare(`UPDATE resource_catalog_state SET revision = revision + 1, updated_at = ? WHERE id = 1 AND revision = ?`).run(updatedAt, expectedRevision);
    return result.changes === 1 ? expectedRevision + 1 : undefined;
  }

  listResources(activeOnly = false): CatalogTargetRecord[] {
    const rows = this.database.prepare(`SELECT id, public_id, name, code, description, active, developer_grade FROM resources ${activeOnly ? "WHERE active = 1" : ""} ORDER BY lower(name), public_id`).all() as TargetRow[];
    const roleRows = this.database.prepare(`
      SELECT rr.resource_id, rr.role
        FROM resource_roles rr
        JOIN resources r ON r.id = rr.resource_id
        ${activeOnly ? "WHERE r.active = 1" : ""}
       ORDER BY rr.resource_id,
                CASE rr.role WHEN 'PI' THEN 1 WHEN 'DEVELOPER' THEN 2 WHEN 'EQUIPMENT_OWNER' THEN 3 ELSE 4 END
    `).all() as ResourceRoleRow[];
    const roles = resourceRolesById(roleRows);
    return rows.map((row) => ({ ...mapTarget(row), roles: roles.get(row.id) ?? [] }));
  }

  listGroups(activeOnly = false): CatalogGroupRecord[] {
    const rows = this.database.prepare(`SELECT id, public_id, name, code, description, active, NULL AS developer_grade FROM resource_groups ${activeOnly ? "WHERE active = 1" : ""} ORDER BY lower(name), public_id`).all() as TargetRow[];
    const memberRows = this.database.prepare(`SELECT gm.group_id, r.public_id FROM resource_group_members gm JOIN resources r ON r.id = gm.resource_id ORDER BY gm.group_id, lower(r.name), r.public_id`).all() as { group_id: number; public_id: string }[];
    const members = new Map<number, string[]>();
    for (const row of memberRows) {
      const list = members.get(row.group_id) ?? [];
      list.push(row.public_id);
      members.set(row.group_id, list);
    }
    return rows.map((row) => ({ ...mapTarget(row), memberResourceIds: members.get(row.id) ?? [] }));
  }

  listResourceRoles(resourceId: number): ResourceRole[] {
    return (this.database.prepare(`
      SELECT resource_id, role
        FROM resource_roles
       WHERE resource_id = ?
       ORDER BY CASE role WHEN 'PI' THEN 1 WHEN 'DEVELOPER' THEN 2 WHEN 'EQUIPMENT_OWNER' THEN 3 ELSE 4 END
    `).all(resourceId) as ResourceRoleRow[]).map((row) => row.role);
  }

  findResourceByPublicId(publicId: string): CatalogTargetRecord | undefined {
    const row = this.database.prepare(`SELECT id, public_id, name, code, description, active, developer_grade FROM resources WHERE public_id = ?`).get(publicId) as TargetRow | undefined;
    return row ? { ...mapTarget(row), roles: this.listResourceRoles(row.id) } : undefined;
  }

  findGroupByPublicId(publicId: string): CatalogGroupRecord | undefined {
    const row = this.database.prepare(`SELECT id, public_id, name, code, description, active, NULL AS developer_grade FROM resource_groups WHERE public_id = ?`).get(publicId) as TargetRow | undefined;
    if (!row) return undefined;
    const members = this.database.prepare(`SELECT r.public_id FROM resource_group_members gm JOIN resources r ON r.id = gm.resource_id WHERE gm.group_id = ? ORDER BY lower(r.name), r.public_id`).all(row.id) as { public_id: string }[];
    return { ...mapTarget(row), memberResourceIds: members.map((member) => member.public_id) };
  }

  listResourceProjectUsage(): Map<number, CatalogTargetProjectUsage> {
    const rows = this.database.prepare(`
      WITH usage AS (
        SELECT resource_id AS target_id, project_id, 'task_assignment' AS category
          FROM task_assignments
         WHERE resource_id IS NOT NULL
        UNION ALL
        SELECT resource_id, project_id, 'equipment_role'
          FROM project_equipment_resource_roles
        UNION ALL
        SELECT resource_id, project_id, 'system_role'
          FROM project_system_resource_roles
        UNION ALL
        SELECT r.id, w.project_id, 'calendar'
          FROM work_calendar_rules w
          JOIN resources r ON r.public_id = w.target_public_id
         WHERE w.target_type = 'RESOURCE'
      )
      SELECT target_id,
             COUNT(DISTINCT project_id) AS project_count,
             COUNT(DISTINCT CASE WHEN category = 'task_assignment' THEN project_id END) AS task_assignment_project_count,
             COUNT(DISTINCT CASE WHEN category = 'equipment_role' THEN project_id END) AS equipment_role_project_count,
             COUNT(DISTINCT CASE WHEN category = 'system_role' THEN project_id END) AS system_role_project_count,
             COUNT(DISTINCT CASE WHEN category = 'calendar' THEN project_id END) AS calendar_project_count
        FROM usage
       GROUP BY target_id
    `).all() as ProjectUsageRow[];
    return mapProjectUsage(rows);
  }

  listGroupProjectUsage(): Map<number, CatalogTargetProjectUsage> {
    const rows = this.database.prepare(`
      WITH usage AS (
        SELECT group_id AS target_id, project_id, 'task_assignment' AS category
          FROM task_assignments
         WHERE group_id IS NOT NULL
        UNION ALL
        SELECT g.id, w.project_id, 'calendar'
          FROM work_calendar_rules w
          JOIN resource_groups g ON g.public_id = w.target_public_id
         WHERE w.target_type = 'RESOURCE_GROUP'
      )
      SELECT target_id,
             COUNT(DISTINCT project_id) AS project_count,
             COUNT(DISTINCT CASE WHEN category = 'task_assignment' THEN project_id END) AS task_assignment_project_count,
             0 AS equipment_role_project_count,
             0 AS system_role_project_count,
             COUNT(DISTINCT CASE WHEN category = 'calendar' THEN project_id END) AS calendar_project_count
        FROM usage
       GROUP BY target_id
    `).all() as ProjectUsageRow[];
    return mapProjectUsage(rows);
  }

  removeResourceMemberships(resourceId: number): void {
    this.database.prepare("DELETE FROM resource_group_members WHERE resource_id = ?").run(resourceId);
  }

  removeGroupMemberships(groupId: number): void {
    this.database.prepare("DELETE FROM resource_group_members WHERE group_id = ?").run(groupId);
  }

  deleteResource(id: number): boolean {
    return this.database.prepare("DELETE FROM resources WHERE id = ?").run(id).changes === 1;
  }

  deleteGroup(id: number): boolean {
    return this.database.prepare("DELETE FROM resource_groups WHERE id = ?").run(id).changes === 1;
  }

  insertResource(input: { publicId: string; name: string; code: string | null; description: string; developerGrade?: DeveloperGrade | null; now: string }): CatalogTargetRecord {
    const result = this.database.prepare(`INSERT INTO resources (public_id, name, code, description, developer_grade, active, created_at, updated_at) VALUES (@publicId, @name, @code, @description, @developerGrade, 1, @now, @now)`).run({ ...input, developerGrade: input.developerGrade ?? null });
    const row = this.database.prepare(`SELECT id, public_id, name, code, description, active, developer_grade FROM resources WHERE id = ?`).get(Number(result.lastInsertRowid)) as TargetRow;
    return mapTarget(row);
  }

  insertGroup(input: { publicId: string; name: string; code: string | null; description: string; now: string }): CatalogGroupRecord {
    const result = this.database.prepare(`INSERT INTO resource_groups (public_id, name, code, description, active, created_at, updated_at) VALUES (@publicId, @name, @code, @description, 1, @now, @now)`).run(input);
    const row = this.database.prepare(`SELECT id, public_id, name, code, description, active, NULL AS developer_grade FROM resource_groups WHERE id = ?`).get(Number(result.lastInsertRowid)) as TargetRow;
    return { ...mapTarget(row), memberResourceIds: [] };
  }

  updateResource(id: number, input: { name?: string; code?: string | null; description?: string; active?: boolean; developerGrade?: DeveloperGrade | null }, now: string): void { this.updateTarget("resources", id, input, now); }
  updateGroup(id: number, input: { name?: string; code?: string | null; description?: string; active?: boolean }, now: string): void { this.updateTarget("resource_groups", id, input, now); }

  private updateTarget(table: "resources" | "resource_groups", id: number, input: { name?: string; code?: string | null; description?: string; active?: boolean; developerGrade?: DeveloperGrade | null }, now: string): void {
    const sets: string[] = []; const values: unknown[] = [];
    if (input.name !== undefined) { sets.push("name = ?"); values.push(input.name); }
    if (input.code !== undefined) { sets.push("code = ?"); values.push(input.code); }
    if (input.description !== undefined) { sets.push("description = ?"); values.push(input.description); }
    if (input.active !== undefined) { sets.push("active = ?"); values.push(input.active ? 1 : 0); }
    if (table === "resources" && input.developerGrade !== undefined) { sets.push("developer_grade = ?"); values.push(input.developerGrade); }
    if (sets.length === 0) return;
    sets.push("updated_at = ?"); values.push(now, id);
    this.database.prepare(`UPDATE ${table} SET ${sets.join(", ")} WHERE id = ?`).run(...values);
  }

  replaceGroupMembers(groupId: number, resourceIds: number[], now: string): void {
    this.database.prepare("DELETE FROM resource_group_members WHERE group_id = ?").run(groupId);
    const insert = this.database.prepare(`INSERT INTO resource_group_members (group_id, resource_id, created_at) VALUES (?, ?, ?)`);
    for (const resourceId of resourceIds) insert.run(groupId, resourceId, now);
  }

  replaceResourceRoles(resourceId: number, roles: readonly ResourceRole[], now: string): void {
    const keep = new Set(roles);
    for (const currentRole of this.listResourceRoles(resourceId)) {
      if (!keep.has(currentRole)) {
        this.database.prepare("DELETE FROM resource_roles WHERE resource_id = ? AND role = ?").run(resourceId, currentRole);
      }
    }
    const insert = this.database.prepare(`INSERT OR IGNORE INTO resource_roles (resource_id, role, created_at) VALUES (?, ?, ?)`);
    for (const role of roles) insert.run(resourceId, role, now);
  }

  listAssignments(projectId: number): AssignmentRecord[] {
    const rows = this.database.prepare(`
      SELECT a.id, a.public_id, a.project_id, a.task_id, t.public_id AS task_public_id,
             CASE WHEN a.resource_id IS NOT NULL THEN 'resource' ELSE 'group' END AS kind,
             COALESCE(a.resource_id, a.group_id) AS target_internal_id,
             COALESCE(r.public_id, g.public_id) AS target_public_id,
             a.assignment_start, a.assignment_end, a.allocation_percent
      FROM task_assignments a
      JOIN tasks t ON t.id = a.task_id AND t.project_id = a.project_id
      LEFT JOIN resources r ON r.id = a.resource_id
      LEFT JOIN resource_groups g ON g.id = a.group_id
      WHERE a.project_id = ?
      ORDER BY a.task_id, a.id`).all(projectId) as Array<{
        id:number; public_id:string; project_id:number; task_id:number; task_public_id:string;
        kind:"resource"|"group"; target_internal_id:number; target_public_id:string;
        assignment_start:string|null; assignment_end:string|null; allocation_percent:number|null;
      }>;
    return rows.map((row) => ({
      id: row.id, publicId: row.public_id, projectId: row.project_id, taskId: row.task_id,
      taskPublicId: row.task_public_id, kind: row.kind, targetInternalId: row.target_internal_id,
      targetPublicId: row.target_public_id, assignmentStart: row.assignment_start,
      assignmentEnd: row.assignment_end, allocationPercent: row.allocation_percent,
      assignmentRole: null,
    }));
  }

  replaceTaskAssignments(input: {
    projectId: number;
    taskId: number;
    targets: Array<{
      publicId: string; kind: "resource" | "group"; internalId: number; assignmentPublicId: string;
      assignmentStart: string | null; assignmentEnd: string | null; allocationPercent: number | null;
      assignmentRole?: ResourceRole | null;
    }>;
    now: string;
  }): void {
    this.database.prepare("DELETE FROM task_assignments WHERE project_id = ? AND task_id = ?").run(input.projectId, input.taskId);
    const insert = this.database.prepare(`
      INSERT INTO task_assignments
      (public_id, project_id, task_id, resource_id, group_id, assignment_start, assignment_end, allocation_percent, assignment_role, created_at, updated_at)
      VALUES (@assignmentPublicId, @projectId, @taskId, @resourceId, @groupId, @assignmentStart, @assignmentEnd, @allocationPercent, @assignmentRole, @now, @now)`);
    for (const target of input.targets) {
      insert.run({
        assignmentPublicId: target.assignmentPublicId, projectId: input.projectId, taskId: input.taskId,
        resourceId: target.kind === "resource" ? target.internalId : null,
        groupId: target.kind === "group" ? target.internalId : null,
        assignmentStart: target.kind === "resource" ? target.assignmentStart : null,
        assignmentEnd: target.kind === "resource" ? target.assignmentEnd : null,
        allocationPercent: target.kind === "resource" ? target.allocationPercent : null,
        assignmentRole: null,
        now: input.now,
      });
    }
  }

  getAdminCredential(): { passwordSalt: Buffer; passwordHash: Buffer } | undefined {
    const row = this.database.prepare(`SELECT password_salt, password_hash FROM resource_catalog_admin_credentials WHERE id = 1`).get() as { password_salt: Buffer; password_hash: Buffer } | undefined;
    return row ? { passwordSalt: row.password_salt, passwordHash: row.password_hash } : undefined;
  }

  seedAdminCredential(input: { passwordSalt: Buffer; passwordHash: Buffer; updatedAt: string }): boolean {
    const result = this.database.prepare(`INSERT OR IGNORE INTO resource_catalog_admin_credentials (id, password_kdf, password_salt, password_hash, updated_at) VALUES (1, 'scrypt', @passwordSalt, @passwordHash, @updatedAt)`).run(input);
    return result.changes === 1;
  }

  replaceAdminCredential(input: { passwordSalt: Buffer; passwordHash: Buffer; updatedAt: string }): void {
    this.database.prepare(`
      INSERT INTO resource_catalog_admin_credentials (id, password_kdf, password_salt, password_hash, updated_at)
      VALUES (1, 'scrypt', @passwordSalt, @passwordHash, @updatedAt)
      ON CONFLICT(id) DO UPDATE SET
        password_kdf = excluded.password_kdf,
        password_salt = excluded.password_salt,
        password_hash = excluded.password_hash,
        updated_at = excluded.updated_at
    `).run(input);
  }

  revokeAllAdminSessions(revokedAt: string): void {
    this.database.prepare(`UPDATE resource_catalog_admin_sessions SET revoked_at = COALESCE(revoked_at, ?) WHERE revoked_at IS NULL`).run(revokedAt);
  }

  insertAdminSession(input: { tokenHash: Buffer; createdAt: string; expiresAt: string }): number {
    const result = this.database.prepare(`INSERT INTO resource_catalog_admin_sessions (token_hash, created_at, expires_at) VALUES (@tokenHash, @createdAt, @expiresAt)`).run(input);
    return Number(result.lastInsertRowid);
  }

  findAdminSessionByHash(tokenHash: Buffer): { id: number; expiresAt: string; revokedAt: string | null } | undefined {
    const row = this.database.prepare(`SELECT id, expires_at, revoked_at FROM resource_catalog_admin_sessions WHERE token_hash = ?`).get(tokenHash) as { id:number; expires_at:string; revoked_at:string|null } | undefined;
    return row ? { id: row.id, expiresAt: row.expires_at, revokedAt: row.revoked_at } : undefined;
  }

  revokeAdminSession(id: number, revokedAt: string): void {
    this.database.prepare(`UPDATE resource_catalog_admin_sessions SET revoked_at = COALESCE(revoked_at, ?) WHERE id = ?`).run(revokedAt, id);
  }
}
