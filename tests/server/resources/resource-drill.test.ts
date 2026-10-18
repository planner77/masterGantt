import { MilestoneMembershipRepository } from "../../../src/server/repositories/milestone-membership-repository-core";
import { writeFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import type { ResourceDashboardDto } from "../../../src/contracts/resource-dashboard";
import type { ResourceDrillQueryInput, ResourceDrillQueryResponse, ResourceDrillScopeDto } from "../../../src/contracts/resource-drill";
import { RESOURCE_DRILL_LIMITS } from "../../../src/contracts/resource-drill";
import { MilestoneDashboardService } from "../../../src/server/projects/milestone-dashboard-service-core";
import { handleResourceDrill } from "../../../src/server/resources/resource-dashboard-handlers-core";
import { ResourceDashboardService, assertResourcePlanResponseBytes } from "../../../src/server/resources/resource-dashboard-service-core";
import { resourceDashboardFixture, RESOURCE_DASHBOARD_NOW } from "../../fixtures/resource-dashboard";

const fixtures: ReturnType<typeof resourceDashboardFixture>[] = [];
function fixture() { const f = resourceDashboardFixture(); fixtures.push(f); return f; }
afterEach(() => { for (const f of fixtures.splice(0)) f.database.close(); });
const options = { applicationBaseUrl: "https://gantt.example", environment: "production", requestId: () => "drill-test" };
function body(f: ReturnType<typeof fixture>, changes: Partial<ResourceDrillQueryInput> = {}): ResourceDrillQueryInput {
  return { sourceContext: f.service.getDashboard(f.project.publicId)!.resourceScopeContext!, scope: { kind: "scheduleSelection", nodeIds: [f.tasks.get("S")!.publicId] }, filters: {}, projection: { kind: "report" }, ...changes };
}
function post(f: ReturnType<typeof fixture>, input: unknown, headers: HeadersInit = {}) {
  return handleResourceDrill(new Request(`https://gantt.example/api/projects/${f.project.publicId}/resource-dashboard/query`, { method: "POST", headers: { "Origin": "https://gantt.example", "Content-Type": "application/json", ...headers }, body: JSON.stringify(input) }), f.project.publicId, { service: f.service, ...options }, true);
}
function scope(f: ReturnType<typeof fixture>, query: URLSearchParams) {
  return handleResourceDrill(new Request(`https://gantt.example/api/projects/${f.project.publicId}/resource-dashboard/scope?${query}`), f.project.publicId, { service: f.service, ...options });
}
async function report(response: Response) { expect(response.status).toBe(200); return (await response.json() as ResourceDrillQueryResponse).data as ResourceDashboardDto; }
function addTask(f: ReturnType<typeof fixture>, name: string, parentId: number | null = null) {
  return f.schedules.insertTask({ projectId: f.project.id, publicId: randomUUID(), externalId: name, name, type: "task", parentId, scheduleMode: "auto", requestedStart: "2026-10-05", startDate: "2026-10-05", endDate: "2026-10-09", duration: 4, progress: 0, status: "not_started", sortOrder: f.schedules.nextSiblingSortOrder(f.project.id, parentId), createdAt: RESOURCE_DASHBOARD_NOW, updatedAt: RESOURCE_DASHBOARD_NOW });
}

describe("#528 SQLite readonly scoped drill", () => {
  it("shares canonical source context across bootstrap, Resource and legacy Milestone without mutations", async () => {
    const f = fixture(), before = f.state(), dashboard = f.service.getDashboard(f.project.publicId)!;
    const legacy = new MilestoneDashboardService(f.database, { clock: () => new Date(RESOURCE_DASHBOARD_NOW), mdPerMmEnvironment: "21" }).getDashboard(f.project.publicId)!;
    const response = await scope(f, new URLSearchParams({ view: "context" }));
    expect(response.status).toBe(200); const data = (await response.json()).data;
    expect(dashboard.resourceScopeContext).toMatchObject(data); expect(legacy.resourceScopeContext).toMatchObject(data);
    expect(legacy.resourceScopeUnavailableReason).toBeNull(); expect(f.state()).toEqual(before);
    expect(response.headers.get("cache-control")).toBe("private, no-store"); expect(response.headers.get("x-content-type-options")).toBe("nosniff"); expect(response.headers.get("set-cookie")).toBeNull();
  });
  it("expands Summary/multi-root to ordinary Tasks, deduplicates names/IDs and keeps full Gate", async () => {
    const f = fixture(), baseline = f.service.getDashboard(f.project.publicId)!;
    const single = await report(await post(f, body(f, { scope: { kind: "summarySubtree", rootId: f.tasks.get("S")!.publicId } })));
    const multi = await report(await post(f, body(f, { scope: { kind: "scheduleSelection", nodeIds: [f.tasks.get("S2")!.publicId, f.tasks.get("T2")!.publicId, f.tasks.get("T1")!.publicId, f.tasks.get("S2")!.publicId] } })));
    expect(single.summary.assignmentCount).toBe(4); expect(single.summary.taskCount).toBe(2); expect(multi.summary).toEqual(single.summary); expect(multi.snapshotId).toBe(single.snapshotId);
    expect(single.stages.map((stage) => stage.full)).toEqual(baseline.stages.map((stage) => stage.full));
  });
  it("keeps exact co-assignee A intersection and T0 before personal conditions", async () => {
    const f = fixture(), input = body(f, { scope: { kind: "exactAssignments", assignmentIds: [f.assignmentIds.get("A1")!] }, filters: { resourceIds: [f.resources.get("R2")!.publicId] } });
    const result = await report(await post(f, input)); expect(result.summary.assignmentCount).toBe(0); expect(result.diagnostics.denominator).toBe(1); expect(result.diagnostics.completelyUnassigned.count).toBe(0);
    const selected = await report(await post(f, { ...input, filters: {} })); expect(selected.summary.assignmentCount).toBe(1); expect(selected.resources.map((row) => row.id)).toEqual([f.resources.get("R1")!.publicId]);
  });
  it("preserves explicit empty selectors and empty Summary rather than All", async () => {
    const f = fixture();
    for (const descriptor of [{ kind: "scheduleSelection", nodeIds: [] }, { kind: "exactAssignments", assignmentIds: [] }, { kind: "summarySubtree", rootId: f.tasks.get("EMPTY")!.publicId }] as ResourceDrillQueryInput["scope"][]) {
      const result = await report(await post(f, body(f, { scope: descriptor }))); expect(result.summary.taskCount).toBe(0); expect(result.summary.assignmentCount).toBe(0); expect(result.diagnostics.denominator).toBe(0);
    }
  });
  it("retains source restriction in Milestone reference/excluded while Plan project keeps full same R", async () => {
    const f = fixture(), result = await report(await post(f, body(f, { scope: { kind: "exactAssignments", assignmentIds: [f.assignmentIds.get("A1")!] }, filters: { milestoneIds: [f.tasks.get("M2")!.publicId], granularity: "week" } })));
    expect(result.summary.assignmentCount).toBe(0); expect(result.reference!.assignmentCount).toBe(1); expect(result.excluded!.assignmentCount).toBe(1);
    expect(result.plan!.population.resourceIds).toHaveLength(2); expect(result.plan!.totals.summary.project.assignmentCount).toBe(5); expect(result.plan!.totals.summary.selected.assignmentCount).toBe(0);
  });
  it("returns >50 full distinct scope IDs and ancestor context separately, rejecting pagination", async () => {
    const f = fixture(), parent = f.tasks.get("S")!;
    f.database.transaction(() => { for (let index = 0; index < 65; index++) { const task = addTask(f, `shared-name-${index}`, parent.id); f.catalog.replaceTaskAssignments({ projectId: f.project.id, taskId: task.id, now: RESOURCE_DASHBOARD_NOW, targets: [{ kind: "resource", publicId: f.resources.get("R1")!.publicId, internalId: f.resources.get("R1")!.id, assignmentPublicId: randomUUID(), allocationPercent: 50, assignmentStart: null, assignmentEnd: null }] }); } })();
    const current = f.service.getDashboard(f.project.publicId)!; const params = new URLSearchParams({ view: "dashboard", snapshotId: current.snapshotId, dimension: "resource", id: f.resources.get("R1")!.publicId });
    const response = await scope(f, params); expect(response.status).toBe(200); const result = (await response.json()).data as ResourceDrillScopeDto;
    expect(result.assignmentCount).toBe(68); expect(result.taskCount).toBe(68); expect(result.taskIds).toHaveLength(68); expect(result.ancestorSummaryIds).toContain(parent.publicId); expect(result.taskIds).not.toContain(parent.publicId);
    params.set("limit", "50"); expect((await scope(f, params)).status).toBe(400);
  });
  it("echoes immutable original source separately and creates a fresh target scope context", async () => {
    const f = fixture(), input = body(f, { filters: { from: "2026-10-07", to: "2026-10-08", asOfDate: "2026-10-20", mdPerMm: null } });
    const initial = await post(f, input); const envelope = await initial.json() as ResourceDrillQueryResponse; const result = envelope.data as ResourceDashboardDto;
    expect(envelope.drill.sourceContext).toEqual(input.sourceContext); expect(result.resourceScopeContext!.range).toEqual({ from: "2026-10-07", to: "2026-10-08" });
    const scoped = await post(f, { ...input, projection: { kind: "scope", target: "dashboard", snapshotId: result.snapshotId, selector: result.summary.selector } });
    expect(scoped.status).toBe(200); const second = await scoped.json() as ResourceDrillQueryResponse; expect(second.drill.sourceContext).toEqual(input.sourceContext);
    expect((second.data as ResourceDrillScopeDto).sourceContext).toEqual({ ...result.resourceScopeContext, sourceProjection: { kind: "details", selector: { ...result.summary.selector, assignmentScope: "selected" }, view: "assignments" } });
  });
  it("keeps snapshot identity independent of mode/granularity/page and exact set order", async () => {
    const f = fixture(), input = body(f); const plain = await report(await post(f, input)); const week = await report(await post(f, { ...input, filters: { granularity: "week", mode: "group" } })); const month = await report(await post(f, { ...input, filters: { granularity: "month" } }));
    expect(week.snapshotId).toBe(plain.snapshotId); expect(month.snapshotId).toBe(plain.snapshotId);
    const detail = await post(f, { ...input, projection: { kind: "details", snapshotId: plain.snapshotId, selector: plain.summary.selector, view: "assignments", offset: 1, limit: 1 } }); expect(detail.status).toBe(200); expect((await detail.json()).data.snapshotId).toBe(plain.snapshotId);
  });
  it("rejects stale raw data or environment source policy before foreign selector semantics", async () => {
    const f = fixture(), input = body(f, { scope: { kind: "exactAssignments", assignmentIds: [randomUUID()] } });
    expect((await post(f, input)).status).toBe(400);
    const staleInput = { ...input, sourceContext: { ...input.sourceContext, dataSnapshotId: "0".repeat(64) } }; expect((await post(f, staleInput)).status).toBe(409);
    const otherService = new ResourceDashboardService(f.database, { clock: () => new Date(RESOURCE_DASHBOARD_NOW), mdPerMmEnvironment: "22" });
    const changed = await handleResourceDrill(new Request("https://gantt.example/query", { method: "POST", headers: { Origin: "https://gantt.example", "Content-Type": "application/json" }, body: JSON.stringify(input) }), f.project.publicId, { ...options, service: otherService }, true); expect(changed.status).toBe(409);
    expect(changed.headers.get("set-cookie")).toBeNull(); expect(changed.headers.get("cache-control")).toBe("private, no-store");
  });
  it("fresh foreign descriptors are400 across every projection, stale data remains409", async () => {
    const f = fixture(), input = body(f, { filters: { granularity: "week" } }), result = await report(await post(f, input));
    const detail = { snapshotId: result.snapshotId, granularity: "week" as const, periodId: "all", selector: { kind: "total" as const }, demandScope: "selected" as const, offset: 0, limit: 50 };
    const projections: ResourceDrillQueryInput["projection"][] = [{ kind: "report" }, { kind: "details", snapshotId: result.snapshotId, selector: result.summary.selector, view: "assignments", offset: 0, limit: 50 }, { kind: "groupChildren", snapshotId: result.snapshotId, groupId: f.groups.get("G1")!.publicId, offset: 0, limit: 50 }, { kind: "planDaily", ...detail }, { kind: "planDayResources", ...detail, date: "2026-10-05" }, { kind: "planDayAssignments", ...detail, selector: { kind: "resource", resourceId: f.resources.get("R1")!.publicId }, date: "2026-10-05" }, { kind: "scope", target: "dashboard", snapshotId: result.snapshotId, selector: result.summary.selector }, { kind: "scope", target: "plan", ...detail }];
    for (const projection of projections) {
      // Scope projection omits transport pagination even though the internal helper has defaults.
      const validProjection = projection.kind === "scope" && projection.target === "plan" ? { kind: projection.kind, target: projection.target, snapshotId: projection.snapshotId, selector: projection.selector, granularity: projection.granularity, periodId: projection.periodId, demandScope: projection.demandScope } : projection;
      const request = { ...input, projection: validProjection, scope: { kind: "exactAssignments" as const, assignmentIds: [randomUUID()] } };
      expect((await post(f, request)).status, JSON.stringify(validProjection)).toBe(400);
      expect((await post(f, { ...input, projection: validProjection, filters: { ...input.filters, resourceIds: [randomUUID()] } })).status, JSON.stringify(validProjection)).toBe(400);
      expect((await post(f, { ...request, sourceContext: { ...input.sourceContext, dataSnapshotId: "0".repeat(64) } })).status, JSON.stringify(validProjection)).toBe(409);
    }
  });
  it("raw assignment changes invalidate fingerprints even if revision was not manually advanced", async () => {
    const f = fixture(), input = body(f), before = input.sourceContext.dataSnapshotId;
    f.database.prepare("UPDATE task_assignments SET allocation_percent=60 WHERE public_id=?").run(f.assignmentIds.get("A1")!);
    const current = f.service.getScope(f.project.publicId, { view: "context" })!; expect("dataSnapshotId" in current && current.dataSnapshotId).not.toBe(before);
    expect((await post(f, input)).status).toBe(409);
  });
  it("GET deleted/foreign filter scopes retain legacy stale409 precedence", async () => {
    const f = fixture(), dashboard = f.service.getDashboard(f.project.publicId)!;
    const params = new URLSearchParams({ view: "dashboard", snapshotId: dashboard.snapshotId, taskIds: randomUUID(), dimension: "all" }); expect((await scope(f, params)).status).toBe(409);
    const selected = new URLSearchParams({ view: "dashboard", snapshotId: dashboard.snapshotId, dimension: "milestone", id: randomUUID() }); expect((await scope(f, selected)).status).toBe(400);
  });
  it("rejects foreign/nonordinary assignment/node IDs and invalid actual parent period/date", async () => {
    const f = fixture(); for (const descriptor of [{ kind: "exactAssignments", assignmentIds: [f.assignmentIds.get("SUMMARY")!] }, { kind: "exactAssignments", assignmentIds: [f.assignmentIds.get("GROUP")!] }, { kind: "scheduleSelection", nodeIds: [f.tasks.get("M1")!.publicId] }, { kind: "summarySubtree", rootId: f.tasks.get("T1")!.publicId }] as ResourceDrillQueryInput["scope"][]) expect((await post(f, body(f, { scope: descriptor }))).status).toBe(400);
    const input = body(f); input.sourceContext.sourceProjection = { kind: "plan", granularity: "week", periodId: "2026-W41", selector: { kind: "total" }, demandScope: "selected", date: "2026-10-18" }; expect((await post(f, input)).status).toBe(400);
  });
  it("enforces Origin, media/encoding, invalid JSON and actual streamed 1MiB+1 with no state changes", async () => {
    const f = fixture(), before = f.state(), input = body(f);
    for (const origin of ["", "null", "https://evil.example", "https://gantt.example/"]) expect((await post(f, input, { Origin: origin })).status).toBe(403);
    expect((await post(f, input, { "Content-Type": "text/plain" })).status).toBe(415); expect((await post(f, input, { "Content-Encoding": "gzip" })).status).toBe(415);
    for (const [size, expected] of [[RESOURCE_DRILL_LIMITS.bodyBytes, 200], [RESOURCE_DRILL_LIMITS.bodyBytes + 1, 413]] as const) {
      const json = JSON.stringify(input); const payload = json + " ".repeat(size - Buffer.byteLength(json));
      const stream = new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode(payload)); controller.close(); } });
      const response = await handleResourceDrill(new Request("https://gantt.example/query", { method: "POST", headers: { Origin: "https://gantt.example", "Content-Type": "application/json" }, body: stream, duplex: "half" } as RequestInit), f.project.publicId, { ...options, service: f.service }, true); expect(response.status).toBe(expected);
    }
    const invalid = await handleResourceDrill(new Request("https://gantt.example/query", { method: "POST", headers: { Origin: "https://gantt.example", "Content-Type": "application/json" }, body: "{" }), f.project.publicId, { ...options, service: f.service }, true); expect(invalid.status).toBe(400); expect(f.state()).toEqual(before);
  });
  it("accepts raw selector cardinality at5000/8000 and rejects +1 even duplicate IDs", async () => {
    const f = fixture();
    for (const [kind, field, value, maximum] of [["scheduleSelection", "nodeIds", f.tasks.get("T1")!.publicId, 5000], ["exactAssignments", "assignmentIds", f.assignmentIds.get("A1")!, 8000]] as const) {
      expect((await post(f, body(f, { scope: { kind, [field]: Array(maximum).fill(value) } as ResourceDrillQueryInput["scope"] }))).status).toBe(200);
      expect((await post(f, body(f, { scope: { kind, [field]: Array(maximum + 1).fill(value) } as ResourceDrillQueryInput["scope"] }))).status).toBe(400);
    }
  });
  it("bootstrap has no period limit but actual report range366/367 uses semantic422", async () => {
    const f = fixture(), context = await scope(f, new URLSearchParams({ view: "context" })); expect(context.status).toBe(200);
    expect((await post(f, body(f, { filters: { from: "2026-01-01", to: "2027-01-01" } }))).status).toBe(200);
    expect((await post(f, body(f, { filters: { from: "2026-01-01", to: "2027-01-02" } }))).status).toBe(422);
  });
  it("preserves legacy Milestone report and marks context unavailable above raw Task budget", () => {
    const f = fixture(); f.database.transaction(() => { for (let index = f.tasks.size; index < 5001; index++) addTask(f, `extra-${index}`); })();
    const legacy = new MilestoneDashboardService(f.database, { clock: () => new Date(RESOURCE_DASHBOARD_NOW), mdPerMmEnvironment: "21" }).getDashboard(f.project.publicId)!;
    expect(legacy.rows).toHaveLength(3); expect(legacy.resourceScopeContext).toBeNull(); expect(legacy.resourceScopeUnavailableReason).toBe("limit-exceeded"); expect(() => f.service.getScope(f.project.publicId, { view: "context" })).toThrowError(/한도/);
  });
  it("benchmarks actual SQLite POST handler with2700 exact Assignment IDs and985500 assignment-days", async () => {
    const f = fixture(), project = f.createProject(), resources = Array.from({ length: 40 }, (_, index) => f.catalog.insertResource({ publicId: randomUUID(), name: `Bench ${index}`, code: `B${index}`, description: "private", now: RESOURCE_DASHBOARD_NOW }));
    const groups = Array.from({ length: 5 }, (_, index) => f.catalog.insertGroup({ publicId: randomUUID(), name: `Group ${index}`, code: `BG${index}`, description: "private", now: RESOURCE_DASHBOARD_NOW }));
    groups.forEach((group, index) => f.catalog.replaceGroupMembers(group.id, resources.filter((_, resourceIndex) => resourceIndex % 5 === index).map(resource => resource.id), RESOURCE_DASHBOARD_NOW));
    const milestones = ["2026-01-01", "2026-01-02"].map((date, index) => f.schedules.insertTask({ projectId: project.id, publicId: randomUUID(), externalId: `bench-M${index}`, name: `Bench Milestone ${index}`, type: "milestone", parentId: null, scheduleMode: "auto", requestedStart: date, startDate: date, endDate: date, duration: 0, progress: 0, status: "not_started", sortOrder: index, createdAt: RESOURCE_DASHBOARD_NOW, updatedAt: RESOURCE_DASHBOARD_NOW }));
    const membership = new MilestoneMembershipRepository(f.database);
    const assignmentIds: string[] = [];
    f.database.transaction(() => {
      for (let index = 0; index < 68; index++) {
        const task = f.schedules.insertTask({ projectId: project.id, publicId: randomUUID(), externalId: `bench-${index}`, name: `Bench ${index}`, type: "task", parentId: null, scheduleMode: "auto", requestedStart: "2026-01-01", startDate: "2026-01-01", endDate: "2026-12-31", duration: 261, progress: 0, status: "not_started", sortOrder: index, createdAt: RESOURCE_DASHBOARD_NOW, updatedAt: RESOURCE_DASHBOARD_NOW });
        membership.set(project.id, task.id, milestones[index % 2].id);
        f.catalog.replaceTaskAssignments({ projectId: project.id, taskId: task.id, now: RESOURCE_DASHBOARD_NOW, targets: resources.slice(0, Math.min(40, 2700 - index * 40)).map(resource => { const id = randomUUID(); assignmentIds.push(id); return { kind: "resource" as const, publicId: resource.publicId, internalId: resource.id, assignmentPublicId: id, allocationPercent: 50, assignmentStart: null, assignmentEnd: null }; }) });
      }
    })();
    const raw = f.service.getScope(project.publicId, { view: "context" })!;
    if (!("dataSnapshotId" in raw)) throw new Error("Context projection expected");
    const input: ResourceDrillQueryInput = { sourceContext: { ...raw, range: { from: "2026-01-01", to: "2026-12-31" }, asOfDate: "2026-10-17", mdPerMm: null, mdPerMmSource: "query", mdPerMmProvided: true, sourceProjection: { kind: "schedule" } }, scope: { kind: "exactAssignments", assignmentIds }, filters: { from: "2026-01-01", to: "2026-12-31", granularity: "month" }, projection: { kind: "report" } };
    const call = (value: ResourceDrillQueryInput) => handleResourceDrill(new Request(`https://gantt.example/api/projects/${project.publicId}/resource-dashboard/query`, { method: "POST", headers: { Origin: "https://gantt.example", "Content-Type": "application/json" }, body: JSON.stringify(value) }), project.publicId, { service: f.service, ...options }, true);
    const started = performance.now(), response = await call(input), content = await response.text(), elapsedMs = performance.now() - started, bytes = Buffer.byteLength(content);
    expect(response.status, content.slice(0, 200)).toBe(200); expect(bytes).toBeLessThanOrEqual(2097152); const envelope = JSON.parse(content) as ResourceDrillQueryResponse;
    expect((envelope.data as ResourceDashboardDto).summary.assignmentCount).toBe(2700); expect(envelope.drill.scope.kind === "exactAssignments" && envelope.drill.scope.assignmentIds).toHaveLength(2700);
    writeFileSync("/tmp/issue-528-sqlite-post-handler-benchmark.json", JSON.stringify({ environment: "in-process SQLite + HTTP handler, not Next network benchmark", resources: 40, groups: 5, assignments: 2700, days: 365, assignmentDays: 985500, elapsedMs, bytes }));
    expect((await call({ ...input, filters: { ...input.filters, granularity: "week" } })).status).toBe(422);
  });
  it("serialized response has an exact byte boundary and never truncates", () => {
    const exact = { data: "x".repeat(200) }, bytes = Buffer.byteLength(JSON.stringify(exact)); expect(() => assertResourcePlanResponseBytes(exact, "detail.bytes", bytes)).not.toThrow(); expect(() => assertResourcePlanResponseBytes(exact, "detail.bytes", bytes - 1)).toThrowError(/한도/); expect(exact.data).toHaveLength(200);
  });
});
