import { describe, expect, it } from "vitest";
import { resourceDashboardUiFixture } from "../../fixtures/resource-dashboard-ui";
import type { StatefulProjectFixture } from "../../fixtures/stateful-project";
import { resourceExportFilterNames, captureResourceExportLease, resourceExportCanReconfirm, resourceExportBindingKey, resourceExportBodyBudget, resourceExportCanDeliver, resourceExportDownloadToken, resourceExportGuardReason, resourceExportIntent, type ResourceExportLease, type ResourceExportLiveState } from "../../../src/features/resources/resource-export-model";

function evidence() {
  const report = resourceDashboardUiFixture({ project: { publicId: "project", revision: 40 } } as StatefulProjectFixture);
  report.resourceScopeContext = { projectPublicId: report.projectPublicId, projectRevision: report.projectRevision,
    catalogRevision: report.catalogRevision, calendarRevision: report.calendarRevision, dataSnapshotId: "d".repeat(64),
    range: report.range, asOfDate: report.asOfDate, mdPerMm: report.mdPerMm, mdPerMmSource: report.mdPerMmSource,
    mdPerMmProvided: false, sourceProjection: { kind: "report" } };
  const lease = { confirmationId: 1, visitId: 3, queryKey: "mode=group", bindingKey: "null", report, binding: null as ResourceExportLease["binding"] } satisfies ResourceExportLease;
  const live = { confirmationId: 1, visitId: 3, active: true, phase: "ready", queryKey: lease.queryKey,
    bindingKey: "null", projectPublicId: report.projectPublicId, projectRevision: 40, context: structuredClone(report.resourceScopeContext!), readAllowed: true } satisfies ResourceExportLiveState;
  return { lease, live };
}
describe("Resource Excel export evidence", () => {
  it("shows the immutable Task and WBS filter IDs alongside catalog names", () => {
    const entries = [
      { id: "task-uuid", name: "시운전", type: "task" as const },
      { id: "summary-uuid", name: "물류시스템 WBS", type: "summary" as const },
    ];
    expect(resourceExportFilterNames(["task-uuid"], entries)).toBe("시운전 · task-uuid");
    expect(resourceExportFilterNames(["summary-uuid"], entries)).toBe("물류시스템 WBS · summary-uuid");
    expect(resourceExportFilterNames(["task-uuid", "missing-id"], entries)).toBe("시운전 · task-uuid / missing-id");
    expect(resourceExportFilterNames([], entries)).toBe("전체");
    expect(resourceExportFilterNames(["res-01"], [{ id: "res-01", name: "Alice", code: "ENG" }]))
      .toBe("Alice (ENG) · res-01");
  });

  it("requires the current active ready visit and exact query/binding", () => {
    const { lease, live } = evidence();
    expect(resourceExportGuardReason(lease, live)).toBeNull();
    for (const [changed, reason] of [
      [{ active: false }, "inactive-visit"], [{ phase: "loading" }, "loading-report"],
      [{ visitId: 4 }, "visit-changed"], [{ confirmationId: 2 }, "report-changed"], [{ queryKey: "other" }, "query-changed"],
      [{ bindingKey: "other" }, "binding-changed"], [{ readAllowed: false }, "read-denied"],
    ] as const) expect(resourceExportGuardReason(lease, { ...live, ...changed })).toBe(reason);
    expect(resourceExportGuardReason(null, live)).toBe("missing-report");
  });
  it("rejects same project revision with a changed catalog, calendar or assignment fingerprint", () => {
    const { lease, live } = evidence();
    for (const changed of [{ catalogRevision: 2 }, { calendarRevision: "different" }, { dataSnapshotId: "different" }])
      expect(resourceExportGuardReason(lease, { ...live, context: { ...live.context!, ...changed } })).toBe("stale-context");
    expect(resourceExportGuardReason(lease, { ...live, projectRevision: 41 })).toBe("stale-context");
  });
  it("retains original drill policy separately from the actual target report", () => {
    const { lease, live } = evidence();
    lease.binding = { sourceContext: { ...live.context!, mdPerMm: null, mdPerMmSource: "query", mdPerMmProvided: true,
      sourceProjection: { kind: "schedule" } }, scope: { kind: "exactAssignments", assignmentIds: ["original-assignment"] } };
    lease.bindingKey = resourceExportBindingKey(lease.binding); live.bindingKey = lease.bindingKey;
    expect(resourceExportGuardReason(lease, live)).toBeNull();
    const intent = resourceExportIntent(lease, "current", ["week"]);
    expect(intent.originalSourceContext?.mdPerMm).toBeNull();
    expect(intent.expectedReport.context.mdPerMm).toBe(20);
    expect(intent.basis === "current" && intent.binding?.scope).toEqual(lease.binding.scope);
    const captured = captureResourceExportLease(lease);
    lease.binding.scope = { kind: "exactAssignments", assignmentIds: ["changed"] };
    expect(resourceExportIntent(captured, "current", ["week"])).toHaveProperty("binding.scope.assignmentIds", ["original-assignment"]);
    expect(resourceExportGuardReason({ ...captured, binding: null }, live)).toBe("binding-changed");
  });
  it("rejects actual policy/asOf drift and unavailable source", () => {
    const { lease, live } = evidence();
    for (const changed of [{ mdPerMm: null }, { mdPerMmSource: "query" as const }, { asOfDate: "2026-09-19" }])
      expect(resourceExportGuardReason(lease, { ...live, context: { ...live.context!, ...changed } })).toBe("stale-policy");
    lease.report.mdPerMm = 0;
    expect(resourceExportGuardReason(lease, live)).toBe("stale-policy");
    expect(resourceExportGuardReason(lease, { ...live, context: null })).toBe("source-unavailable");
  });
  it("whole sends only confirmed context and never mutates filters or the original scope", () => {
    const { lease } = evidence();
    lease.report.filters.search = "동명이인"; lease.report.filters.taskIds = ["task"];
    const before = structuredClone(lease);
    const intent = resourceExportIntent(lease, "project", ["week", "month"]);
    expect(intent.expectedReport).toEqual({ context: lease.report.resourceScopeContext });
    expect(intent).not.toHaveProperty("binding"); expect(intent.expectedReport).not.toHaveProperty("filters");
    expect(intent.expectedReport).not.toHaveProperty("snapshotId"); expect(lease).toEqual(before);
  });
  it("current preserves nullable requested defaults and omits DTO-only conversion metadata", () => {
    const { lease } = evidence();
    const current = resourceExportIntent(lease, "current", ["month"]);
    if (current.basis !== "current") throw new Error("unexpected basis");
    expect(current.expectedReport.filters).not.toHaveProperty("from");
    expect(current.expectedReport.filters).not.toHaveProperty("mdPerMmProvided");
    expect(current.expectedReport.filters).not.toHaveProperty("mdPerMm");
    lease.report.filters.mdPerMmProvided = true;
    expect(resourceExportIntent(lease, "current", ["week"]).expectedReport).toHaveProperty("filters.mdPerMm", null);
    const captured = captureResourceExportLease(lease); lease.report.filters.search = "new";
    expect(captured.report.filters.search).toBe("");
  });
  it("rejects zero, duplicate or excessive period choices", () => {
    const { lease } = evidence();
    for (const choices of [[], ["week", "week"], ["week", "month", "week"]] as const)
      expect(() => resourceExportIntent(lease, "current", choices)).toThrow("INVALID_GRANULARITIES");
  });
  it("counts the whole request UTF-8 body and fails without truncation", () => {
    expect(resourceExportBodyBudget("a".repeat(8190))).toEqual({ allowed: true, bytes: 8192, reason: null });
    expect(resourceExportBodyBudget("a".repeat(8191))).toEqual({ allowed: false, bytes: 8193, reason: "body-limit" });
    expect(resourceExportBodyBudget("가".repeat(2731)).allowed).toBe(false);
    expect(resourceExportBodyBudget({ exact: Array.from({ length: 500 }, (_, n) => `assignment-${n}`) }).allowed).toBe(false);
    expect(resourceExportBodyBudget(BigInt(1)).reason).toBe("invalid-json");
  });
  it("compares rejected receipts only inside one visit/query/binding and requires ready explicit reconfirmation", () => {
    const { lease, live } = evidence();
    const rejected = { projectPublicId: lease.report.projectPublicId, visitId: 3, queryKey: lease.queryKey, bindingKey: lease.bindingKey, confirmationId: 20 };
    expect(resourceExportCanReconfirm(rejected, lease, live)).toBe(false);
    const newVisit = { ...lease, visitId: 4, confirmationId: 1 }, newLive = { ...live, visitId: 4, confirmationId: 1 };
    expect(resourceExportCanReconfirm(rejected, newVisit, newLive)).toBe(true);
    const newProject = captureResourceExportLease(lease);
    newProject.report.projectPublicId = "another-project";
    newProject.report.resourceScopeContext!.projectPublicId = "another-project";
    expect(resourceExportCanReconfirm(rejected, newProject, { ...live, projectPublicId: "another-project", context: newProject.report.resourceScopeContext! })).toBe(true);

    expect(resourceExportCanReconfirm(rejected, newVisit, { ...newLive, phase: "loading" })).toBe(false);
    expect(resourceExportCanReconfirm(rejected, { ...lease, confirmationId: 21 }, { ...live, confirmationId: 21 })).toBe(true);
    expect(resourceExportCanReconfirm(rejected, { ...lease, queryKey: "new" }, { ...live, queryKey: "new" })).toBe(true);
    const token = resourceExportDownloadToken(2, lease, resourceExportIntent(lease, "current", ["week"]));
    expect(resourceExportCanDeliver(token, 2, true, false, newVisit, newLive, resourceExportIntent(newVisit, "current", ["week"]))).toBe(false);
  });
  it("discards late downloads after generation, visit, context, close, abort or option changes", () => {
    const { lease, live } = evidence(); const options = resourceExportIntent(lease, "current", ["week"]);
    const token = resourceExportDownloadToken(7, lease, options);
    expect(resourceExportCanDeliver(token, 7, true, false, lease, live, options)).toBe(true);
    expect(resourceExportCanDeliver(token, 8, true, false, lease, live, options)).toBe(false);
    expect(resourceExportCanDeliver(token, 7, false, false, lease, live, options)).toBe(false);
    expect(resourceExportCanDeliver(token, 7, true, true, lease, live, options)).toBe(false);
    expect(resourceExportCanDeliver(token, 7, true, false, lease, { ...live, visitId: 9 }, options)).toBe(false);
    expect(resourceExportCanDeliver(token, 7, true, false, lease, live, resourceExportIntent(lease, "project", ["week"]))).toBe(false);
  });
});
