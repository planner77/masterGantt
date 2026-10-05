import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  analyzeHistory,
  listSpecFiles,
  lptPlan,
  median,
  selectShardFiles,
} from "../../scripts/e2e-shard-planner.mjs";

const tempDirs: string[] = [];
afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("historical E2E shard planner", () => {
  it("uses a robust median instead of a transient outlier", () => {
    expect(median([10, 11, 10, 12, 47])).toBe(11);
    expect(median([10, 12, 14, 16])).toBe(13);
  });

  it("builds a deterministic LPT plan", () => {
    const weights = new Map([
      ["a.spec.ts", 300],
      ["b.spec.ts", 220],
      ["c.spec.ts", 190],
      ["d.spec.ts", 100],
      ["e.spec.ts", 90],
      ["f.spec.ts", 50],
    ]);
    const first = lptPlan(weights, 3);
    const second = lptPlan(weights, 3);
    expect(first).toEqual(second);
    expect(first.map((bin) => bin.totalMs).sort((a, b) => a - b)).toEqual([300, 310, 340]);
  });

  it("never drops current files when a committed plan is stale", () => {
    const currentFiles = ["tests/e2e/a.spec.ts", "tests/e2e/b.spec.ts", "tests/e2e/new.spec.ts"];
    const plan = {
      schemaVersion: 1,
      shardCount: 2,
      shards: [
        { shard: 1, files: ["tests/e2e/a.spec.ts", "tests/e2e/deleted.spec.ts"] },
        { shard: 2, files: ["tests/e2e/b.spec.ts"] },
      ],
    };
    const selected = [1, 2].flatMap((shard) =>
      selectShardFiles({ plan, currentFiles, shard, total: 2 }) ?? [],
    );
    expect([...selected].sort()).toEqual([...currentFiles].sort());
    expect(new Set(selected).size).toBe(currentFiles.length);
  });

  it("rejects invalid shard ids and duplicate shard groups", () => {
    const currentFiles = ["tests/e2e/a.spec.ts", "tests/e2e/b.spec.ts"];

    expect(
      selectShardFiles({
        plan: {
          schemaVersion: 1,
          shardCount: 2,
          shards: [
            { shard: 1, files: ["tests/e2e/a.spec.ts"] },
            { shard: 3, files: ["tests/e2e/b.spec.ts"] },
          ],
        },
        currentFiles,
        shard: 1,
        total: 2,
      }),
    ).toBeNull();

    expect(
      selectShardFiles({
        plan: {
          schemaVersion: 1,
          shardCount: 2,
          shards: [
            { shard: 1, files: ["tests/e2e/a.spec.ts"] },
            { shard: 1, files: ["tests/e2e/b.spec.ts"] },
          ],
        },
        currentFiles,
        shard: 1,
        total: 2,
      }),
    ).toBeNull();
  });

  it("recommends a rebalance only after enough historical runs", () => {
    const root = mkdtempSync(join(tmpdir(), "mastergantt-e2e-history-"));
    tempDirs.push(root);
    const files = listSpecFiles();
    expect(files.length).toBeGreaterThan(6);

    for (let run = 1; run <= 10; run += 1) {
      const runDir = join(root, String(1000 + run));
      mkdirSync(runDir, { recursive: true });
      for (let shard = 1; shard <= 6; shard += 1) {
        const entries = files
          .filter((_, index) => index % 6 === shard - 1)
          .map((file, index) => ({
            file,
            durationMs: (index + 1) * 1000 * [1, 5, 3, 5, 2, 2][shard - 1],
          }));
        writeFileSync(
          join(runDir, `shard-${shard}.json`),
          JSON.stringify({
            schemaVersion: 1,
            runId: String(1000 + run),
            headSha: String(run),
            shard,
            shardCount: 6,
            status: "passed",
            entries,
          }),
        );
      }
    }

    const result = analyzeHistory({
      historyDir: root,
      shardCount: 6,
      minRuns: 10,
      currentPlanPath: join(root, "missing-plan.json"),
      now: new Date("2026-10-05T00:00:00Z"),
    });
    expect(result.reason.enoughRuns).toBe(true);
    expect(result.reason.enoughCoverage).toBe(true);
    expect(result.reason.imbalanced).toBe(true);
    expect(result.plan.shards).toHaveLength(6);
    expect(result.plan.sourceRunIds).toHaveLength(10);
  });
});
