import type { Page, Request, Response, TestInfo } from "@playwright/test";
import { performance } from "node:perf_hooks";

export type Stage = "sqlite_migrate" | "server_start_readiness" | "next_route_warmup" | "next_dynamic_route_warmup" | "fixture_setup" | "fixture_teardown" | "server_restart" | "seed_issue_623" | "test_body" | "next_assigned_targets_warmup" | "next_assignment_targets_warmup";
type Route = "process-context" | "assignment-targets" | "task-logistics-links" | "resource-dashboard" | "target-bindings" | "other-api";
type Result = "complete" | "http_error" | "abort" | "timeout" | "network" | "other" | "incomplete";
const MAX_RECORDS = 512;
const METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]);
const n = (value: number) => Math.round(value * 100) / 100;
function failure(error: unknown): Result {
  // Playwright Request.failure() returns { errorText }, not a string/Error.
  // Do not store raw errorText; only return an allowlisted category.
  const text = error instanceof Error ? error.message :
    typeof error === "string" ? error :
    error !== null && typeof error === "object" &&
    "errorText" in error && typeof error.errorText === "string"
      ? error.errorText : "";
  if (/ABORT|CANCEL/i.test(text)) return "abort";
  if (/TIMEOUT|timed out/i.test(text)) return "timeout";
  if (/ECONN|EPIPE|ERR_|ENOTFOUND|NetworkError/i.test(text)) return "network";
  return "other";
}
export function safeRoute(raw: string): Route | null {
  let path: string;
  try { path = new URL(raw, "http://localhost").pathname; } catch { return null; }
  if (!path.startsWith("/api/")) return null;
  if (/\/logistics\/process-context$/.test(path)) return "process-context";
  if (/\/assignment-targets$/.test(path)) return "assignment-targets";
  if (/\/tasks\/[^/]+\/logistics-links$/.test(path)) return "task-logistics-links";
  if (/\/resource-dashboard(?:\/details)?$/.test(path)) return "resource-dashboard";
  if (/\/target-bindings$/.test(path)) return "target-bindings";
  return "other-api";
}
interface RequestSample {
  source: "browser" | "fixture";
  route: Route;
  method: string;
  startMs: number;
  durationMs: number;
  status: number | null;
  outcome: Result;
}
export class IsolatedPerformanceReceipt {
  private started = performance.now();
  private stack: Stage[] = [];
  private stages: Array<{stage: Stage; startMs: number; durationMs: number; outcome: "ok" | "error"; errorClass: string | null}> = [];
  private requests: RequestSample[] = [];
  private serverRequests: Array<{
    route: Route; method: string; status: number | null;
    serverMs: number | null; sqlStatementCount: number | null;
    sqlExecutionMs: number | null; sqlErrorCount: number | null;
  }> = [];
  private serverEventsDiscarded = 0;
  private discardedRequests = 0;
  constructor(private readonly info: TestInfo) {}
  private append(item: RequestSample) {
    if (this.requests.length >= MAX_RECORDS) this.discardedRequests++;
    else this.requests.push(item);
  }
  async measure<T>(stage: Stage, task: () => Promise<T>): Promise<T> {
    const start = performance.now();
    this.stack.push(stage);
    let outcome: "ok" | "error" = "ok", errorClass: string | null = null;
    try { return await task(); }
    catch (error) { outcome = "error"; errorClass = failure(error); throw error; }
    finally {
      this.stages.push({ stage, startMs: n(start-this.started), durationMs: n(performance.now()-start), outcome, errorClass });
      this.stack.pop();
    }
  }
  async api<T extends {status(): number}>(route: string, method: string, task: () => Promise<T>): Promise<T> {
    const start = performance.now(), safe = safeRoute(route);
    const verb = METHODS.has(method) ? method : "OTHER";
    try {
      const result = await task();
      if (safe) this.append({source:"fixture", route:safe, method:verb, startMs:n(start-this.started),
        durationMs:n(performance.now()-start), status:result.status(), outcome:result.status()>=400?"http_error":"complete"});
      return result;
    } catch (error) {
      if (safe) this.append({source:"fixture", route:safe, method:verb, startMs:n(start-this.started),
        durationMs:n(performance.now()-start), status:null, outcome:failure(error)});
      throw error;
    }
  }
  listen(page: Page): () => void {
    const active = new Map<Request,{start:number; route:Route; method:string; status:number|null}>();
    const start = (request: Request) => {
      const route = safeRoute(request.url());
      if (route) active.set(request,{start:performance.now(),route,method:METHODS.has(request.method())?request.method():"OTHER",status:null});
    };
    const response = (item: Response) => {
      const record = active.get(item.request());
      if (record) record.status = item.status();
    };
    const finish = (request: Request, failed: boolean) => {
      const record = active.get(request);
      if (!record) return;
      active.delete(request);
      this.append({source:"browser",route:record.route,method:record.method,
        startMs:n(record.start-this.started),durationMs:n(performance.now()-record.start),
        status:record.status, outcome:failed?failure(request.failure()):record.status!==null && record.status>=400?"http_error":"complete"});
    };
    const completed = (req: Request) => finish(req,false);
    const failed = (req: Request) => finish(req,true);
    page.on("request",start); page.on("response",response);
    page.on("requestfinished",completed); page.on("requestfailed",failed);
    return () => {
      page.off("request",start); page.off("response",response);
      page.off("requestfinished",completed); page.off("requestfailed",failed);
      for (const req of active.keys()) {
        const record=active.get(req)!;active.delete(req);
        this.append({source:"browser",route:record.route,method:record.method,startMs:n(record.start-this.started),
          durationMs:n(performance.now()-record.start),status:record.status,outcome:"incomplete"});
      }
    };
  }
  /**
   * Server logs are sanitized by SafeOutputRing first. Never copy server request
   * IDs, error messages, SQL, headers, or absolute timestamps to the artifact.
   * Rows are independently observed; overlapping requests are NOT joined by time.
   */
  captureServerEvents(records: Array<Record<string, unknown>>, discarded = 0) {
    this.serverEventsDiscarded += Math.max(0, discarded);
    for (const record of records) {
      if (record.event !== "http_request_completed") continue;
      const route = typeof record.route === "string" ? safeRoute(record.route) : null;
      if (!route) continue;
      if (this.serverRequests.length >= MAX_RECORDS) { this.serverEventsDiscarded++; continue; }
      const safeNumber = (input: unknown) =>
        typeof input === "number" && Number.isFinite(input) && input >= 0 ? n(input) : null;
      this.serverRequests.push({
        route, method: typeof record.method === "string" && METHODS.has(record.method) ? record.method : "OTHER",
        status: typeof record.status === "number" && Number.isInteger(record.status) && record.status >= 100 && record.status <= 599 ? record.status : null,
        serverMs: safeNumber(record.durationMs),
        sqlStatementCount: safeNumber(record.sqlStatementCount),
        sqlExecutionMs: safeNumber(record.sqlExecutionMs),
        sqlErrorCount: safeNumber(record.sqlErrorCount),
      });
    }
  }
  snapshot() {
    return {
      requests: this.requests.map(record => ({ ...record })),
      serverRequests: this.serverRequests.map(record => ({ ...record })),
      stages: this.stages.map(record => ({ ...record })),
    };
  }
  async attach(status: "ok" | "error") {
    const report = {
      schemaVersion: 2, status, source: {
        runId: /^\d+$/.test(process.env.GITHUB_RUN_ID||"")?process.env.GITHUB_RUN_ID:null,
        attempt: /^\d+$/.test(process.env.GITHUB_RUN_ATTEMPT||"")?Number(process.env.GITHUB_RUN_ATTEMPT):null,
        checkoutSha: /^[a-f0-9]{40}$/i.test(process.env.GITHUB_SHA||"")?process.env.GITHUB_SHA:null,
        headSha: /^[a-f0-9]{40}$/i.test(process.env.E2E_SOURCE_HEAD_SHA||"")?process.env.E2E_SOURCE_HEAD_SHA:null,
        testId:this.info.testId, project:this.info.project.name, retry:this.info.retry, worker:this.info.workerIndex,
      },
      elapsedMs:n(performance.now()-this.started), currentStage:this.stack.at(-1)||null,
      stages:this.stages, requests:this.requests, discardedRequests:this.discardedRequests,
      serverRequests: this.serverRequests, serverEventsDiscarded: this.serverEventsDiscarded,
      correlation: "SERVER_AGGREGATE_ONLY_NOT_PER_REQUEST_JOIN",
      timeoutBudgets:{testMs:this.info.timeout, isolatedFixtureMs:120000},
    };
    await this.info.attach("issue-751-isolated-performance",{contentType:"application/json",body:Buffer.from(JSON.stringify(report))});
  }
}
