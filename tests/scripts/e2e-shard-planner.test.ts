import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
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

  it("covers all current specs exactly once after #767 eight-shard escalation", () => {
    const path = fileURLToPath(new URL("../config/e2e-shard-plan.json", import.meta.url));
    const plan = JSON.parse(readFileSync(path, "utf8")) as {
      schemaVersion: number;
      shardCount: number;
      shards: Array<{ shard: number; files: string[] }>;
    };
    const discovered = listSpecFiles();
    const entries = plan.shards.flatMap(group => group.files);
    expect(plan.schemaVersion).toBe(1);
    expect(plan.shardCount).toBe(8);
    expect(plan.shards.map(group => group.shard).sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(plan.shards.every(group => group.files.length === 17)).toBe(true);
    expect(new Set(entries).size).toBe(entries.length);
    expect([...entries].sort()).toEqual(discovered); // New specs require deliberate plan slots.
    const selected = [1, 2, 3, 4, 5, 6, 7, 8].flatMap(shard =>
      selectShardFiles({ plan, currentFiles: discovered, shard, total: 8 }) ?? [],
    );
    expect([...selected].sort()).toEqual(discovered);
    expect(new Set(selected).size).toBe(discovered.length);
    for (const [file, assignedShard] of [
      // Current eight-shard placement supersedes historical six-shard corrections;
      // validate each current destination and preserve unique 136 specs.
      ["project-task-editor.spec.ts", 2],
      ["issue-623-resource-mvp.spec.ts", 1],
      ["issue-735-system-dashboard.spec.ts", 4],
      ["issue-734-equipment-dashboard.spec.ts", 2],
      ["issue-732-milestone-dashboard.spec.ts", 7],
      ["issue-621-resource-target.spec.ts", 8],
      ["gantt-state-recovery-editor.spec.ts", 4],
      ["issue-736-resource-dashboard.spec.ts", 5],
      ["project-transfer-layout-491.spec.ts", 6],
      ["canonical-projection.spec.ts", 6],
      ["logistics-target-authoring.spec.ts", 7],
      ["project-task-delete-context.spec.ts", 5],
      ["issue-730-view-composer.spec.ts", 5],
      ["issue-733-process-workarea-dashboard.spec.ts", 4],
      ["issue-726-task-logistics.spec.ts", 6],
    ] as const) {
      expect(plan.shards.filter(group => group.files.includes(`tests/e2e/${file}`)).map(group => group.shard)).toEqual([assignedShard]);
    }
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
