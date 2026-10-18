import type { WbsTaskLedgerInput } from "../../src/domain/resources/wbs-task-ledger";
import type { ProjectResourceMembershipDto } from "../../src/contracts/project-resource-memberships";
import { createWorkingCalendar } from "../../src/domain/scheduling/calendar";
import { resourceKpiTask } from "./resource-kpi";
import type { ResourceKpiInput } from "../../src/domain/resources/resource-kpi";

export function ledgerMembership(id: string, registered = true): ProjectResourceMembershipDto {
  return { id, name: id, code: id, description: "", active: true, roles: [], developerGrade: null, groups: [], registered,
    sources: { membership: registered, taskAssignments: false, responsibilityAssignments: false, equipmentRoles: false, systemRoles: false },
    usage: { taskAssignments: 0, responsibilityAssignments: 0, equipmentRoles: 0, systemRoles: 0 } };
}
/** Adapter of the actual #725/#727 DTOs, not another public API. */
export function ledgerFromKpi(kpi: ResourceKpiInput & { logistics: NonNullable<ResourceKpiInput["logistics"]> }): WbsTaskLedgerInput {
  return { version: "wbs-task-ledger:v1", contextSourceVersion: "explicit-task-context:v1", snapshotProjectPublicId: kpi.projectPublicId, kpi,
    taskContexts: kpi.tasks.map(task => ({ taskId: task.taskId, processLinks: [], workAreaLinks: [] })),
    equipmentWorkAreas: [], equipment: kpi.logistics.instances.filter(row => row.kind === "equipment").map(row => ({ id: row.entityId, controlSystems: [], resourceRoles: [] })),
    systems: kpi.logistics.instances.filter(row => row.kind === "system").map(row => ({ id: row.entityId, layer: "controller", scope: "project", processIds: [], coordinatedSystemIds: [], resourceRoles: [] })),
    resourceMemberships: kpi.resources.map(row => ledgerMembership(row.resourceId)) };
}
/** W1/W2 decision oracle: four raw personal Assignments, never allocated by process. */
export function wbsTaskLedgerFixture(): WbsTaskLedgerInput {
  const from = "2026-10-05", to = "2026-10-09";
  const kpi: WbsTaskLedgerInput["kpi"] = { projectPublicId: "P728", timezone: "Asia/Seoul", asOfDate: "2026-10-12", from, to, mdPerMm: 20,
    projectCalendar: createWorkingCalendar({ timezone: "Asia/Seoul", weekendDays: [6, 0] }),
    tasks: [resourceKpiTask("S", { type: "summary", duration: 5 }),
      resourceKpiTask("M", { type: "milestone", duration: 0, start: to, end: to }),
      ...["T0", "T1", "T2", "T3", "UNASSIGNED", "GROUP_ONLY"].map(id => resourceKpiTask(id, { parentTaskId: id === "T0" ? "S" : null, duration: 5, start: from, end: to, progress: id === "T1" ? 100 : 0, status: id === "T1" ? "completed" : "not_started" }))],
    memberships: [{ taskId: "T1", milestoneTaskId: "M" }, { taskId: "T2", milestoneTaskId: "M" }], links: [],
    resources: [{ resourceId: "R1", groupIds: ["G1", "G2"], roles: ["DEVELOPER"], developerGrade: "ADVANCED" }, { resourceId: "R2", groupIds: [], roles: [], developerGrade: null }],
    assignments: [2, 3, 4, 5].map((md, index) => ({ assignmentId: `A${index}`, taskId: `T${index}`, kind: "resource", targetId: "R1", allocationPercent: md / 5 * 100 })),
    logistics: { targets: [], instances: [
      { kind: "equipment", entityId: "E10", typeCode: "amr", quantity: 10, projectProcessId: "PA" },
      { kind: "equipment", entityId: "E5", typeCode: "amr", quantity: 5, projectProcessId: "PB", active: false },
      { kind: "system", entityId: "ACS-A", typeCode: "acs", quantity: 1 }, { kind: "system", entityId: "ACS-B", typeCode: "acs", quantity: 1 },
      { kind: "system", entityId: "MCS", typeCode: "mcs", quantity: 1 }],
      processes: [{ id: "PA", occurrenceId: "OA", processTypeId: "ASSEMBLY" }, { id: "PB", occurrenceId: "OB", processTypeId: "INSPECT" }, { id: "P-NOMAP", occurrenceId: null }],
      workAreas: [{ id: "WA", occurrenceId: "OA" }, { id: "WB", occurrenceId: "OB" }], bindings: [],
      legacy: [
        ...["T0", "T1", "T2", "T3"].map(taskId => ({ taskId, kind: "system" as const, entityId: "MCS", scope: "self" as const })),
        ...["E10", "E5"].map(entityId => ({ taskId: "T3", kind: "equipment" as const, entityId, scope: "self" as const })),
        ...["ACS-A", "ACS-B"].map(entityId => ({ taskId: "T3", kind: "system" as const, entityId, scope: "self" as const }))] } };
  kpi.assignments = [...kpi.assignments, { assignmentId: "GROUP", taskId: "GROUP_ONLY", kind: "group", targetId: "G1", allocationPercent: null }];
  const input = ledgerFromKpi(kpi);
  input.taskContexts = input.taskContexts.map(row => ({ ...row,
    processLinks: row.taskId === "S" ? [{ processId: "PB", scope: "subtree" }] : row.taskId === "T1" ? [{ processId: "PA", scope: "self" }] : row.taskId === "T2" ? [{ processId: "PB", scope: "self" }] : row.taskId === "T3" ? [{ processId: "PA", scope: "self" }, { processId: "PB", scope: "self" }] : [],
    workAreaLinks: row.taskId === "T3" ? [{ processId: "PA", workAreaId: "WA", scope: "self" }, { processId: "PB", workAreaId: "WB", scope: "self" }] : [] }));
  input.equipmentWorkAreas = [{ equipmentId: "E10", processId: "PA", occurrenceId: "OA", workAreaId: "WA" }, { equipmentId: "E10", processId: "PB", occurrenceId: "OB", workAreaId: "WB" }];
  input.equipment = input.equipment.map(row => ({ ...row, controlSystems: row.id === "E10" ? [{ systemId: "ACS-A", controlRole: "primary" }] : [] }));
  input.systems = input.systems.map(row => row.id === "MCS" ? { ...row, layer: "coordinator", scope: "processes", processIds: ["PA", "PB"], coordinatedSystemIds: ["ACS-A", "ACS-B"] } : row);
  return input;
}
