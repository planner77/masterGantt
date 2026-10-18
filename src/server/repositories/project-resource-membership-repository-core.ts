import type Database from "better-sqlite3";
import type { ProjectResourceMembershipDto, ProjectResourceMembershipQuery, } from "../../contracts/project-resource-memberships";
import type { DeveloperGrade, ResourceRole } from "../../contracts/resources";
import { PublicApiError } from "../http/api-error-core";
export const MEMBERSHIP_LIMITS = {
  catalogResources: 100000,
  catalogGroups: 1000,
  projectMembers: 10000,
  projectReferences: 500000,
  responseBytes: 2 * 1024 * 1024,
} as const;
function limitExceeded(): never {
  throw new PublicApiError(422, "RESOURCE_MEMBERSHIP_LIMIT_EXCEEDED", "프로젝트 리소스 조회 또는 저장 한도를 초과했습니다.");
}
const USAGE_CTE = `WITH usage AS (
 SELECT a.resource_id, CASE WHEN t.type='task' THEN 'assignment' ELSE 'responsibility' END category
  FROM task_assignments a JOIN tasks t ON t.id=a.task_id AND t.project_id=a.project_id
 WHERE a.project_id=@projectId AND a.resource_id IS NOT NULL
 UNION ALL SELECT resource_id, 'equipment' FROM project_equipment_resource_roles WHERE project_id=@projectId
 UNION ALL SELECT resource_id, 'system' FROM project_system_resource_roles WHERE project_id=@projectId
), usage_counts AS (
 SELECT resource_id, SUM(category='assignment') assignments, SUM(category='responsibility') responsibilities,
    SUM(category='equipment') equipment, SUM(category='system') systems
  FROM usage GROUP BY resource_id
), population AS (
 SELECT r.*, m.resource_id IS NOT NULL registered,
    COALESCE(u.assignments,0) assignments, COALESCE(u.responsibilities,0) responsibilities,
    COALESCE(u.equipment,0) equipment, COALESCE(u.systems,0) systems
  FROM resources r
  LEFT JOIN project_resource_memberships m ON m.resource_id=r.id AND m.project_id=@projectId
  LEFT JOIN usage_counts u ON u.resource_id=r.id
)`;
const PROJECT_POPULATION = "registered=1 OR assignments+responsibilities+equipment+systems>0";
interface Row {
  id: number;
  public_id: string;
  name: string;
  code: string | null;
  description: string;
  active: number;
  developer_grade: DeveloperGrade | null;
  registered: number;
  assignments: number;
  responsibilities: number;
  equipment: number;
  systems: number;
}
type GroupRow = {
  id: string;
  name: string;
  active: number;
};
export class ProjectResourceMembershipRepository {
  constructor(private readonly database: Database.Database) { }
  private assertReadBudget(projectId: number): void {
    for (const [table, maximum] of [["resources", MEMBERSHIP_LIMITS.catalogResources], ["resource_groups", MEMBERSHIP_LIMITS.catalogGroups]] as const) {
      const count = this.database.prepare(`SELECT COUNT(*) FROM (SELECT 1 FROM ${table} LIMIT ?)`).pluck().get(maximum + 1) as number;
      if (count > maximum)
        limitExceeded();
    }
    const references = this.database.prepare(`SELECT COUNT(*) FROM (
   SELECT 1 FROM task_assignments WHERE project_id=@projectId
   UNION ALL SELECT 1 FROM project_equipment_resource_roles WHERE project_id=@projectId
   UNION ALL SELECT 1 FROM project_system_resource_roles WHERE project_id=@projectId
   LIMIT @limit
  )`).pluck().get({ projectId, limit: MEMBERSHIP_LIMITS.projectReferences + 1 }) as number;
    if (references > MEMBERSHIP_LIMITS.projectReferences)
      limitExceeded();
    const members = this.database.prepare("SELECT COUNT(*) FROM (SELECT 1 FROM project_resource_memberships WHERE project_id=? LIMIT ?)")
      .pluck().get(projectId, MEMBERSHIP_LIMITS.projectMembers + 1) as number;
    if (members > MEMBERSHIP_LIMITS.projectMembers)
      limitExceeded();
  }
  list(projectId: number, query: ProjectResourceMembershipQuery) {
    this.assertReadBudget(projectId);
    const parameters = {
      projectId,
      q: query.q ?? "",
      role: query.role ?? null,
      grade: query.grade ?? null,
      groupId: query.groupId ?? null,
      active: query.active === undefined ? null : Number(query.active),
      registration: query.registration ?? null,
      usage: query.usage ?? null,
      catalog: query.scope === "catalog" ? 1 : 0,
      limit: query.limit ?? 50,
      offset: query.offset ?? 0,
    };
    const where = `WHERE (@catalog=1 OR ${PROJECT_POPULATION})
   AND (@q='' OR instr(lower(name),lower(@q))>0 OR instr(lower(COALESCE(code,'')),lower(@q))>0)
   AND (@active IS NULL OR active=@active)
   AND (@role IS NULL OR EXISTS(SELECT 1 FROM resource_roles rr WHERE rr.resource_id=population.id AND rr.role=@role))
   AND (@grade IS NULL OR developer_grade=@grade)
   AND (@groupId IS NULL OR EXISTS(SELECT 1 FROM resource_group_members gm JOIN resource_groups g ON g.id=gm.group_id WHERE gm.resource_id=population.id AND g.public_id=@groupId))
   AND (@registration IS NULL OR registered=(@registration='registered'))
   AND (@usage IS NULL OR (@usage='assigned' AND assignments>0)
    OR (@usage='unassigned' AND assignments+responsibilities+equipment+systems=0)
    OR (@usage='roleOnly' AND assignments=0 AND responsibilities+equipment+systems>0))`;
    const total = this.database.prepare(`${USAGE_CTE} SELECT COUNT(*) FROM population ${where}`).pluck().get(parameters) as number;
    const rows = this.database.prepare(`${USAGE_CTE} SELECT * FROM population ${where} ORDER BY lower(name),public_id LIMIT @limit OFFSET @offset`).all(parameters) as Row[];
    const counts = this.database.prepare(`${USAGE_CTE}
   SELECT COALESCE(SUM(registered),0) registered, COALESCE(SUM(assignments>0),0) assigned,
      COALESCE(SUM(assignments=0 AND responsibilities+equipment+systems>0),0) roleOnly,
      COALESCE(SUM(active=0),0) inactive
    FROM population WHERE ${PROJECT_POPULATION}`).get({ projectId }) as {
      registered: number;
      assigned: number;
      roleOnly: number;
      inactive: number;
    };
    const groupRows = this.database.prepare(`${USAGE_CTE}
   SELECT DISTINCT g.public_id id,g.name,g.active FROM resource_groups g
   WHERE @catalog=1 OR EXISTS(
    SELECT 1 FROM resource_group_members gm JOIN population p ON p.id=gm.resource_id
    WHERE gm.group_id=g.id AND (${PROJECT_POPULATION})
   ) ORDER BY lower(g.name),g.public_id`).all({ projectId, catalog: parameters.catalog }) as GroupRow[];
    const roleStatement = this.database.prepare("SELECT role FROM resource_roles WHERE resource_id=? ORDER BY role");
    const groupStatement = this.database.prepare(`SELECT g.public_id id,g.name,g.active
   FROM resource_group_members gm JOIN resource_groups g ON g.id=gm.group_id
   WHERE gm.resource_id=? ORDER BY lower(g.name),g.public_id LIMIT ?`);
    const groups = (entries: GroupRow[]) => entries.map(group => ({ ...group, active: group.active === 1 }));
    const resources: ProjectResourceMembershipDto[] = rows.map(row => ({
      id: row.public_id,
      name: row.name,
      code: row.code,
      description: row.description,
      active: row.active === 1,
      developerGrade: row.developer_grade,
      roles: (roleStatement.all(row.id) as {
        role: ResourceRole;
      }[]).map(entry => entry.role),
      groups: groups(groupStatement.all(row.id, MEMBERSHIP_LIMITS.catalogGroups) as GroupRow[]),
      registered: row.registered === 1,
      sources: {
        membership: row.registered === 1,
        taskAssignments: row.assignments > 0,
        responsibilityAssignments: row.responsibilities > 0,
        equipmentRoles: row.equipment > 0,
        systemRoles: row.systems > 0,
      },
      usage: {
        taskAssignments: row.assignments,
        responsibilityAssignments: row.responsibilities,
        equipmentRoles: row.equipment,
        systemRoles: row.systems,
      },
    }));
    return { total, counts, resources, groups: groups(groupRows), offset: parameters.offset, limit: parameters.limit };
  }
  register(projectId: number, resourceId: number, now: string): boolean {
    const existing = this.database.prepare("SELECT 1 FROM project_resource_memberships WHERE project_id=? AND resource_id=?").get(projectId, resourceId);
    if (existing)
      return false;
    const count = this.database.prepare("SELECT COUNT(*) FROM (SELECT 1 FROM project_resource_memberships WHERE project_id=? LIMIT ?)")
      .pluck().get(projectId, MEMBERSHIP_LIMITS.projectMembers) as number;
    if (count >= MEMBERSHIP_LIMITS.projectMembers)
      limitExceeded();
    return this.database.prepare("INSERT INTO project_resource_memberships(project_id,resource_id,created_at) VALUES(?,?,?)")
      .run(projectId, resourceId, now).changes > 0;
  }
  unregister(projectId: number, resourceId: number): boolean {
    return this.database.prepare("DELETE FROM project_resource_memberships WHERE project_id=? AND resource_id=?")
      .run(projectId, resourceId).changes > 0;
  }
  inUse(projectId: number, resourceId: number): boolean {
    return !!this.database.prepare(`SELECT 1 FROM task_assignments WHERE project_id=@projectId AND resource_id=@resourceId
   UNION ALL SELECT 1 FROM project_equipment_resource_roles WHERE project_id=@projectId AND resource_id=@resourceId
   UNION ALL SELECT 1 FROM project_system_resource_roles WHERE project_id=@projectId AND resource_id=@resourceId LIMIT 1`)
      .get({ projectId, resourceId });
  }
  publicIds(projectId: number): string[] {
    const ids = this.database.prepare(`SELECT r.public_id FROM project_resource_memberships m
   JOIN resources r ON r.id=m.resource_id WHERE m.project_id=? ORDER BY r.public_id LIMIT ?`)
      .pluck().all(projectId, MEMBERSHIP_LIMITS.projectMembers + 1) as string[];
    if (ids.length > MEMBERSHIP_LIMITS.projectMembers)
      limitExceeded();
    return ids;
  }
  copy(sourceId: number, targetId: number, now: string): void {
    this.publicIds(sourceId);
    this.database.prepare(`INSERT INTO project_resource_memberships(project_id,resource_id,created_at)
   SELECT ?,resource_id,? FROM project_resource_memberships WHERE project_id=?`).run(targetId, now, sourceId);
  }
}
