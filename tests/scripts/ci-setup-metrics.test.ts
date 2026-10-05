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

describe("CI setup/cache metrics", () => {
  it("records one machine-readable metric and Step Summary row", () => {
    const dir = mkdtempSync(join(tmpdir(), "mastergantt-ci-metric-"));
    tempDirs.push(dir);
    const summary = join(dir, "summary.md");
    const env = {
      ...process.env,
      RUNNER_TEMP: dir,
      GITHUB_JOB: "unit-test",
      GITHUB_RUN_ID: "123",
      GITHUB_RUN_ATTEMPT: "2",
      GITHUB_EVENT_NAME: "pull_request",
      GITHUB_SHA: "a".repeat(40),
      GITHUB_STEP_SUMMARY: summary,
    };
    execFileSync(
      process.execPath,
      [
        "scripts/record-ci-setup-metric.mjs",
        "--metric",
        "npm-ci",
        "--started-ms",
        String(Date.now() - 25),
        "--cache",
        "exact-hit=true",
      ],
      { cwd: root, env, stdio: "pipe" },
    );

    const metrics = readFileSync(join(dir, "ci-setup-metrics-unit-test.jsonl"), "utf8")
      .trim()
      .split(/\r?\n/)
      .map((line) => JSON.parse(line));
    expect(metrics).toHaveLength(1);
    expect(metrics[0]).toMatchObject({
      schemaVersion: 1,
      issue: 439,
      job: "unit-test",
      eventName: "pull_request",
      metric: "npm-ci",
      cache: "exact-hit=true",
    });
    expect(metrics[0].durationMs).toBeGreaterThanOrEqual(0);
    expect(readFileSync(summary, "utf8")).toContain("| npm-ci |");
  });

  it("calculates median and p90 from historical JSONL metrics", () => {
    const dir = mkdtempSync(join(tmpdir(), "mastergantt-ci-analysis-"));
    tempDirs.push(dir);
    const history = join(dir, "history");
    mkdirSync(history, { recursive: true });
    const records = Array.from({ length: 10 }, (_, index) => ({
      schemaVersion: 1,
      issue: 439,
      runId: String(100 + index),
      runAttempt: 1,
      job: "build",
      eventName: "pull_request",
      headSha: String(index).padStart(40, "0"),
      metric: "npm-ci",
      durationMs: (index + 1) * 1000,
      cache: index % 2 === 0 ? "exact-hit=true" : "exact-hit=false",
      recordedAt: "2026-10-05T00:00:00.000Z",
    }));
    writeFileSync(join(history, "metrics.jsonl"), records.map((value) => JSON.stringify(value)).join("\n") + "\n");
    const output = join(dir, "analysis.json");
    execFileSync(
      process.execPath,
      [
        "scripts/analyze-ci-setup-metrics.mjs",
        "--input",
        history,
        "--min-samples",
        "10",
        "--output",
        output,
      ],
      { cwd: root, stdio: "pipe" },
    );
    const result = JSON.parse(readFileSync(output, "utf8"));
    expect(result.records).toBe(10);
    expect(result.metrics).toEqual([
      {
        eventName: "pull_request",
        metric: "npm-ci",
        samples: 10,
        enoughSamples: true,
        medianMs: 5500,
        p90Ms: 9000,
        cache: {
          "exact-hit=false": 5,
          "exact-hit=true": 5,
        },
      },
    ]);
  });
});
