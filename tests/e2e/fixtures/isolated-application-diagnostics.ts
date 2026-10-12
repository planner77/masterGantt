import type { ChildProcess } from "node:child_process";
import { readFile } from "node:fs/promises";
import { freemem, totalmem } from "node:os";
import { resolve } from "node:path";

const methods = new Set(["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"]);
const requestIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const events = new Set(["http_request_completed", "http_request_unhandled", "http_request_rejected", "http_request_unexpected_error"]);
const routePattern = /^\/api\/(?:health\/(?:live|ready)|projects(?:\/\[publicId\](?:\/(?:tasks(?:\/\[taskId\])?|links|milestone-memberships|edit-sessions(?:\/current)?|edit-password))?)?|project-master\/catalog)$/;

/** Retain route templates only, never public IDs, query strings, or arbitrary paths. */
export function diagnosticRoute(value: unknown): string {
  if (typeof value !== "string" || value.includes("?") || value.includes("#")) return "other";
  const template = value.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi, "[id]")
    .replace("/projects/[id]", "/projects/[publicId]").replace("/tasks/[id]", "/tasks/[taskId]");
  return routePattern.test(template) ? template : "other";
}

export function transportFailureKind(error: unknown): string {
  // Inspect transient error text for known classifications; never retain that text.
  const message = error instanceof Error ? error.message : "";
  for (const code of ["ECONNRESET", "ECONNREFUSED", "EPIPE", "ETIMEDOUT", "ENOTFOUND"]) if (message.includes(code)) return code;
  if (/socket hang up/i.test(message)) return "SOCKET_HANG_UP";
  if (/timeout|timed out/i.test(message)) return "TIMEOUT";
  return "UNCLASSIFIED";
}

type SafeRecord = Record<string, string | number | boolean | null>;

/** Bounded records are reconstructed from an allowlist, not redacted raw log lines. */
export class SafeOutputRing {
  private pending = "";
  private discardLine = false;
  private readonly records: SafeRecord[] = [];
  private bytes = 0;
  discardedLines = 0;
  constructor(private readonly maximumBytes = 8_192, private readonly maximumRecords = 64) {}
  push(chunk: Buffer | string): void {
    const text = chunk.toString();
    for (const character of text) {
      if (character === "\n") {
        if (!this.discardLine) this.line(this.pending);
        this.pending = ""; this.discardLine = false;
      } else if (!this.discardLine) {
        this.pending += character;
        if (this.pending.length > 4_096) { this.pending = ""; this.discardLine = true; this.discardedLines++; }
      }
    }
  }
  private line(raw: string): void {
    let value: unknown;
    try { value = JSON.parse(raw); } catch { this.discardedLines++; return; }
    if (!value || typeof value !== "object" || !("event" in value) || typeof value.event !== "string" || !events.has(value.event)) { this.discardedLines++; return; }
    const input = value as Record<string, unknown>;
    const record: SafeRecord = { event: value.event };
    if (typeof input.requestId === "string" && requestIdPattern.test(input.requestId)) record.requestId = input.requestId;
    if (typeof input.method === "string" && methods.has(input.method)) record.method = input.method;
    if (input.route !== undefined) record.route = diagnosticRoute(input.route);
    if (typeof input.status === "number" && Number.isInteger(input.status) && input.status >= 100 && input.status <= 599) record.status = input.status;
    if (typeof input.durationMs === "number" && Number.isFinite(input.durationMs) && input.durationMs >= 0) record.durationMs = Math.min(input.durationMs, 3_600_000);
    const size = Buffer.byteLength(JSON.stringify(record));
    this.records.push(record); this.bytes += size;
    while (this.bytes > this.maximumBytes || this.records.length > this.maximumRecords) this.bytes -= Buffer.byteLength(JSON.stringify(this.records.shift()));
  }
  snapshot() { return { records: this.records.map(record => ({ ...record })), discardedLines: this.discardedLines, retainedBytes: this.bytes }; }
}

function safeSignal(signal: unknown): string | null {
  return typeof signal === "string" && ["SIGTERM", "SIGKILL", "SIGINT", "SIGABRT", "SIGSEGV", "SIGHUP", "SIGQUIT"].includes(signal) ? signal : null;
}

export class IsolatedApplicationDiagnostics {
  private readonly startedAt = Date.now();
  private readonly generations: Array<{ child: ChildProcess; expectedShutdown: boolean; generation: number }> = [];
  private readonly lifecycle: SafeRecord[] = [];
  private readonly requests: SafeRecord[] = [];
  readonly stdout = new SafeOutputRing();
  readonly stderr = new SafeOutputRing();
  track(child: ChildProcess): void {
    const state = { child, expectedShutdown: false, generation: this.generations.length + 1 };
    this.generations.push(state);
    this.event({ event: "spawn", pid: child.pid ?? null, generation: state.generation, expectedShutdown: false });
    child.once("error", error => this.event({ event: "spawn_error", generation: state.generation, failure: transportFailureKind(error), expectedShutdown: state.expectedShutdown }));
    child.once("exit", (code, signal) => this.event({ event: "exit", pid: child.pid ?? null, generation: state.generation, exitCode: code, signal: safeSignal(signal), expectedShutdown: state.expectedShutdown }));
    child.once("close", (code, signal) => this.event({ event: "close", pid: child.pid ?? null, generation: state.generation, exitCode: code, signal: safeSignal(signal), expectedShutdown: state.expectedShutdown }));
    child.stdout?.on("data", chunk => this.stdout.push(chunk));
    child.stderr?.on("data", chunk => this.stderr.push(chunk));
  }
  expectShutdown(child: ChildProcess): void {
    const state = this.generations.find(value => value.child === child);
    if (state) { state.expectedShutdown = true; this.event({ event: "shutdown_requested", generation: state.generation, pid: child.pid ?? null, expectedShutdown: true }); }
  }
  private event(value: SafeRecord): void {
    this.lifecycle.push({ ...value, elapsedMs: Date.now() - this.startedAt });
    if (this.lifecycle.length > 64) this.lifecycle.shift();
  }
  request(event: "started" | "completed" | "transport_failure", route: string, method: string, durationMs: number, status?: number, requestId?: string, failure?: string): void {
    this.requests.push({ event, route: diagnosticRoute(route), method: methods.has(method) ? method : "other", elapsedMs: Date.now() - this.startedAt, durationMs, ...(status === undefined ? {} : { status }), ...(requestId && requestIdPattern.test(requestId) ? { requestId } : {}), ...(failure ? { failure } : {}) });
    if (this.requests.length > 64) this.requests.shift();
  }
  snapshot() {
    return {
      schemaVersion: 1, elapsedMs: Date.now() - this.startedAt,
      processes: this.generations.slice(-16).map(({ child, generation, expectedShutdown }) => ({ pid: child.pid ?? null, generation, exitCode: child.exitCode, signal: safeSignal(child.signalCode), expectedShutdown, alive: child.exitCode === null && child.signalCode === null && child.pid !== undefined })),
      lifecycle: this.lifecycle.map(event => ({ ...event })), requests: this.requests.map(event => ({ ...event })),
      stdout: this.stdout.snapshot(), stderr: this.stderr.snapshot(),
      interpretation: "관측값만 기록합니다. 연결 초기화·프로세스 종료·OOM의 인과관계는 서로 일치하는 증거가 없으면 미확정입니다.",
    };
  }
  currentPid(): number | undefined { return this.generations.at(-1)?.child.pid; }
}

async function numericFile(path: string): Promise<number | null> {
  try { const raw = (await readFile(path, "utf8")).trim(); const number = Number(raw); return /^\d+$/.test(raw) && Number.isSafeInteger(number) ? number : null; } catch { return null; }
}

/** Linux observations exclude command lines, environment, filenames, and database contents. */
export async function resourceSnapshot(pid?: number) {
  const processes: Array<{ pid: number; parentPid: number | null; rssKb: number | null; threads: number | null }> = [];
  const pending = pid ? [pid] : [];
  while (pending.length && processes.length < 32) {
    const current = pending.shift()!;
    if (processes.some(value => value.pid === current)) continue;
    try {
      const status = await readFile(`/proc/${current}/status`, "utf8");
      const number = (key: string) => { const match = new RegExp(`^${key}:\\s+(\\d+)`, "m").exec(status); return match ? Number(match[1]) : null; };
      processes.push({ pid: current, parentPid: number("PPid"), rssKb: number("VmRSS"), threads: number("Threads") });
      const children = await readFile(`/proc/${current}/task/${current}/children`, "utf8").catch(() => "");
      pending.push(...children.trim().split(/\s+/).filter(value => /^\d+$/.test(value)).map(Number).slice(0, 32 - processes.length));
    } catch { /* Process may exit between lifecycle and /proc observation. */ }
  }
  let cgroup: { currentBytes: number | null; maxBytes: number | null; oom: number | null; oomKill: number | null } | null = null;
  try {
    const membership = await readFile("/proc/self/cgroup", "utf8");
    const path = /^0::(\/[^\r\n]*)$/m.exec(membership)?.[1];
    if (path && !path.split("/").includes("..")) {
      const directory = resolve("/sys/fs/cgroup", `.${path}`);
      const events = await readFile(resolve(directory, "memory.events"), "utf8");
      const value = (key: string) => { const match = new RegExp(`^${key} (\\d+)$`, "m").exec(events); return match ? Number(match[1]) : null; };
      cgroup = { currentBytes: await numericFile(resolve(directory, "memory.current")), maxBytes: await numericFile(resolve(directory, "memory.max")), oom: value("oom"), oomKill: value("oom_kill") };
    }
  } catch { /* cgroup v2 may be absent or unreadable. */ }
  const memory = process.memoryUsage();
  return { hostFreeBytes: freemem(), hostTotalBytes: totalmem(), workerRssBytes: memory.rss, workerHeapUsedBytes: memory.heapUsed, processes, processTreeTruncated: pending.length > 0, cgroup };
}

export async function healthObservation(origin: string) {
  const started = Date.now();
  try {
    // One independent health read; never replay the failing business request.
    const response = await fetch(`${origin}/api/health/ready`, { signal: AbortSignal.timeout(1_500), redirect: "error" });
    await response.body?.cancel();
    return { status: response.status, durationMs: Date.now() - started, failure: null };
  } catch (error) { return { status: null, durationMs: Date.now() - started, failure: transportFailureKind(error) }; }
}

export interface DiagnosticResponse { status(): number; headers(): Record<string, string> }
export type ObserveIsolatedApi = <T extends DiagnosticResponse>(route: string, method: string, operation: () => Promise<T>) => Promise<T>;

export function observeIsolatedApi(diagnostics: IsolatedApplicationDiagnostics, capture: () => Promise<void>): ObserveIsolatedApi {
  return async (route, method, operation) => {
    const started = Date.now();
    diagnostics.request("started", route, method, 0);
    try {
      const response = await operation();
      diagnostics.request("completed", route, method, Date.now() - started, response.status(), response.headers()["x-request-id"]);
      return response;
    } catch (error) {
      diagnostics.request("transport_failure", route, method, Date.now() - started, undefined, undefined, transportFailureKind(error));
      // Diagnostics must not replace the original failure or turn it into a retry.
      await capture().catch(() => undefined);
      throw error;
    }
  };
}
