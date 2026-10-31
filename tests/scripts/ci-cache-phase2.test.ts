import { execFileSync, spawnSync } from "node:child_process";
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

  it("fails closed when before and after workload metric sets differ", () => {
    const dir = mkdtempSync(join(tmpdir(), "mastergantt-ci-phase2-mismatch-"));
    tempDirs.push(dir);
    const baseline = join(dir, "baseline.json");
    const current = join(dir, "current.json");
    const output = join(dir, "comparison.json");

    const npm = {
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
    const restore = {
      ...npm,
      metric: "new-cache-restore",
      medianMs: 4_000,
      p90Ms: 5_000,
      runnerMinutesPerSuccessfulRun: 0.08,
      cacheHitRate: 0.9,
    };
    writeFileSync(baseline, JSON.stringify({ metrics: [npm] }));
    writeFileSync(current, JSON.stringify({ metrics: [{ ...npm, medianMs: 7_000 }, restore] }));

    execFileSync(process.execPath, [
      "scripts/compare-ci-setup-metrics.mjs",
      "--baseline", baseline,
      "--current", current,
      "--output", output,
    ], { cwd: root, stdio: "pipe" });

    const result = JSON.parse(readFileSync(output, "utf8"));
    expect(result.workloadComparable).toBe(false);
    expect(result.adoptGroups).toBe(0);
    expect(result.comparisons).toHaveLength(2);
    expect(result.comparisons.every((item: { recommendation: string }) =>
      item.recommendation === "WORKLOAD_MISMATCH")).toBe(true);
    expect(result.comparisons.find((item: { metric: string }) => item.metric === "new-cache-restore"))
      .toMatchObject({ presentBefore: false, presentAfter: true, comparable: false });
  });

  it("keeps Docker shared cache read-only on PR and writes on main push", () => {
    const workflow = readFileSync(resolve(root, ".github/workflows/ci.yml"), "utf8");
    expect(workflow).toContain(
      "cache-to: ${{ github.event_name == 'push' && format('type=gha,mode=max,scope=mastergantt-docker-{0}-{1}', runner.os, runner.arch) || '' }}",
    );
    expect(workflow).toContain(
      '--cache "${{ github.event_name == \'push\' && \'gha-write-max\' || \'gha-readonly\' }}"',
    );
    expect(
      workflow.split("cache-to: type=gha,mode=max,scope=mastergantt-docker-${{ runner.os }}-${{ runner.arch }}").length - 1,
    ).toBe(1);
  });

  it("enforces cache invalidation and fallback contracts statically", () => {
    const output = execFileSync(process.execPath, ["scripts/verify-ci-cache-contract.mjs"], {
      cwd: root,
      encoding: "utf8",
    });
    expect(output).toContain("CI cache contract PASS (#444)");
  });
});

 
describe("Issue #444 provenance-bound focused Docker after audit", () => {
  function makeAnalysis(job: string, medianMs: number, runnerMinutes: number, options: {
    runs?: number; eventName?: string; provenance?: boolean; p90Ms?: number;
  } = {}) {
    const metric = {
      workflow: ".github/workflows/ci.yml",
      eventName: options.eventName ?? "pull_request",
      job, metric: "docker-build-cache",
      lane: options.eventName === "push" ? "Main" : "PR",
      enoughSamples: true, successfulRuns: options.runs ?? 20,
      medianMs, p90Ms: options.p90Ms ?? Math.ceil(medianMs * 1.15),
      runnerMinutesPerSuccessfulRun: runnerMinutes,
    };
    return {
      schemaVersion: 2, phase2Issue: 444,
      minSamples: 10, requireBoundProvenance: options.provenance ?? true,
      metrics: [metric],
    };
  }

  function compare(before: unknown, after: unknown, extra: string[] = []) {
    const dir = mkdtempSync(join(tmpdir(), "mastergantt-ci444-focus-"));
    tempDirs.push(dir);
    const baseline = join(dir, "before.json");
    const current = join(dir, "after.json");
    writeFileSync(baseline, JSON.stringify(before));
    writeFileSync(current, JSON.stringify(after));
    return JSON.parse(execFileSync(process.execPath, [
      "scripts/compare-ci-setup-metrics.mjs",
      "--baseline", baseline, "--current", current,
      "--scope-workflow", ".github/workflows/ci.yml",
      "--scope-event", "pull_request",
      "--scope-metric", "docker-build-cache",
      "--before-job", "docker_smoke",
      "--after-job", "pr_docker_smoke",
      "--rename-evidence", "https://github.com/planner77/masterGantt/commit/6a3d61fac54f3fb5584351bd0a1e886afc3781f4",
      ...extra,
    ], { cwd: root, encoding: "utf8" }));
  }

  it("compares renamed PR metric numerically but never auto-ADOPTs unverified workload", () => {
    const result = compare(
      makeAnalysis("docker_smoke", 97_482, 1.533, { runs: 23, p90Ms: 110_173 }),
      makeAnalysis("pr_docker_smoke", 90_520, 1.472, { runs: 21, p90Ms: 99_371 }),
    );
    expect(result).toMatchObject({
      focused: true, renamedJob: true, workloadKeysMatch: true,
      workloadComparable: false, reviewRequiredGroups: 1, adoptGroups: 0,
    });
    expect(result.comparisons[0]).toMatchObject({
      numericComparable: true, comparable: false, policyThresholdMet: true,
      recommendation: "REVIEW_REQUIRED",
      delta: { medianPercent: -7.14, p90Percent: -9.8, runnerMinutesPercent: -3.98 },
    });
  });

  it("blocks an unrelated event and does not borrow other-lane samples", () => {
    const result = compare(
      makeAnalysis("docker_smoke", 100_000, 1.5, { eventName: "push" }),
      makeAnalysis("pr_docker_smoke", 80_000, 1.2),
    );
    expect(result.workloadKeysMatch).toBe(false);
    expect(result.adoptGroups).toBe(0);
    expect(result.comparisons[0]).toMatchObject({
      presentBefore: false, recommendation: "WORKLOAD_MISMATCH",
    });
  });

  it("requires ten actual distinct runs and trusted-source provenance for focused comparisons", () => {
    const insufficient = compare(
      makeAnalysis("docker_smoke", 100_000, 1.5, { runs: 9 }),
      makeAnalysis("pr_docker_smoke", 80_000, 1.2),
    );
    expect(insufficient.comparisons[0].recommendation).toBe("COLLECT_MORE");
    const unbound = compare(
      makeAnalysis("docker_smoke", 100_000, 1.5, { provenance: false }),
      makeAnalysis("pr_docker_smoke", 80_000, 1.2),
    );
    expect(unbound.comparisons[0].recommendation).toBe("PROVENANCE_REQUIRED");
    expect(unbound.adoptGroups).toBe(0);
  });

  it("rejects invalid runner costs and duplicate workload records", () => {
    const invalid = compare(
      makeAnalysis("docker_smoke", 100_000, 1.5),
      makeAnalysis("pr_docker_smoke", 80_000, 0),
    );
    expect(invalid.comparisons[0].recommendation).toBe("INVALID_METRICS");
    expect(invalid.adoptGroups).toBe(0);
    const duplicate = makeAnalysis("docker_smoke", 100_000, 1.5);
    duplicate.metrics.push({ ...duplicate.metrics[0] });
    expect(() => compare(duplicate, makeAnalysis("pr_docker_smoke", 80_000, 1.2)))
      .toThrow();
  });

  it("requires an explicit source for aliases and fully specified scope", () => {
    const dir = mkdtempSync(join(tmpdir(), "mastergantt-ci444-invalid-"));
    tempDirs.push(dir);
    const baseline = join(dir, "before.json");
    const current = join(dir, "after.json");
    writeFileSync(baseline, JSON.stringify(makeAnalysis("docker_smoke", 100_000, 1.5)));
    writeFileSync(current, JSON.stringify(makeAnalysis("pr_docker_smoke", 80_000, 1.2)));
    const base = ["scripts/compare-ci-setup-metrics.mjs", "--baseline", baseline, "--current", current];
    expect(() => execFileSync(process.execPath, [
      ...base, "--scope-workflow", ".github/workflows/ci.yml",
      "--scope-event", "pull_request", "--scope-metric", "docker-build-cache",
      "--before-job", "docker_smoke", "--after-job", "pr_docker_smoke",
    ], { cwd: root, stdio: "pipe" })).toThrow();
    expect(() => execFileSync(process.execPath, [
      ...base, "--scope-workflow", ".github/workflows/ci.yml",
    ], { cwd: root, stdio: "pipe" })).toThrow();
  });
});


describe("Issue #444: CI 진단 한글 오류 메시지 회귀", () => {
  const base = ["scripts/compare-ci-setup-metrics.mjs", "--baseline", "not-found-before.json", "--current", "not-found-after.json"];
  const scope = [
    "--scope-workflow", ".github/workflows/ci.yml",
    "--scope-event", "pull_request",
    "--scope-metric", "docker-build-cache",
    "--before-job", "docker_smoke",
    "--after-job", "pr_docker_smoke",
  ];
  it("rejects incomplete scope, missing rename evidence and invalid sample sizes in Korean", () => {
    const cases: { args: string[]; diagnostic: RegExp }[] = [
      { args: ["--scope-workflow", ".github/workflows/ci.yml"], diagnostic: /다섯 옵션이 모두 필요합니다/ },
      { args: scope, diagnostic: /Job 이름이 변경된 경우 --rename-evidence에 GitHub PR\/commit URL이 필요합니다/ },
      { args: [...scope, "--rename-evidence", "https://github.com/planner77/masterGantt/pull/789", "--min-samples", "9"], diagnostic: /--min-samples는 10 이상의 정수여야 합니다/ },
      { args: [...scope.slice(0, -1), "docker_smoke", "--rename-evidence", "https://github.com/planner77/masterGantt/pull/789"], diagnostic: /전후 Job 이름이 다른 범위 지정 비교/ },
    ];
    for (const fixture of cases) {
      const result = spawnSync(process.execPath, [...base, ...fixture.args], {
        cwd: root, encoding: "utf8",
      });
      expect(result.status).toBe(1);
      expect(result.stderr).toMatch(fixture.diagnostic);
    }
  });
});


describe("Issue #790: same-job focused evidence cannot self-authorize ADOPT", () => {
  it("reports REVIEW_REQUIRED for improvement without independent source and workload attestation", () => {
    const dir = mkdtempSync(join(tmpdir(), "mastergantt-ci790-advisory-"));
    tempDirs.push(dir);
    const baseline = join(dir, "before.json");
    const current = join(dir, "after.json");
    const m = {
      workflow: ".github/workflows/ci.yml", eventName: "push",
      job: "docker_smoke", metric: "docker-build-cache", lane: "Main",
      enoughSamples: true, successfulRuns: 20,
      medianMs: 100000, p90Ms: 130000, runnerMinutesPerSuccessfulRun: 2,
    };
    const meta = { schemaVersion: 2, phase2Issue: 444, minSamples: 10, requireBoundProvenance: true };
    writeFileSync(baseline, JSON.stringify({ ...meta, metrics: [m] }));
    writeFileSync(current, JSON.stringify({ ...meta, metrics: [{
      ...m, medianMs: 80000, p90Ms: 110000, runnerMinutesPerSuccessfulRun: 1.8,
    }] }));
    const out = JSON.parse(execFileSync(process.execPath, [
      "scripts/compare-ci-setup-metrics.mjs", "--baseline", baseline,
      "--current", current, "--scope-workflow", ".github/workflows/ci.yml",
      "--scope-event", "push", "--scope-metric", "docker-build-cache",
      "--before-job", "docker_smoke", "--after-job", "docker_smoke",
    ], { cwd: root, encoding: "utf8" }));
    expect(out.comparisons[0]).toMatchObject({
      numericComparable: true, policyThresholdMet: true,
      recommendation: "REVIEW_REQUIRED",
    });
    expect(out.adoptGroups).toBe(0);
  });
});
