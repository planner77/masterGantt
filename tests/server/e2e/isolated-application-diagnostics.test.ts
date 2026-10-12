import { spawn } from "node:child_process";
import { once } from "node:events";
import { PassThrough } from "node:stream";
import type { ChildProcess } from "node:child_process";
import { EventEmitter } from "node:events";
import { describe, expect, it, onTestFailed, vi } from "vitest";
import { diagnosticRoute, healthObservation, IsolatedApplicationDiagnostics, observeIsolatedApi, resourceSnapshot, SafeOutputRing } from "../../e2e/fixtures/isolated-application-diagnostics";

const requestId = "00000000-0000-4000-8000-000000000001";

describe("isolated application diagnostics confidentiality and failure preservation", () => {
  it("retains only allowlisted request metadata, handles chunks, and bounds both log rings", () => {
    const ring = new SafeOutputRing(600, 3);
    const raw = JSON.stringify({ event: "http_request_completed", requestId, method: "GET", route: `/api/projects/${requestId}`, status: 200, durationMs: 12, cookie: "PRIVATE_COOKIE", password: "PRIVATE_PASSWORD", token: "PRIVATE_TOKEN", body: { secret: "PRIVATE_BODY" }, stack: "PRIVATE_STACK" }) + "\n";
    ring.push(raw.slice(0, 35)); ring.push(raw.slice(35));
    ring.push("password=PRIVATE_UNKNOWN\n");
    ring.push(JSON.stringify({ event: "http_request_completed", route: "/api/projects?secret=PRIVATE_QUERY", method: "GET" }) + "\n");
    ring.push("PRIVATE_LONG".repeat(1_000) + "\n");
    for (let index = 0; index < 10; index++) ring.push(raw);
    const output = JSON.stringify(ring.snapshot());
    expect(output).not.toContain("PRIVATE_");
    expect(ring.snapshot().records).toHaveLength(3);
    expect(ring.snapshot().retainedBytes).toBeLessThanOrEqual(600);
    expect(ring.snapshot().discardedLines).toBe(2);
    expect(ring.snapshot().records[0]).toMatchObject({ requestId, route: "/api/projects/[publicId]", status: 200 });
    expect(diagnosticRoute("/api/projects?token=secret")).toBe("other");
    expect(diagnosticRoute("/private/password")).toBe("other");
  });

  it("records unexpected exits separately from requested restart/cleanup without raw error messages", () => {
    const fake = () => Object.assign(new EventEmitter(), { pid: 321, exitCode: null, signalCode: null, stdout: new PassThrough(), stderr: new PassThrough() }) as unknown as ChildProcess;
    const diagnostics = new IsolatedApplicationDiagnostics();
    const first = fake(); diagnostics.track(first);
    first.emit("exit", 137, "SIGKILL");
    const second = fake(); diagnostics.track(second); diagnostics.expectShutdown(second);
    second.emit("error", new Error("PRIVATE_PASSWORD")); second.emit("exit", 0, "SIGTERM");
    const snapshot = diagnostics.snapshot();
    expect(snapshot.lifecycle.filter(event => event.event === "exit")).toMatchObject([{ expectedShutdown: false, exitCode: 137, signal: "SIGKILL" }, { expectedShutdown: true, exitCode: 0, signal: "SIGTERM" }]);
    expect(JSON.stringify(snapshot)).not.toContain("PRIVATE_PASSWORD");
  });

  it("captures before cleanup and rethrows the identical transport error without a business retry", async () => {
    const diagnostics = new IsolatedApplicationDiagnostics();
    const error = new Error("apiRequestContext.get: read ECONNRESET cookie=PRIVATE_COOKIE");
    const operation = vi.fn().mockRejectedValue(error);
    let captured: unknown;
    const capture = vi.fn(async () => { captured = diagnostics.snapshot(); });
    const request = observeIsolatedApi(diagnostics, capture);
    await expect(request(`/api/projects/${requestId}`, "GET", operation)).rejects.toBe(error);
    expect(operation).toHaveBeenCalledTimes(1);
    expect(capture).toHaveBeenCalledTimes(1);
    expect(captured).toMatchObject({ requests: [{ event: "started" }, { event: "transport_failure", failure: "ECONNRESET" }] });
    expect(JSON.stringify(captured)).not.toContain("PRIVATE_COOKIE");
  });

  it("preserves the original error even if diagnostic attachment fails", async () => {
    const error = new Error("socket hang up");
    const request = observeIsolatedApi(new IsolatedApplicationDiagnostics(), async () => { throw new Error("attachment failed"); });
    await expect(request("/api/projects", "POST", async () => { throw error; })).rejects.toBe(error);
  });

  it("correlates successful responses with existing server IDs and never treats HTTP409 as transport failure", async () => {
    const diagnostics = new IsolatedApplicationDiagnostics(); const capture = vi.fn();
    const response = { status: () => 409, headers: () => ({ "x-request-id": requestId, "set-cookie": "PRIVATE_COOKIE" }) };
    expect(await observeIsolatedApi(diagnostics, capture)("/api/projects", "POST", async () => response)).toBe(response);
    expect(capture).not.toHaveBeenCalled();
    expect(diagnostics.snapshot().requests.at(-1)).toMatchObject({ event: "completed", status: 409, requestId });
    expect(JSON.stringify(diagnostics.snapshot())).not.toContain("PRIVATE_COOKIE");
  });

  it("performs a single independent health read and excludes its body and credentials", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("PRIVATE_BODY", { status: 503 }));
    try {
      expect(await healthObservation("http://127.0.0.1:12345")).toMatchObject({ status: 503, failure: null });
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock.mock.calls[0][0]).toBe("http://127.0.0.1:12345/api/health/ready");
      expect(fetchMock.mock.calls[0][1]).not.toHaveProperty("headers");
    } finally { fetchMock.mockRestore(); }
  });

  it("observes a real child exit and numeric resources without command lines or environment", async () => {
    let phase: "waiting_ready" | "observing_resources" | "waiting_stop_ack" | "waiting_close" | "closed" = "waiting_ready";
    onTestFailed(() => { console.info(`실제 child 진단 검증 실패 단계: ${phase}`); });
    const script = "process.once('message',()=>{process.send('stopping',()=>process.exit(7))});process.send('ready')";
    const child = spawn(process.execPath, ["-e", script], { stdio: ["ignore", "ignore", "ignore", "ipc"], env: { ...process.env, DIAGNOSTIC_TEST_PRIVATE: "PRIVATE_ENV" } });
    const diagnostics = new IsolatedApplicationDiagnostics(); diagnostics.track(child);
    const closed = once(child, "close");
    const controlMessage = () => Promise.race([
      once(child, "message"),
      closed.then(() => { throw new Error(`실제 child가 제어 응답 전에 종료되었습니다: ${phase}`); }),
    ]);
    let resources: Awaited<ReturnType<typeof resourceSnapshot>>;
    try {
      // Dedicated control messages cannot be consumed by stdout diagnostic listeners.
      expect((await controlMessage())[0]).toBe("ready");
      phase = "observing_resources";
      resources = await resourceSnapshot(child.pid);
      phase = "waiting_stop_ack";
      const stopping = controlMessage();
      child.send("stop");
      expect((await stopping)[0]).toBe("stopping");
      phase = "waiting_close";
      await closed;
      phase = "closed";
    } finally {
      if (child.exitCode === null && child.signalCode === null) child.kill();
    }
    expect(diagnostics.snapshot().processes[0]).toMatchObject({ exitCode: 7, expectedShutdown: false, alive: false });
    expect(resources.workerRssBytes).toBeGreaterThan(0);
    if (process.platform === "linux") expect(resources.processes[0]).toMatchObject({ pid: child.pid, parentPid: process.pid });
    const output = JSON.stringify({ resources, diagnostics: diagnostics.snapshot() });
    expect(output).not.toMatch(/PRIVATE_ENV|DIAGNOSTIC_TEST_PRIVATE|commandLine|database|password/i);
  });
});
