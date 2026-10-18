import type Database from "better-sqlite3";
import type { ProjectResourceMembershipDto } from "../../contracts/project-resource-memberships";
import type { DashboardResourceRecord, DashboardGroupRecord } from "./resource-dashboard-repository-core";
import { LogisticsService } from "../logistics/logistics-service-core";
import { PublicApiError } from "../http/api-error-core";

/** Complete Project population, in bulk and inside the caller's read transaction. */
export function readWbsViewContext(db: Database.Database, projectId: number, resources: DashboardResourceRecord[], groups: DashboardGroupRecord[]) {
  const tables = ["task_process_contexts", "task_process_links", "task_work_area_links", "equipment_work_areas", "project_resource_memberships", "project_equipment_systems", "project_system_processes", "project_system_links", "project_equipment_resource_roles", "project_system_resource_roles"];
  let count = resources.length + groups.reduce((sum, row) => sum + row.memberResourceIds.length, 0);
  // Count before loading the additional graph; never truncate a partial snapshot.
  for (const table of tables) {
    count += db.prepare(`SELECT COUNT(*) FROM ${table} WHERE project_id=?`).pluck().get(projectId) as number;
    if (count > 100_000) throw new PublicApiError(422, "REPORT_LIMIT_EXCEEDED", "WBS 문맥 원본 관계 조회 한도를 초과했습니다.");
  }
  const logistics = new LogisticsService(db).getLogisticsDto(projectId);
  const usage = db.prepare(`WITH usage AS (
    SELECT resource_id,CASE WHEN t.type='task' THEN 'assignment' ELSE 'responsibility' END kind FROM task_assignments a JOIN tasks t ON t.id=a.task_id AND t.project_id=a.project_id WHERE a.project_id=? AND resource_id IS NOT NULL
    UNION ALL SELECT resource_id,'equipment' FROM project_equipment_resource_roles WHERE project_id=?
    UNION ALL SELECT resource_id,'system' FROM project_system_resource_roles WHERE project_id=?)
    SELECT r.public_id id,SUM(u.kind='assignment') assignments,SUM(u.kind='responsibility') responsibilities,SUM(u.kind='equipment') equipment,SUM(u.kind='system') systems
    FROM usage u JOIN resources r ON r.id=u.resource_id GROUP BY r.public_id ORDER BY r.public_id`).all(projectId, projectId, projectId) as Array<{ id: string; assignments: number; responsibilities: number; equipment: number; systems: number }>;
  const byUsage = new Map(usage.map(row => [row.id, row]));
  const registered = new Set(db.prepare("SELECT r.public_id FROM project_resource_memberships m JOIN resources r ON r.id=m.resource_id WHERE m.project_id=? ORDER BY r.public_id").pluck().all(projectId) as string[]);
  const resourceMemberships: ProjectResourceMembershipDto[] = resources.map(resource => {
    const used = byUsage.get(resource.publicId), membership = registered.has(resource.publicId);
    const usage = { taskAssignments: used?.assignments ?? 0, responsibilityAssignments: used?.responsibilities ?? 0, equipmentRoles: used?.equipment ?? 0, systemRoles: used?.systems ?? 0 };
    return { id: resource.publicId, name: resource.name, code: resource.code, description: "", active: resource.active, roles: resource.roles.filter((role): role is Exclude<typeof role, "UNSPECIFIED"> => role !== "UNSPECIFIED"), developerGrade: resource.developerGrade,
      groups: groups.filter(group => group.memberResourceIds.includes(resource.publicId)).map(group => ({ id: group.publicId, name: group.name, active: group.active })), registered: membership,
      usage, sources: { membership, taskAssignments: usage.taskAssignments > 0, responsibilityAssignments: usage.responsibilityAssignments > 0, equipmentRoles: usage.equipmentRoles > 0, systemRoles: usage.systemRoles > 0 } };
  });
  return { taskContexts: logistics.taskProcessContexts!, equipmentWorkAreas: logistics.equipmentWorkAreas!, equipment: logistics.equipment, systems: logistics.systems, resourceMemberships };
}
