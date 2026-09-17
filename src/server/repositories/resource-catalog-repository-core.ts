import type Database from "better-sqlite3";

export interface CatalogTargetRecord {
  id: number;
  publicId: string;
  name: string;
  code: string | null;
  description: string;
  active: boolean;
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
}

interface TargetRow {
  id: number;
  public_id: string;
  name: string;
  code: string | null;
  description: string;
  active: number;
}

function mapTarget(row: TargetRow): CatalogTargetRecord {
  return {
    id: row.id,
    publicId: row.public_id,
    name: row.name,
    code: row.code,
    description: row.description,
    active: row.active === 1,
  };
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
    const rows = this.database.prepare(`SELECT id, public_id, name, code, description, active FROM resources ${activeOnly ? "WHERE active = 1" : ""} ORDER BY lower(name), public_id`).all() as TargetRow[];
    return rows.map(mapTarget);
  }

  listGroups(activeOnly = false): CatalogGroupRecord[] {
    const rows = this.database.prepare(`SELECT id, public_id, name, code, description, active FROM resource_groups ${activeOnly ? "WHERE active = 1" : ""} ORDER BY lower(name), public_id`).all() as TargetRow[];
    const memberRows = this.database.prepare(`SELECT gm.group_id, r.public_id FROM resource_group_members gm JOIN resources r ON r.id = gm.resource_id ORDER BY gm.group_id, lower(r.name), r.public_id`).all() as { group_id: number; public_id: string }[];
    const members = new Map<number, string[]>();
    for (const row of memberRows) {
      const list = members.get(row.group_id) ?? [];
      list.push(row.public_id);
      members.set(row.group_id, list);
    }
    return rows.map((row) => ({ ...mapTarget(row), memberResourceIds: members.get(row.id) ?? [] }));
  }

  findResourceByPublicId(publicId: string): CatalogTargetRecord | undefined {
    const row = this.database.prepare(`SELECT id, public_id, name, code, description, active FROM resources WHERE public_id = ?`).get(publicId) as TargetRow | undefined;
    return row ? mapTarget(row) : undefined;
  }

  findGroupByPublicId(publicId: string): CatalogGroupRecord | undefined {
    const row = this.database.prepare(`SELECT id, public_id, name, code, description, active FROM resource_groups WHERE public_id = ?`).get(publicId) as TargetRow | undefined;
    if (!row) return undefined;
    const members = this.database.prepare(`SELECT r.public_id FROM resource_group_members gm JOIN resources r ON r.id = gm.resource_id WHERE gm.group_id = ? ORDER BY lower(r.name), r.public_id`).all(row.id) as { public_id: string }[];
    return { ...mapTarget(row), memberResourceIds: members.map((member) => member.public_id) };
  }

  insertResource(input: { publicId: string; name: string; code: string | null; description: string; now: string }): CatalogTargetRecord {
    const result = this.database.prepare(`INSERT INTO resources (public_id, name, code, description, active, created_at, updated_at) VALUES (@publicId, @name, @code, @description, 1, @now, @now)`).run(input);
    const row = this.database.prepare(`SELECT id, public_id, name, code, description, active FROM resources WHERE id = ?`).get(Number(result.lastInsertRowid)) as TargetRow;
    return mapTarget(row);
  }

  insertGroup(input: { publicId: string; name: string; code: string | null; description: string; now: string }): CatalogGroupRecord {
    const result = this.database.prepare(`INSERT INTO resource_groups (public_id, name, code, description, active, created_at, updated_at) VALUES (@publicId, @name, @code, @description, 1, @now, @now)`).run(input);
    const row = this.database.prepare(`SELECT id, public_id, name, code, description, active FROM resource_groups WHERE id = ?`).get(Number(result.lastInsertRowid)) as TargetRow;
    return { ...mapTarget(row), memberResourceIds: [] };
  }

  updateResource(id: number, input: { name?: string; code?: string | null; description?: string; active?: boolean }, now: string): void { this.updateTarget("resources", id, input, now); }
  updateGroup(id: number, input: { name?: string; code?: string | null; description?: string; active?: boolean }, now: string): void { this.updateTarget("resource_groups", id, input, now); }

  private updateTarget(table: "resources" | "resource_groups", id: number, input: { name?: string; code?: string | null; description?: string; active?: boolean }, now: string): void {
    const sets: string[] = []; const values: unknown[] = [];
    if (input.name !== undefined) { sets.push("name = ?"); values.push(input.name); }
    if (input.code !== undefined) { sets.push("code = ?"); values.push(input.code); }
    if (input.description !== undefined) { sets.push("description = ?"); values.push(input.description); }
    if (input.active !== undefined) { sets.push("active = ?"); values.push(input.active ? 1 : 0); }
    if (sets.length === 0) return;
    sets.push("updated_at = ?"); values.push(now, id);
    this.database.prepare(`UPDATE ${table} SET ${sets.join(", ")} WHERE id = ?`).run(...values);
  }

  replaceGroupMembers(groupId: number, resourceIds: number[], now: string): void {
    this.database.prepare("DELETE FROM resource_group_members WHERE group_id = ?").run(groupId);
    const insert = this.database.prepare(`INSERT INTO resource_group_members (group_id, resource_id, created_at) VALUES (?, ?, ?)`);
    for (const resourceId of resourceIds) insert.run(groupId, resourceId, now);
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
    }));
  }

  replaceTaskAssignments(input: {
    projectId: number;
    taskId: number;
    targets: Array<{
      publicId: string; kind: "resource" | "group"; internalId: number; assignmentPublicId: string;
      assignmentStart: string | null; assignmentEnd: string | null; allocationPercent: number | null;
    }>;
    now: string;
  }): void {
    this.database.prepare("DELETE FROM task_assignments WHERE project_id = ? AND task_id = ?").run(input.projectId, input.taskId);
    const insert = this.database.prepare(`
      INSERT INTO task_assignments
      (public_id, project_id, task_id, resource_id, group_id, assignment_start, assignment_end, allocation_percent, created_at, updated_at)
      VALUES (@assignmentPublicId, @projectId, @taskId, @resourceId, @groupId, @assignmentStart, @assignmentEnd, @allocationPercent, @now, @now)`);
    for (const target of input.targets) {
      insert.run({
        assignmentPublicId: target.assignmentPublicId, projectId: input.projectId, taskId: input.taskId,
        resourceId: target.kind === "resource" ? target.internalId : null,
        groupId: target.kind === "group" ? target.internalId : null,
        assignmentStart: target.kind === "resource" ? target.assignmentStart : null,
        assignmentEnd: target.kind === "resource" ? target.assignmentEnd : null,
        allocationPercent: target.kind === "resource" ? target.allocationPercent : null,
        now: input.now,
      });
    }
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
