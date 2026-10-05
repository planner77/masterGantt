import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const root = resolve(__dirname, "../..");
const tempDirs: string[] = [];
afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function metric(runId: number, durationMs: number, options: {
  workflow?: string;
  eventName?: string;
  job?: string;
  name?: string;
  cache?: string;
} = {}) {
  return {
    schemaVersion: 2,
    issue: 439,
    runId: String(runId),
    runAttempt: 1,
    workflow: options.workflow ?? ".github/workflows/ci.yml",
    job: options.job ?? "build",
    eventName: options.eventName ?? "pull_request",
    headSha: String(runId).padStart(40, "0"),
    metric: options.name ?? "npm-ci",
    durationMs,
    cache: options.cache ?? "exact-hit=true",
    recordedAt: "2026-10-05T00:00:00.000Z",
  };
}

describe("Issue #444 CI setup/cache Phase 2/3", () => {
  it("reports lane readiness, cache hit rate and ranked runner-minute candidates", () => {
    const dir = mkdtempSync(join(tmpdir(), "mastergantt-ci-phase2-"));
    tempDirs.push(dir);
    const history = join(dir, "history");
    mkdirSync(history, { recursive: true });

    const records = [
      ...Array.from({ length: 10 }, (_, index) =>
        metric(100 + index, 2_000 + index * 100, { cache: index < 8 ? "exact-hit=true" : "exact-hit=false" }),
      ),
      ...Array.from({ length: 10 }, (_, index) =>
        metric(200 + index, 5_000 + index * 100, { job: "docker", name: "docker-build-cache", cache: "gha-summary" }),
      ),
      ...Array.from({ length: 10 }, (_, index) =>
        metric(300 + index, 3_000 + index * 100, { eventName: "push", job: "build" }),
      ),
      ...Array.from({ length: 10 }, (_, index) =>
        metric(400 + index, 4_000 + index * 100, {
          workflow: ".github/workflows/release-image.yml",
          eventName: "push",
          job: "static",
        }),
      ),
    ];
    writeFileSync(join(history, "metrics.jsonl"), records.map((value) => JSON.stringify(value)).join("\n") + "\n");

    const output = join(dir, "analysis.json");
    execFileSync(process.execPath, [
      "scripts/analyze-ci-setup-metrics.mjs",
      "--input", history,
      "--min-samples", "10",
      "--output", output,
    ], { cwd: root, stdio: "pipe" });

    const result = JSON.parse(readFileSync(output, "utf8"));
    expect(result).toMatchObject({
      phase2Issue: 444,
      phase2Ready: true,
      readiness: {
        PR: { ready: true },
        Main: { ready: true },
        Release: { ready: true },
      },
    });
    const npm = result.metrics.find((item: { lane: string; job: string; metric: string }) =>
      item.lane === "PR" && item.job === "build" && item.metric === "npm-ci");
    expect(npm.cacheHitRate).toBe(0.8);
    expect(npm.runnerMinutesPerSuccessfulRun).toBeGreaterThan(0);
    expect(result.candidates[0]).toMatchObject({ lane: "PR", job: "docker", metric: "docker-build-cache" });
  });

  it("keeps Phase 2 collecting until every PR/Main/Release group has enough distinct successful runs", () => {
    const dir = mkdtempSync(join(tmpdir(), "mastergantt-ci-phase2-gate-"));
    tempDirs.push(dir);
    const history = join(dir, "history");
    mkdirSync(history, { recursive: true });

    const records = [
      ...Array.from({ length: 10 }, (_, index) => metric(500 + index, 1_000)),
      ...Array.from({ length: 9 }, (_, index) => metric(600 + index, 1_000, { eventName: "push" })),
      ...Array.from({ length: 10 }, (_, index) => metric(700 + index, 1_000, {
        workflow: ".github/workflows/release-image.yml", eventName: "push", job: "static",
      })),
    ];
    writeFileSync(join(history, "metrics.jsonl"), records.map((value) => JSON.stringify(value)).join("\n") + "\n");

    const output = join(dir, "analysis.json");
    execFileSync(process.execPath, [
      "scripts/analyze-ci-setup-metrics.mjs",
      "--input", history,
      "--min-samples", "10",
      "--output", output,
    ], { cwd: root, stdio: "pipe" });
    const result = JSON.parse(readFileSync(output, "utf8"));
    expect(result.phase2Ready).toBe(false);
    expect(result.readiness.Main).toMatchObject({ ready: false, notReadyGroups: 1 });
  });

  it("adopts only comparable improvements that meet wall-clock and runner-minute policy", () => {
    const dir = mkdtempSync(join(tmpdir(), "mastergantt-ci-phase2-compare-"));
    tempDirs.push(dir);
    const baseline = join(dir, "baseline.json");
    const current = join(dir, "current.json");
    const output = join(dir, "comparison.json");

    const baseMetric = {
      lane: "PR",
      workflow: ".github/workflows/ci.yml",
      eventName: "pull_request",
      job: "build",
      metric: "npm-ci",
      successfulRuns: 10,
      enoughSamples: true,
      medianMs: 10_000,
      p90Ms: 12_000,
      runnerMinutesPerSuccessfulRun: 0.25,
      cacheHitRate: 0.4,
    };
    writeFileSync(baseline, JSON.stringify({ metrics: [baseMetric] }));
    writeFileSync(current, JSON.stringify({ metrics: [{
      ...baseMetric,
      medianMs: 8_000,
      p90Ms: 9_000,
      runnerMinutesPerSuccessfulRun: 0.24,
      cacheHitRate: 0.9,
    }] }));

    execFileSync(process.execPath, [
      "scripts/compare-ci-setup-metrics.mjs",
      "--baseline", baseline,
      "--current", current,
      "--min-improvement-percent", "5",
      "--max-runner-increase-percent", "0",
      "--output", output,
    ], { cwd: root, stdio: "pipe" });

    const result = JSON.parse(readFileSync(output, "utf8"));
    expect(result.comparisons[0]).toMatchObject({
      comparable: true,
      wallClockImprovementPercent: 20,
      recommendation: "ADOPT",
      delta: { medianPercent: -20 },
    });
  });

  it("enforces cache invalidation and fallback contracts statically", () => {
    const output = execFileSync(process.execPath, ["scripts/verify-ci-cache-contract.mjs"], {
      cwd: root,
      encoding: "utf8",
    });
    expect(output).toContain("CI cache contract PASS (#444)");
  });
});
