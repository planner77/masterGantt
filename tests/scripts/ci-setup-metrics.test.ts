import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const root = resolve(__dirname, "../..");
const tempDirs: string[] = [];
afterEach(() => { for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });

describe("CI setup/cache metrics", () => {
  it("records workflow identity and Step Summary row", () => {
    const dir = mkdtempSync(join(tmpdir(), "mastergantt-ci-metric-"));
    tempDirs.push(dir);
    const summary = join(dir, "summary.md");
    const env = {
      ...process.env,
      RUNNER_TEMP: dir,
      GITHUB_WORKFLOW: "PR CI",
      GITHUB_WORKFLOW_REF: "planner77/masterGantt/.github/workflows/ci.yml@refs/pull/443/merge",
      GITHUB_JOB: "unit-test",
      GITHUB_RUN_ID: "123",
      GITHUB_RUN_ATTEMPT: "2",
      GITHUB_EVENT_NAME: "pull_request",
      GITHUB_SHA: "a".repeat(40),
      GITHUB_STEP_SUMMARY: summary,
    };
    execFileSync(process.execPath, ["scripts/record-ci-setup-metric.mjs", "--metric", "npm-ci", "--started-ms", String(Date.now() - 25), "--cache", "exact-hit=true"], { cwd: root, env, stdio: "pipe" });
    const metrics = readFileSync(join(dir, "ci-setup-metrics-unit-test.jsonl"), "utf8").trim().split(/\r?\n/).map((line) => JSON.parse(line));
    expect(metrics).toHaveLength(1);
    expect(metrics[0]).toMatchObject({ schemaVersion: 2, issue: 439, workflow: ".github/workflows/ci.yml", job: "unit-test", eventName: "pull_request", metric: "npm-ci", cache: "exact-hit=true" });
    expect(readFileSync(summary, "utf8")).toContain("| npm-ci |");
  });

  it("uses 10 distinct run IDs for readiness", () => {
    const dir = mkdtempSync(join(tmpdir(), "mastergantt-ci-analysis-"));
    tempDirs.push(dir);
    const history = join(dir, "history");
    mkdirSync(history, { recursive: true });
    const records = Array.from({ length: 10 }, (_, index) => ({
      schemaVersion: 2, issue: 439, runId: String(100 + index), runAttempt: 1,
      workflow: ".github/workflows/ci.yml", job: "build", eventName: "pull_request",
      headSha: String(index).padStart(40, "0"), metric: "npm-ci", durationMs: (index + 1) * 1000,
      cache: index % 2 === 0 ? "exact-hit=true" : "exact-hit=false", recordedAt: "2026-10-05T00:00:00.000Z",
    }));
    writeFileSync(join(history, "metrics.jsonl"), records.map(JSON.stringify).join("\n") + "\n");
    const output = join(dir, "analysis.json");
    execFileSync(process.execPath, ["scripts/analyze-ci-setup-metrics.mjs", "--input", history, "--min-samples", "10", "--output", output], { cwd: root, stdio: "pipe" });
    const result = JSON.parse(readFileSync(output, "utf8"));
    expect(result.metrics[0]).toMatchObject({ workflow: ".github/workflows/ci.yml", job: "build", samples: 10, successfulRuns: 10, enoughSamples: true, medianMs: 5500, p90Ms: 9000 });
  });

  it("separates workflows/jobs and does not count shards or reruns as new runs", () => {
    const dir = mkdtempSync(join(tmpdir(), "mastergantt-ci-analysis-grouping-"));
    tempDirs.push(dir);
    const history = join(dir, "history");
    mkdirSync(history, { recursive: true });
    const rec = (workflow: string, job: string, runId: string, attempt: number, durationMs: number) => ({
      schemaVersion: 2, issue: 439, runId, runAttempt: attempt, workflow, job, eventName: "push",
      headSha: "b".repeat(40), metric: "npm-ci", durationMs, cache: "exact-hit=true", recordedAt: "2026-10-05T00:00:00.000Z",
    });
    const records = [
      ...Array.from({ length: 6 }, (_, i) => rec(".github/workflows/ci.yml", "e2e", "200", 1, 1000 + i)),
      rec(".github/workflows/ci.yml", "e2e", "200", 2, 1100),
      ...Array.from({ length: 6 }, (_, i) => rec(".github/workflows/release-image.yml", "e2e", "300", 1, 2000 + i)),
      rec(".github/workflows/ci.yml", "build", "201", 1, 3000),
    ];
    writeFileSync(join(history, "metrics.jsonl"), records.map(JSON.stringify).join("\n") + "\n");
    const output = join(dir, "analysis.json");
    execFileSync(process.execPath, ["scripts/analyze-ci-setup-metrics.mjs", "--input", history, "--min-samples", "2", "--output", output], { cwd: root, stdio: "pipe" });
    const result = JSON.parse(readFileSync(output, "utf8"));
    expect(result.metrics).toHaveLength(3);
    expect(result.metrics.find((x: { workflow: string; job: string }) => x.workflow === ".github/workflows/ci.yml" && x.job === "e2e")).toMatchObject({ samples: 7, successfulRuns: 1, enoughSamples: false });
    expect(result.metrics.find((x: { workflow: string; job: string }) => x.workflow === ".github/workflows/release-image.yml" && x.job === "e2e")).toMatchObject({ samples: 6, successfulRuns: 1, enoughSamples: false });
  });
});
