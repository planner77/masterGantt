import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const root = resolve(__dirname, "../..");
const script = "scripts/compare-issue-118-layout.mjs";
const temporary: string[] = [];
afterEach(() => { for (const path of temporary.splice(0)) rmSync(path, { recursive: true, force: true }); });

function fixture() {
  const before = {
    schema: "mastergantt-ui-evidence/v2", issue: 889, state: "wbs-day-1440",
    sourceSha: "a".repeat(40), baselineSha: "0".repeat(40),
    fixture: { kind: "synthetic", name: "schedule-views", scope: "DATA_CAPTURED", sha256: "f".repeat(64) },
    environment: { browser: "chromium", browserVersion: "145.0", playwrightVersion: "1.63.0",
      os: "linux", osRelease: "6.8", locale: "ko", documentLocale: "ko", font: "system-ui",
      theme: "light", deviceScaleFactor: 1, cssZoom: "1", timezone: "UTC",
      observedTime: "2026-01-01T00:00:00.000Z", viewport: { width: 1440, height: 900 } },
    geometry: [
      { name: "grid-header", x: 10, y: 100, width: 480, height: 60 },
      { name: "chart-header", x: 490, y: 100, width: 900, height: 60 },
      { name: "task-row", x: 10, y: 160, width: 1380, height: 34 },
    ],
  };
  const after = structuredClone(before);
  after.sourceSha = "b".repeat(40);
  after.baselineSha = before.sourceSha;
  const contract = { baselineSha: before.sourceSha, sourceSha: after.sourceSha, measurements: [
    { name: "grid-header", field: "y", tolerance: 1, designRef: "docs/UI_UX_GUIDELINES.md#issue-889--890" },
    { name: "chart-header", field: "height", tolerance: 1, designRef: "docs/UI_UX_GUIDELINES.md#issue-889--890" },
    { name: "task-row", field: "height", tolerance: 0, designRef: "DESIGN.md#issue-889--890" },
  ] };
  return { before, after, contract };
}

function compare(input = fixture()) {
  const dir = mkdtempSync(join(tmpdir(), "mastergantt-layout-896-"));
  temporary.push(dir);
  const paths = ["before", "after", "contract"].map((key) => {
    const path = join(dir, key + ".json");
    writeFileSync(path, JSON.stringify(input[key as keyof typeof input]));
    return path;
  });
  const processResult = spawnSync(process.execPath, [script, "--ui-evidence", ...paths, dir], { cwd: root, encoding: "utf8" });
  return { exit: processResult.status, result: JSON.parse(readFileSync(join(dir, "comparison.json"), "utf8")),
    summary: readFileSync(join(dir, "summary.md"), "utf8") };
}

describe("Issue #896 reuses #118 layout measurement comparison", () => {
  it("accepts explicit geometry bounds as advisory only, with separate integrity verification", () => {
    const input = fixture();
    input.after.geometry[0].y += 1;
    const actual = compare(input);
    expect(actual.exit).toBe(0);
    expect(actual.result.status).toBe("GEOMETRY_MATCH_NOT_UAT");
    expect(actual.result.measurements).toHaveLength(3);
    expect(actual.summary).toContain("scripts/ui_evidence.py");
    expect(actual.summary).toContain("사용자 수용 아님");
  });

  it.each([
    ["CSS header displacement", 0, "y", 2],
    ["mixed header height", 1, "height", 4],
    ["density regression", 2, "height", -2],
    ["rounding must not hide drift", 0, "y", 1.001],
  ] as const)("fails %s without relaxing tolerance", (_label, index, field, change) => {
    const input = fixture();
    input.after.geometry[index][field] += change;
    const actual = compare(input);
    expect(actual.exit).toBe(1);
    expect(actual.result.status).toBe("FAIL");
    expect(actual.result.measurements.some((value: { outcome: string }) => value.outcome === "FAIL")).toBe(true);
  });

  it.each(["os", "osRelease", "browserVersion", "playwrightVersion", "font", "locale", "theme", "cssZoom", "observedTime"] as const)(
    "blocks incomparable %s environment drift", (field) => {
      const input = fixture();
      input.after.environment[field] = "different";
      expect(compare(input).result.status).toBe("BLOCKED");
    });

  it("blocks missing environment and ignores harmless JSON key order", () => {
    const input = fixture();
    input.after.environment = Object.fromEntries(Object.entries(input.after.environment).reverse()) as typeof input.after.environment;
    expect(compare(input).result.status).toBe("GEOMETRY_MATCH_NOT_UAT");
    input.after.environment.font = "";
    expect(compare(input).result.status).toBe("BLOCKED");
  });

  it("blocks changed baseline instead of adopting a new golden", () => {
    const input = fixture();
    input.after.baselineSha = "c".repeat(40);
    expect(compare(input).result.status).toBe("BLOCKED");
    input.after.baselineSha = input.before.sourceSha;
    input.contract.sourceSha = "d".repeat(40);
    expect(compare(input).result.status).toBe("BLOCKED");
  });

  it("blocks fixture or dynamic content substitution", () => {
    const input = fixture();
    input.after.fixture.sha256 = "e".repeat(64);
    expect(compare(input).result.status).toBe("BLOCKED");
    input.after.fixture.sha256 = input.before.fixture.sha256;
    input.after.fixture.scope = "DECLARATION_ONLY";
    expect(compare(input).result.status).toBe("BLOCKED");
  });

  it("blocks missing geometry and uncertain measurements", () => {
    const input = fixture();
    input.after.geometry.pop();
    expect(compare(input).result.status).toBe("BLOCKED");
  });

  it("requires a DESIGN reference and explicit nonnegative tolerance", () => {
    const input = fixture();
    input.contract.measurements[0].tolerance = -1;
    expect(compare(input).result.status).toBe("BLOCKED");
    input.contract.measurements[0].tolerance = 1;
    input.contract.measurements[0].designRef = "";
    expect(compare(input).result.status).toBe("BLOCKED");
  });

  it("does not promote historical v1 to comparable v2 evidence", () => {
    const input = fixture();
    input.before.schema = "mastergantt-ui-evidence/v1";
    expect(compare(input).result.status).toBe("BLOCKED");
  });

  it("preserves the original #118 positional CLI and before/after policy", () => {
    const dir = mkdtempSync(join(tmpdir(), "mastergantt-layout-118-"));
    temporary.push(dir);
    const original = { viewport: { width: 390, height: 844 }, state: "readonly",
      ganttVisibleHeight: 300, gantt: { y: 100 }, documentOverflowX: false,
      infoLineCount: 1, screenshot: "before.png" };
    const updated = { ...original, ganttVisibleHeight: 320, screenshot: "after.png" };
    const before = join(dir, "before.json");
    const after = join(dir, "after.json");
    writeFileSync(before, JSON.stringify([original]));
    writeFileSync(after, JSON.stringify([updated]));
    const outcome = spawnSync(process.execPath, [script, before, after, dir], { cwd: root, encoding: "utf8" });
    expect(outcome.status).toBe(0);
    const summary = readFileSync(join(dir, "summary.md"), "utf8");
    expect(summary).toContain("703a6f08595dea06a918366192df464d7215108e");
    expect(summary).toContain("6386db860af69635cfb0fe626fd1a937905b9a56");
    expect(summary).toContain("## 판정: PASS");
    expect(JSON.parse(readFileSync(join(dir, "comparison.json"), "utf8"))[0].delta).toBe(20);
    writeFileSync(after, JSON.stringify([original]));
    expect(spawnSync(process.execPath, [script, before, after, dir], { cwd: root }).status).toBe(1);
  });
});
