import type Database from "better-sqlite3";
import type { ScheduleViewSourceDto } from "../../contracts/schedule-views";
import type { TaskLogisticsCompatibilityLink, TaskLogisticsLinksDto } from "../../contracts/logistics";
import { RESOURCE_DASHBOARD_LIMITS } from "../../contracts/resource-dashboard";
import { resolveAllTaskTargetBindings } from "../../domain/logistics/task-target-bindings";
import { PublicApiError } from "../http/api-error-core";
import { loadBoundedTaskLogisticsSnapshot, LogisticsCompatibilityError } from "../logistics/task-logistics-compatibility-core";
import { displayNameTranslationFieldMap } from "./display-name-translations-repository-core";
import { LogisticsRepository } from "./logistics-repository-core";
import { LogisticsTypeCatalogRepository } from "./logistics-type-catalog-repository-core";
import { ResourceCatalogRepository } from "./resource-catalog-repository-core";

export class ScheduleViewSourceInvalidError extends Error {
  constructor() { super("Schedule view source references are inconsistent."); }
}

/** Caller owns the Project read gate and one encompassing deferred read transaction. */
export class ScheduleViewSourceRepository {
  constructor(private readonly database: Database.Database) {}

  read(projectId: number): Omit<ScheduleViewSourceDto, "schema" | "projectPublicId" | "projectRevision"> {
    const catalog = new ResourceCatalogRepository(this.database);
    const assignmentCount = this.database.prepare("SELECT count(*) count FROM task_assignments WHERE project_id=?").get(projectId) as { count: number };
    if (assignmentCount.count > RESOURCE_DASHBOARD_LIMITS.assignments) {
      throw new PublicApiError(422, "SCHEDULE_VIEW_SOURCE_LIMIT_EXCEEDED", "일정 View 조회 한도를 초과했습니다. 프로젝트의 연결 범위를 확인해 주세요.");
    }
    const brokenMembership = this.database.prepare(`SELECT 1 FROM resource_group_members gm WHERE (
      gm.resource_id IN (SELECT resource_id FROM task_assignments WHERE project_id=? AND resource_id IS NOT NULL) OR
      gm.group_id IN (SELECT group_id FROM task_assignments WHERE project_id=? AND group_id IS NOT NULL)) AND (
      NOT EXISTS(SELECT 1 FROM resources r WHERE r.id=gm.resource_id) OR
      NOT EXISTS(SELECT 1 FROM resource_groups g WHERE g.id=gm.group_id)) LIMIT 1`).get(projectId, projectId);
    if (brokenMembership) throw new ScheduleViewSourceInvalidError();
    const membershipCount = this.database.prepare(`SELECT count(*) count FROM resource_group_members gm WHERE
      gm.resource_id IN (SELECT resource_id FROM task_assignments WHERE project_id=? AND resource_id IS NOT NULL)`)
      .get(projectId) as { count: number };
    if (membershipCount.count > RESOURCE_DASHBOARD_LIMITS.catalogMemberships) {
      throw new PublicApiError(422, "SCHEDULE_VIEW_SOURCE_LIMIT_EXCEEDED", "일정 View 조회 한도를 초과했습니다. 프로젝트의 연결 범위를 확인해 주세요.");
    }
    const records = catalog.listAssignments(projectId);
    if (records.length !== assignmentCount.count || records.some(row => !row.targetPublicId)) throw new ScheduleViewSourceInvalidError();
    // Only resources explicitly assigned in this Project are disclosed. Project membership,
    // equipment ownership and Group membership never create personal Task assignments.
    const resources = this.database.prepare(`SELECT r.public_id id,r.name,r.active FROM resources r WHERE r.id IN
      (SELECT resource_id FROM task_assignments WHERE project_id=? AND resource_id IS NOT NULL) ORDER BY lower(r.name),r.public_id`)
      .all(projectId) as Array<{ id: string; name: string; active: number }>;
    const groupRows = this.database.prepare(`SELECT g.id internalId,g.public_id id,g.name,g.active FROM resource_groups g WHERE
      g.id IN (SELECT group_id FROM task_assignments WHERE project_id=? AND group_id IS NOT NULL) OR
      g.id IN (SELECT gm.group_id FROM resource_group_members gm JOIN task_assignments a ON a.resource_id=gm.resource_id WHERE a.project_id=?)
      ORDER BY lower(g.name),g.public_id`).all(projectId, projectId) as Array<{ internalId: number; id: string; name: string; active: number }>;
    const resourceIds = new Set(resources.map(row => row.id));
    const groupIds = new Set(groupRows.map(row => row.id));
    if (records.some(row => !(row.kind === "resource" ? resourceIds : groupIds).has(row.targetPublicId))) throw new ScheduleViewSourceInvalidError();
    const members = this.database.prepare(`SELECT g.public_id groupId,r.public_id resourceId FROM resource_group_members gm
      JOIN resource_groups g ON g.id=gm.group_id JOIN resources r ON r.id=gm.resource_id
      WHERE r.id IN (SELECT resource_id FROM task_assignments WHERE project_id=? AND resource_id IS NOT NULL)
      ORDER BY g.public_id,r.public_id`).all(projectId) as Array<{ groupId: string; resourceId: string }>;
    const membership = new Map<string, string[]>();
    for (const row of members) {
      const ids = membership.get(row.groupId) ?? [];
      ids.push(row.resourceId); membership.set(row.groupId, ids);
    }
    const groupTranslations = displayNameTranslationFieldMap(this.database, "resource_groups", groupRows.map(row => row.internalId));
    const logistics = new LogisticsRepository(this.database);
    // The bounded loader checks broken project references before any inner join can hide them.
    const snapshot = loadBoundedTaskLogisticsSnapshot(this.database, projectId);
    const resolved = resolveAllTaskTargetBindings(snapshot);
    const equipment = logistics.listEquipment(projectId);
    const equipmentById = new Map(equipment.map(row => [row.publicId, row]));
    const equipmentTranslations = displayNameTranslationFieldMap(this.database, "project_equipment", equipment.map(row => row.id));
    const tasks = new Map((this.database.prepare("SELECT public_id id,name FROM tasks WHERE project_id=?").all(projectId) as Array<{ id: string; name: string }>).map(row => [row.id, row.name]));
    const types = new LogisticsTypeCatalogRepository(this.database);
    const usedTypes = new Set(equipment.map(row => row.equipmentType));
    const equipmentTypes = types.list("equipment").filter(row => usedTypes.has(row.code));
    if (equipmentTypes.length !== usedTypes.size) throw new ScheduleViewSourceInvalidError();
    const taskEquipment: TaskLogisticsLinksDto[] = [];
    for (const [taskId, effective] of resolved) {
      const equipmentSources = effective.legacySources.filter(row => row.kind === "equipment");
      const directEquipmentLinks: TaskLogisticsLinksDto["directEquipmentLinks"] = [];
      const inheritedEquipmentLinks: TaskLogisticsLinksDto["inheritedEquipmentLinks"] = [];
      for (const source of equipmentSources) {
        const entity = equipmentById.get(source.entityId), sourceTaskName = tasks.get(source.sourceTaskId);
        if (!entity || sourceTaskName === undefined) throw new LogisticsCompatibilityError();
        const link = { equipmentId: entity.publicId, scope: source.scope, equipmentCode: entity.code, equipmentName: entity.name, equipmentType: entity.equipmentType, active: entity.active === 1 };
        if (source.inherited) inheritedEquipmentLinks.push({ ...link, sourceTaskId: source.sourceTaskId, sourceTaskName });
        else directEquipmentLinks.push(link);
      }
      const compatibilityLinks: TaskLogisticsCompatibilityLink[] = effective.effectiveMembers.filter(member => member.kind === "equipment").flatMap(member => {
        const entity = equipmentById.get(member.entityId);
        if (!entity) throw new LogisticsCompatibilityError();
        return member.provenance.map(source => {
          const sourceTaskName = tasks.get(source.sourceTaskId);
          if (sourceTaskName === undefined) throw new LogisticsCompatibilityError();
          return { sourceId: source.bindingId, kind: "equipment" as const, entityId: entity.publicId, code: entity.code, name: entity.name,
            active: entity.active === 1, sourceTaskId: source.sourceTaskId, sourceTaskName, scope: source.scope, inherited: source.inherited,
            selection: source.selection, coverage: source.coverage, coverageMode: source.coverageMode, readonly: true as const };
        });
      });
      taskEquipment.push({ taskId, directEquipmentLinks, inheritedEquipmentLinks, effectiveEquipmentIds: effective.effectiveEquipmentIds,
        directSystemLinks: [], inheritedSystemLinks: [], effectiveSystemIds: [], compatibilityLinks });
    }
    return {
      catalogRevision: catalog.getRevision(), logisticsTypeCatalogRevision: types.getRevision(),
      assignments: records.map(row => ({ id: row.publicId, taskId: row.taskPublicId, target: { kind: row.kind, id: row.targetPublicId },
        role: null, allocation: row.kind === "resource" ? { start: row.assignmentStart, end: row.assignmentEnd, percent: row.allocationPercent } : null })),
      resources: resources.map(row => ({ ...row, active: row.active === 1 })),
      groups: groupRows.map(row => ({ id: row.id, name: row.name, active: row.active === 1, memberResourceIds: membership.get(row.id) ?? [], ...groupTranslations.get(String(row.internalId)) })),
      equipment: equipment.map(row => ({ id: row.publicId, name: row.name, active: row.active === 1, equipmentType: row.equipmentType, model: row.model,
        managementUnit: row.managementUnit, quantity: row.quantity, ...equipmentTranslations.get(String(row.id)) })),
      equipmentTypes: equipmentTypes.map(row => ({ code: row.code, name: row.name, active: row.active, ...(row.translations ? { translations: row.translations } : {}) })),
      taskEquipment,
    };
  }
}
