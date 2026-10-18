import { inflateRawSync } from "node:zlib";
import { expect, test, isolatedApplicationOptions } from "./fixtures/isolated-application";
import type { ProjectSnapshotResponse, ProjectTaskDto } from "../../src/contracts/projects";
import type { ResourceDashboardDto } from "../../src/contracts/resource-dashboard";
import type { ProjectExcelExportRequest } from "../../src/contracts/project-excel-export";
import type { ResourceExcelExportOptions } from "../../src/contracts/resource-excel-export";
const password = "Synthetic529Backend!";
test.use({ ...isolatedApplicationOptions, isolatedResourceAdminPassword: password });
function entries(bytes: Buffer) { const result = new Map<string, string>(); let at = 0; while (at + 30 <= bytes.length && bytes.readUInt32LE(at) === 0x04034b50) { const size = bytes.readUInt32LE(at + 18), length = bytes.readUInt16LE(at + 26), start = at + 30 + length + bytes.readUInt16LE(at + 28); result.set(bytes.toString("utf8", at + 30, at + 30 + length), inflateRawSync(bytes.subarray(start, start + size)).toString()); at = start + size; } return result; }
test("#529 실제 Next HTTP XLSX·readonly·exact scope·원문·숫자·stale 전체 실패", async ({ page, browser, baseURL }, info) => {
  test.setTimeout(180000); const origin = baseURL!;
  const created = await page.request.post("/api/projects", { headers: { Origin: origin }, data: { name: "Resource Export #529", ownerName: "Backend E2E", description: "synthetic", editPassword: "API529!" } }); expect(created.status()).toBe(201);
  const publicId = (await created.json()).data.project.publicId as string, api = `/api/projects/${publicId}`;
  const get = async () => await (await page.request.get(api)).json() as ProjectSnapshotResponse; let snapshot = await get();
  const mutate = async (path: string, data: unknown, method: "post" | "put" | "patch" = "post", status = 200) => { const response = await page.request[method](`${api}${path}`, { headers: { Origin: origin, "If-Match": `"${snapshot.data.project.revision}"` }, data }); expect(response.status(), await response.text()).toBe(status); snapshot = await get(); return response; };
  const add = async (name: string, type: "task" | "milestone" = "task") => { const response = await mutate("/tasks", { name, type, start: "2026-10-06", duration: type === "task" ? 3 : 0, progress: 0 }, "post", 201); return (await response.json()).data.tasks.find((t: ProjectTaskDto) => t.name === name) as ProjectTaskDto; };
  const task = await add("=원문<&"), unset = await add("-미설정"), milestone = await add("Milestone529", "milestone");
  await mutate("/milestone-memberships", { changes: [{ taskId: task.taskId, milestoneTaskId: milestone.taskId }] });
  expect((await page.request.post("/api/resource-catalog/admin-sessions", { headers: { Origin: origin }, data: { password } })).status()).toBe(201);
  let catalog = (await (await page.request.get("/api/resources")).json()).data;
  const resourceIds: string[] = [];
  for (const code of ["R1", "R2"]) { const response = await page.request.post("/api/resources", { headers: { Origin: origin, "If-Match": `"${catalog.revision}"` }, data: { name: `+${code}`, code: `@${code}`, roles: ["PI", "DEVELOPER"], developerGrade: "ADVANCED" } }); expect(response.status()).toBe(201); catalog = (await response.json()).data; resourceIds.push(catalog.resources.find((r: { code: string }) => r.code === `@${code}`).id); }
  await mutate(`/tasks/${task.taskId}/assignments`, { catalogRevision: catalog.revision, targets: resourceIds.map(id => ({ kind: "resource", id, allocation: { start: null, end: null, percent: 33.333333 } })) }, "put");
  await mutate(`/tasks/${unset.taskId}/assignments`, { catalogRevision: catalog.revision, targets: [{ kind: "resource", id: resourceIds[0] }] }, "put");
  const readonly = await browser.newContext({ baseURL: origin });
  try {
    const report = (await (await readonly.request.get(`${api}/resource-dashboard?from=2026-10-06&to=2026-10-08&mdPerMm=null`)).json()).data as ResourceDashboardDto;
    const resourceDashboard: ResourceExcelExportOptions = { basis: "current", expectedReport: { context: report.resourceScopeContext!, snapshotId: report.snapshotId, filters: { from: "2026-10-06", to: "2026-10-08", mdPerMm: null } }, granularities: ["week", "month"] };
    const body: ProjectExcelExportRequest = { scope: "project", scale: "day", hierarchyDisplay: "expanded", includeDependencies: false, layout: { columns: [{ id: "text", widthPx: 224 }] }, resourceDashboard };
    const exportFile = async (input = body, originValue = origin) => readonly.request.post(`${api}/exports/excel`, { headers: { Origin: originValue, "If-Match": `"${report.projectRevision}"` }, data: input });
    const response = await exportFile(); expect(response.status(), await response.text()).toBe(200); const zip = entries(await response.body()); const workbook = zip.get("xl/workbook.xml")!;
    const names = [...workbook.matchAll(/name="([^"]+)"/g)].map(m => m[1]); expect(names.slice(-7)).toEqual(["Resource Report", "Resource Milestones", "Group Milestones", "Resource Plan", "Resource Assignments", "Resource Quality", "Resource Relations"]);
    const xml = zip.get(`xl/worksheets/sheet${names.indexOf("Resource Assignments") + 1}.xml`)!;
    expect([...xml.matchAll(/<row /g)]).toHaveLength(4); expect(xml).toContain("=원문&lt;&amp;"); expect(xml).toContain("+R1"); expect(xml).toContain("@R1"); expect(xml).not.toContain("&apos;=원문"); expect(xml).not.toContain("<f>");
    const values = [...xml.matchAll(/<c r="Y\d+"[^>]*><v>([^<]+)<\/v><\/c>/g)].map(m => Number(m[1])); expect(values.reduce((n, v) => n + v, 0)).toBeCloseTo(report.summary.effort.knownMd, 14); expect(xml).toMatch(/<c r="Y\d+"[^>]*\/>/); expect(xml).toMatch(/<c r="Z\d+"[^>]*\/>/);
    const external = [...zip.values()].filter(value => value.includes('TargetMode="External"')); expect(external).toHaveLength(1); expect(external[0]).toContain(`Target="${origin}/projects/${publicId}"`);
    expect(response.headers()["cache-control"]).toBe("private, no-store"); expect(response.headers()["set-cookie"]).toBeUndefined(); expect(response.headers()["x-content-type-options"]).toBe("nosniff"); expect(await readonly.cookies()).toEqual([]);
    const scopedResponse = await readonly.request.post(`${api}/resource-dashboard/query`, { headers: { Origin: origin }, data: { sourceContext: report.resourceScopeContext, scope: { kind: "scheduleSelection", nodeIds: [task.taskId] }, filters: body.resourceDashboard!.basis === "current" ? body.resourceDashboard!.expectedReport.filters : {}, projection: { kind: "report" } } }); expect(scopedResponse.status()).toBe(200);
    const scoped = (await scopedResponse.json()).data as ResourceDashboardDto, scopedOptions: ResourceExcelExportOptions = { ...resourceDashboard, expectedReport: { context: scoped.resourceScopeContext!, snapshotId: scoped.snapshotId, filters: resourceDashboard.expectedReport.filters } };
    const omitted = await exportFile({ ...body, resourceDashboard: scopedOptions }); expect(omitted.status()).toBe(412); expect(omitted.headers()["content-type"]).toContain("json");
    const exact = await exportFile({ ...body, resourceDashboard: { ...scopedOptions, binding: { sourceContext: report.resourceScopeContext!, scope: { kind: "scheduleSelection", nodeIds: [task.taskId] } } } }); expect(exact.status()).toBe(200);
    expect((await exportFile(body, "http://foreign.example")).status()).toBe(403);
    const huge = await readonly.request.post(`${api}/exports/excel`, { headers: { Origin: origin, "If-Match": `"${report.projectRevision}"`, "Content-Type": "application/json" }, data: " ".repeat(8193) }); expect(huge.status()).toBe(413);
    expect((await get()).data.project.revision).toBe(report.projectRevision); await mutate(`/tasks/${task.taskId}`, { name: "changed" }, "patch"); const stale = await exportFile(); expect(stale.status()).toBe(412);
    await info.attach("actual-529-api-xlsx", { body: JSON.stringify({ names, bytes: (await response.body()).length, selectedA: report.summary.assignmentCount, knownMd: report.summary.effort.knownMd, snapshotId: report.snapshotId, rawContext: report.resourceScopeContext }), contentType: "application/json" });
  } finally { await readonly.close(); }
});
