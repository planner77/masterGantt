import { test as base, expect, type Page } from "@playwright/test";
import { execFile, spawn, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { createServer, type AddressInfo } from "node:net";
import { resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { promisify } from "node:util";

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
export const test = base.extend<{ isolatedApplication: string }>({
  isolatedApplication: [async ({ browserName }, provide, testInfo) => {
    const external = process.env.PLAYWRIGHT_BASE_URL;
    if (external) {
      testInfo.annotations.push({ type: "external-application", description: "User-managed server: process/DB/rate-limit isolation is not provided. Use a disposable instance and a selected scenario." });
      await provide(external);
      return;
    }
    await mkdir(resolve(repositoryRoot, ".data"), { recursive: true });
    const temporary = await mkdtemp(resolve(repositoryRoot, ".data", "playwright-isolated-"));
    // Must obey next.config.ts's .next-<lowercase-name> contract. Never reuse
    // the shared mock/demo server's .next-e2e output or a developer's .next.
    const distName = `.next-e2e-isolated-${randomUUID()}`;
    let child: ChildProcess | undefined;
    let closed = Promise.resolve();
    try {
      const port = await unusedLoopbackPort();
      const origin = `http://127.0.0.1:${port}`;
      const deadline = Date.now() + startupMilliseconds;
      const applicationEnvironment: NodeJS.ProcessEnv = {
        ...process.env,
        NODE_ENV: "development",
        APP_BASE_URL: origin,
        DATABASE_PATH: resolve(temporary, "database.sqlite3"),
        NEXT_DIST_DIR: distName,
      };
      // Readiness is deliberately read-only/fileMustExist and cannot bootstrap
      // an empty fixture. Use the existing CLI; never touch another database.
      await executeFile(process.execPath, ["--import", "tsx", resolve(repositoryRoot, "scripts/migrate.ts")], {
        cwd: repositoryRoot,
        env: applicationEnvironment,
        timeout: 30_000,
        maxBuffer: 16_384,
        windowsHide: true,
      });
      let spawnError: Error | undefined;
      let output = "";
      child = spawn(process.execPath, [resolve(repositoryRoot, "node_modules/next/dist/bin/next"), "dev", "--hostname", "127.0.0.1", "--port", String(port)], {
        cwd: repositoryRoot,
        detached: process.platform !== "win32",
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
        env: applicationEnvironment,
      });
      child.once("error", (error) => { spawnError = error; });
      const application = child;
      closed = new Promise<void>((done) => application.once("close", () => done()));
      const capture = (chunk: Buffer) => { output = (output + chunk.toString()).slice(-16_384); };
      child.stdout?.on("data", capture);
      child.stderr?.on("data", capture);
      let ready = false;
      while (Date.now() < deadline) {
        if (spawnError || child.exitCode !== null || child.signalCode !== null) {
          throw new Error(`Isolated E2E server exited before readiness: ${spawnError?.message ?? child.exitCode ?? child.signalCode}\n${output}`);
        }
        try {
          const response = await fetch(`${origin}/api/health/ready`, { signal: AbortSignal.timeout(2_000) });
          await response.arrayBuffer();
          if (response.ok) { ready = true; break; }
        } catch { /* Fresh development server is still starting or compiling. */ }
        await delay(100);
      }
      if (!ready) throw new Error(`Isolated E2E server readiness timed out.\n${output}`);
      // Read-only route warmup belongs to fixture setup, not the test's 30s
      // behavior budget. GET/405 does not consume create/unlock attempts.
      const missing = "00000000-0000-4000-8000-000000000001";
      const paths = ["/", "/projects/new", `/projects/${missing}`, "/api/projects", `/api/projects/${missing}`, `/api/projects/${missing}/edit-sessions`, `/api/projects/${missing}/edit-sessions/current`, `/api/projects/${missing}/edit-password`, `/api/projects/${missing}/tasks`, `/api/projects/${missing}/tasks/${missing}`];
      for (const path of paths) {
        const remaining = deadline - Date.now();
        if (remaining <= 0) throw new Error("Isolated E2E route warmup exceeded its startup budget.");
        const response = await fetch(`${origin}${path}`, { signal: AbortSignal.timeout(remaining) });
        await response.arrayBuffer();
        if (response.status >= 500) throw new Error(`Isolated E2E warmup failed: ${path} HTTP ${response.status}\n${output}`);
      }
      testInfo.annotations.push({ type: "isolated-application", description: `${browserName}: fresh process and SQLite per test at ${origin}; production rate limits unchanged.` });
      await provide(origin);
    } finally {
      if (child) await stopApplication(child, closed);
      // Remove only paths allocated by this fixture, after its server exits.
      await rm(temporary, { recursive: true, force: true });
      await rm(resolve(repositoryRoot, distName), { recursive: true, force: true });
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

/** Report the actual HTTP failure rather than a misleading navigation timeout. */
export async function submitProjectAndExpectCreated(page: Page, ownerName = E2E_PROJECT_OWNER): Promise<void> {
  const owner = page.getByLabel("소유자", { exact: true });
  if (await owner.count() > 0 && (await owner.inputValue()).trim().length === 0) {
    await owner.fill(ownerName);
  }
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
