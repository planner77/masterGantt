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
    // The #479 private read security spec is deliberately assigned to shard 8, not silently dropped.
    // 누락·중복은 계속 실패해야 하며 hash fallback으로 대체하지 않는다.
    // #866 Phase A adds language-shell to shard 5; Phase B adds master-data to shard 7.
    // #880 신규 일정 View spec은 기존 배치를 유지하며 shard 3에 명시 등록한다.
    // #885/#894 layouts remain immutable historical evidence. #900 F-003 moves
    // exactly two complete specs; all 147 current specs remain unique.
    expect(plan.shards.map(group => group.files.length)).toEqual([17, 18, 17, 21, 18, 17, 19, 20]);
    expect(new Set(entries).size).toBe(entries.length);
    expect([...entries].sort()).toEqual(discovered); // New specs require deliberate plan slots.
    const selected = [1, 2, 3, 4, 5, 6, 7, 8].flatMap(shard =>
      selectShardFiles({ plan, currentFiles: discovered, shard, total: 8 }) ?? [],
    );
    expect([...selected].sort()).toEqual(discovered);
    expect(new Set(selected).size).toBe(discovered.length);
    const evidence = plan as typeof plan & {
      manualRebalance885: {
        sourceRunId: number; originalHeadSha: string; beforeFileCounts: number[];
        afterFileCounts: number[]; explicitSpecCount: number; jobTimeoutMinutes: number;
        movedFiles: Array<{ file: string; from: number; to: number }>;
      };
      manualRebalance894: {
        sourceRunId: number; sourceRunNumber: number; sourceHeadSha: string;
        sourceBaseSha: string; originalConclusion: string; jobTimeoutMinutes: number;
        shard7ObservedPassCount: number; shard7PlannedTestCount: number;
        beforeFileCounts: number[]; afterFileCounts: number[];
        explicitSpecCount: number; movedFiles: Array<{ file: string; from: number; to: number }>;
      };
      manualRebalance900: {
        sourceRunId: number; sourceHeadSha: string; sourceBaseSha: string;
        originalConclusion: string; jobTimeoutMinutes: number;
        cancelledShardSelectedCases: number; cancelledShardObservedPasses: number;
        cancelledShardUnfinishedCases: number; successfulShards: number[];
        originalShardFileCounts: number[]; revisedShardFileCounts: number[];
        explicitSpecCount: number; movedFiles: Array<{ file: string; from: number; to: number }>;
      };
    };
    const incident = evidence.manualRebalance885;
    expect(incident.sourceRunId).toBe(42376741473);
    expect(incident.originalHeadSha).toBe("26ac9049a82ea143e1aa614039c3cf62041e2a04");
    expect(incident.beforeFileCounts).toEqual([19, 18, 19, 18, 18, 18, 18, 19]);
    // #885 is an immutable historical placement, not the live #894 layout.
    expect(incident.afterFileCounts).toEqual([17, 18, 17, 21, 17, 17, 21, 19]);
    expect(incident.jobTimeoutMinutes).toBe(35);
    expect(incident.explicitSpecCount).toBe(discovered.length);
    expect(incident.movedFiles).toHaveLength(6);
    const correction = evidence.manualRebalance894;
    expect(correction.sourceRunId).toBe(42446255333);
    expect(correction.sourceRunNumber).toBe(3572);
    expect(correction.sourceHeadSha).toBe("415631ce7c1fc279e9cddb37e0070495de209565");
    expect(correction.sourceBaseSha).toBe("ecc15d171f08dbb249ff52b13ca616592d1c9ac7");
    expect(correction.originalConclusion).toBe("cancelled");
    expect(correction.jobTimeoutMinutes).toBe(35);
    expect([correction.shard7ObservedPassCount, correction.shard7PlannedTestCount]).toEqual([116, 119]);
    expect(correction.explicitSpecCount).toBe(discovered.length);
    expect(correction.beforeFileCounts).toEqual(incident.afterFileCounts);
    expect(correction.afterFileCounts).toEqual([17, 19, 17, 22, 18, 16, 19, 19]);
    expect(correction.movedFiles).toHaveLength(4);
    expect(new Set(correction.movedFiles.map(item => item.file)).size).toBe(correction.movedFiles.length);

    const rebalance900 = evidence.manualRebalance900;
    expect(rebalance900.sourceRunId).toBe(42475849089);
    expect(rebalance900.sourceHeadSha).toBe("6bf821cf9c57941f2e1547b8cb1552b6f99ea277");
    expect(rebalance900.sourceBaseSha).toBe("90c5a1a951c749a9690b1c83e5a74b6d122dd6e3");
    expect(rebalance900.originalConclusion).toBe("cancelled");
    expect(rebalance900.jobTimeoutMinutes).toBe(35);
    expect([rebalance900.cancelledShardSelectedCases, rebalance900.cancelledShardObservedPasses,
      rebalance900.cancelledShardUnfinishedCases]).toEqual([113, 102, 11]);
    expect(rebalance900.successfulShards).toEqual([1, 3, 4, 5, 6, 7, 8]);
    expect(rebalance900.explicitSpecCount).toBe(discovered.length);
    expect(rebalance900.originalShardFileCounts).toEqual(correction.afterFileCounts);
    expect(rebalance900.revisedShardFileCounts).toEqual(plan.shards.map(group => group.files.length));
    expect(rebalance900.movedFiles).toHaveLength(2);
    expect(new Set(rebalance900.movedFiles.map(item => item.file)).size).toBe(2);

    // Reverse current #900 assignments to reconstruct the *immutable* #894
    // snapshot, then reverse #894 itself to reconstruct #885's snapshot.
    const restoredCounts = plan.shards.map(group => group.files.length);
    for (const movement of rebalance900.movedFiles) {
      expect(movement.from).not.toBe(movement.to);
      expect(movement.from).toBeGreaterThanOrEqual(1);
      expect(movement.to).toBeLessThanOrEqual(8);
      expect(plan.shards.filter(group => group.files.includes(movement.file)).map(group => group.shard)).toEqual([movement.to]);
      restoredCounts[movement.to - 1]--;
      restoredCounts[movement.from - 1]++;
    }
    expect(restoredCounts).toEqual(correction.afterFileCounts);
    for (const movement of correction.movedFiles) {
      expect(movement.from).not.toBe(movement.to);
      expect(movement.from).toBeGreaterThanOrEqual(1);
      expect(movement.to).toBeLessThanOrEqual(8);
      const newest = rebalance900.movedFiles.find(item => item.file === movement.file);
      expect(plan.shards.filter(group => group.files.includes(movement.file)).map(group => group.shard))
        .toEqual([newest?.to ?? movement.to]);
      restoredCounts[movement.to - 1]--;
      restoredCounts[movement.from - 1]++;
    }
    expect(restoredCounts).toEqual(correction.beforeFileCounts);
    for (const movement of incident.movedFiles) {
      // A later decision can override a former destination, never its history.
      const newer = correction.movedFiles.find(item => item.file === movement.file);
      const newest = rebalance900.movedFiles.find(item => item.file === movement.file);
      if (newer) expect(newer.from).toBe(movement.to);
      if (newest) expect(newest.from).toBe(newer?.to ?? movement.to);
      expect(plan.shards.filter(group => group.files.includes(movement.file)).map(group => group.shard))
        .toEqual([newest?.to ?? newer?.to ?? movement.to]);
    }
    for (const [file, assignedShard] of [
      // Current eight-shard placement supersedes historical six-shard corrections;
      // validate each current destination and preserve every unique current spec.
      ["country-calendar-admin.spec.ts", 1],
      ["milestone-timeline-interchange-http.spec.ts", 4],
      ["project-task-editor.spec.ts", 2],
      ["issue-623-resource-mvp.spec.ts", 1],
      ["issue-751-performance-telemetry.spec.ts", 1],
      ["issue-762-process-workareas.spec.ts", 3],
      ["issue-737-target0-acceptance.spec.ts", 6],
      ["issue-735-system-dashboard.spec.ts", 6],
      ["issue-734-equipment-dashboard.spec.ts", 8],
      ["issue-732-milestone-dashboard.spec.ts", 7],
      ["issue-621-resource-target.spec.ts", 8],
      ["gantt-state-recovery-editor.spec.ts", 4],
      ["issue-736-resource-dashboard.spec.ts", 5],
      ["issue-866-language-shell.spec.ts", 5],
      ["i18n-master-data.spec.ts", 7],
      ["schedule-views.spec.ts", 3],
      ["i18n.spec.ts", 8],
      ["project-transfer-layout-491.spec.ts", 6],
      ["gantt-state-product-integration.spec.ts", 7],
      ["project-task-context-menu.spec.ts", 2],
      ["canonical-projection.spec.ts", 6],
      ["logistics-target-authoring.spec.ts", 7],
      ["project-task-delete-context.spec.ts", 5],
      ["issue-730-view-composer.spec.ts", 5],
      ["issue-733-process-workarea-dashboard.spec.ts", 4],
      ["issue-726-task-logistics.spec.ts", 6],
      // #885 Full #3563.1 35-minute canceled shard 1/3 and six-file, timeout-neutral rebalance.
      ["project-summary-bar-visual.spec.ts", 4],
      ["project-grid-reorder-persistence.spec.ts", 4],
      ["project-list-search-filter.spec.ts", 5],
      ["milestone-stage-exchange.spec.ts", 4],
      ["milestone-visibility-persistence.spec.ts", 4],
      ["logistics-dashboard-request-state.spec.ts", 7],
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
