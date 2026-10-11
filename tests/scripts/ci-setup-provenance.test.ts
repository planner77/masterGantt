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

describe("CI setup metric trusted provenance", () => {
  it("overwrites untrusted run provenance with GitHub Actions run metadata", () => {
    const dir = mkdtempSync(join(tmpdir(), "mastergantt-setup-provenance-"));
    tempDirs.push(dir);
    const artifact = join(dir, "artifact");
    mkdirSync(artifact, { recursive: true });
    const path = join(artifact, "metrics.jsonl");
    writeFileSync(path, JSON.stringify({
      schemaVersion: 2,
      issue: 439,
      runId: "999999",
      runAttempt: 99,
      workflow: ".github/workflows/release-image.yml",
      eventName: "workflow_dispatch",
      headSha: "f".repeat(40),
      job: "build",
      metric: "npm-ci",
      durationMs: 1234,
      cache: "exact-hit=true",
    }) + "\n");

    execFileSync(process.execPath, [
      "scripts/bind-ci-setup-artifact-provenance.mjs",
      "--input", artifact,
      "--run-id", "12345",
      "--run-attempt", "2",
      "--workflow", ".github/workflows/ci.yml",
      "--event", "pull_request",
      "--head-sha", "a".repeat(40),
    ], { cwd: root, stdio: "pipe" });

    const record = JSON.parse(readFileSync(path, "utf8").trim());
    expect(record).toMatchObject({
      runId: "12345",
      runAttempt: 2,
      workflow: ".github/workflows/ci.yml",
      eventName: "pull_request",
      headSha: "a".repeat(40),
      provenanceBound: true,
      provenanceSource: "github-actions-run-api",
      job: "build",
      metric: "npm-ci",
    });
  });

  it("does not count unbound records when readiness requires trusted provenance", () => {
    const dir = mkdtempSync(join(tmpdir(), "mastergantt-setup-provenance-analysis-"));
    tempDirs.push(dir);
    const history = join(dir, "history");
    mkdirSync(history, { recursive: true });
    const records = [
      ...Array.from({ length: 10 }, (_, index) => ({
        schemaVersion: 2,
        issue: 439,
        runId: String(100 + index),
        runAttempt: 1,
        workflow: ".github/workflows/ci.yml",
        eventName: "pull_request",
        headSha: "b".repeat(40),
        job: "build",
        metric: "npm-ci",
        durationMs: 1000,
        cache: "exact-hit=true",
        provenanceBound: false,
      })),
      {
        schemaVersion: 2,
        issue: 439,
        runId: "500",
        runAttempt: 1,
        workflow: ".github/workflows/ci.yml",
        eventName: "pull_request",
        headSha: "c".repeat(40),
        job: "build",
        metric: "npm-ci",
        durationMs: 1000,
        cache: "exact-hit=true",
        provenanceBound: true,
      },
    ];
    writeFileSync(join(history, "metrics.jsonl"), records.map((value) => JSON.stringify(value)).join("\n") + "\n");
    const output = join(dir, "analysis.json");

    execFileSync(process.execPath, [
      "scripts/analyze-ci-setup-metrics.mjs",
      "--input", history,
      "--min-samples", "10",
      "--require-bound-provenance", "true",
      "--output", output,
    ], { cwd: root, stdio: "pipe" });

    const result = JSON.parse(readFileSync(output, "utf8"));
    expect(result.requireBoundProvenance).toBe(true);
    expect(result.records).toBe(1);
    expect(result.metrics[0]).toMatchObject({ successfulRuns: 1, enoughSamples: false });
  });
});
