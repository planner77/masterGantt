import { test as base, expect, type Page } from "@playwright/test";
import { execFile, spawn, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { createServer, type AddressInfo } from "node:net";
import { resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { promisify } from "node:util";
import { IsolatedPerformanceReceipt } from "./isolated-performance-receipt";
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
  restart: (patchOnlyReadinessPath?: string) => Promise<void>;
  observeApi: ObserveIsolatedApi;
  timeStage: <T>(stage: "seed_issue_623", task: () => Promise<T>) => Promise<T>;
  listen: (page: Page) => () => void;
}

export const test = base.extend<{
  isolatedApplication: string;
  isolatedResourceAdminPassword: string | undefined;
  isolatedProjectMasterAdminPassword: string | undefined;
  isolatedApplicationRuntime: IsolatedApplicationRuntime;
  restartIsolatedApplication: (patchOnlyReadinessPath?: string) => Promise<void>;
  observeIsolatedApi: ObserveIsolatedApi;
  timeIsolatedStage: <T>(stage: "seed_issue_623", task: () => Promise<T>) => Promise<T>;
  isolatedBrowserNetwork: void;
}>({
  isolatedResourceAdminPassword: [undefined, { option: true }],
  isolatedProjectMasterAdminPassword: [undefined, { option: true }],
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
  isolatedBrowserNetwork: [async ({page, isolatedApplicationRuntime}, provide) => {
    const stop = isolatedApplicationRuntime.listen(page);
    try { await provide(); } finally { stop(); }
  }, {auto:true}],
  isolatedApplicationRuntime: [async ({ browserName, isolatedResourceAdminPassword, isolatedProjectMasterAdminPassword }, provide, testInfo) => {
    const performanceReceipt = new IsolatedPerformanceReceipt(testInfo);
    const external = process.env.PLAYWRIGHT_BASE_URL;
    if (external) {
      testInfo.annotations.push({ type: "external-application", description: "User-managed server: process/DB/rate-limit isolation is not provided. Use a disposable instance and a selected scenario." });
      try { await provide({ origin: external, timeStage: async (_stage, task) => task(), listen: () => () => {}, observeApi: async (_route, _method, operation) => operation(), restart: async () => {
        testInfo.annotations.push({ type: "NOT TESTED", description: "사용자 관리 서버에서는 실제 프로세스 재시작을 검증하지 않았습니다." });
        throw new Error("NOT TESTED: 사용자 관리 외부 서버를 재시작할 수 없습니다.");
      } }); } finally { await performanceReceipt.attach(testInfo.status === testInfo.expectedStatus ? "ok" : "error"); }
      return;
    }
    await mkdir(resolve(repositoryRoot, ".data"), { recursive: true });
    const temporary = await mkdtemp(resolve(repositoryRoot, ".data", "playwright-isolated-"));
    // Must obey next.config.ts's .next-<lowercase-name> contract. Never reuse
    // the shared mock/demo server's .next-e2e output or a developer's .next.
    const distName = `.next-e2e-isolated-${randomUUID()}`;
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
        NEXT_DIST_DIR: distName,
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
      const startApplication = async (patchOnlyReadinessPath?: string): Promise<void> => {
        const deadline = Date.now() + startupMilliseconds;
        let spawnError: Error | undefined;
        child = spawn(process.execPath, [resolve(repositoryRoot, "node_modules/next/dist/bin/next"), "dev", "--hostname", "127.0.0.1", "--port", String(port)], {
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
        const paths = ["/", "/projects/new", "/api/project-master/catalog", `/projects/${missing}`, "/api/projects", `/api/projects/${missing}`, `/api/projects/${missing}/edit-sessions`, `/api/projects/${missing}/edit-sessions/current`, `/api/projects/${missing}/edit-password`, `/api/projects/${missing}/tasks`, `/api/projects/${missing}/tasks/${missing}`];
        await performanceReceipt.measure("next_route_warmup", async () => {
        for (const path of paths) {
          const remaining = deadline - Date.now();
          if (remaining <= 0) throw new Error("Isolated E2E route warmup exceeded its startup budget.");
          const response = await fetch(`${origin}${path}`, { signal: AbortSignal.timeout(remaining) });
          await response.arrayBuffer();
          if (response.status >= 500) throw new Error(`격리 E2E 경로 준비 실패: HTTP ${response.status}. isolated-application-diagnostics 첨부를 확인하세요.`);
        }
        });
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
          while (Date.now() < deadline) {
            if (!child || child.exitCode !== null || child.signalCode !== null) {
              throw new Error("격리 E2E 경로 준비 중 서버가 종료되었습니다. 진단을 확인하세요.");
            }
            const remaining = deadline - Date.now();
            if (remaining <= 0) break;
            let response: Response;
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
            await response.arrayBuffer();
            if (lastStatus === 405) break;
            if (lastStatus !== 404) {
              throw new Error(`격리 E2E PATCH 전용 동적 경로 준비 결과가 예상 밖입니다: GET HTTP ${lastStatus} (예상 405).`);
            }
            await delay(100);
          }
          if (lastStatus !== 405) {
            throw new Error(`격리 E2E 서버 재시작 후 설비 PATCH 경로가 준비되지 않았습니다: read-only GET 마지막 HTTP ${lastStatus ?? "전송 실패"}, 예상 405. isolated-application-diagnostics 첨부를 확인하세요.`);
          }
          });
        }
      };
      await performanceReceipt.measure("fixture_setup", startApplication);
      baselineResources = await resourceSnapshot(diagnostics.currentPid());
      let restarting = false;
      const restart = async (patchOnlyReadinessPath?: string): Promise<void> => {
        if (restarting) throw new Error("격리 E2E 서버 재시작이 이미 진행 중입니다.");
        if (!child) throw new Error("격리 E2E fixture의 실행 프로세스가 없습니다.");
        restarting = true;
        try {
          diagnostics.expectShutdown(child);
          await stopApplication(child, closed);
          child = undefined;
          // Preserve port/origin, SQLite, build output and environment; no migration rerun.
          await performanceReceipt.measure("server_restart", () => startApplication(patchOnlyReadinessPath));
        } finally { restarting = false; }
      };
      testInfo.annotations.push({ type: "isolated-application", description: `${browserName}: fresh process and SQLite per test at ${origin}; production rate limits unchanged.` });
      const observed = observeIsolatedApi(diagnostics, () => captureDiagnostics("api_transport_failure"));
      await provide({ origin, restart, listen: page => performanceReceipt.listen(page),
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
          if (child) { diagnostics.expectShutdown(child); await stopApplication(child, closed); }
          await rm(temporary, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
          await rm(resolve(repositoryRoot, distName), { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
        });
      } finally {
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
