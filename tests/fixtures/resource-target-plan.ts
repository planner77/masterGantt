import type { ResourceKpiInput } from "../../src/domain/resources/resource-kpi";
import type { ResourceKpiLogisticsInput } from "../../src/domain/resources/resource-kpi-targets";
import { resourceKpiTask } from "./resource-kpi";
import { resourceTargetKpiFixture } from "./resource-target-kpi";

/** #622 uses the existing canonical Target resolver and personal Assignment ledger. */
export function resourceTargetPlanFixture(): ResourceKpiInput & { logistics: ResourceKpiLogisticsInput } {
  const base = resourceTargetKpiFixture();
  return { ...base, tasks: [
    resourceKpiTask("S", { type: "summary", duration: 5, end: base.to }),
    ...["SELECTED", "OUTSIDE", "OTHER", "UNKNOWN", "ZERO"].map(taskId => resourceKpiTask(taskId, {
      parentTaskId: taskId === "SELECTED" ? "S" : null, duration: 5, end: base.to,
    })),
  ], resources: base.resources.slice(0, 2), assignments: [
    { assignmentId: "A80", taskId: "SELECTED", kind: "resource", targetId: "R1", allocationPercent: 80 },
    { assignmentId: "A60", taskId: "OUTSIDE", kind: "resource", targetId: "R1", allocationPercent: 60 },
    { assignmentId: "OTHER50", taskId: "OTHER", kind: "resource", targetId: "R2", allocationPercent: 50 },
  ], logistics: { ...base.logistics, bindings: [
    { id: "INHERITED-A", taskId: "S", targetId: "TARGET-A", scope: "subtree", selection: "whole", memberIds: [] },
    { id: "DIRECT-A", taskId: "SELECTED", targetId: "TARGET-A", scope: "self", selection: "whole", memberIds: [] },
    { id: "DIRECT-B", taskId: "SELECTED", targetId: "TARGET-B", scope: "self", selection: "whole", memberIds: [] },
  ], legacy: [{ taskId: "OUTSIDE", kind: "system", entityId: "MCS-1", scope: "self" }] } };
}
