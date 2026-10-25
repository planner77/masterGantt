import { afterEach, describe, expect, it } from "vitest";
import { ProjectCopyService } from "../../../src/server/projects/project-copy-service-core";
import { ProjectTemplateService } from "../../../src/server/templates/project-template-service-core";
import { ProjectExportSnapshotService } from "../../../src/server/exports/project-export-snapshot-service-core";
import { handleProjectExcelExport } from "../../../src/server/exports/project-excel-export-handler-core";
import { buildProjectExcelWorkbook } from "../../../src/server/exports/project-excel-export-core";
import { snapshotTaskTargetBindings } from "../../../src/server/logistics/task-target-transfer-core";
import { ProjectJsonExportService } from "../../../src/server/exports/project-json-export-core";
import { issue623BackendFixture, ISSUE_623_NOW, issue623WorkbookEntries, issue623Table } from "../../fixtures/issue-623-backend-fixture";
import { issue623TargetResourceFixture } from "../../fixtures/issue-623-target-resource";
import type { ResourceExcelExportOptions } from "../../../src/contracts/resource-excel-export";
const fixtures: ReturnType<typeof issue623BackendFixture>[] = [];
function fixture(input?: Parameters<typeof issue623BackendFixture>[0]) { const f = issue623BackendFixture(input); fixtures.push(f); return f; }
afterEach(() => fixtures.splice(0).forEach(f => f.db.close()));
const password = async () => ({ algorithm: "scrypt" as const, salt: Buffer.alloc(16, 1), hash: Buffer.alloc(32, 2), n: 32768, r: 8, p: 3, keyLength: 32 });
const revision = (f: ReturnType<typeof fixture>) => Number(f.db.prepare("SELECT revision FROM projects WHERE id=?").pluck().get(f.project.id));
describe("#785 physical workbook and lossless archived transfer", () => {
  it("exports physical names and canonical evidence while retaining every shared provenance path and raw Assignment totals", () => {
    const input = issue623TargetResourceFixture();
    input.logistics.bindings.find(row => row.id === "ZERO-A")!.coverageByMember = [{ memberId: "MEM-A-AMR", coverage: 1 }];
    const f = fixture(input);
    f.db.prepare("UPDATE logistics_targets SET name='ARCHIVE_LABEL_MUST_STAY_PRIVATE' WHERE project_id=?").run(f.project.id);
    const filters = { ...f.filters, taskIds: [f.id("SHARED"), f.id("ZERO")], targetIds: [f.id("TARGET-A")] }, report = f.service.getDashboard(f.project.publicId, filters)!;
    const options: ResourceExcelExportOptions = { basis: "current", expectedReport: { context: report.resourceScopeContext!, snapshotId: report.snapshotId, filters }, granularities: ["week", "month"] };
    const bundle = new ProjectExportSnapshotService(f.db, { clock: () => ISSUE_623_NOW }).get(f.project.publicId, false, options)!;
    bundle.resourceDashboard!.canonicalProjectUrl = `https://gantt.example/projects/${f.project.publicId}`;
    const result = issue623WorkbookEntries(buildProjectExcelWorkbook(bundle.snapshot, { includeDependencies: false, scope: "project", scale: "day", hierarchyDisplay: "expanded", layout: { columns: [{ id: "text", widthPx: 224 }] }, resourceDashboard: options }, undefined, bundle.stageDashboard, bundle.resourceDashboard));
    expect(result.names).toContain("Resource Logistics");
    expect(result.names).toContain("Resource Entity Catalog");
    expect(result.names).toContain("Resource Entity Sources");
    expect(result.names.some(name => /Target/.test(name))).toBe(false);
    const worksheets = [...result.entries].filter(([name]) => /^xl\/worksheets\/sheet\d+\.xml$/.test(name)).map(([, text]) => text).join("");
    expect(worksheets).not.toContain("ARCHIVE_LABEL_MUST_STAY_PRIVATE");
    expect(worksheets).not.toMatch(/targetIds|targetScopes|targetProjection|targetContext|Target 미연결/);
    const sourceRows = issue623Table(result.sheet("Resource Entity Sources"));
    const mcsRows = sourceRows.filter(row => row.relation === "MemberProvenance" && row.taskId === f.id("SHARED") && row.entityId === f.id("MCS-1"));
    const original = bundle.resourceDashboard!.targetData!.taskSources.find(row => row.taskId === f.id("SHARED"))!.effectiveMembers.find(row => row.entityId === f.id("MCS-1"))!;
    expect(mcsRows).toHaveLength(original.provenance.length);
    expect(new Set(mcsRows.map(row => row.bindingId))).toEqual(new Set(original.provenance.map(row => row.bindingId)));
    expect(mcsRows.every(row => row.coverage === null && row.coverageMode === "whole")).toBe(true);
    const assignmentRows = issue623Table(result.sheet("Resource Assignments"));
    expect(sourceRows.some(row => row.relation === "MemberProvenance" && row.taskId === f.id("ZERO") && row.coverage === 1 && row.coverageMode === "partial")).toBe(true);
    expect(assignmentRows).toHaveLength(2);
    expect(assignmentRows.find(row => row.assignmentId === f.id("SHARED-R1"))).toMatchObject({ assignmentId: f.id("SHARED-R1"), plannedMd: 5 });
    expect(f.db.pragma("foreign_key_check")).toEqual([]);
  });
  it("retires implicit archived export selectors and accepts physical instance/type selection with exact raw totals", async () => {
    const f = fixture(), service = new ProjectExportSnapshotService(f.db, { clock: () => ISSUE_623_NOW });
    const options = (filters: NonNullable<Parameters<typeof f.service.getDashboard>[1]>): ResourceExcelExportOptions => {
      const report = f.service.getDashboard(f.project.publicId, filters)!;
      return { basis: "current", expectedReport: { context: report.resourceScopeContext!, snapshotId: report.snapshotId, filters }, granularities: ["week"] };
    };
    const send = (resourceDashboard: ResourceExcelExportOptions, version?: string) => handleProjectExcelExport(new Request(`https://gantt.example/api/projects/${f.project.publicId}/exports/excel`, {
      method: "POST", headers: { Origin: "https://gantt.example", "Content-Type": "application/json", "If-Match": `"${revision(f)}"`, ...(version ? { "X-MasterGantt-Resource-Version": version } : {}) },
      body: JSON.stringify({ includeDependencies: false, scope: "project", scale: "day", hierarchyDisplay: "expanded", layout: { columns: [{ id: "text", widthPx: 224 }] }, resourceDashboard }),
    }), f.project.publicId, { service: f.projectService, applicationBaseUrl: "https://gantt.example", environment: "production", getExportBundle: (...args) => service.get(...args) });
    const archived = options({ ...f.filters, targetIds: [f.id("TARGET-A")] });
    expect((await send(archived)).status).toBe(410);
    const audit = await send(archived, "1"); expect(audit.status).toBe(200); expect(audit.headers.get("Deprecation")).toBe("true");
    const physical = options({ ...f.filters, systemIds: [f.id("MCS-1")], physicalSystemTypeCodes: ["mcs"] });
    const wire = { ...physical, expectedReport: { ...physical.expectedReport, filters: { ...f.filters, systemIds: [f.id("MCS-1")], systemTypeCodes: ["mcs"] } } } as ResourceExcelExportOptions;
    const response = await send(wire); expect(response.status).toBe(200);
    const result = issue623WorkbookEntries(new Uint8Array(await response.arrayBuffer()));
    const rows = issue623Table(result.sheet("Resource Assignments"));
    expect(rows.reduce((sum, row) => sum + Number(row.plannedMd ?? 0), 0)).toBe(f.service.getDashboard(f.project.publicId, { ...f.filters, systemIds: [f.id("MCS-1")], physicalSystemTypeCodes: ["mcs"] })!.summary.effort.knownMd);
    expect((await send(physical, "9")).status).toBe(400);
  });
  it("keeps JSON1.1 loss guard and omits archived entity counts from public Template DTOs", () => {
    const f = fixture(), templates = new ProjectTemplateService(f.db, { clock: () => ISSUE_623_NOW, hashPassword: password });
    const saved = templates.createTemplateFromProject(f.auth, revision(f), { name: "Physical relations" });
    expect(saved).not.toHaveProperty("targetCount");
    const raw = JSON.parse(f.db.prepare("SELECT content_json FROM project_templates WHERE public_id=?").pluck().get(saved.id) as string);
    expect(raw.logistics.targets).toHaveLength(2);
    expect(raw.logistics.taskTargetBindings).toHaveLength(10);
    try { new ProjectJsonExportService(f.db, { clock: () => ISSUE_623_NOW }).get(f.project.publicId, revision(f)); throw Error("expected format rejection"); }
    catch (error) { expect(error).toMatchObject({ code: "TASK_TARGET_EXPORT_UNSUPPORTED" }); expect((error as Error).message).not.toContain("Target"); }
  });
  it("rejects dangling source bindings before a snapshot and rolls back Copy and Template without source loss", async () => {
    const f = fixture();
    f.db.pragma("foreign_keys=OFF");
    f.db.prepare("DELETE FROM tasks WHERE project_id=? AND external_id='SHARED'").run(f.project.id);
    f.db.pragma("foreign_keys=ON");
    const before = f.db.prepare("SELECT * FROM task_target_bindings WHERE project_id=? ORDER BY id").all(f.project.id);
    const projectsBefore = f.db.prepare("SELECT COUNT(*) FROM projects").pluck().get();
    const templatesBefore = f.db.prepare("SELECT COUNT(*) FROM project_templates").pluck().get();
    expect(() => snapshotTaskTargetBindings(f.db, f.project.id)).toThrow(expect.objectContaining({ code: "TASK_TARGET_TRANSFER_INVALID" }));
    await expect(new ProjectCopyService(f.db, { clock: () => ISSUE_623_NOW, hashPassword: password }).copy(f.auth, revision(f), { name: "Rejected", description: "", editPassword: "password123" })).rejects.toThrow();
    expect(() => new ProjectTemplateService(f.db, { clock: () => ISSUE_623_NOW }).createTemplateFromProject(f.auth, revision(f), { name: "Rejected" })).toThrow();
    expect(f.db.prepare("SELECT COUNT(*) FROM projects").pluck().get()).toBe(projectsBefore);
    expect(f.db.prepare("SELECT COUNT(*) FROM project_templates").pluck().get()).toBe(templatesBefore);
    expect(f.db.prepare("SELECT * FROM task_target_bindings WHERE project_id=? ORDER BY id").all(f.project.id)).toEqual(before);
  });
});
