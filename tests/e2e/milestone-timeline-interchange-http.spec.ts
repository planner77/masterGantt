import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { APIRequestContext, APIResponse, Download, TestInfo } from "@playwright/test";
import { expect, test, isolatedApplicationOptions } from "./fixtures/isolated-application";
import type { ProjectSnapshotResponse } from "../../src/contracts/projects";
import type { ResourceDashboardDto } from "../../src/contracts/resource-dashboard";
import type { ProjectExcelExportRequest } from "../../src/contracts/project-excel-export";
import { canonicalInterchangeFixture, canonicalMeaning, fixtureBytes, logicalHash, workbookEntries, workbookSheet } from "../fixtures/issue-553/canonical-interchange";

const editPassword = "MT553!";
const adminPassword = "Synthetic553Catalog!";
test.use({ ...isolatedApplicationOptions, isolatedResourceAdminPassword: adminPassword });
const excel: ProjectExcelExportRequest = { includeDependencies: false, scope: "project", scale: "day", hierarchyDisplay: "expanded", layout: { columns: [{ id: "text", widthPx: 224 }] } };
async function accepted(response: APIResponse, expected: number) {
  expect(response.status(), `HTTP ${response.status()}: ${await response.text()}`).toBe(expected);
  return response;
}
async function project(request: APIRequestContext, origin: string, name: string, seed = true) {
  const created = await accepted(await request.post("/api/projects", { headers: { Origin: origin }, data: { name, ownerName: "E2E 자동화", description: "#553 합성 canonical 교환", editPassword } }), 201);
  const publicId = (await created.json()).data.project.publicId as string, api = `/api/projects/${publicId}`;
  const get = async () => await (await accepted(await request.get(api), 200)).json() as ProjectSnapshotResponse;
  let snapshot = await get();
  const headers = () => ({ Origin: origin, "If-Match": `"${snapshot.data.project.revision}"` });
  const refresh = async () => snapshot = await get();
  const importFile = async (bytes: Buffer) => {
    const preview = (await (await accepted(await request.post(`${api}/imports/preview`, { headers: { Origin: origin, "Content-Type": "application/json" }, data: bytes }), 200)).json()).data;
    const response = await accepted(await request.post(`${api}/imports`, { headers: { ...headers(), "Content-Type": "application/json", "X-Import-Preview-Digest": preview.previewDigest }, data: bytes }), 201);
    await refresh(); return response;
  };
  if (seed) await importFile(fixtureBytes());
  const mutate = async (path: string, data: unknown, method: "post" | "patch" | "put" = "post", status = 200) => { const response = await accepted(await request[method](`${api}${path}`, { headers: headers(), data }), status); await refresh(); return response; };
  const task = (id: string) => snapshot.data.tasks.find(t => t.externalId === id)!;
  const unlock = async () => { await accepted(await request.post(`${api}/edit-sessions`, { headers: { Origin: origin }, data: { editPassword } }), 204); await refresh(); };
  return { publicId, api, get, headers, refresh, importFile, mutate, task, unlock, current: () => snapshot };
}
async function evidence(info: TestInfo, name: string, value: unknown) {
  const document = { environment: "Next development + real loopback HTTP + native SQLite", fixtureHash: logicalHash(canonicalInterchangeFixture()), ...value as object };
  const bytes = JSON.stringify(document, null, 2), output = info.outputPath(`${name}.json`);
  await writeFile(output, bytes); await info.attach(name, { path: output, contentType: "application/json" });
  if (process.env.CAPTURE_ISSUE_553_BACKEND === "1") {
    const directory = resolve("output/playwright/issue-553/backend-http"); await mkdir(directory, { recursive: true }); await writeFile(resolve(directory, `${name}.json`), bytes);
  }
}
async function downloadedBytes(download: Download) {
  const stream = await download.createReadStream(); expect(stream).not.toBeNull();
  const parts: Buffer[] = []; for await (const chunk of stream!) parts.push(Buffer.from(chunk)); return Buffer.concat(parts);
}

test("#553 actual HTTP JSON/Excel/Resource/logistics source invariance and process restart", async ({ page, baseURL, restartIsolatedApplication }, info) => {
  test.setTimeout(240_000);
  const origin = baseURL!, f = await project(page.request, origin, "MT5 canonical HTTP");
  await accepted(await page.request.post("/api/resource-catalog/admin-sessions", { headers: { Origin: origin }, data: { password: adminPassword } }), 201);
  let catalog = (await (await accepted(await page.request.get("/api/resources"), 200)).json()).data;
  const resource = await accepted(await page.request.post("/api/resources", { headers: { Origin: origin, "If-Match": `"${catalog.revision}"` }, data: { name: "=MT5 Developer <&>", code: "R553", roles: ["DEVELOPER"], developerGrade: "ADVANCED" } }), 201);
  catalog = (await resource.json()).data;
  const resourceId = catalog.resources.find((r: { code: string }) => r.code === "R553").id as string;
  const group = await accepted(await page.request.post("/api/resource-groups", { headers: { Origin: origin, "If-Match": `"${catalog.revision}"` }, data: { name: "MT5 group", code: "G553" } }), 201);
  catalog = (await group.json()).data;
  const groupId = catalog.groups.find((g: { code: string }) => g.code === "G553").id as string;
  await f.mutate(`/tasks/${f.task("INHERITED").taskId}/assignments`, { catalogRevision: catalog.revision, targets: [{ kind: "resource", id: resourceId, allocation: { start: null, end: null, percent: 50 } }] }, "put");
  await f.mutate(`/tasks/${f.task("FREE").taskId}/assignments`, { catalogRevision: catalog.revision, targets: [{ kind: "resource", id: resourceId }] }, "put");
  await f.mutate(`/tasks/${f.task("S").taskId}/assignments`, { catalogRevision: catalog.revision, targets: [{ kind: "group", id: groupId }] }, "put");
  const process = await f.mutate("/logistics/processes", { name: "MT5 공정", code: "PROC553" }, "post", 201);
  const processId = (await process.json()).data.logistics.processes[0].id as string;
  const equipment = await f.mutate("/logistics/equipment", { processId, name: "MT5 설비", code: "EQ553", equipmentType: "stocker", managementUnit: "unit", quantity: 1 }, "post", 201);
  const equipmentId = (await equipment.json()).data.logistics.equipment[0].id as string;
  await f.mutate(`/tasks/${f.task("INHERITED").taskId}/logistics-links`, { equipmentLinks: [{ equipmentId, scope: "self" }], systemLinks: [] }, "put");
  const before = await f.get(), beforeHash = logicalHash(before.data);
  const projections = async () => {
    const stage = (await (await accepted(await page.request.get(`${f.api}/milestone-dashboard?asOfDate=2026-10-09`), 200)).json()).data;
    const resource = (await (await accepted(await page.request.get(`${f.api}/resource-dashboard?from=2026-10-06&to=2026-10-09&mdPerMm=null`), 200)).json()).data as ResourceDashboardDto;
    const logistics = (await (await accepted(await page.request.get(`${f.api}/logistics/dashboard`), 200)).json()).data;
    return { stage, resource, logistics };
  };
  const reports = await projections();
  const jsonResponse = await accepted(await page.request.post(`${f.api}/exports/json`, { headers: f.headers(), data: { scope: "project" } }), 200);
  const bytes = await jsonResponse.body(), json = JSON.parse(bytes.toString());
  expect(json.tasks).toHaveLength(33); expect(json.memberships).toHaveLength(5);
  expect(Object.keys(json).sort()).toEqual(["memberships", "project", "schemaVersion", "source", "tasks"]);
  const workbookResponse = await accepted(await page.request.post(`${f.api}/exports/excel`, { headers: f.headers(), data: { ...excel, includeLogistics: true } }), 200);
  const workbook = workbookEntries(await workbookResponse.body());
  expect(workbook.get("xl/workbook.xml")).toContain('name="Logistics"'); expect(workbook.get("xl/workbook.xml")).not.toContain('name="Dependencies"'); expect(workbook.get("xl/workbook.xml")).not.toContain('name="Resource Report"');
  for (const task of before.data.tasks) expect(workbookSheet(workbook, "Tasks")).toContain(task.taskId);
  expect(workbookSheet(workbook, "Gantt")).toContain("M-INTERNAL");
  expect(workbookSheet(workbook, "Milestone Stages")).toContain("M/M 환산 미설정은 0이 아님");
  const reportOptions = { basis: "current", expectedReport: { context: reports.resource.resourceScopeContext, snapshotId: reports.resource.snapshotId, filters: { from: "2026-10-06", to: "2026-10-09", mdPerMm: null } }, granularities: ["week", "month"] };
  const detailed = await accepted(await page.request.post(`${f.api}/exports/excel`, { headers: f.headers(), data: { ...excel, includeLogistics: true, resourceDashboard: reportOptions } }), 200);
  const expanded = workbookEntries(await detailed.body());
  expect(workbookSheet(expanded, "Tasks")).toBe(workbookSheet(workbook, "Tasks")); expect(workbookSheet(expanded, "Gantt")).toBe(workbookSheet(workbook, "Gantt")); expect(workbookSheet(expanded, "Logistics")).toBe(workbookSheet(workbook, "Logistics"));
  expect(expanded.get("xl/workbook.xml")).toContain('name="Resource Report"');
  const rawAssignment = workbookSheet(expanded, "Resource Assignments");
  expect(rawAssignment).toContain("=MT5 Developer &lt;&amp;&gt;"); expect(rawAssignment).not.toContain("<f>"); expect(rawAssignment).toMatch(/<c r="Y\d+"[^>]*\/>/);
  const links = [...expanded.values()].filter(xml => xml.includes('TargetMode="External"')); expect(links).toHaveLength(1); expect(links[0]).toContain(`Target="${origin}/projects/${f.publicId}"`);
  const stale = await page.request.post(`${f.api}/exports/excel`, { headers: { ...f.headers(), "If-Match": '"1"' }, data: excel }); expect(stale.status()).toBe(412);
  const foreign = await page.request.post(`${f.api}/exports/json`, { headers: { ...f.headers(), Origin: "http://foreign.example" }, data: {} }); expect(foreign.status()).toBe(403);
  const unsupported = await page.request.post(`${f.api}/exports/gantt-svg`, { headers: f.headers(), data: { scope: "project", scale: "day", hierarchyDisplay: "expanded" } }); expect(unsupported.status()).toBe(422); expect((await unsupported.json()).error.code).toBe("EXPORT_UNSUPPORTED");
  expect(await f.get()).toEqual(before);
  const target = await project(page.request, origin, "MT5 JSON imported", false); await target.importFile(bytes);
  const imported = await target.get(); expect(canonicalMeaning(imported)).toEqual(canonicalMeaning(before)); expect(imported.data.assignments).toEqual([]); expect(imported.data.logistics?.processes).toEqual([]);
  expect(imported.data.tasks.every(t => !before.data.tasks.some(source => source.taskId === t.taskId))).toBe(true);
  // The isolated fixture really stops and starts Next on the same SQLite file.
  await restartIsolatedApplication();
  expect(await f.get()).toEqual(before); expect(await target.get()).toEqual(imported);
  const afterReports = await projections();
  // calculatedAt is a fresh observation; compare every other actual projection field.
  const stable = (value: unknown): unknown => Array.isArray(value) ? value.map(stable) : value && typeof value === "object" ? Object.fromEntries(Object.entries(value).filter(([key]) => key !== "calculatedAt").map(([key, item]) => [key, stable(item)])) : value;
  expect(stable(afterReports)).toEqual(stable(reports));
  await evidence(info, "actual-http-export-import-restart", { publicId: f.publicId, importedPublicId: target.publicId, revision: before.data.project.revision, canonicalBeforeHash: beforeHash, canonicalAfterHash: logicalHash((await f.get()).data), semanticSourceHash: logicalHash(canonicalMeaning(before)), semanticImportedHash: logicalHash(canonicalMeaning(imported)), taskCount: 33, linkCount: 8, explicitMembershipCount: 5, assignmentCount: before.data.assignments?.length, catalogRevision: reports.resource.catalogRevision, jsonBytes: bytes.length, defaultWorkbookBytes: (await workbookResponse.body()).length, resourceWorkbookBytes: (await detailed.body()).length, processRestarted: true, projectionEqualityExcludingCalculatedAt: true, sourceUnchanged: true, resourceLogisticsExcludedFromJson: true, svgUnsupportedStatus: unsupported.status(), staleStatus: stale.status(), foreignOriginStatus: foreign.status() });
});

test("#553 actual HTTP Copy/Template/multi-root Copy/Cut and external membership policy", async ({ page, baseURL }, info) => {
  test.setTimeout(200_000);
  const origin = baseURL!, f = await project(page.request, origin, "MT5 Copy Template"), before = await f.get();
  const copied = (await (await accepted(await page.request.post(`${f.api}/copy`, { headers: f.headers(), data: { name: "MT5 Copy", ownerName: "E2E 자동화", description: "", editPassword, resetProgress: false } }), 201)).json()).data;
  const copySnapshot = await (await accepted(await page.request.get(`/api/projects/${copied.project.publicId}`), 200)).json() as ProjectSnapshotResponse;
  expect(canonicalMeaning(copySnapshot)).toEqual(canonicalMeaning(before)); expect(copySnapshot.data.tasks.every(t => !before.data.tasks.some(s => s.taskId === t.taskId))).toBe(true);
  await f.unlock(); expect((await f.get()).data.tasks).toEqual(before.data.tasks);
  const template = (await (await accepted(await page.request.post("/api/project-templates", { headers: f.headers(), data: { sourceProjectPublicId: f.publicId, name: "MT5 saved", description: "" } }), 201)).json()).data;
  const instance = (await (await accepted(await page.request.post(`/api/project-templates/${template.id}/instantiate`, { headers: { Origin: origin }, data: { name: "MT5 Instance", ownerName: "E2E 자동화", editPassword, description: "", projectStartDate: "2026-10-06" } }), 201)).json()).data;
  expect(instance.tasks).toHaveLength(33); expect(instance.links).toHaveLength(8);
  const instanceSnapshot = await (await accepted(await page.request.get(`/api/projects/${instance.project.publicId}`), 200)).json() as ProjectSnapshotResponse;
  expect(canonicalMeaning(instanceSnapshot).tasks.map(t => [t.externalId, t.parentExternalId, t.membership])).toEqual(canonicalMeaning(before).tasks.map(t => [t.externalId, t.parentExternalId, t.membership]));
  expect(instance.tasks.filter((t: { type: string }) => t.type !== "summary").every((t: { status: string; progress: number; baselineStart: string | null }) => t.status === "not_started" && t.progress === 0 && t.baselineStart == null)).toBe(true);
  await f.unlock();
  const reviewBefore = await f.get(), command = { kind: "copy", taskIds: [f.task("S").taskId], anchorTaskId: f.task("DEST").taskId, placement: "child" };
  const unconfirmed = await page.request.post(`${f.api}/task-commands`, { headers: f.headers(), data: command }); expect(unconfirmed.status()).toBe(409); expect((await unconfirmed.json()).error.code).toBe("TASK_COPY_MEMBERSHIP_REVIEW_REQUIRED"); expect(await f.get()).toEqual(reviewBefore);
  await f.mutate("/task-commands", { ...command, taskIds: [f.task("S").taskId, f.task("M-SAME-A").taskId, f.task("M-SAME-B").taskId, f.task("T-SS-P").taskId, f.task("T-SS-Q").taskId], acknowledgedMembershipExclusions: true });
  const copiedUnion = f.current(), newTasks = copiedUnion.data.tasks.filter(t => !before.data.tasks.some(s => s.taskId === t.taskId)); expect(newTasks).toHaveLength(11);
  expect(newTasks.some(t => t.name === "M-INTERNAL" && t.type === "milestone")).toBe(true);
  expect(copiedUnion.data.links.filter(l => !before.data.links.some(s => s.id === l.id))).toHaveLength(1);
  const priorIds = copiedUnion.data.tasks.map(t => t.taskId), free = f.task("FREE");
  await f.mutate("/task-commands", { kind: "reparent", taskId: free.taskId, anchorTaskId: f.task("DEST").taskId, placement: "child" });
  expect(new Set(f.current().data.tasks.map(t => t.taskId))).toEqual(new Set(priorIds)); expect(f.task("FREE").membership?.effectiveMilestoneTaskId).toBe(f.task("M-LONG").taskId);
  await evidence(info, "actual-http-copy-template-cut", { publicId: f.publicId, copiedPublicId: copied.project.publicId, templateId: template.id, instantiatedPublicId: instance.project.publicId, beforeRevision: before.data.project.revision, finalRevision: f.current().data.project.revision, fullCopySemanticHash: logicalHash(canonicalMeaning(copySnapshot)), sourceSemanticHash: logicalHash(canonicalMeaning(before)), templateTaskCount: 33, templateLinkCount: 8, sourceBeforeStructuralCommandsUnchanged: true, multiRootCopiedTaskCount: newTasks.length, cutIdsUnchanged: true, unconfirmedMembershipStatus: unconfirmed.status() });
});

test("#553 actual HTTP supported SVG variant and closed/import/session/revision atomic guards", async ({ page, browser, baseURL }, info) => {
  test.setTimeout(160_000);
  const origin = baseURL!, f = await project(page.request, origin, "MT5 guards", false);
  const supported = canonicalInterchangeFixture(); supported.tasks.forEach(t => t.predecessors.forEach(l => { l.type = "FS"; l.lag = 0; }));
  await f.importFile(Buffer.from(JSON.stringify(supported)));
  const before = await f.get();
  // No route mocking: these four downloads cross the actual common dialog and HTTP renderer.
  await page.addInitScript(() => {
    const state = { created: 0, revoked: 0 };
    Object.defineProperty(window, "__issue553ObjectUrls", { value: state });
    const create = URL.createObjectURL.bind(URL), revoke = URL.revokeObjectURL.bind(URL);
    URL.createObjectURL = (value: Blob | MediaSource) => { state.created++; return create(value); };
    URL.revokeObjectURL = (value: string) => { state.revoked++; revoke(value); };
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`/projects/${f.publicId}`);
  await expect(page.getByText("편집 중", { exact: true })).toBeVisible();
  const frame = page.locator(".project-gantt-frame"); await expect(frame).toHaveAttribute("data-project-gantt-api-instance", /.+/);
  const instance = await frame.getAttribute("data-project-gantt-api-instance");
  const nativeRow = (id: string) => page.locator(`.project-gantt-widget .wx-row[data-id=":${id}"]`);
  await expect(nativeRow(f.task("S").taskId)).toBeVisible();
  const collapse = nativeRow(f.task("S").taskId).locator('[data-action="open-task"]'); await collapse.click(); await expect(collapse).toHaveClass(/wxi-menu-right/);
  const toggle = page.getByRole("button", { name: "◆ Milestone 표시", exact: true }); await toggle.click(); await expect(toggle).toHaveAttribute("aria-pressed", "false");
  const search = page.getByRole("searchbox", { name: "작업명, 설명, External ID 검색", exact: true }); await search.fill("FREE");
  await expect(nativeRow(f.task("FREE").taskId)).toBeVisible(); await expect(nativeRow(f.task("INHERITED").taskId)).toHaveCount(0);
  const trigger = page.getByRole("button", { name: "내보내기", exact: true }).first(), dialog = page.getByRole("dialog", { name: "내보내기", exact: true });
  const downloads: { format: string; bytes: number; hash: string; revision: number; canonicalMilestoneCount?: number; width?: number; height?: number }[] = [];
  let mutations = 0;
  const observe = (request: import("@playwright/test").Request) => {
    const path = new URL(request.url()).pathname;
    if (path.startsWith(f.api) && !path.includes("/exports/") && ["POST", "PATCH", "PUT", "DELETE"].includes(request.method())) mutations++;
  };
  page.on("request", observe);
  let fullSvgDimensions: RegExpExecArray | null = null;
  for (const format of ["json", "excel", "svg", "png"] as const) {
    await trigger.click(); await dialog.getByLabel("형식").selectOption(format);
    if (format === "excel") await dialog.getByLabel("일정 Dependency 제외").check();
    if (format === "svg" || format === "png") await dialog.getByLabel("프로젝트 전체 (Grid와 차트)").check();
    const path = `${f.api}/exports/${format === "excel" ? "excel" : format === "json" ? "json" : "gantt-svg"}`;
    const [request, download] = await Promise.all([page.waitForRequest(r => r.method() === "POST" && new URL(r.url()).pathname === path), page.waitForEvent("download"), dialog.getByRole("button", { name: "내보내기", exact: true }).click()]);
    expect(request.headers()["if-match"]).toBe(`"${before.data.project.revision}"`);
    const bytes = await downloadedBytes(download), record = { format, bytes: bytes.length, hash: logicalHash(bytes.toString("base64")), revision: before.data.project.revision };
    if (format === "json") { const output = JSON.parse(bytes.toString()); expect(output.tasks).toHaveLength(33); expect(output.memberships).toHaveLength(5); expect(output.tasks.filter((t: { type: string }) => t.type === "milestone")).toHaveLength(before.data.tasks.filter(t => t.type === "milestone").length); }
    if (format === "excel") { const output = workbookEntries(bytes); for (const task of before.data.tasks) expect(workbookSheet(output, "Tasks")).toContain(task.taskId); expect(workbookSheet(output, "Gantt")).toContain("M-INTERNAL"); expect(output.get("xl/workbook.xml")).not.toContain('name="Dependencies"'); }
    if (format === "svg") { const text = bytes.toString(); expect(text).toContain("M-ONLY"); expect(text).toContain("M-INTERNAL"); expect(text.match(/<polygon /g)).toHaveLength(before.data.tasks.filter(t => t.type === "milestone").length); fullSvgDimensions = /<svg[^>]*width="(\d+)" height="(\d+)"/.exec(text); expect(fullSvgDimensions).not.toBeNull(); }
    if (format === "png") { expect(bytes.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a"); expect(bytes.readUInt32BE(16)).toBe(Number(fullSvgDimensions![1])); expect(bytes.readUInt32BE(20)).toBe(Number(fullSvgDimensions![2])); downloads.push({ ...record, width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) }); }
    else downloads.push(record);
    await expect(dialog).toHaveCount(0); await expect(trigger).toBeFocused(); await expect(toggle).toHaveAttribute("aria-pressed", "false"); await expect(search).toHaveValue("FREE"); await expect(frame).toHaveAttribute("data-project-gantt-api-instance", instance!); expect(await f.get()).toEqual(before);
  }
  page.off("request", observe); expect(mutations).toBe(0);
  await expect.poll(() => page.evaluate(() => { const state = (window as unknown as Window & { __issue553ObjectUrls: { created: number; revoked: number } }).__issue553ObjectUrls; return state.created - state.revoked; })).toBe(0);
  // Clearing the search confirms the original collapsed tree survived every export.
  await search.fill(""); await expect(nativeRow(f.task("S").taskId).locator('[data-action="open-task"]')).toHaveClass(/wxi-menu-right/);
  await evidence(info, "actual-browser-off-search-collapsed-downloads", { publicId: f.publicId, revision: before.data.project.revision, apiInstance: instance, showMilestones: false, searchDuringDownloads: "FREE", collapsedSummaryExternalId: "S", downloads, mutationRequestCount: mutations, canonicalSnapshotUnchanged: true, objectUrlsAllRevoked: true, actualHttpNoRouteMocking: true });
  const svgResponse = await accepted(await page.request.post(`${f.api}/exports/gantt-svg`, { headers: f.headers(), data: { scope: "project", scale: "week", hierarchyDisplay: "expanded" } }), 200);
  const svg = await svgResponse.text(); expect(svg).toContain("M-ONLY"); expect(svg).toContain("M-INTERNAL"); expect(svg.match(/<polygon /g)).toHaveLength(before.data.tasks.filter(t => t.type === "milestone").length);
  const clipped = await accepted(await page.request.post(`${f.api}/exports/gantt-svg`, { headers: f.headers(), data: { scope: "range", startDate: "2026-10-06", endDate: "2026-10-07", scale: "day", hierarchyDisplay: "expanded" } }), 200); expect(await clipped.text()).toContain('width="64"');
  const closed = { kind: "copy", taskIds: [f.task("M-CLOSED").taskId], anchorTaskId: f.task("DEST").taskId, placement: "child", acknowledgedMembershipExclusions: true };
  const boundary = await page.request.post(`${f.api}/task-commands`, { headers: f.headers(), data: closed }); expect(boundary.status()).toBe(409); expect((await boundary.json()).error.code).toBe("COMPLETED_MILESTONE_COPY_BOUNDARY_LOCKED"); expect(await f.get()).toEqual(before);
  const mixed = canonicalInterchangeFixture(); mixed.tasks.find(t => t.externalId === "M-MANUAL")!.predecessors = [{ externalId: "FREE", type: "SS", lag: 0 }];
  const mixedTarget = await project(page.request, origin, "MT5 mixed rejection", false), emptyTarget = await mixedTarget.get();
  const rejected = await page.request.post(`${mixedTarget.api}/imports/preview`, { headers: { Origin: origin, "Content-Type": "application/json" }, data: Buffer.from(JSON.stringify(mixed)) }); expect(rejected.status()).toBe(422); expect((await rejected.json()).error.code).toBe("MIXED_DEPENDENCY_UNSUPPORTED"); expect(await mixedTarget.get()).toEqual(emptyTarget); expect(await f.get()).toEqual(before);
  // Creating another Project replaces this context's edit cookie; restore the source binding.
  await f.unlock(); expect(await f.get()).toEqual(before);
  const command = { kind: "reparent", taskId: f.task("FREE").taskId, anchorTaskId: f.task("DEST").taskId, placement: "child" };
  const stale = await page.request.post(`${f.api}/task-commands`, { headers: { ...f.headers(), "If-Match": '"1"' }, data: command }); expect(stale.status()).toBe(412); expect((await stale.json()).error.code).toBe("REVISION_MISMATCH");
  const readonly = await browser.newContext({ baseURL: origin });
  try { const unauthorized = await readonly.request.post(`${f.api}/task-commands`, { headers: f.headers(), data: command }); expect(unauthorized.status()).toBe(401); expect((await unauthorized.json()).error.code).toBe("EDIT_SESSION_REQUIRED"); } finally { await readonly.close(); }
  expect(await f.get()).toEqual(before);
  await evidence(info, "actual-http-svg-and-atomic-guards", { publicId: f.publicId, canonicalHash: logicalHash(before.data), taskCount: before.data.tasks.length, supportedVariant: "all existing endpoint pairs FS/0, recalculated by actual Import", svgBytes: Buffer.byteLength(svg), fullMilestonePolygonCount: before.data.tasks.filter(t => t.type === "milestone").length, rangeWidthPx: 64, completedCopyStatus: boundary.status(), completedCopyCode: "COMPLETED_MILESTONE_COPY_BOUNDARY_LOCKED", mixedImportStatus: rejected.status(), mixedImportCode: "MIXED_DEPENDENCY_UNSUPPORTED", staleStatus: stale.status(), staleCode: "REVISION_MISMATCH", unauthorizedStatus: 401, unauthorizedCode: "EDIT_SESSION_REQUIRED", snapshotUnchangedAfterEveryRejectedMutation: true });
});
