import { describe, expect, it } from "vitest";
import { validateImportPayload, validateProjectImportPayload } from "../../src/contracts/import";
import { createWorkingCalendar } from "../../src/domain/scheduling";
const calendar = createWorkingCalendar({ timezone: "Asia/Seoul", weekendDays: [6, 0], holidays: [] });
const task = (externalId = "T", extra = {}) => ({ externalId, name: externalId, type: "task", parentExternalId: null, requestedStart: "2026-10-05", duration: 2, progress: 0, status: "not_started", predecessors: [], ...extra });
const payload = (tasks: object[] = [task()], extra = {}) => ({ schemaVersion: "1.1", project: { name: "P", description: "" }, tasks, ...extra });
describe("JSON 1.1 authored stage contract", () => {
  it("retains the exact 1.0 pure result through version dispatch", () => { const legacy = { schemaVersion: "1.0", project: { name: "P", description: "" }, tasks: [{ externalId: "T", name: "T", type: "task", parentExternalId: null, start: "2026-10-05", duration: 2, progress: 0, predecessors: [] }] }; const a = validateImportPayload(legacy, calendar), b = validateProjectImportPayload(legacy, calendar); expect(b).toEqual(a.success ? { ...a, memberships: [] } : a); });
  it("accepts empty 1.1 export and keeps 1.0 minItems 1", () => { expect(validateProjectImportPayload(payload([]), calendar).success).toBe(true); expect(validateImportPayload({ ...payload([]), schemaVersion: "1.0" }, calendar).success).toBe(false); });
  it("resolves forward membership and Summary inheritance with explicit child override", () => {
    const tasks = [task("C", { parentExternalId: "S" }), { externalId: "S", name: "S", type: "summary", parentExternalId: null, predecessors: [] }, task("M", { type: "milestone", duration: 0 })];
    const result = validateProjectImportPayload(payload(tasks, { memberships: [{ taskExternalId: "S", milestoneExternalId: "M" }, { taskExternalId: "C", milestoneExternalId: null }] }), calendar); expect(result.success).toBe(true);
  });
  it.each(["ready", "effectiveMilestoneTaskId", "resources", "plannedMd"])("rejects derived/foreign root field %s", (key) => { expect(validateProjectImportPayload(payload(undefined, { [key]: true }), calendar).success).toBe(false); });
  it("rejects authored Summary schedule and status", () => { for (const key of ["duration", "progress", "status", "baseline"]) expect(validateProjectImportPayload(payload([{ externalId: "S", name: "S", type: "summary", parentExternalId: null, predecessors: [], [key]: null }]), calendar).success).toBe(false); });
  it.each([{ status: "completed", progress: 99 }, { status: "not_started", progress: 1 }, { status: "in_progress", progress: 100 }])("rejects inconsistent explicit status %j", (extra) => { expect(validateProjectImportPayload(payload([task("T", extra)]), calendar).success).toBe(false); });
  it("supports in_progress zero without rewriting it", () => { const result = validateProjectImportPayload(payload([task("T", { status: "in_progress" })]), calendar); expect(result.success && result.tasks[0].status).toBe("in_progress"); });
  it("recomputes leaf baseline against target calendar", () => { const result = validateProjectImportPayload(payload([task("T", { baseline: { start: "2026-10-09", duration: 2 } })]), calendar); expect(result.success && result.tasks[0].baselineEnd).toBe("2026-10-12"); });
  it("rejects nonzero M baseline duration", () => { expect(validateProjectImportPayload(payload([task("M", { type: "milestone", duration: 0, baseline: { start: "2026-10-09", duration: 1 } })]), calendar).success).toBe(false); });
  it.each([{ memberships: [{ taskExternalId: "T", milestoneExternalId: "missing" }] }, { memberships: [{ taskExternalId: "T", milestoneExternalId: "T" }] }, { memberships: [{ taskExternalId: "T", milestoneExternalId: null }, { taskExternalId: "T", milestoneExternalId: null }] }])("rejects invalid or duplicate membership %j", ({ memberships }) => { expect(validateProjectImportPayload(payload(undefined, { memberships }), calendar).success).toBe(false); });
});

describe("published JSON 1.1 examples", () => {
  it.each(["project-import-1.1.json", "project-import-1.1-empty.json"])("validates the documented producer file %s", async (filename) => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const result = validateProjectImportPayload(JSON.parse(readFileSync(join(process.cwd(), "docs/examples", filename), "utf8")), calendar);
    expect(result.success).toBe(true);
  });
});
