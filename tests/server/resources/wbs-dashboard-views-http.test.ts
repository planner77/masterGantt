import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { WbsViewDimension, WbsViewLevel, WbsViewQueryInput } from "../../../src/contracts/wbs-dashboard-views";
import { handleWbsViewQuery } from "../../../src/server/resources/wbs-dashboard-views-handlers-core";
import { handleProjectExcelExport } from "../../../src/server/exports/project-excel-export-handler-core";
import { openDatabase } from "../../../src/server/db/core";
import { ResourceDashboardService } from "../../../src/server/resources/resource-dashboard-service-core";
import { wbsDashboardViewsFixture } from "../../fixtures/wbs-dashboard-views";
import { RESOURCE_DASHBOARD_NOW as now } from "../../fixtures/resource-dashboard";

type Fixture = ReturnType<typeof wbsDashboardViewsFixture>;
type Row = { selector: { dimension: string; id: string | null }; path: Row["selector"][]; name: string; viewRowKey: string; taskIds: string[]; assignmentIds: string[]; totals: { tasks: { taskCount: number }; assignments: { effort: { knownMd: number; plannedMd: number | null } }; participation: { registeredCount: number; assignedCount: number }; configurationReference: { equipmentQuantity: number }; relatedMembers: { equipmentQuantity: number } }; children: Row[] };
type Report = Row & { schema: string; snapshotId: string; spec: WbsViewQueryInput["spec"] };
const filters = { from: "2026-10-05", to: "2026-10-09", asOfDate: "2026-10-12", mdPerMm: 20 };
const spec = (root: WbsViewDimension = "process", levels: WbsViewLevel[] = []): WbsViewQueryInput["spec"] => ({ version: "wbs-view:v1", contextSourceVersion: "explicit-task-context:v1", root, levels });
const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => { vi.restoreAllMocks(); for (const cleanup of cleanups.splice(0).reverse()) await cleanup(); });

/** Real HTTP transport, production read handler/service and migrated SQLite; no mocked API data. */
async function fixture(mode: Parameters<typeof wbsDashboardViewsFixture>[0] = "mixed", filename = ":memory:") {
  const f = wbsDashboardViewsFixture(mode, filename);
  let activeDatabase = f.database, activeService = f.service;
  let origin = "";
  const server = createServer(async (incoming, outgoing) => {
    try {
      const chunks: Buffer[] = []; for await (const chunk of incoming) chunks.push(Buffer.from(chunk));
      const request = new Request(origin + incoming.url, { method: incoming.method, headers: incoming.headers as Record<string, string>, body: Buffer.concat(chunks) });
      const projectPublicId = new URL(request.url).pathname.split("/")[3];
      const response = incoming.url?.endsWith("/exports/excel")
        ? await handleProjectExcelExport(request, projectPublicId, { service: { getReadonlySnapshot: () => undefined }, applicationBaseUrl: origin, environment: "production", allowInsecureHttp: "true" })
        : await handleWbsViewQuery(request, projectPublicId, { service: activeService, applicationBaseUrl: origin, environment: "production", allowInsecureHttp: "true" });
      outgoing.writeHead(response.status, Object.fromEntries(response.headers)); outgoing.end(Buffer.from(await response.arrayBuffer()));
    } catch { outgoing.writeHead(500); outgoing.end("HTTP fixture failure"); }
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  cleanups.push(async () => { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); activeDatabase.close(); });
  const query = (body: unknown, suppliedOrigin: string | null = origin, publicId = f.project.publicId) => fetch(`${origin}/api/projects/${publicId}/resource-dashboard/views`, { method: "POST", headers: { "Content-Type": "application/json", ...(suppliedOrigin === null ? {} : { Origin: suppliedOrigin }) }, body: JSON.stringify(body) });
  const report = async (view = spec(), additional: Partial<WbsViewQueryInput> = {}) => {
    const response = await query({ spec: view, filters, ...additional });
    const body = await response.text(); expect(response.status, body).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store"); expect(response.headers.get("x-content-type-options")).toBe("nosniff"); expect(response.headers.get("set-cookie")).toBeNull();
    return { data: JSON.parse(body).data as Report, bytes: Buffer.byteLength(body) };
  };
  const reopen = () => { activeDatabase.close(); activeDatabase = openDatabase({ filename, migrationsDirectory: join(process.cwd(), "db/migrations") }).database; activeService = new ResourceDashboardService(activeDatabase, { clock: () => new Date(now), mdPerMmEnvironment: "21" }); };
  return { ...f, origin, query, report, reopen };
}
const node = (parent: Pick<Row, "children">, dimension: string, id: string | null) => {
  const found = parent.children.find(row => row.selector.dimension === dimension && row.selector.id === id);
  expect(found, `${dimension}:${id}`).toBeDefined(); return found!;
};
const taskIds = (f: Fixture, ids: string[]) => ids.map(id => f.tasks.get(id)!.publicId).sort();
const assignmentIds = (f: Fixture, ids: string[]) => ids.map(id => f.assignmentIds.get(id)!).sort();
function assertScope(row: Row, f: Fixture, tasks: string[], assignments: string[], md: number) {
  expect([...row.taskIds].sort()).toEqual(taskIds(f, tasks)); expect([...row.assignmentIds].sort()).toEqual(assignmentIds(f, assignments));
  expect(row.totals.assignments.effort.knownMd).toBe(md);
}

describe("#729 migrated SQLite → production handler → actual HTTP acceptance", () => {
  it.each(["direct", "target", "mixed"] as const)("AC1 W2 %s source is distinct14/A8/B9/unlinked2 without implicit process fallback", async mode => {
    const f = await fixture(mode), before = f.state();
    const { data } = await f.report(spec("system", ["process"]));
    expect(data.schema).toBe("wbs-view-report/2");
    expect(JSON.stringify(data)).not.toMatch(/"(?:targetId|targetIds|targetSources|targetMembers|inactiveTargetIds)"/);
    const mcs = node(data, "system", f.systems[2].publicId);
    assertScope(mcs, f, ["T0", "T1", "T2", "T3"], ["A0", "A1", "A2", "A3"], 14);
    assertScope(node(mcs, "process", f.processA.publicId), f, ["T1", "T3"], ["A1", "A3"], 8);
    assertScope(node(mcs, "process", f.processB.publicId), f, ["T2", "T3"], ["A2", "A3"], 9);
    assertScope(node(mcs, "process", null), f, ["T0"], ["A0"], 2);
    expect(mcs.children.reduce((sum, row) => sum + row.totals.assignments.effort.knownMd, 0)).toBe(19);
    expect(f.state()).toEqual(before);
    expect(f.database.prepare("SELECT COUNT(*) FROM logistics_targets WHERE project_id=?").pluck().get(f.project.id)).toBe(mode === "direct" ? 0 : 2);
  });

  it("AC1 registered-only roots and raw unassigned work survive all resource axes", async () => {
    const f = await fixture("direct");
    for (const [dimension, id] of [["equipment", f.idleEquipment.publicId], ["system", f.idleSystem.publicId], ["resource", f.resources.get("R2")!.publicId]] as const) {
      const result = (await f.report(spec(dimension))).data, idle = node(result, dimension, id);
      expect(idle.taskIds).toEqual([]); expect(idle.assignmentIds).toEqual([]); expect(idle.totals.assignments.effort.knownMd).toBe(0);
    }
    const resource = (await f.report(spec("resource"))).data;
    const unassigned = node(resource, "resource", null);
    assertScope(unassigned, f, ["UNASSIGNED", "GROUP_ONLY"], [], 0);
    expect(resource.totals.participation).toMatchObject({ registeredCount: 2, assignedCount: 1 });
    const unrelated = f.catalog.insertResource({ publicId: randomUUID(), name: "Unrelated global", code: "UNRELATED", description: "private", now });
    expect((await f.report(spec("resource"))).data.children.some(row => row.selector.id === unrelated.publicId)).toBe(false);
    const emptyProcess = f.logistics.insertProcess({ publicId: randomUUID(), projectId: f.project.id, code: "IDLE-P", name: "등록만 공정", parentId: null, active: 1, now });
    expect(node((await f.report()).data, "process", emptyProcess.publicId).taskIds).toEqual([]);
  });

  it("AC2/3 root-only, typed sibling and serial examples retain order-independent raw unions", async () => {
    const f = await fixture();
    const views = [spec("process"), spec("process", [{ kind: "siblings", dimensions: ["equipment", "system"] }, "resource"]), spec("equipment", ["process", "system", "resource"]), spec("equipment", ["milestone", "process"]), spec("resource", ["milestone", "system", "process"]), spec("milestone", ["resource", "process", "equipment"])];
    const first = (await f.report(views[0])).data;
    for (const view of views) {
      const { data } = await f.report(view);
      expect(data.totals).toEqual(first.totals); expect([...data.taskIds].sort()).toEqual([...first.taskIds].sort()); expect([...data.assignmentIds].sort()).toEqual([...first.assignmentIds].sort());
      const seen = new Set<string>();
      const visit = (row: Row) => { expect(seen.has(row.viewRowKey)).toBe(false); seen.add(row.viewRowKey); for (const child of row.children) visit(child); };
      for (const row of data.children) visit(row);
    }
    const sibling = (await f.report(views[1])).data;
    const a = node(sibling, "process", f.processA.publicId);
    expect(new Set(a.children.map(row => row.selector.dimension))).toEqual(new Set(["equipment", "system"]));
    expect(a.children.flatMap(row => row.children).every(row => row.selector.dimension === "resource")).toBe(true);
    expect((await f.report(spec("equipment", ["process"]))).data.snapshotId).not.toBe((await f.report(spec("process", ["equipment"]))).data.snapshotId);
    const grouped = (await f.report(spec("group", ["resource"]))).data;
    expect(grouped.children.filter(row => row.selector.id !== null).reduce((sum, row) => sum + row.totals.assignments.effort.knownMd, 0)).toBe(28);
    expect(grouped.totals.assignments.effort.knownMd).toBe(14);
  });

  it("AC2/3 reversing equipment/system siblings preserves process task and assignment unions", async () => {
    const f = await fixture("mixed");
    const forward = (await f.report(spec("process", [{ kind: "siblings", dimensions: ["equipment", "system"] }]))).data;
    const reversed = (await f.report(spec("process", [{ kind: "siblings", dimensions: ["system", "equipment"] }]))).data;
    expect([...forward.taskIds].sort()).toEqual([...reversed.taskIds].sort());
    expect([...forward.assignmentIds].sort()).toEqual([...reversed.assignmentIds].sort());
    expect(forward.totals).toEqual(reversed.totals);
    for (const id of [f.processA.publicId, f.processB.publicId]) {
      const first = node(forward, "process", id), second = node(reversed, "process", id);
      expect([...first.taskIds].sort()).toEqual([...second.taskIds].sort());
      expect([...first.assignmentIds].sort()).toEqual([...second.assignmentIds].sort());
      expect(first.totals).toEqual(second.totals);
      expect(new Set(first.children.map(row => row.selector.dimension))).toEqual(new Set(["equipment", "system"]));
      expect(new Set(second.children.map(row => row.selector.dimension))).toEqual(new Set(["equipment", "system"]));
    }
  });

  it("AC4 E1→shared Milestone→process never widens to E2-T2; exact detail pages and drill match IDs", async () => {
    const f = await fixture("direct"), view = spec("equipment", ["milestone", "process", "resource"]);
    const data = (await f.report(view)).data;
    const e = node(data, "equipment", f.equipment[0].publicId), m = node(e, "milestone", f.tasks.get("M")!.publicId), p = node(m, "process", f.processA.publicId);
    assertScope(m, f, ["T1"], ["A1"], 3); assertScope(p, f, ["T1"], ["A1"], 3);
    expect(m.children.some(row => row.selector.id === f.processB.publicId)).toBe(false);
    for (const kind of ["scope", "details"] as const) {
      const response = await f.query({ spec: view, filters, projection: { kind, snapshotId: data.snapshotId, path: p.path, ...(kind === "details" ? { view: "assignments", offset: 0, limit: 1 } : {}) } });
      const body = await response.json(); expect(response.status, JSON.stringify(body)).toBe(200);
      if (kind === "scope") {
        expect(body.data.taskIds).toEqual(p.taskIds); expect(body.data.assignmentIds).toEqual(p.assignmentIds);
        expect(body.data.instanceIds.filter((entry: { kind: string }) => entry.kind === "equipment")).toEqual([{ kind: "equipment", instanceId: f.equipment[0].publicId }]);
        expect(body.data.instancePaths.every((entry: { taskId: string }) => entry.taskId === f.tasks.get("T1")!.publicId)).toBe(true);
      }
      else { expect(body.data.totalCount).toBe(1); expect(body.data.nextOffset).toBeNull(); expect(body.data.rows[0].taskId).toBe(f.tasks.get("T1")!.publicId); expect(body.data.rows[0].assignment.assignmentId).toBe(f.assignmentIds.get("A1")); }
    }
    const rootProjection = { kind: "details", snapshotId: data.snapshotId, path: [], view: "assignments", offset: 0, limit: 2 };
    const one = (await (await f.query({ spec: view, filters, projection: rootProjection })).json()).data;
    const two = (await (await f.query({ spec: view, filters, projection: { ...rootProjection, offset: 2 } })).json()).data;
    expect(one.totalCount).toBe(4); expect(one.nextOffset).toBe(2); expect(two.nextOffset).toBeNull();
    expect(new Set([...one.rows, ...two.rows].map((row: { assignment: { assignmentId: string } }) => row.assignment.assignmentId))).toEqual(new Set(assignmentIds(f, ["A0", "A1", "A2", "A3"])));
  });

  it("AC4 readonly Origin isolation, strict spec/foreign selection and filter-bound snapshot errors", async () => {
    const f = await fixture(), view = spec("process", ["equipment"]), data = (await f.report(view)).data;
    expect((await f.query({ spec: view }, null)).status).toBe(403);
    expect((await f.query({ spec: view }, "https://foreign.example")).status).toBe(403);
    for (const publicId of ["malformed", randomUUID()]) {
      const response = await f.query({ spec: view, filters }, f.origin, publicId);
      expect(response.status).toBe(404); expect((await response.json()).error.code).toBe("PROJECT_NOT_FOUND");
    }
    const otherProject = f.createProject();
    const otherReport = await f.query({ spec: view, filters }, f.origin, otherProject.publicId);
    expect(otherReport.status).toBe(200); expect((await otherReport.json()).data.taskIds).toEqual([]);
    const crossProjectScope = await f.query({ spec: view, filters, scope: { kind: "exactAssignments", assignmentIds: [f.assignmentIds.get("A1")] } }, f.origin, otherProject.publicId);
    expect(crossProjectScope.status).toBe(400); expect((await crossProjectScope.json()).error.code).toBe("INVALID_SELECTION");
    for (const bad of [
      { ...view, root: "unknown" }, { ...view, version: "wbs-view:v2" }, { ...view, root: "process", levels: ["process"] },
      { ...view, levels: [{ kind: "siblings", dimensions: ["equipment", "equipment"] }] },
      { ...view, levels: [{ kind: "siblings", dimensions: ["resource", "system"] }] },
      { ...view, levels: ["equipment", "system", "resource", "group", "role", "milestone", "workArea", "process"] },
    ]) {
      const response = await f.query({ spec: bad, filters }); expect(response.status).toBe(400); const body = await response.json(); expect(body.error.code).toBe("INVALID_REQUEST"); expect(body.data).toBeUndefined();
    }
    const projection = { kind: "details", snapshotId: data.snapshotId, path: [], view: "assignments", offset: 0, limit: 100 };
    const changed = await f.query({ spec: view, filters: { ...filters, resourceIds: [f.resources.get("R2")!.publicId] }, projection });
    expect(changed.status).toBe(409); expect((await changed.json()).error.code).toBe("REPORT_STALE");
    const changedSpec = await f.query({ spec: spec("equipment", ["process"]), filters, projection });
    expect(changedSpec.status).toBe(409); expect((await changedSpec.json()).error.code).toBe("REPORT_STALE");
    for (const bad of [
      { ...projection, path: [{ dimension: "equipment", id: f.equipment[0].publicId }] },
      { ...projection, limit: 101 }, { ...projection, offset: -1 },
    ]) expect((await f.query({ spec: view, filters, projection: bad })).status).toBe(400);
    const foreign = await fixture();
    const foreignResponse = await f.query({ spec: view, filters, projection: { ...projection, path: [{ dimension: "process", id: foreign.processA.publicId }] } });
    expect(foreignResponse.status).toBe(400); expect((await foreignResponse.json()).error.code).toBe("INVALID_SELECTION");
    expect((await f.query({ spec: view, filters: { ...filters, taskIds: [foreign.tasks.get("T1")!.publicId] } })).status).toBe(400);
    const body = await (await f.query({ spec: view, filters: { ...filters, from: "2025-01-01", to: "2026-12-31" } })).json();
    expect(body.error.code).toBe("REPORT_LIMIT_EXCEEDED"); expect(body.data).toBeUndefined();
  });

  it.each(["processContext", "multiWorkArea", "workAreaName", "membership", "resourceName", "calendar", "targetName", "assignment"] as const)("AC4 %s changes invalidate exact details without requiring revision bumps", async source => {
    const f = await fixture(), view = spec("equipment", ["milestone", "process"]), data = (await f.report(view)).data;
    const changes = {
      processContext: () => f.contexts.replaceTask(f.project.id, f.tasks.get("T0")!.id, { processLinks: [{ processId: f.processA.id, scope: "self" }], workAreaLinks: [] }),
      multiWorkArea: () => f.contexts.replaceEquipment(f.project.id, f.equipment[0].id, [f.areaA]),
      workAreaName: () => f.database.prepare("UPDATE work_areas SET name='Changed work area' WHERE id=?").run(f.areaB.workAreaId),
      membership: () => f.database.prepare("DELETE FROM project_resource_memberships WHERE project_id=? AND resource_id=?").run(f.project.id, f.resources.get("R2")!.id),
      resourceName: () => f.database.prepare("UPDATE resources SET name='Changed resource' WHERE id=?").run(f.resources.get("R1")!.id),
      calendar: () => f.schedules.insertHoliday(f.project.id, "2026-10-07", "New holiday", now),
      targetName: () => f.database.prepare("UPDATE logistics_targets SET name='Changed Target' WHERE public_id=?").run(f.targets[0].id),
      assignment: () => f.database.prepare("UPDATE task_assignments SET allocation_percent=10 WHERE public_id=?").run(f.assignmentIds.get("A0")),
    };
    changes[source]();
    const response = await f.query({ spec: view, filters, projection: { kind: "details", snapshotId: data.snapshotId, path: [], view: "tasks", offset: 0, limit: 100 } });
    expect(response.status).toBe(409); expect((await response.json()).error.code).toBe("REPORT_STALE");
    const current = (await f.report(view)).data; expect(current.snapshotId).not.toBe(data.snapshotId);
    expect(f.projects.findById(f.project.id)!.revision).toBe(1);
  });

  // File-backed migration/seed and initial HTTP snapshot can exceed the Vitest
  // 5s *test body* budget under concurrent CI jobs. Keep the real on-disk
  // migration and every before/after assertion; prepare once in beforeAll
  // (separate hook budget) rather than increasing global/per-test timeouts.
  describe("AC1/4 persisted SQLite restart (isolated setup phase)", () => {
    let f: Awaited<ReturnType<typeof fixture>>;
    let view: WbsViewQueryInput["spec"];
    let before: Report;
    let areasBefore: Report;
    let unlinkedPath: Row["path"];

    beforeAll(async () => {
      const directory = mkdtempSync(join(tmpdir(), "wbs729-"));
      cleanups.push(async () => rmSync(directory, { force: true, recursive: true }));
      f = await fixture("direct", join(directory, "data.sqlite3"));
      view = spec("system", ["process"]);
      before = (await f.report(view)).data;
      unlinkedPath = node(node(before, "system", f.systems[2].publicId), "process", null).path;
      areasBefore = (await f.report(spec("workArea", ["equipment"]))).data;
    });

    it("AC1/4 persisted explicit process0 and multiWorkAreas retain snapshot/exact HTTP details after reopen", async () => {
      f.reopen();
      const after = (await f.report(view)).data;
      expect(after).toEqual(before);
      expect((await f.report(spec("workArea", ["equipment"]))).data).toEqual(areasBefore);
      const response = await f.query({ spec: view, filters, projection: { kind: "details", snapshotId: before.snapshotId, path: unlinkedPath, view: "assignments", offset: 0, limit: 100 } });
      expect(response.status).toBe(200);
      const page = (await response.json()).data;
      expect(page.rows.map((row: { taskId: string }) => row.taskId)).toEqual([f.tasks.get("T0")!.publicId]);
      expect(page.rows[0].assignment.plannedMd).toBe(2);
    });
  });

  it("AC3 W1 cross-process WorkAreas are complete and quantity is a distinct union", async () => {
    const f = await fixture(), data = (await f.report(spec("workArea", ["equipment", "resource"]))).data;
    const a = node(data, "workArea", f.areaId), b = node(data, "workArea", f.areaBPublicId);
    expect(a.name).toBe("조립 작업구역"); expect(b.name).toBe("검사 작업구역");
    for (const row of [a, b]) {
      assertScope(row, f, ["T3"], ["A3"], 5);
      expect(node(row, "equipment", f.equipment[0].publicId).totals.relatedMembers.equipmentQuantity).toBe(10);
    }
    expect(data.totals.relatedMembers.equipmentQuantity).toBe(15);
    expect(a.totals.assignments.effort.knownMd + b.totals.assignments.effort.knownMd).toBe(10);
  });

  it("AC5 legacy report/Target filters/Plan remain unchanged after opt-in views", async () => {
    const f = await fixture(), legacy = f.service.getDashboard(f.project.publicId, { ...filters, granularity: "week", projectionOrder: ["target", "resource"], targetIds: [f.targets[0].id] })!;
    await f.report(spec("process", [{ kind: "siblings", dimensions: ["equipment", "system"] }, "resource"]));
    expect(f.service.getDashboard(f.project.publicId, { ...filters, granularity: "week", projectionOrder: ["target", "resource"], targetIds: [f.targets[0].id] })).toEqual(legacy);
    expect(legacy.summary.effort.knownMd).toBe(10); expect(legacy.plan).toBeDefined();
    expect(f.service.getDashboard(f.project.publicId, filters)!.summary.effort.knownMd).toBe(14);
  });

  it("AC4 exact raw Assignment drill excludes another assignee of the same Task", async () => {
    const f = await fixture("direct"), task = f.tasks.get("T1")!, r1 = f.resources.get("R1")!, r2 = f.resources.get("R2")!;
    const originalId = f.assignmentIds.get("A1")!, otherId = randomUUID();
    f.catalog.replaceTaskAssignments({ projectId: f.project.id, taskId: task.id, now, targets: [
      { kind: "resource", internalId: r1.id, publicId: r1.publicId, assignmentPublicId: originalId, assignmentStart: null, assignmentEnd: null, allocationPercent: 60 },
      { kind: "resource", internalId: r2.id, publicId: r2.publicId, assignmentPublicId: otherId, assignmentStart: null, assignmentEnd: null, allocationPercent: 50 },
    ] });
    const view = spec("equipment", ["milestone", "process", "resource"]), scope = { kind: "exactAssignments" as const, assignmentIds: [originalId] };
    const data = (await f.report(view, { scope })).data;
    assertScope(data, f, ["T1"], ["A1"], 3);
    const p = node(node(node(data, "equipment", f.equipment[0].publicId), "milestone", f.tasks.get("M")!.publicId), "process", f.processA.publicId);
    expect(p.children.filter(row => row.assignmentIds.length).map(row => row.selector.id)).toEqual([r1.publicId]);
    const response = await f.query({ spec: view, filters, scope, projection: { kind: "details", snapshotId: data.snapshotId, path: p.path, view: "assignments", offset: 0, limit: 100 } });
    expect(response.status).toBe(200);
    const details = (await response.json()).data;
    expect(details.totalCount).toBe(1); expect(details.rows[0].assignment.assignmentId).toBe(originalId);
    expect(details.rows[0].taskSources.sources.every((source: { relationKind: string }) => !["controls", "coordinates"].includes(source.relationKind))).toBe(true);
    const personalSpec = spec("resource"), personalData = (await f.report(personalSpec, { scope })).data;
    const excludedPerson = node(personalData, "resource", r2.publicId);
    expect(excludedPerson.taskIds).toEqual([]); expect(excludedPerson.assignmentIds).toEqual([]); expect(excludedPerson.totals.tasks.taskCount).toBe(0);
    const excludedDetail = await f.query({ spec: personalSpec, filters, scope, projection: { kind: "details", snapshotId: personalData.snapshotId, path: excludedPerson.path, view: "tasks", offset: 0, limit: 100 } });
    expect(excludedDetail.status).toBe(200); expect((await excludedDetail.json()).data.totalCount).toBe(0);
  });

  it("AC4 every source scope intersects original filters before report, scope and details", async () => {
    const f = await fixture("direct"), view = spec("system", ["process", "resource"]);
    const cases = [
      { scope: { kind: "scheduleSelection", nodeIds: [f.tasks.get("T1")!.publicId] }, tasks: ["T1"], assignments: ["A1"], md: 3 },
      { scope: { kind: "scheduleSelection", nodeIds: [] }, tasks: [], assignments: [], md: 0 },
      { scope: { kind: "summarySubtree", rootId: f.tasks.get("S")!.publicId }, tasks: ["T0"], assignments: ["A0"], md: 2 },
      { scope: { kind: "exactAssignments", assignmentIds: [f.assignmentIds.get("A2")!] }, filters: { ...filters, taskIds: [f.tasks.get("T1")!.publicId] }, tasks: [], assignments: [], md: 0 },
      { scope: { kind: "exactAssignments", assignmentIds: [] }, tasks: [], assignments: [], md: 0 },
    ] as const;
    for (const c of cases) {
      const body = { spec: view, scope: c.scope, filters: "filters" in c ? c.filters : filters };
      const response = await f.query(body); expect(response.status).toBe(200);
      const data = (await response.json()).data as Report;
      assertScope(data, f, [...c.tasks], [...c.assignments], c.md);
      for (const kind of ["scope", "details"] as const) {
        const response = await f.query({ ...body, projection: { kind, snapshotId: data.snapshotId, path: [], ...(kind === "details" ? { view: "assignments", offset: 0, limit: 100 } : {}) } });
        expect(response.status).toBe(200); const result = (await response.json()).data;
        if (kind === "scope") { expect(result.taskIds.sort()).toEqual(taskIds(f, [...c.tasks])); expect(result.assignmentIds.sort()).toEqual(assignmentIds(f, [...c.assignments])); }
        else { expect(result.totalCount).toBe(c.assignments.length); expect(result.rows.map((row: { assignment: { assignmentId: string } }) => row.assignment.assignmentId).sort()).toEqual(assignmentIds(f, [...c.assignments])); }
      }
    }
  });

  it("AC4 unsupported WBS Excel export returns explicit409 instead of dropping the view scope", async () => {
    const f = await fixture(), data = (await f.report(spec("equipment", ["milestone", "process"]))).data;
    const response = await fetch(`${f.origin}/api/projects/${f.project.publicId}/exports/excel`, { method: "POST", headers: { Origin: f.origin, "Content-Type": "application/json", "If-Match": '"1"' }, body: JSON.stringify({
      includeDependencies: false, scope: "project", scale: "day", hierarchyDisplay: "expanded", layout: { columns: [{ id: "text", widthPx: 224 }] },
      resourceDashboard: { basis: "current", expectedReport: { context: (data as Report & { sourceContext: unknown }).sourceContext, snapshotId: data.snapshotId, filters }, granularities: ["week"] },
    }) });
    const body = await response.json(); expect(response.status, JSON.stringify(body)).toBe(409); expect(body.error.code).toBe("WBS_VIEW_EXPORT_UNSUPPORTED"); expect(body.data).toBeUndefined();
  });

  it("AC1 configured nonworking0, unset effort and raw unassigned remain distinct", async () => {
    const f = await fixture("direct");
    f.database.prepare("UPDATE tasks SET end_date='2026-10-11' WHERE public_id=?").run(f.tasks.get("T0")!.publicId);
    f.database.prepare("UPDATE task_assignments SET assignment_start='2026-10-10',assignment_end='2026-10-11',allocation_percent=100 WHERE public_id=?").run(f.assignmentIds.get("A0"));
    const view = spec("system", ["process"]), extended = { ...filters, to: "2026-10-11", mdPerMm: null };
    const data = (await f.report(view, { filters: extended })).data;
    const zero = node(node(data, "system", f.systems[2].publicId), "process", null);
    expect(zero.totals.assignments.effort).toMatchObject({ knownMd: 0, plannedMd: 0, plannedMm: null, state: "configured" });
    f.database.prepare("UPDATE task_assignments SET allocation_percent=NULL WHERE public_id=?").run(f.assignmentIds.get("A0"));
    const unsetData = (await f.report(view, { filters: extended })).data;
    expect(node(node(unsetData, "system", f.systems[2].publicId), "process", null).totals.assignments.effort).toMatchObject({ knownMd: 0, plannedMd: null, state: "unset" });
    expect(node((await f.report(spec("resource"), { filters: extended })).data, "resource", null).assignmentIds).toEqual([]);
  });

  it("AC6 fan-out and actual response byte limits fail explicitly without partial totals", async () => {
    const f = await fixture("direct");
    f.database.transaction(() => {
      for (let i = 0; i < 1000; i++) {
        const r = f.catalog.insertResource({ publicId: randomUUID(), name: `Root ${i}`, code: `ROOT${i}`, description: "", now });
        f.database.prepare("INSERT INTO project_resource_memberships(project_id,resource_id,created_at) VALUES(?,?,?)").run(f.project.id, r.id, now);
      }
    })();
    const fanout = await f.query({ spec: spec("resource"), filters }), fanoutBody = await fanout.json();
    expect(fanout.status).toBe(422); expect(fanoutBody.error.code).toBe("REPORT_LIMIT_EXCEEDED"); expect(fanoutBody.data).toBeUndefined();
    const g = await fixture("direct"), r = g.resources.get("R1")!;
    g.database.transaction(() => {
      for (let i = 0; i < 600; i++) {
        const task = g.schedules.insertTask({ projectId: g.project.id, publicId: randomUUID(), externalId: `BYTES${i}`, name: "長".repeat(200), type: "task", parentId: null, scheduleMode: "auto", requestedStart: "2026-10-05", startDate: "2026-10-05", endDate: "2026-10-09", duration: 5, progress: 0, status: "not_started", sortOrder: i + 100, createdAt: now, updatedAt: now });
        g.contexts.replaceTask(g.project.id, task.id, { processLinks: [{ processId: g.processA.id, scope: "self" }], workAreaLinks: [] });
        g.catalog.replaceTaskAssignments({ projectId: g.project.id, taskId: task.id, now, targets: [{ kind: "resource", internalId: r.id, publicId: r.publicId, assignmentPublicId: randomUUID(), assignmentStart: null, assignmentEnd: null, allocationPercent: 100 }] });
      }
    })();
    const oversized = await g.query({ spec: spec("process", ["resource"]), filters }), oversizedBody = await oversized.json();
    expect(oversized.status).toBe(422); expect(oversizedBody.error.code).toBe("REPORT_LIMIT_EXCEEDED"); expect(oversizedBody.data).toBeUndefined();
    expect(g.service.getDashboard(g.project.publicId, filters)!.summary.assignmentCount).toBe(604);
  });

  it("AC6 increased actual input keeps SQL query count bounded and records response bytes/time", async () => {
    const f = await fixture("direct");
    const measure = async () => {
      let queries = 0;
      const statements: string[] = [];
      const original = f.database.prepare.bind(f.database);
      const spy = vi.spyOn(f.database, "prepare").mockImplementation((sql: string) => {
        statements.push(sql);
        const statement = original(sql);
        for (const method of ["get", "all", "run"] as const) {
          const execute = statement[method].bind(statement);
          Object.defineProperty(statement, method, { value: (...args: unknown[]) => { queries++; return execute(...args); }, configurable: true });
        }
        return statement;
      });
      const started = performance.now(), result = await f.report(spec("process", ["resource"]));
      const elapsedMs = performance.now() - started; spy.mockRestore();
      return { queries, elapsedMs, responseBytes: result.bytes, result: result.data, statements };
    };
    const baseline = await measure();
    f.database.transaction(() => {
      for (let i = 0; i < 120; i++) {
        const t = f.schedules.insertTask({ projectId: f.project.id, publicId: randomUUID(), externalId: `BENCH${i}`, name: `Benchmark ${i}`, type: "task", parentId: null, scheduleMode: "auto", requestedStart: "2026-10-05", startDate: "2026-10-05", endDate: "2026-10-09", duration: 5, progress: 0, status: "not_started", sortOrder: 100 + i, createdAt: now, updatedAt: now });
        f.contexts.replaceTask(f.project.id, t.id, { processLinks: [{ processId: f.processA.id, scope: "self" }], workAreaLinks: [] });
        const r = f.resources.get("R1")!;
        f.catalog.replaceTaskAssignments({ projectId: f.project.id, taskId: t.id, now, targets: [{ kind: "resource", internalId: r.id, publicId: r.publicId, assignmentPublicId: randomUUID(), assignmentStart: null, assignmentEnd: null, allocationPercent: 100 }] });
      }
      for (let i = 0; i < 25; i++) {
        const r = f.catalog.insertResource({ publicId: randomUUID(), name: `Registered ${i}`, code: `BENCH-R${i}`, description: "", now });
        f.database.prepare("INSERT INTO project_resource_memberships(project_id,resource_id,created_at) VALUES(?,?,?)").run(f.project.id, r.id, now);
      }
    })();
    const increased = await measure();
    expect(increased.result.assignmentIds).toHaveLength(124); expect(increased.result.totals.assignments.effort.knownMd).toBe(614);
    expect(increased.queries).toBeLessThanOrEqual(baseline.queries + 5);
    expect(increased.responseBytes).toBeLessThan(2 * 1024 * 1024);
    const queriesForPlan = {
      connectedCatalog: increased.statements.find(sql => sql.startsWith("SELECT public_id AS publicId,name,code,active,developer_grade") && sql.includes("UNION SELECT resource_id FROM project_resource_memberships")),
      taskContexts: increased.statements.find(sql => sql.includes("FROM tasks t LEFT JOIN task_process_contexts")),
      taskProcessLinks: increased.statements.find(sql => sql.includes("FROM task_process_links l JOIN project_processes")),
    };
    const queryPlans = Object.entries(queriesForPlan).map(([query, sql]) => {
      expect(sql, query).toBeDefined();
      const rows = f.database.prepare(`EXPLAIN QUERY PLAN ${sql}`).all(...Array.from({ length: (sql!.match(/\?/g) ?? []).length }, () => f.project.id)) as Array<{ detail: string }>;
      expect(rows.length).toBeGreaterThan(0); return { query, operations: rows.map(row => row.detail) };
    });
    const evidence = { environment: "Node HTTP socket → production handler → actual migrated SQLite; not Next browser E2E", baseline: { tasks: 8, members: 2, queries: baseline.queries, elapsedMs: baseline.elapsedMs, responseBytes: baseline.responseBytes }, increased: { tasks: 128, assignments: 124, members: 27, queries: increased.queries, elapsedMs: increased.elapsedMs, responseBytes: increased.responseBytes }, queryPlans };
    if (process.env.ISSUE_729_BENCHMARK_OUTPUT) writeFileSync(process.env.ISSUE_729_BENCHMARK_OUTPUT, JSON.stringify(evidence, null, 2));
  });
});
