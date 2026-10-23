import { assertCapturedInstall } from "../../fixtures/gantt-state-consistency/capture-install";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import capture from "../../fixtures/gantt-axis-transaction/actual-core-2.7.3.json";

type Position = { left: number; top: number };
interface Sample {
  core: Position & { originMs: number; endMs: number; scaleWidth: number; chartWidth: number; selected: string[] };
  physical: (Position & { chartWidth: number; scrollWidth: number }) | null;
  apiInstance: number;
  writes?: number;
}
interface Result { outcome: string; reason: string; viewport: string; requestedPosition?: Position; position?: Position }
interface Trial { repeat: number; result: Result | string; supported?: boolean; before: Sample; after: Sample }
interface Case {
  mode: string; width: number; scale: string; range?: string; variant?: string; interruption?: string; stage?: string; action?: string;
  trials?: Trial[]; result?: Result; before?: Sample; after?: Sample; lateWrites?: number; heldWrites?: number;
  canonicalUnchanged?: boolean; filter?: { canonicalCount: number; visibleCount: number } | null;
  actionObservation?: { canonicalCount: number; visibleCount: number } | null;
  allowClamp?: boolean; requested?: Position; physicalCapacity?: number;
  retryResult?: Result; syntheticWrites?: number; restoringWrites?: number; afterNaturalResize?: Sample;
}
const evidence = capture as unknown as { installed: {wrapper: string; store: string}; sha256: Record<string,string>; cases: Case[]; notTested: string[]; originalFailures: unknown[] };

describe("actual installed Core axis transaction capture", () => {
  it("binds the observation to unchanged source bytes and the actual wrapper/store versions", () => {
    expect(evidence.installed).toEqual({wrapper: "2.7.3",store: "2.7.2"});
    // This captured browser run predates the #690 source-taint review fix.
    // Verify its exact historical code, not a rewritten source fingerprint.
    assertCapturedInstall(process.cwd());
    const historicalSources: Record<string,string> = {
      ...capture.captureSourceMappings,
      "src/features/gantt/viewport/axis-transaction.ts": "tests/fixtures/gantt-axis-transaction/axis-transaction-original.snapshot.txt",
      "tests/fixtures/gantt-axis-transaction/browser.tsx": "tests/fixtures/gantt-axis-transaction/browser-original.snapshot.txt",
    };
    for (const [path, expected] of Object.entries(evidence.sha256)) {
      expect(createHash("sha256").update(readFileSync(resolve(historicalSources[path] ?? path))).digest("hex"), path).toBe(expected);
    }
    for (const path of ["src/features/gantt/viewport/axis-transaction.ts", "tests/fixtures/gantt-axis-transaction/browser.tsx"]) {
      expect(createHash("sha256").update(readFileSync(resolve(path))).digest("hex"), path).not.toBe(evidence.sha256[path]);
    }
    expect(evidence.originalFailures.length).toBeGreaterThanOrEqual(3);
    expect(evidence.notTested.join(" ")).toContain("Production wiring");
  });

  it("keeps all five widths and both scales, stopping a failing repeated trial", () => {
    const matrix = evidence.cases.filter(entry => entry.trials);
    expect(matrix).toHaveLength(40);
    for (const mode of ["A", "B", "C", "U1"]) for (const width of [390,768,1024,1440,1920]) for (const scale of ["day","week"]) {
      const entry = matrix.find(row => row.mode === mode && row.width === width && row.scale === scale)!;
      expect(entry).toBeDefined();
      const trials = entry.trials!;
      const failure = trials.findIndex(trial => mode === "U1" ? typeof trial.result === "object" && trial.result.outcome !== "SETTLED" : trial.supported === false);
      if (failure !== -1) expect(trials).toHaveLength(failure + 1);
      else expect(trials).toHaveLength(3);
    }
  });

  it("confirms Core and physical viewport separately for every successful right-edge extension", () => {
    const rows = evidence.cases.filter(row => row.mode === "U1" && row.trials && row.width > 390);
    expect(rows).toHaveLength(8);
    for (const row of rows) for (const trial of row.trials!) {
      expect(trial.result).toMatchObject({outcome:"SETTLED",viewport:"PRESERVED"});
      expect(trial.after.apiInstance).toBe(trial.before.apiInstance);
      expect(trial.after.core.left).toBe(trial.before.core.left);
      expect(trial.after.core.top).toBe(trial.before.core.top);
      expect(trial.after.core.selected).toEqual(trial.before.core.selected);
      expect(Math.abs(trial.after.physical!.left - trial.after.core.left)).toBeLessThanOrEqual(1);
      expect(Math.abs(trial.after.physical!.top - trial.after.core.top)).toBeLessThanOrEqual(1);
      expect(trial.after.core.scaleWidth).toBeGreaterThan(trial.before.core.scaleWidth);
      expect(trial.after.physical!.scrollWidth).toBeGreaterThan(trial.before.physical!.scrollWidth);
    }
  });

  it("records narrow-chart unavailability and the original compatibility failure", () => {
    for (const row of evidence.cases.filter(row => row.mode === "U1" && row.width === 390 && row.trials)) {
      expect(row.trials![0].result).toMatchObject({outcome:"NOT_MEASURABLE",viewport:"UNAVAILABLE"});
    }
    const c = evidence.cases.find(row => row.mode === "C" && row.width === 1440 && row.scale === "day" && row.trials)!;
    expect(c.trials![0].supported).toBe(false);
    expect(c.trials![0].result).toBe("TIMED_OUT");
    expect(c.trials![0].after.core.left).not.toBe(c.trials![0].before.core.left);
  });

  it("distinguishes globally empty and filtered-zero rows without changing canonical tasks/tree/links", () => {
    const rows = evidence.cases.filter(row => row.range === "short" && row.variant);
    expect(rows).toHaveLength(16);
    for (const row of rows) expect(row.canonicalUnchanged).toBe(true);
    for (const row of rows.filter(row => row.variant === "no-match")) {
      expect(row.filter).toEqual({canonicalCount:60,visibleCount:0});
    }
    for (const row of rows.filter(row => row.width === 1440)) expect(row.result).toMatchObject({outcome:"SETTLED",viewport:"APPLIED",position:{left:0,top:0}});
  });

  it("lets actual input and public Core commands supersede an already committed extent without replay", () => {
    const rows = evidence.cases.filter(row => row.stage === "AFTER_EXTENT_COMMIT");
    expect(rows.map(row => row.action)).toEqual(["wheel","task-reveal","milestone-reveal","filter-no-match","columns","physical-resize"]);
    for (const row of rows) {
      expect(row.heldWrites).toBe(1);
      expect(row.result).toMatchObject({outcome:"SUPERSEDED",viewport:"UNAVAILABLE"});
      expect(row.after!.writes).toBe(1);
      expect(row.lateWrites).toBe(0);
    }
    const wheel = rows.find(row => row.action === "wheel")!;
    expect(wheel.after!.physical!.left).not.toBe(wheel.before!.physical!.left);
    expect(rows.find(row => row.action === "filter-no-match")!.actionObservation).toEqual({canonicalCount:60,visibleCount:0});
  });

  it("keeps the actual native/Core endpoint disagreement unavailable instead of claiming a successful clamp", () => {
    const trials = evidence.cases.filter(row => row.stage === "CAPACITY_POLICY");
    expect(trials).toHaveLength(2);
    const denied = trials.find(row => row.allowClamp === false)!;
    expect(denied.requested!.left).toBe(denied.physicalCapacity! + 100);
    expect(denied.result).toMatchObject({outcome:"NO_SCROLL_CAPACITY",viewport:"UNAVAILABLE",requestedPosition:denied.requested});
    expect(denied.after!.writes).toBe(denied.before!.writes);
    const allowed = trials.find(row => row.allowClamp === true)!;
    expect(allowed.result).toMatchObject({outcome:"TIMED_OUT",viewport:"UNAVAILABLE"});
    expect(allowed.before!.core.chartWidth).toBe(allowed.before!.physical!.chartWidth + 1);
    expect(allowed.after!.core.left).toBe(allowed.before!.core.scaleWidth - allowed.before!.core.chartWidth);
    expect(allowed.after!.core.left).toBe(allowed.physicalCapacity! - 1);
    expect(allowed.after!.physical!.left).toBe(allowed.after!.core.left);
    expect(allowed.after!.writes).toBe(1);
    expect(allowed.lateWrites).toBe(0);
  });

  it("does not replay a completed transaction after a later actual wheel gesture", () => {
    const trial = evidence.cases.find(row => row.stage === "WHEEL_AFTER_SETTLED")!;
    expect(trial.result).toMatchObject({outcome:"SETTLED",viewport:"PRESERVED"});
    expect(trial.after!.physical!.left).not.toBe(trial.before!.physical!.left);
    expect(trial.after!.writes).toBe(trial.before!.writes);
  });

  it("rejects a cancelled actual synthetic resize on the same API without a restoring write", () => {
    const trial = evidence.cases.find(row => row.stage === "CANCEL_AFTER_SYNTHETIC_WRITE")!;
    expect(trial.result).toMatchObject({outcome:"SUPERSEDED",viewport:"UNAVAILABLE"});
    expect(trial.syntheticWrites).toBe(1);
    expect(trial.restoringWrites).toBe(0);
    expect(trial.retryResult).toMatchObject({outcome:"UNSUPPORTED",reason:"COMPATIBILITY_TAINTED"});
    expect(trial.afterNaturalResize!.physical!.chartWidth).toBeLessThan(trial.before!.physical!.chartWidth);
  });
});
