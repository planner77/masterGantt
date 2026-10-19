import type { TestInfo } from "@playwright/test";
import { performance } from "node:perf_hooks";

/** #751: timings are monotonic; never persist absolute URLs, request payloads or credentials. */
type Stage = "sqlite_migrate" | "server_start_readiness" | "next_route_warmup" | "next_dynamic_route_warmup" | "fixture_setup" | "test_body" | "fixture_teardown" | "server_restart";
export interface PerformanceSample {
  stage: Stage;
  durationMs: number;
  outcome: "ok" | "error";
  errorKind?: "timeout" | "other";
}

export class IsolatedPerformanceReceipt {
  private readonly samples: PerformanceSample[] = [];
  private readonly begun = performance.now();
  private active: Stage | null = null;
  constructor(private readonly testInfo: TestInfo) {}

  async measure<T>(stage: Stage, task: () => Promise<T>): Promise<T> {
    const start = performance.now();
    this.active = stage;
    try {
      const result = await task();
      this.samples.push({ stage, durationMs: Math.round((performance.now() - start) * 100) / 100, outcome: "ok" });
      return result;
    } catch (error) {
      const kind = error instanceof Error && /timeout|timed out|exceeded/i.test(error.message) ? "timeout" : "other";
      this.samples.push({ stage, durationMs: Math.round((performance.now() - start) * 100) / 100, outcome: "error", errorKind: kind });
      throw error;
    } finally {
      this.active = null;
    }
  }

  async attach(status: "ok" | "error"): Promise<void> {
    const receipt = {
      schemaVersion: 1,
      source: {
        runId: process.env.GITHUB_RUN_ID && /^\d+$/.test(process.env.GITHUB_RUN_ID) ? process.env.GITHUB_RUN_ID : null,
        attempt: process.env.GITHUB_RUN_ATTEMPT && /^\d+$/.test(process.env.GITHUB_RUN_ATTEMPT) ? Number(process.env.GITHUB_RUN_ATTEMPT) : null,
        headSha: process.env.GITHUB_SHA && /^[a-f0-9]{40}$/i.test(process.env.GITHUB_SHA) ? process.env.GITHUB_SHA : null,
        testId: this.testInfo.testId,
        project: this.testInfo.project.name,
        retry: this.testInfo.retry,
        worker: this.testInfo.workerIndex,
      },
      status,
      currentStage: this.active,
      elapsedMs: Math.round((performance.now() - this.begun) * 100) / 100,
      samples: this.samples,
      // Playwright's test timeout applies to test body + hooks, while a fixture
      // with an explicit timeout has its own budget. Never sum these as one.
      testTimeoutMs: this.testInfo.timeout,
      fixtureTimeoutMs: 120_000,
    };
    await this.testInfo.attach("issue-751-isolated-performance", {
      body: Buffer.from(JSON.stringify(receipt, null, 2)),
      contentType: "application/json",
    });
  }
}
