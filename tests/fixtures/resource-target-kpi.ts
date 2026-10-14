import type { ResourceKpiInput } from "../../src/domain/resources/resource-kpi";
import type { ResourceKpiLogisticsInput } from "../../src/domain/resources/resource-kpi-targets";
import { logisticsTargetBase, logisticsTargetResourceFixture } from "./logistics-targets";
import { resourceKpiTask } from "./resource-kpi";

/** #614 goldens plus the existing Resource Task/Assignment semantics; no operational data. */
export function resourceTargetKpiFixture(): ResourceKpiInput & { logistics: ResourceKpiLogisticsInput } {
  const input = logisticsTargetResourceFixture();
  const task = (id: string) => resourceKpiTask(id, { duration: 5, end: "2026-10-11" });
  return { ...input, tasks: [
    resourceKpiTask("SUMMARY", { type: "summary", duration: 5, end: "2026-10-11" }),
    ...input.tasks.map(row => row.taskId === "INTEGRATED" ? { ...row, parentTaskId: "SUMMARY" } : row),
    ...["ACS-ONLY", "LEGACY", "COMMON", "NOAREA", "MIXED"].map(task),
  ], assignments: [...input.assignments,
    { assignmentId: "A-ACS", taskId: "ACS-ONLY", kind: "resource", targetId: "R1", allocationPercent: 100 },
    { assignmentId: "A-LEGACY", taskId: "LEGACY", kind: "resource", targetId: "R1", allocationPercent: 20 },
    { assignmentId: "A-COMMON", taskId: "COMMON", kind: "resource", targetId: "R1", allocationPercent: 10 },
    { assignmentId: "A-NOAREA", taskId: "NOAREA", kind: "resource", targetId: "R2", allocationPercent: 10 },
    { assignmentId: "A-MIXED", taskId: "MIXED", kind: "resource", targetId: "R2", allocationPercent: 20 },
  ], logistics: {
    instances: [
      ...logisticsTargetBase.equipment.map(row => ({ kind: "equipment" as const, entityId: row.id, typeCode: row.equipmentType, quantity: row.quantity, projectProcessId: "P1" })),
      ...logisticsTargetBase.systems.map(row => ({ kind: "system" as const, entityId: row.id, typeCode: row.systemType, quantity: 1 })),
    ],
    processes: [{ id: "P1", occurrenceId: "OCC-A-ASSEMBLY" }, { id: "LEGACY-PROCESS", occurrenceId: null }],
    workAreas: logisticsTargetBase.workAreas.map(row => ({ id: row.id, occurrenceId: row.occurrenceId })),
    targets: [
      ...logisticsTargetBase.targets.map(row => ({ id: row.id, scope: row.scope, projectProcessId: "P1", occurrenceId: row.occurrenceId, workAreaId: row.workAreaId, active: false, members: row.members })),
      { id: "TARGET-COMMON", scope: "project_common", projectProcessId: null, occurrenceId: null, workAreaId: null, members: [{ id: "COMMON-MCS", kind: "system", entityId: "MCS-1" }] },
      { id: "TARGET-NOAREA", scope: "process", projectProcessId: "P1", occurrenceId: "OCC-A-ASSEMBLY", workAreaId: null, members: [{ id: "NOAREA-ACS", kind: "system", entityId: "ACS-A" }] },
      { id: "TARGET-UNUSED", scope: "process", projectProcessId: "P1", occurrenceId: "OCC-A-ASSEMBLY", workAreaId: null, members: [{ id: "UNUSED-ACS", kind: "system", entityId: "ACS-A" }] },
    ],
    bindings: [
      { id: "B-INHERITED", taskId: "SUMMARY", targetId: "TARGET-A", scope: "subtree", selection: "whole", memberIds: [] },
      { id: "B-DIRECT", taskId: "INTEGRATED", targetId: "TARGET-A", scope: "self", selection: "whole", memberIds: [] },
      { id: "B-B", taskId: "INTEGRATED", targetId: "TARGET-B", scope: "self", selection: "whole", memberIds: [] },
      { id: "B-ACS", taskId: "ACS-ONLY", targetId: "TARGET-A", scope: "self", selection: "subset", memberIds: ["MEM-A-ACS"] },
      { id: "B-MIXED", taskId: "MIXED", targetId: "TARGET-A", scope: "self", selection: "subset", memberIds: ["MEM-A-ACS"] },
      { id: "B-COMMON", taskId: "COMMON", targetId: "TARGET-COMMON", scope: "self", selection: "whole", memberIds: [] },
      { id: "B-NOAREA", taskId: "NOAREA", targetId: "TARGET-NOAREA", scope: "self", selection: "whole", memberIds: [] },
    ], legacy: [
      { taskId: "LEGACY", kind: "system", entityId: "MCS-1", scope: "self" },
      { taskId: "MIXED", kind: "equipment", entityId: "AMR-B", scope: "self" },
    ],
  } };
}
