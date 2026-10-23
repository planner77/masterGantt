import { test as base, expect, type Page } from "@playwright/test";
import { execFile, spawn, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { createServer, type AddressInfo } from "node:net";
import { resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { promisify } from "node:util";
import { IsolatedPerformanceReceipt } from "./isolated-performance-receipt";
import { isolatedReadOnlyWarmupPaths, isolatedWarmupStage } from "./isolated-route-warmup";
import { healthObservation, IsolatedApplicationDiagnostics, observeIsolatedApi, resourceSnapshot, type ObserveIsolatedApi } from "./isolated-application-diagnostics";

const repositoryRoot = resolve(__dirname, "../../..");
const startupMilliseconds = 90_000;
const executeFile = promisify(execFile);
export const E2E_PROJECT_OWNER = "E2E 자동화";

async function unusedLoopbackPort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((done, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => done());
  });
  const port = (server.address() as AddressInfo).port;
  await new Promise<void>((done, reject) => server.close((error) => error ? reject(error) : done()));
  return port;
}

async function waitForExit(closed: Promise<void>): Promise<boolean> {
  const controller = new AbortController();
  try {
    return await Promise.race([
      closed.then(() => true),
      delay(5_000, false, { signal: controller.signal }),
    ]);
  } finally { controller.abort(); }
}

async function stopApplication(child: ChildProcess, closed: Promise<void>): Promise<void> {
  if (!child.pid) return;
  if (process.platform === "win32") {
    // next dev owns a child server; terminate only this fixture's process tree.
    const killer = spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore", windowsHide: true });
    await new Promise<void>((done) => {
      killer.once("error", () => done());
      killer.once("close", () => done());
    });
  } else {
    try { process.kill(-child.pid, "SIGTERM"); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error; }
  }
  if (await waitForExit(closed)) return;
  if (process.platform === "win32") child.kill("SIGKILL");
  else {
    try { process.kill(-child.pid, "SIGKILL"); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error; }
  }
  if (!(await waitForExit(closed))) {
    throw new Error("Isolated E2E server did not terminate; its database and build output were not removed.");
  }
}

/** Browser contexts alone cannot isolate a server's process-global rate limiter. */
interface IsolatedApplicationRuntime {
  origin: string;
  restart: (patchOnlyReadinessPath?: string, taskContextReadinessPath?: string) => Promise<void>;
  observeApi: ObserveIsolatedApi;
  timeStage: <T>(stage: "seed_issue_623" | "test_body", task: () => Promise<T>) => Promise<T>;
  listen: (page: Page) => () => void;
  snapshot: () => ReturnType<IsolatedPerformanceReceipt["snapshot"]>;
}

export const test = base.extend<{
  isolatedApplication: string;
  isolatedResourceAdminPassword: string | undefined;
  isolatedProjectMasterAdminPassword: string | undefined;
  // Default Turbopack remains unchanged; opt into Webpack only for isolated
  // Next dev tests with persistent dynamic-route 404 after restart.
  isolatedDevBundler: "turbopack" | "webpack";
  /** #733 F733-007: serial GET-only compile warmup scoped to actual #725 routes. */
  isolatedRouteWarmup: "base" | "process-workareas";
  /** #733 F733-005: optionally discard the previous dev compiler cache on restart. */
  isolatedFreshDistOnRestart: boolean;
  isolatedApplicationRuntime: IsolatedApplicationRuntime;
  restartIsolatedApplication: (patchOnlyReadinessPath?: string, taskContextReadinessPath?: string) => Promise<void>;
  observeIsolatedApi: ObserveIsolatedApi;
  timeIsolatedStage: <T>(stage: "seed_issue_623" | "test_body", task: () => Promise<T>) => Promise<T>;
  isolatedBrowserNetwork: void;
  observedIsolatedPerformance: () => ReturnType<IsolatedPerformanceReceipt["snapshot"]>;
}>({
  isolatedResourceAdminPassword: [undefined, { option: true }],
  isolatedProjectMasterAdminPassword: [undefined, { option: true }],
  isolatedDevBundler: ["turbopack", { option: true }],
  isolatedRouteWarmup: ["base", { option: true }],
  isolatedFreshDistOnRestart: [false, { option: true }],
  isolatedApplication: async ({ isolatedApplicationRuntime }, provide) => {
    await provide(isolatedApplicationRuntime.origin);
  },
  restartIsolatedApplication: async ({ isolatedApplicationRuntime }, provide) => {
    await provide(isolatedApplicationRuntime.restart);
  },
  observeIsolatedApi: async ({ isolatedApplicationRuntime }, provide) => {
    await provide(isolatedApplicationRuntime.observeApi);
  },
  timeIsolatedStage: async ({ isolatedApplicationRuntime }, provide) => {
    await provide(isolatedApplicationRuntime.timeStage);
  },
  observedIsolatedPerformance: async ({ isolatedApplicationRuntime }, provide) => {
    await provide(isolatedApplicationRuntime.snapshot);
  },
  isolatedBrowserNetwork: [async ({ page, isolatedApplicationRuntime }, provide) => {
    const stop = isolatedApplicationRuntime.listen(page);
    try { await provide(); } finally { stop(); }
  }, { auto: true }],
  isolatedApplicationRuntime: [async ({ browserName, isolatedResourceAdminPassword, isolatedProjectMasterAdminPassword, isolatedDevBundler, isolatedRouteWarmup, isolatedFreshDistOnRestart }, provide, testInfo) => {
    const performanceReceipt = new IsolatedPerformanceReceipt(testInfo);
    const external = process.env.PLAYWRIGHT_BASE_URL;
    if (external) {
      testInfo.annotations.push({ type: "external-application", description: "User-managed server: process/DB/rate-limit isolation is not provided. Use a disposable instance and a selected scenario." });
      try {
        await provide({
          origin: external,
          timeStage: async (_stage, task) => task(),
          listen: () => () => {},
          snapshot: () => performanceReceipt.snapshot(),
          observeApi: async (_route, _method, operation) => operation(),
          restart: async () => {
            testInfo.annotations.push({ type: "NOT TESTED", description: "사용자 관리 서버에서는 실제 프로세스 재시작을 검증하지 않았습니다." });
            throw new Error("NOT TESTED: 사용자 관리 외부 서버를 재시작할 수 없습니다.");
          },
        });
      } finally { await performanceReceipt.attach(testInfo.status === testInfo.expectedStatus ? "ok" : "error"); }
      return;
    }
    await mkdir(resolve(repositoryRoot, ".data"), { recursive: true });
    const temporary = await mkdtemp(resolve(repositoryRoot, ".data", "playwright-isolated-"));
    // Must obey next.config.ts's .next-<lowercase-name> contract. Never reuse
    // the shared mock/demo server's .next-e2e output or a developer's .next.
    const distNames = [`.next-e2e-isolated-${randomUUID()}`];
    // Every allocated folder is owned by this disposable fixture only.
    // Do not reuse a running Next dev generation's compilation artifacts.
    let child: ChildProcess | undefined;
    let closed = Promise.resolve();
    const diagnostics = new IsolatedApplicationDiagnostics();
    let origin: string | undefined;
    let baselineResources: Awaited<ReturnType<typeof resourceSnapshot>> | undefined;
    let capturedFailure = false;
    const captureDiagnostics = async (reason: "api_transport_failure" | "setup_failure" | "test_failure") => {
      if (capturedFailure) return;
      capturedFailure = true;
      const beforeProbe = diagnostics.snapshot();
      const [resources, health] = await Promise.all([
        resourceSnapshot(diagnostics.currentPid()),
        origin ? healthObservation(origin) : Promise.resolve(null),
      ]);
      await testInfo.attach("isolated-application-diagnostics", {
        contentType: "application/json",
        body: Buffer.from(JSON.stringify({ reason, beforeProbe, afterProbe: diagnostics.snapshot(), baselineResources, resources, health }, null, 2)),
      });
    };
    try {
      const port = await unusedLoopbackPort();
      origin = `http://127.0.0.1:${port}`;
      const applicationEnvironment: NodeJS.ProcessEnv = {
        ...process.env,
        NODE_ENV: "development",
        APP_BASE_URL: origin,
        DATABASE_PATH: resolve(temporary, "database.sqlite3"),
        NEXT_DIST_DIR: distNames[0]!,
        ISSUE_751_SQL_METRICS: "true",
        ...(isolatedResourceAdminPassword===undefined?{}:{RESOURCE_CATALOG_ADMIN_PASSWORD:isolatedResourceAdminPassword}),
        ...(isolatedProjectMasterAdminPassword===undefined?{}:{PROJECT_MASTER_ADMIN_PASSWORD:isolatedProjectMasterAdminPassword}),
      };
      // Readiness is deliberately read-only/fileMustExist and cannot bootstrap
      // an empty fixture. Use the existing CLI; never touch another database.
      await performanceReceipt.measure("sqlite_migrate", () => executeFile(process.execPath, ["--import", "tsx", resolve(repositoryRoot, "scripts/migrate.ts")], {
        cwd: repositoryRoot,
        env: applicationEnvironment,
        timeout: 30_000,
        maxBuffer: 16_384,
        windowsHide: true,
      }));
      const startApplication = async (patchOnlyReadinessPath?: string, taskContextReadinessPath?: string): Promise<void> => {
        const deadline = Date.now() + startupMilliseconds;
        let spawnError: Error | undefined;
        child = spawn(process.execPath, [
          resolve(repositoryRoot, "node_modules/next/dist/bin/next"), "dev",
          ...(isolatedDevBundler === "webpack" ? ["--webpack"] : []),
          "--hostname", "127.0.0.1", "--port", String(port),
        ], {
          cwd: repositoryRoot,
          detached: process.platform !== "win32",
          windowsHide: true,
          stdio: ["ignore", "pipe", "pipe"],
          env: applicationEnvironment,
        });
        child.once("error", (error) => { spawnError = error; });
        diagnostics.track(child);
        const application = child;
        closed = new Promise<void>((done) => application.once("close", () => done()));
        await performanceReceipt.measure("server_start_readiness", async () => {
        let ready = false;
        while (Date.now() < deadline) {
          if (spawnError || application.exitCode !== null || application.signalCode !== null) {
            throw new Error("격리 E2E 서버가 준비 완료 전에 종료되었습니다. isolated-application-diagnostics 첨부를 확인하세요.");
          }
          try {
            const response = await fetch(`${origin}/api/health/ready`, { signal: AbortSignal.timeout(2_000) });
            await response.arrayBuffer();
            if (response.ok) { ready = true; break; }
          } catch { /* Fresh development server is still starting or compiling. */ }
          await delay(100);
        }
        if (!ready) throw new Error("격리 E2E 서버 준비 시간이 초과되었습니다. isolated-application-diagnostics 첨부를 확인하세요.");
        });
        // Read-only route warmup belongs to fixture setup, not the test's 30s
        // behavior budget. GET/405 does not consume create/unlock attempts.
        const missing = "00000000-0000-4000-8000-000000000001";
        const paths = isolatedReadOnlyWarmupPaths(missing);
        // #733 F733-007 / Next dev manifest corruption: force first compilation
        // of the actual #725 API route families serially, before business writes
        // and browser navigation can overlap lazy route compilation. Synthetic
        // UUIDs + GET only: no fixture mutations, authentication or retries.
        // Every restarted generation gets the same bounded warmup.
        const processRoutes = isolatedRouteWarmup === "process-workareas" ? [
          "/api/project-master/admin-sessions",
          "/api/project-master/admin/items",
          "/api/project-master/admin/relations",
          "/api/process-catalog/admin",
          "/api/process-catalog/admin/types",
          "/api/process-catalog/admin/occurrences",
          "/api/process-catalog/admin/work-areas",
          `/api/projects/${missing}/logistics/processes`,
          `/api/projects/${missing}/logistics/process-mappings/${missing}`,
          `/api/projects/${missing}/logistics/equipment`,
          `/api/projects/${missing}/logistics/equipment/${missing}`,
          `/api/projects/${missing}/logistics`,
          `/api/projects/${missing}/logistics/process-context`,
          `/api/projects/${missing}/logistics/targets`,
          `/api/projects/${missing}/tasks/${missing}/process-context`,
        ] : [];
        const prewarmStatusCounts: Record<string, number> = {};
        await performanceReceipt.measure("next_route_warmup", async () => {
          for (const path of [...paths, ...processRoutes]) {
            const readOnlyGet = async () => {
              const remaining = deadline - Date.now();
              if (remaining <= 0) throw new Error("Isolated E2E route warmup exceeded its startup budget.");
              const response = await fetch(`${origin}${path}`, { signal: AbortSignal.timeout(remaining) });
              const mediaType = response.headers.get("content-type")?.toLowerCase() ?? "";
              await response.arrayBuffer();
              if (response.status >= 500) throw new Error(`격리 E2E 경로 준비 실패: HTTP ${response.status}. isolated-application-diagnostics 첨부를 확인하세요.`);
              if (processRoutes.includes(path)) {
                if (response.status === 404 && !mediaType.includes("application/json")) {
                  throw new Error("격리 E2E 공정 API 사전 준비에서 동적 라우트가 HTML404를 반환했습니다.");
                }
                const key = String(response.status);
                prewarmStatusCounts[key] = (prewarmStatusCounts[key] ?? 0) + 1;
              }
            };
            const stage = isolatedWarmupStage(path);
            if (stage) await performanceReceipt.measure(stage, readOnlyGet);
            else await readOnlyGet();
          }
        });
        if (processRoutes.length) {
          await testInfo.attach("issue-733-process-api-serial-prewarm", {
            contentType: "application/json",
            body: Buffer.from(JSON.stringify({
              phase: patchOnlyReadinessPath ? "restart" : "initial",
              bundler: isolatedDevBundler,
              routeCount: processRoutes.length,
              method: "GET", realBusinessRequestsRetried: false,
              statusCounts: prewarmStatusCounts,
            })),
          });
        }
        if (patchOnlyReadinessPath) {
          await performanceReceipt.measure("next_dynamic_route_warmup", async () => {
          // A healthy /api/health/ready does not establish that the lazy Next.js
          // dynamic PATCH-only route is registered after this isolated restart.
          // Probe GET only (Next returns 405 when the PATCH route is known);
          // never issue a synthetic PATCH or retry a mutation.
          const route = new URL(patchOnlyReadinessPath, origin);
          if (route.origin !== origin || route.search || route.hash ||
              !/^\/api\/projects\/[0-9a-f-]{36}\/logistics\/equipment\/[0-9a-f-]{36}$/.test(route.pathname)) {
            throw new Error("격리 E2E 재시작 읽기 전용 준비 검사는 해당 프로젝트의 설비 API만 허용합니다.");
          }
          let lastStatus: number | null = null;
          let lastContentType = "";
          let attempts = 0;
          while (Date.now() < deadline) {
            if (!child || child.exitCode !== null || child.signalCode !== null) {
              throw new Error("격리 E2E 경로 준비 중 서버가 종료되었습니다. 진단을 확인하세요.");
            }
            const remaining = deadline - Date.now();
            if (remaining <= 0) break;
            let response: Response;
            attempts++;
            try {
              response = await fetch(route, {
                method: "GET", cache: "no-store",
                signal: AbortSignal.timeout(Math.min(2_000, remaining)),
              });
            } catch {
              await delay(100); // The read-only route is still compiling; no write retry.
              continue;
            }
            lastStatus = response.status;
            lastContentType = response.headers.get("content-type") ?? "";
            await response.arrayBuffer();
            if (lastStatus === 405) break;
            // Retry only Next's transient HTML404 during lazy route compilation.
            // A JSON404 or any other status is an API/contract failure, not warmup.
            if (lastStatus !== 404 || !lastContentType.includes("text/html")) {
              throw new Error(`격리 E2E PATCH 동적 경로의 응답이 예상 밖입니다: GET HTTP ${lastStatus} (${lastContentType || "unknown MIME"}, 예상 405 또는 준비 중 HTML404).`);
            }
            await delay(100);
          }
          if (lastStatus !== 405) {
            throw new Error(`격리 E2E 서버 재시작 후 설비 PATCH 경로가 준비되지 않았습니다: read-only GET 마지막 HTTP ${lastStatus ?? "전송 실패"} (${lastContentType || "unknown MIME"}, attempts=${attempts}), 예상 405. isolated-application-diagnostics 첨부를 확인하세요.`);
          }
          await testInfo.attach("issue-733-equipment-route-ready", {
            contentType: "application/json",
            body: Buffer.from(JSON.stringify({
              route: "/api/projects/[publicId]/logistics/equipment/[equipmentId]",
              method: "GET", expectedStatus: 405, attempts,
              originalMutationRetries: 0, bundler: isolatedDevBundler,
            })),
          });
          });
        }
        if (taskContextReadinessPath) {
          // #730 PR #756 Full #3037: equipment GET405 alone cannot prove
          // the independent task process-context GET route is registered.
          // A Next development HTML 404 is a pending route; a canonical JSON
          // 404/401/500 is an actual API failure and must never be retried.
          const route = new URL(taskContextReadinessPath, origin);
          const match = /^\/api\/projects\/([0-9a-f-]{36})\/tasks\/([0-9a-f-]{36})\/process-context$/.exec(route.pathname);
          const equipmentProject = patchOnlyReadinessPath?.split("/")[3];
          if (route.origin !== origin || route.search || route.hash ||
              route.pathname !== taskContextReadinessPath || !match ||
              (equipmentProject !== undefined && equipmentProject !== match[1])) {
            throw new Error("격리 E2E 재시작 Task 공정 연결 준비 경로는 동일 프로젝트의 canonical 읽기 URL이어야 합니다.");
          }
          let ready = false;
          let lastStatus: number | null = null;
          let attempts = 0;
          while (Date.now() < deadline) {
            if (!child || child.exitCode !== null || child.signalCode !== null) {
              throw new Error("격리 E2E Task 경로 준비 중 서버가 종료되었습니다. 진단을 확인하세요.");
            }
            const remaining = deadline - Date.now();
            if (remaining <= 0) break;
            let response: Response;
            attempts++;
            try {
              response = await fetch(route, {
                method: "GET", cache: "no-store",
                signal: AbortSignal.timeout(Math.min(2_000, remaining)),
              });
            } catch {
              await delay(100); // Before ready: transport/warming only, never retry PUT/PATCH.
              continue;
            }
            lastStatus = response.status;
            const contentType = response.headers.get("content-type") ?? "";
            if (response.status === 200) {
              if (!contentType.includes("application/json")) {
                throw new Error("격리 E2E Task 공정 연결 경로의 200 응답이 JSON이 아닙니다.");
              }
              const payload = await response.json().catch(() => null) as {data?: {context?: Record<string, unknown>}} | null;
              if (!payload?.data?.context ||
                  !Object.prototype.hasOwnProperty.call(payload.data.context, "processLinks")) {
                throw new Error("격리 E2E Task 공정 연결 경로의 JSON context 계약이 유효하지 않습니다.");
              }
              ready = true;
              break;
            }
            await response.arrayBuffer();
            if (response.status !== 404 || !contentType.includes("text/html")) {
              throw new Error(`격리 E2E Task 공정 연결 경로가 실제 API 오류를 반환했습니다: HTTP ${response.status} (${contentType || "unknown MIME"}).`);
            }
            await delay(100); // Only Next's HTML 404 during bounded route compilation.
          }
          if (!ready) {
            throw new Error(`격리 E2E 서버 재시작 후 Task GET 경로 미준비: 마지막 HTTP ${lastStatus ?? "전송 실패"} (예상 200 JSON).`);
          }
          await testInfo.attach("issue-730-task-route-ready", {
            contentType: "application/json",
            body: Buffer.from(JSON.stringify({
              route: "/api/projects/[publicId]/tasks/[taskId]/process-context",
              method: "GET", expectedStatus: 200, contentType: "application/json", attempts,
              originalMutationRetries: 0,
            })),
          });
        }
      };
      await performanceReceipt.measure("fixture_setup", () => startApplication());
      baselineResources = await resourceSnapshot(diagnostics.currentPid());
      let restarting = false;
      const restart = async (patchOnlyReadinessPath?: string, taskContextReadinessPath?: string): Promise<void> => {
        if (restarting) throw new Error("격리 E2E 서버 재시작이 이미 진행 중입니다.");
        if (!child) throw new Error("격리 E2E fixture의 실행 프로세스가 없습니다.");
        restarting = true;
        try {
          diagnostics.expectShutdown(child);
          await stopApplication(child, closed);
          child = undefined;
          // Preserve port/origin and persisted SQLite without rerunning migration.
          // Opt-in tests get a fresh compiler/dist generation after the old
          // server has terminated, ruling out stale reuse of the first dev cache.
          if (isolatedFreshDistOnRestart) {
            const freshName = `.next-e2e-isolated-${randomUUID()}`;
            distNames.push(freshName);
            applicationEnvironment.NEXT_DIST_DIR = freshName;
          }
          await performanceReceipt.measure("server_restart", () => startApplication(patchOnlyReadinessPath, taskContextReadinessPath));
        } finally { restarting = false; }
      };
      testInfo.annotations.push({ type: "isolated-application", description: `${browserName}: bundler=${isolatedDevBundler}; routeWarmup=${isolatedRouteWarmup}; freshDistOnRestart=${isolatedFreshDistOnRestart}; fresh process and SQLite per test at ${origin}; production rate limits unchanged.` });
      const observed = observeIsolatedApi(diagnostics, () => captureDiagnostics("api_transport_failure"));
      await provide({
        origin, restart,
        listen: page => performanceReceipt.listen(page),
        snapshot: () => performanceReceipt.snapshot(),
        timeStage: (stage, task) => performanceReceipt.measure(stage, task),
        observeApi: (route, method, operation) => performanceReceipt.api(route, method, () => observed(route, method, operation)),
      });
    } catch (error) {
      await captureDiagnostics("setup_failure").catch(() => undefined);
      throw error;
    } finally {
      if (testInfo.status !== testInfo.expectedStatus) await captureDiagnostics("test_failure").catch(() => undefined);
      try {
        await performanceReceipt.measure("fixture_teardown", async () => {
      if (child) {
        diagnostics.expectShutdown(child);
        await stopApplication(child, closed);
      }
      // Remove only paths allocated by this fixture, after its server exits.
      await rm(temporary, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
      for (const name of distNames) {
        // Only this test's generated folders; never delete another workspace.
        await rm(resolve(repositoryRoot, name), { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
      }
        });
      } finally {
        const serverOutput = diagnostics.stdout.snapshot();
        performanceReceipt.captureServerEvents(serverOutput.records, serverOutput.droppedRecords);
        await performanceReceipt.attach(testInfo.status === testInfo.expectedStatus ? "ok" : "error");
      }
    }
  }, { scope: "test", timeout: 120_000 }],
});

// File-level test.use takes precedence over config.use.baseURL. Browser/context
// fixtures and additional contexts retain Playwright's standard option plumbing.
export const isolatedApplicationOptions = {
  baseURL: async ({ isolatedApplication }: { isolatedApplication: string }, provide: (value: string) => Promise<void>) => {
    await provide(isolatedApplication);
  },
};

export async function submitProjectUnlock(page: Page, password: string): Promise<void> {
  const dialog = page.getByRole("dialog", { name: "편집 활성화", exact: true });
  if (!(await dialog.isVisible().catch(() => false))) {
    await page.getByRole("button", { name: "편집 잠금 해제", exact: true }).click();
    await expect(dialog).toBeVisible();
  }
  await dialog.getByLabel("편집 비밀번호", { exact: true }).fill(password);
  await dialog.getByRole("button", { name: "편집 활성화", exact: true }).click();
}

export async function waitForProjectMasterCatalogReady(page: Page): Promise<void> {
  await expect(page.locator("#project-business-unit")).toBeVisible();
}

/** Report the actual HTTP failure rather than a misleading navigation timeout. */
export async function submitProjectAndExpectCreated(page: Page, ownerName = E2E_PROJECT_OWNER): Promise<void> {
  const owner = page.getByLabel("소유자", { exact: true });
  if (await owner.count() > 0 && (await owner.inputValue()).trim().length === 0) {
    await owner.fill(ownerName);
  }
  await waitForProjectMasterCatalogReady(page);
  const [response] = await Promise.all([
    page.waitForResponse((candidate) => candidate.request().method() === "POST" && new URL(candidate.url()).pathname === "/api/projects"),
    page.getByRole("button", { name: "프로젝트 만들기", exact: true }).click(),
  ]);
  let code = "none";
  if (response.status() !== 201) {
    const body: unknown = await response.json().catch(() => null);
    if (typeof body === "object" && body !== null && "error" in body && typeof body.error === "object" && body.error !== null && "code" in body.error && typeof body.error.code === "string" && /^[A-Z0-9_]{1,80}$/.test(body.error.code)) code = body.error.code;
  }
  const retryAfter = response.headers()["retry-after"];
  const retryDescription = retryAfter && /^\d+$/.test(retryAfter) ? retryAfter : "none";
  expect(response.status(), `POST /api/projects: HTTP ${response.status()}, code=${code}, Retry-After=${retryDescription}. No automatic retry; inspect server isolation and the response.`).toBe(201);
}

export { expect } from "@playwright/test";
