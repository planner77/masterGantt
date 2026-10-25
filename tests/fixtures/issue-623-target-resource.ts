import type { ResourceKpiInput } from "../../src/domain/resources/resource-kpi";
import type { ResourceKpiLogisticsInput } from "../../src/domain/resources/resource-kpi-targets";
import { resourceKpiTask } from "./resource-kpi";
import { resourceTargetKpiFixture } from "./resource-target-kpi";
import { resourceKpiIntegrationFixture, RESOURCE_KPI_INTEGRATION } from "./resource-kpi-integration";

/** Logical IDs can be mapped to HTTP UUIDs; expectations always refer to canonical sources.
 * These fixed values are independent oracles, never recalculated by a test-only engine. */
export const ISSUE_623_TARGET_RESOURCE = {
  from: "2026-10-05", to: "2026-10-11", asOfDate: "2026-10-12", mdPerMm: 20,
  taskEnd: "2026-10-09", nextWorkingDate: "2026-10-12",
  sharedTaskId: "SHARED", sharedAssignmentId: "SHARED-R1", sharedResourceId: "R1",
  targetIds: ["TARGET-A", "TARGET-B"], groupIds: ["G1", "G2"], capacityResourceIds: ["R1", "R2", "R3", "R4"],
  sharedFilters: { taskIds: ["SHARED"] },
  overloadFilters: { resourceIds: ["R4"], targetIds: ["TARGET-A"] },
  expected: {
    shared: { knownMd: 5, plannedMm: 0.25, capacityMd: 20, assignmentIds: ["SHARED-R1"],
      targetKnownMd: [5, 5], equipmentIds: ["AMR-A", "AMR-B"], equipmentQuantity: 15,
      systemIds: ["ACS-A", "ACS-B", "MCS-1"], systemCount: 3,
      mcsBindingIds: ["SHARED-A", "SHARED-B", "SUMMARY-A"] },
    all: { knownMd: 20, plannedMm: 1, assignmentCount: 9, resourceCount: 4, taskCount: 8,
      diagnosticTaskCount: 10, unknownAssignmentIds: ["PARTIAL-R3", "UNSET-R2"],
      groupSubtotalSum: 33, capacityMd: 20 },
    overload: { selectedAssignmentIds: ["SELECTED-R4"], projectAssignmentIds: ["OUTSIDE-R4", "SELECTED-R4"],
      resourceIds: ["R4"], selectedLoadPercent: 80, projectLoadPercent: 140, capacityMd: 5,
      selectedKnownMd: 4, projectKnownMd: 7, excessMd: 2 },
    resource530: RESOURCE_KPI_INTEGRATION.expected,
  },
};

/** One canonical graph for Q1 Target/KPI/Plan checks; no production/persistence dependencies. */
export function issue623TargetResourceFixture(): ResourceKpiInput & { logistics: ResourceKpiLogisticsInput } {
  const base = resourceTargetKpiFixture(), c = ISSUE_623_TARGET_RESOURCE;
  return { ...base, projectPublicId: "P623", from: c.from, to: c.to, asOfDate: c.asOfDate, mdPerMm: c.mdPerMm,
    tasks: [
      resourceKpiTask("S", { type: "summary", duration: 5, end: c.taskEnd }),
      ...["M1", "M2"].map(taskId => {
        const date = taskId === "M1" ? c.taskEnd : c.nextWorkingDate;
        return resourceKpiTask(taskId, { type: "milestone", duration: 0, start: date, end: date });
      }),
      ...["SHARED", "ACS_ONLY", "LEGACY", "UNASSIGNED", "GROUP_ONLY", "PARTIAL", "UNSET", "ZERO", "SELECTED", "OUTSIDE"].map(taskId => resourceKpiTask(taskId, {
        parentTaskId: taskId === "SHARED" ? "S" : null,
        duration: taskId === "ZERO" ? 6 : 5, end: taskId === "ZERO" ? c.nextWorkingDate : c.taskEnd,
      })),
    ],
    memberships: [{ taskId: "SHARED", milestoneTaskId: "M1" }, { taskId: "UNASSIGNED", milestoneTaskId: "M1" },
      { taskId: "SELECTED", milestoneTaskId: "M2" }, { taskId: "OUTSIDE", milestoneTaskId: "M2" }],
    links: [{ id: "M1-M2", predecessorTaskId: "M1", successorTaskId: "M2", type: "FS", lag: 0 }],
    resources: [...base.resources.map(resource => ({ ...resource, groupIds: resource.resourceId === "R3" ? ["G1"] : resource.groupIds })),
      { resourceId: "R4", name: "R4", groupIds: ["G1", "G2"], roles: ["DEVELOPER"], developerGrade: "ADVANCED" }],
    assignments: [
      { assignmentId: "SHARED-R1", taskId: "SHARED", kind: "resource", targetId: "R1", allocationPercent: 100 },
      { assignmentId: "ACS_ONLY-R2", taskId: "ACS_ONLY", kind: "resource", targetId: "R2", allocationPercent: 100 },
      { assignmentId: "LEGACY-R1", taskId: "LEGACY", kind: "resource", targetId: "R1", allocationPercent: 20 },
      { assignmentId: "GROUP_ONLY-G1", taskId: "GROUP_ONLY", kind: "group", targetId: "G1", allocationPercent: null },
      { assignmentId: "PARTIAL-R2", taskId: "PARTIAL", kind: "resource", targetId: "R2", allocationPercent: 40 },
      { assignmentId: "PARTIAL-R3", taskId: "PARTIAL", kind: "resource", targetId: "R3", allocationPercent: null },
      { assignmentId: "UNSET-R2", taskId: "UNSET", kind: "resource", targetId: "R2", allocationPercent: null },
      { assignmentId: "ZERO-R3", taskId: "ZERO", kind: "resource", targetId: "R3", allocationPercent: 100, start: "2026-10-10", end: c.to },
      { assignmentId: "SELECTED-R4", taskId: "SELECTED", kind: "resource", targetId: "R4", allocationPercent: 80 },
      { assignmentId: "OUTSIDE-R4", taskId: "OUTSIDE", kind: "resource", targetId: "R4", allocationPercent: 60 },
    ],
    logistics: { ...base.logistics, targets: base.logistics.targets.filter(target => c.targetIds.includes(target.id)).map(target => ({ ...target, active: true })),
      bindings: [
        { id: "SUMMARY-A", taskId: "S", targetId: "TARGET-A", scope: "subtree", selection: "whole", memberIds: [] },
        { id: "SHARED-A", taskId: "SHARED", targetId: "TARGET-A", scope: "self", selection: "whole", memberIds: [] },
        { id: "SHARED-B", taskId: "SHARED", targetId: "TARGET-B", scope: "self", selection: "whole", memberIds: [] },
        ...["ACS_ONLY", "GROUP_ONLY", "PARTIAL"].map(taskId => ({ id: `${taskId}-A`, taskId, targetId: "TARGET-A", scope: "self" as const, selection: "subset" as const, memberIds: ["MEM-A-ACS"] })),
        { id: "UNSET-B", taskId: "UNSET", targetId: "TARGET-B", scope: "self", selection: "subset", memberIds: ["MEM-B-ACS"] },
        { id: "ZERO-A", taskId: "ZERO", targetId: "TARGET-A", scope: "self", selection: "subset", memberIds: ["MEM-A-AMR"] },
        { id: "SELECTED-A", taskId: "SELECTED", targetId: "TARGET-A", scope: "self", selection: "whole", memberIds: [] },
        { id: "OUTSIDE-B", taskId: "OUTSIDE", targetId: "TARGET-B", scope: "self", selection: "whole", memberIds: [] },
      ], legacy: [{ taskId: "LEGACY", kind: "system", entityId: "MCS-1", scope: "self" }],
    },
  };
}

/** #530's ledger remains unchanged; Q1 adds only independent canonical Target context. */
export function issue623Resource530Fixture(): ResourceKpiInput & { logistics: ResourceKpiLogisticsInput } {
  const base = resourceKpiIntegrationFixture(), graph = issue623TargetResourceFixture().logistics;
  return { ...base, logistics: { ...graph, legacy: [], bindings: [
    { id: "530-T1-A", taskId: "T1", targetId: "TARGET-A", scope: "self", selection: "whole", memberIds: [] },
    { id: "530-T1-B", taskId: "T1", targetId: "TARGET-B", scope: "self", selection: "whole", memberIds: [] },
  ] } };
}
