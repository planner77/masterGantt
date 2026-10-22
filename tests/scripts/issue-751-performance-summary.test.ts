import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Issue #751 E2E summary warning-only source semantics", () => {
  it("retains request outcomes and SQL candidate counts without inventing P95", () => {
    const dir = mkdtempSync(join(tmpdir(), "issue751-summary-"));
    try {
      const file = join(dir, "e2e-timing-shard-1.json");
      writeFileSync(file, JSON.stringify({
        schemaVersion: 1, runId: "3021", runAttempt: 1,
        shard: 1, shardCount: 6, status: "passed", eventName: "pull_request",
        environment: { os: "linux", node: "22.16.0", fullyParallel: true },
        receipts: [{
          schemaVersion: 2, status: "ok", resultStatus: "passed",
          source: { retry: 0, project: "chromium", testId: "stable-test" },
          stages: [{stage: "fixture_setup", durationMs: 501, outcome: "ok"}],
          requests: [
            {route: "assignment-targets", outcome: "complete"},
            {route: "assignment-targets", outcome: "abort"},
          ],
          serverEventsDiscarded: 0,
          serverRequests: [
            {route: "assignment-targets", serverMs: 100, sqlStatementCount: 8, sqlExecutionMs: 70},
          ],
          timeoutBudgets: {testMs: 60000, isolatedFixtureMs: 120000},
        }],
      }));
      const output = execFileSync(process.execPath, [resolve("scripts/issue-751-performance-summary.mjs"), file],
        {encoding: "utf8", env: {...process.env, GITHUB_REPOSITORY: "planner77/masterGantt"}});
      expect(output).toContain("INSUFFICIENT_DATA");
      expect(output).toContain("SQL calls=8");
      expect(output).toContain("cancelled=1");
      expect(output).toContain("SQL_SHARE_HIGH_CANDIDATE");
      expect(output).toContain("actions/runs/3021");
    } finally {
      rmSync(dir, {recursive: true, force: true});
    }
  });
});
