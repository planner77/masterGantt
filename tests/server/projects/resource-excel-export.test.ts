import { RESOURCE_EXCEL_EXPORT_LIMITS } from "../../../src/contracts/resource-excel-export";
import { assertResourceExcelBudget, assertResourceExcelXmlBytes, assertResourceExcelZipBytes } from "../../../src/server/exports/resource-excel-export-core";
import { inflateRawSync } from "node:zlib";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ResourceDashboardDto } from "../../../src/contracts/resource-dashboard";
import type { ProjectExcelExportRequest } from "../../../src/contracts/project-excel-export";
import type { ResourceExcelExportOptions } from "../../../src/contracts/resource-excel-export";
import { ProjectExportSnapshotService } from "../../../src/server/exports/project-export-snapshot-service-core";
import { handleProjectExcelExport } from "../../../src/server/exports/project-excel-export-handler-core";
import { buildProjectExcelWorkbook } from "../../../src/server/exports/project-excel-export-core";
import { parseProjectExcelExportInput } from "../../../src/server/exports/project-excel-export-contract";
import { resourceDashboardFixture, RESOURCE_DASHBOARD_NOW } from "../../fixtures/resource-dashboard";
const fixtures: ReturnType<typeof resourceDashboardFixture>[] = [];
function fixture() { const f = resourceDashboardFixture(); fixtures.push(f); return f; }
afterEach(() => { vi.restoreAllMocks(); fixtures.splice(0).forEach(f => f.database.close()); });
const legacy: ProjectExcelExportRequest = { includeDependencies: false, scope: "project", scale: "day", hierarchyDisplay: "expanded", layout: { columns: [{ id: "text", widthPx: 224 }] } };
function options(f: ReturnType<typeof fixture>, filters = {}): ResourceExcelExportOptions { const report = f.service.getDashboard(f.project.publicId, filters)!; return { basis: "current", expectedReport: { context: report.resourceScopeContext!, snapshotId: report.snapshotId, filters }, granularities: ["week", "month"] }; }
function extract(bytes: Uint8Array) { const b = Buffer.from(bytes), entries = new Map<string, string>(); let offset = 0; while (offset + 30 <= b.length && b.readUInt32LE(offset) === 0x04034b50) { const length = b.readUInt32LE(offset + 18), nameLength = b.readUInt16LE(offset + 26), start = offset + 30 + nameLength + b.readUInt16LE(offset + 28); entries.set(b.toString("utf8", offset + 30, offset + 30 + nameLength), inflateRawSync(b.subarray(start, start + length)).toString()); offset = start + length; } return entries; }
function cells(xml: string) { return [...xml.matchAll(/<c r="([A-Z]+\d+)"[^>]*?(?:\/>|>(.*?)<\/c>)/g)].map(match => ({ ref: match[1], raw: match[0], number: /<v>(.*?)<\/v>/.exec(match[2] ?? "")?.[1], text: /<t[^>]*>(.*?)<\/t>/.exec(match[2] ?? "")?.[1] })); }
async function http(f: ReturnType<typeof fixture>, resourceDashboard?: ResourceExcelExportOptions, body?: string, headers: Record<string, string> = {}) { const service = new ProjectExportSnapshotService(f.database, { clock: () => new Date(RESOURCE_DASHBOARD_NOW), mdPerMmEnvironment: "21" }); return handleProjectExcelExport(new Request(`https://gantt.example/api/projects/${f.project.publicId}/exports/excel`, { method: "POST", headers: { "Content-Type": "application/json", Origin: "https://gantt.example", "If-Match": '"1"', ...headers }, body: body ?? JSON.stringify({ ...legacy, ...(resourceDashboard ? { resourceDashboard } : {}) }) }), f.project.publicId, { service: { getReadonlySnapshot: () => undefined }, applicationBaseUrl: "https://gantt.example", environment: "production", getExportBundle: (...args) => service.get(...args) }); }
describe("#529 Resource workbook real SQLite HTTP handler and OOXML", () => {
  it("checks actual UTF-8 XML and final ZIP bytes and all count boundaries without truncation", () => {
    for (const key of ["sheetRows", "reportRows", "reportCells"] as const) { const cap = RESOURCE_EXCEL_EXPORT_LIMITS[key]; expect(() => assertResourceExcelBudget(key, cap, cap)).not.toThrow(); expect(() => assertResourceExcelBudget(key, cap + 1, cap)).toThrow("limit exceeded"); }
    const xml = "가".repeat(Math.floor(RESOURCE_EXCEL_EXPORT_LIMITS.workbookXmlBytes / 3)), tail = "x".repeat(RESOURCE_EXCEL_EXPORT_LIMITS.workbookXmlBytes % 3);
    expect(() => assertResourceExcelXmlBytes([xml, tail])).not.toThrow(); expect(() => assertResourceExcelXmlBytes([xml, tail + "x"])).toThrow("XML bytes limit exceeded");
    expect(() => assertResourceExcelZipBytes(new Uint8Array(RESOURCE_EXCEL_EXPORT_LIMITS.workbookZipBytes))).not.toThrow(); expect(() => assertResourceExcelZipBytes(new Uint8Array(RESOURCE_EXCEL_EXPORT_LIMITS.workbookZipBytes + 1))).toThrow("ZIP bytes limit exceeded");
  });
  it("integrates writer text limits at 32767 and 32768 code points", () => {
    const f = fixture(), opts = options(f), service = new ProjectExportSnapshotService(f.database, { clock: () => new Date(RESOURCE_DASHBOARD_NOW), mdPerMmEnvironment: "21" }), bundle = service.get(f.project.publicId, false, opts)!;
    bundle.resourceDashboard!.canonicalProjectUrl = `https://gantt.example/projects/${f.project.publicId}`;
    bundle.resourceDashboard!.report.resources[0].name = "한".repeat(32767);
    expect(() => buildProjectExcelWorkbook(bundle.snapshot, { ...legacy, resourceDashboard: opts }, undefined, bundle.stageDashboard, bundle.resourceDashboard)).not.toThrow();
    bundle.resourceDashboard!.report.resources[0].name = "한".repeat(32768);
    expect(() => buildProjectExcelWorkbook(bundle.snapshot, { ...legacy, resourceDashboard: opts }, undefined, bundle.stageDashboard, bundle.resourceDashboard)).toThrow("Excel cell limit");
  });
  it.each(["\uFFFE", "\uFFFF", "\u0001"])("rejects actual Catalog XML forbidden character %s with no workbook", async bad => {
    const f = fixture(); f.catalog.updateResource(f.resources.get("R1")!.id, { name: `unsafe${bad}` }, RESOURCE_DASHBOARD_NOW);
    const response = await http(f, options(f)); expect(response.status).toBe(422); expect(response.headers.get("content-type")).toContain("json");
  });
  it.each(["project", "unselectedTask"])("rejects XML forbidden legacy input outside selected report: %s", async kind => {
    const f = fixture();
    if (kind === "project") f.database.prepare("UPDATE projects SET name=? WHERE id=?").run("Project\uFFFF", f.project.id);
    else f.database.prepare("UPDATE tasks SET name=? WHERE id=?").run("Unselected\uFFFE", f.tasks.get("T3")!.id);
    const response = await http(f, options(f, { taskIds: [f.tasks.get("T1")!.publicId] }));
    expect(response.status).toBe(422); expect(response.headers.get("content-type")).toContain("json");
  });
  it("rejects unpaired surrogates before JSON escaping and preserves valid supplementary Unicode/tab/LF/CR", () => {
    const f = fixture(), opts = options(f), service = new ProjectExportSnapshotService(f.database, { clock: () => new Date(RESOURCE_DASHBOARD_NOW), mdPerMmEnvironment: "21" }), b = service.get(f.project.publicId, false, opts)!;
    b.resourceDashboard!.canonicalProjectUrl = `https://gantt.example/projects/${f.project.publicId}`;
    b.resourceDashboard!.report.resources[0].name = "😀\t\n\r=+-@"; expect(() => buildProjectExcelWorkbook(b.snapshot, { ...legacy, resourceDashboard: opts }, undefined, b.stageDashboard, b.resourceDashboard)).not.toThrow();
    for (const bad of ["\uD800", "\uDC00"]) { b.resourceDashboard!.report.resources[0].name = bad; expect(() => buildProjectExcelWorkbook(b.snapshot, { ...legacy, resourceDashboard: opts }, undefined, b.stageDashboard, b.resourceDashboard)).toThrow("XML 1.0 forbidden"); }
  });
  it("exports real HTTP bytes, seven append sheets, raw/blank numeric cells and distinct A parity", async () => {
    const f = fixture(), before = f.state(), opts = options(f), response = await http(f, opts);
    expect(response.status).toBe(200); expect(response.headers.get("set-cookie")).toBeNull(); expect(response.headers.get("cache-control")).toBe("private, no-store"); expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    const entries = extract(new Uint8Array(await response.arrayBuffer())), wb = entries.get("xl/workbook.xml")!;
    const names = [...wb.matchAll(/name="([^"]+)"/g)].map(m => m[1]); expect(names.slice(-7)).toEqual(["Resource Report", "Resource Milestones", "Group Milestones", "Resource Plan", "Resource Assignments", "Resource Quality", "Resource Relations"]);
    const assignmentXml = entries.get(`xl/worksheets/sheet${names.indexOf("Resource Assignments") + 1}.xml`)!;
    const parsed = cells(assignmentXml); const report = f.service.getDashboard(f.project.publicId)!;
    expect([...assignmentXml.matchAll(/<row /g)]).toHaveLength(report.summary.assignmentCount + 1);
    for (const id of ["A1", "A2", "A3", "A4", "A5"]) expect(assignmentXml.split(f.assignmentIds.get(id)!).length - 1).toBe(1);
    const values = parsed.filter(cell => /^Y\d+$/.test(cell.ref) && cell.number !== undefined).map(cell => Number(cell.number)); expect(values.reduce((a, b) => a + b, 0)).toBeCloseTo(report.summary.effort.knownMd, 14);
    expect(parsed.some(cell => /^Y\d+$/.test(cell.ref) && cell.raw.endsWith("/>"))).toBe(true); expect(parsed.some(cell => cell.number === "0")).toBe(true);
    expect(assignmentXml).not.toContain('s="7"'); expect([...entries.values()].join("")).not.toContain("<f>");
    const relations = [...entries.entries()].filter(([path, value]) => path.includes("worksheets/_rels") && value.includes("rIdProjectDirect")); expect(relations).toHaveLength(1); expect(relations[0][1]).toContain(`Target="https://gantt.example/projects/${f.project.publicId}"`); const target = /Target="([^"]+)"/.exec(relations[0][1])![1]; expect(new URL(target).search).toBe(""); expect(new URL(target).hash).toBe("");
    const milestoneXml = entries.get(`xl/worksheets/sheet${names.indexOf("Resource Milestones") + 1}.xml`)!; expect(milestoneXml).toContain("scheduledDate"); expect(milestoneXml).toContain("2026-10-05");
    const planXml = entries.get(`xl/worksheets/sheet${names.indexOf("Resource Plan") + 1}.xml`)!; expect(planXml).toContain("periodLabel"); expect(planXml).toContain("partial"); expect(planXml).toContain("2026-W41");
    expect(f.state()).toEqual(before);
  });
  it("keeps legacy bytes unchanged and one transaction/clock with full/current context", () => {
    const f = fixture(), clock = vi.fn(() => new Date(RESOURCE_DASHBOARD_NOW)), service = new ProjectExportSnapshotService(f.database, { clock, mdPerMmEnvironment: "21" });
    const a = service.get(f.project.publicId)!, before = buildProjectExcelWorkbook(a.snapshot, legacy, undefined, a.stageDashboard);
    const opts = options(f, { resourceIds: [f.resources.get("R1")!.publicId], mdPerMm: 19 }); clock.mockClear();
    const b = service.get(f.project.publicId, false, opts, 1)!; expect(clock).toHaveBeenCalledTimes(1); expect(b.resourceDashboard!.report.summary.assignmentCount).toBe(3);
    const whole = service.get(f.project.publicId, false, { basis: "project", expectedReport: { context: opts.expectedReport.context }, granularities: ["month"] }, 1)!;
    expect(whole.resourceDashboard!.report.summary.assignmentCount).toBe(5); expect(whole.resourceDashboard!.report.mdPerMm).toBe(19); expect(whole.resourceDashboard!.report.filters.resourceIds).toEqual([]);
    const c = service.get(f.project.publicId)!; expect(Buffer.from(buildProjectExcelWorkbook(c.snapshot, legacy, undefined, c.stageDashboard))).toEqual(Buffer.from(before));
  });
  it("rejects missing/changed exact binding with 412 and accepts the original exact source", async () => {
    const f = fixture(), source = f.service.getDashboard(f.project.publicId)!.resourceScopeContext!, scope = { kind: "exactAssignments" as const, assignmentIds: [f.assignmentIds.get("A1")!] };
    const scoped = f.service.query(f.project.publicId, { sourceContext: source, scope, filters: {}, projection: { kind: "report" } })!.data as ResourceDashboardDto;
    if (!("summary" in scoped)) throw new Error("expected report");
    const opts: ResourceExcelExportOptions = { basis: "current", expectedReport: { context: scoped.resourceScopeContext!, snapshotId: scoped.snapshotId, filters: {} }, granularities: ["month"] };
    expect((await http(f, opts)).status).toBe(412);
    expect((await http(f, { ...opts, binding: { sourceContext: source, scope } })).status).toBe(200);
    expect((await http(f, { ...opts, binding: { sourceContext: source, scope: { ...scope, assignmentIds: [f.assignmentIds.get("A2")!] } } })).status).toBe(412);
  });
  it("preserves literal formula-like text and XML escape while percentages remain 100-based numeric", async () => {
    const f = fixture(); f.database.prepare("UPDATE tasks SET name='=SUM(1,2)<&' WHERE id=?").run(f.tasks.get("T1")!.id); f.catalog.updateResource(f.resources.get("R1")!.id, { name: "+Alice", code: "@DEV" }, RESOURCE_DASHBOARD_NOW);
    const response = await http(f, options(f)); expect(response.status).toBe(200); const entries = extract(new Uint8Array(await response.arrayBuffer())), text = [...entries.entries()].filter(([path]) => /sheet(?:[5-9]|10|11)\.xml$/.test(path)).map(([, value]) => value).join("");
    expect(text).toContain("=SUM(1,2)&lt;&amp;"); expect(text).toContain("+Alice"); expect(text).toContain("@DEV"); expect(text).not.toContain("&apos;=SUM"); expect(text).not.toContain("<f>");
  });
  it.each([
    { kind: "explicit Assignment dates", clearDates: false, originalFrom: "2026-10-10", originalTo: "2026-10-11" },
    { kind: "Task date fallback", clearDates: true, originalFrom: "2026-10-09", originalTo: "2026-10-12" },
  ])("uses real original dates for selected Milestone-unassigned Quality rows: $kind", async ({ clearDates, originalFrom, originalTo }) => {
    const f = fixture();
    const assignmentId = f.assignmentIds.get("A5")!;
    if (clearDates) f.database.prepare("UPDATE task_assignments SET assignment_start=NULL, assignment_end=NULL WHERE public_id=?").run(assignmentId);
    const response = await http(f, options(f, { from: "2026-10-10", to: "2026-10-10" }));
    expect(response.status).toBe(200);
    const entries = extract(new Uint8Array(await response.arrayBuffer()));
    const workbook = entries.get("xl/workbook.xml")!;
    const names = [...workbook.matchAll(/name="([^"]+)"/g)].map(match => match[1]);
    const quality = entries.get(`xl/worksheets/sheet${names.indexOf("Resource Quality") + 1}.xml`)!;
    const assignments = entries.get(`xl/worksheets/sheet${names.indexOf("Resource Assignments") + 1}.xml`)!;
    const assignedRow = (xml: string) => {
      const hit = [...xml.matchAll(/<row r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)].find(match => match[2].includes(assignmentId));
      expect(hit, "Selected A5 must exist in the exported sheet").toBeDefined();
      return { index: hit![1], content: hit![0] };
    };
    const q = assignedRow(quality), a = assignedRow(assignments);
    // Quality I/J are originalFrom/To, while the Assignment sheet U/V are
    // clipped to the requested report's single day.
    const textCell = (xml: string, ref: string) => cells(xml).find(cell => cell.ref === ref)?.text;
    expect(textCell(q.content, `I${q.index}`)).toBe(originalFrom);
    expect(textCell(q.content, `J${q.index}`)).toBe(originalTo);
    expect(textCell(a.content, `U${a.index}`)).toBe("2026-10-10");
    expect(textCell(a.content, `V${a.index}`)).toBe("2026-10-10");
  });
  it("keeps outside-range raw quality separate from selected A and preserves ISO-year/partial period DTO", () => {
    const f = fixture(); f.database.prepare("UPDATE task_assignments SET assignment_start='2026-10-12', assignment_end='2026-10-16' WHERE public_id=?").run(f.assignmentIds.get("A3"));
    const opts = options(f, { from: "2026-10-07", to: "2026-10-08", resourceIds: [f.resources.get("R1")!.publicId] });
    const bundle = f.service.getExcelReport(f.project.publicId, opts)!;
    expect(bundle.assignments).toHaveLength(1); expect(bundle.quality.unsetAssignments).toHaveLength(2); expect(bundle.quality.unsetAssignments.find(row => row.assignmentId === f.assignmentIds.get("A3"))).toMatchObject({ effectiveFrom: "2026-10-12", effectiveTo: "2026-10-16", overlapsRange: false, allocationPercent: null });
    const year = options(f, { from: "2026-12-29", to: "2027-01-02" }), service = new ProjectExportSnapshotService(f.database, { clock: () => new Date(RESOURCE_DASHBOARD_NOW), mdPerMmEnvironment: "21" }), b = service.get(f.project.publicId, false, year)!;
    b.resourceDashboard!.canonicalProjectUrl = `https://gantt.example/projects/${f.project.publicId}`;
    const archive = extract(buildProjectExcelWorkbook(b.snapshot, { ...legacy, resourceDashboard: year }, undefined, b.stageDashboard, b.resourceDashboard));
    const wb = archive.get("xl/workbook.xml")!, names = [...wb.matchAll(/name="([^"]+)"/g)].map(m => m[1]), xml = archive.get(`xl/worksheets/sheet${names.indexOf("Resource Plan") + 1}.xml`)!;
    expect(b.resourceDashboard!.plans.week!.periods[0]).toMatchObject({ key: "2026-W53", year: 2026, week: 53, partial: true }); expect(xml).toContain("2026-W53"); expect(xml).toContain("<v>53</v>"); expect(xml).toContain("2027-01"); expect(xml).toContain("partial");
  });
  it("refuses changed environment M-D policy even with unchanged raw fingerprint", () => {
    const f = fixture(), opts = options(f), service = new ProjectExportSnapshotService(f.database, { clock: () => new Date(RESOURCE_DASHBOARD_NOW), mdPerMmEnvironment: "22" });
    expect(() => service.get(f.project.publicId, false, opts)).toThrowError(expect.objectContaining({ status: 409, code: "REPORT_STALE" }));
  });
  it("validates strict projection/basis and unique week/month input", () => {
    const f = fixture(), opts = options(f); for (const change of [{ granularities: [] }, { granularities: ["week", "week"] }, { basis: "project" }, { extra: 1 }]) expect(parseProjectExcelExportInput({ ...legacy, resourceDashboard: { ...opts, ...change } }).success).toBe(false);
    expect(parseProjectExcelExportInput({ ...legacy, resourceDashboard: opts }).success).toBe(true);
  });
  it("refuses stale raw ledger/MD policy without revision bump and foreign Origin", async () => {
    const f = fixture(), opts = options(f); f.database.prepare("UPDATE tasks SET name='changed' WHERE id=?").run(f.tasks.get("T1")!.id);
    const stale = await http(f, opts); expect(stale.status).toBe(412); expect(stale.headers.get("content-type")).toContain("json");
    expect((await http(f, options(f), undefined, { Origin: "https://foreign.example" })).status).toBe(403);
    expect((await http(f, options(f), undefined, { "If-Match": '"2"' })).status).toBe(412);
  });
  it("keeps the actual UTF-8 8192-byte boundary and rejects 8193 without a workbook", async () => {
    const f = fixture(), json = JSON.stringify({ ...legacy, resourceDashboard: options(f, { search: "한".repeat(50) }) }), pad = (n: number) => json + " ".repeat(n - Buffer.byteLength(json));
    expect((await http(f, undefined, pad(8192))).status).toBe(200); const over = await http(f, undefined, pad(8193)); expect(over.status).toBe(413); expect(over.headers.get("content-type")).toContain("json");
  });
  it("fails closed on missing Plan DTO, mismatched selected A or non-finite raw numbers", () => {
    const f = fixture(), opts = options(f), service = new ProjectExportSnapshotService(f.database, { clock: () => new Date(RESOURCE_DASHBOARD_NOW), mdPerMmEnvironment: "21" }), b = service.get(f.project.publicId, false, opts)!;
    b.resourceDashboard!.canonicalProjectUrl = `https://gantt.example/projects/${f.project.publicId}`;
    for (const mutate of [(x: typeof b.resourceDashboard) => { delete x!.plans.week; }, (x: typeof b.resourceDashboard) => { x!.assignments.pop(); }, (x: typeof b.resourceDashboard) => { x!.report.summary.effort.knownMd = Infinity; }]) { const copy = structuredClone(b.resourceDashboard); mutate(copy); expect(() => buildProjectExcelWorkbook(b.snapshot, { ...legacy, resourceDashboard: opts }, undefined, b.stageDashboard, copy)).toThrow(); }
  });
});
