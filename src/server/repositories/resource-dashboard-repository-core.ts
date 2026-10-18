import { PublicApiError } from "../http/api-error-core";
import type Database from "better-sqlite3";
import type { DeveloperGrade, ResourceWorkloadRole } from "../../contracts/resources";

export interface DashboardResourceRecord { publicId: string; name: string; code: string | null; active: boolean; developerGrade: DeveloperGrade | null; roles: ResourceWorkloadRole[] }
export interface DashboardGroupRecord { publicId: string; name: string; code: string | null; active: boolean; memberResourceIds: string[] }

/** Bulk, Project-connected public catalog projection. Never reads unassigned Group members. */
export class ResourceDashboardRepository {
  constructor(private readonly database: Database.Database) {}
  counts(projectId: number) {
    const count = (sql: string) => (this.database.prepare(sql).get(projectId) as { count: number }).count;
    return { tasks: count("SELECT count(*) AS count FROM tasks WHERE project_id=?"),
      links: count("SELECT count(*) AS count FROM links WHERE project_id=?"),
      catalogMemberships: count("SELECT count(*) AS count FROM resource_group_members WHERE resource_id IN (SELECT DISTINCT resource_id FROM task_assignments WHERE project_id=? AND resource_id IS NOT NULL)"),
      assignments: count("SELECT count(*) AS count FROM task_assignments WHERE project_id=?"),
      calendarRules: count("SELECT count(*) AS count FROM work_calendar_rules WHERE project_id=?"),
      calendarDates: count("SELECT count(*) AS count FROM work_calendar_dates d JOIN work_calendar_rules r ON r.id=d.calendar_rule_id WHERE r.project_id=?") };
  }
  catalog(projectId: number, includeParticipation = false): { resources: DashboardResourceRecord[]; groups: DashboardGroupRecord[] } {
    const connected = includeParticipation ? `SELECT resource_id FROM task_assignments WHERE project_id=? AND resource_id IS NOT NULL
      UNION SELECT resource_id FROM project_resource_memberships WHERE project_id=?
      UNION SELECT resource_id FROM project_equipment_resource_roles WHERE project_id=?
      UNION SELECT resource_id FROM project_system_resource_roles WHERE project_id=?` : "SELECT DISTINCT resource_id FROM task_assignments WHERE project_id=? AND resource_id IS NOT NULL";
    const parameters = includeParticipation ? [projectId, projectId, projectId, projectId] : [projectId];
    if (includeParticipation) {
      const count = this.database.prepare(`SELECT COUNT(*) FROM resource_group_members WHERE resource_id IN (${connected})`).pluck().get(...parameters) as number;
      const resourceCount = this.database.prepare(`SELECT COUNT(*) FROM resources WHERE id IN (${connected})`).pluck().get(...parameters) as number;
      if (count > 16000 || resourceCount > 10000) throw new PublicApiError(422, "REPORT_LIMIT_EXCEEDED", "WBS 프로젝트 참여 원본 조회 한도를 초과했습니다.");
    }
    const resources = this.database.prepare(`SELECT public_id AS publicId,name,code,active,developer_grade AS developerGrade FROM resources WHERE id IN (${connected}) ORDER BY public_id`).all(...parameters) as (Omit<DashboardResourceRecord, "roles" | "active"> & { active: number })[];
    const roles = this.database.prepare(`SELECT r.public_id AS resourceId,rr.role FROM resource_roles rr JOIN resources r ON r.id=rr.resource_id WHERE r.id IN (${connected}) ORDER BY r.public_id,rr.role`).all(...parameters) as { resourceId: string; role: ResourceWorkloadRole }[];
    const members = this.database.prepare(`SELECT g.public_id AS groupId,r.public_id AS resourceId FROM resource_group_members gm JOIN resources r ON r.id=gm.resource_id JOIN resource_groups g ON g.id=gm.group_id WHERE r.id IN (${connected}) ORDER BY g.public_id,r.public_id`).all(...parameters) as { groupId: string; resourceId: string }[];
    const groups = this.database.prepare(`SELECT public_id AS publicId,name,code,active FROM resource_groups WHERE id IN (SELECT DISTINCT group_id FROM resource_group_members WHERE resource_id IN (${connected})) OR id IN (SELECT group_id FROM task_assignments WHERE project_id=? AND group_id IS NOT NULL) ORDER BY public_id`).all(...parameters, projectId) as { publicId: string; name: string; code: string | null; active: number }[];
    const roleMap = new Map<string, ResourceWorkloadRole[]>(), memberMap = new Map<string, string[]>();
    for (const row of roles) { const values = roleMap.get(row.resourceId) ?? []; values.push(row.role); roleMap.set(row.resourceId, values); }
    for (const row of members) { const values = memberMap.get(row.groupId) ?? []; values.push(row.resourceId); memberMap.set(row.groupId, values); }
    return { resources: resources.map((row) => ({ ...row, active: row.active === 1, roles: roleMap.get(row.publicId) ?? [] })),
      groups: groups.map((row) => ({ ...row, active: row.active === 1, memberResourceIds: memberMap.get(row.publicId) ?? [] })) };
  }
}
