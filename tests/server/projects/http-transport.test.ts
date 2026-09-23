import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { parseApplicationBaseUrl, parseAllowInsecureHttp, readApplicationConfiguration, isExactAllowedOrigin, ConfigurationError } from "../../../src/server/security/origin-core";
import { parseEditSessionCookie, serializeEditSessionCookie, serializeExpiredEditSessionCookie } from "../../../src/server/security/cookie-core";
import { EDIT_SESSION_TTL_SECONDS } from "../../../src/server/security/session-core";
import { validateRuntimeConfiguration } from "../../../scripts/validate-runtime-config";
import { checkConfiguredReadiness } from "../../../src/server/health/readiness-service-core";
import { openDatabase } from "../../../src/server/db/core";
import { ProjectService } from "../../../src/server/projects/project-service-core";
import { buildProjectShareUrl } from "../../../src/server/projects/project-share-url-core";
import { handleCreateProject, handleUpdateProject, handleDeleteProject } from "../../../src/server/projects/project-handlers-core";
import { handleCurrentEditSession, handleLogoutProject, handleUnlockProject } from "../../../src/server/projects/edit-session-handlers-core";
import { handleCreateTask, handleUpdateTask, handleDeleteTask } from "../../../src/server/projects/task-handlers-core";
import { FixedWindowRateLimiter } from "../../../src/server/security/rate-limit-core";
import type { CreateProjectResponse, TaskMutationResponse } from "../../../src/contracts/projects";

const http = "http://intranet.example.test:8080";
const https = "https://intranet.example.test:8443";
const migrationsDirectory = join(process.cwd(), "db/migrations");
const token = "A".repeat(43);
const publicId = "2fd0c93f-cd37-4b68-9f09-412239d99c79";

describe("Issue #8 전송 설정", () => {
  it.each([undefined, "false"])("미허용 production HTTP는 거부: %s", (allowInsecureHttp) => {
    expect(() => parseApplicationBaseUrl(http, "production", allowInsecureHttp)).toThrow(ConfigurationError);
    expect(() => validateRuntimeConfiguration({ databasePath: "/data/transport.sqlite3", applicationBaseUrl: http, environment: "production", allowInsecureHttp })).toThrow(ConfigurationError);
  });
  it.each(["", "TRUE", "False", "1", "0", " true", "false ", "yes"])("잘못된 opt-in은 HTTP/HTTPS/개발 모드 모두 거부: %s", (value) => {
    expect(() => parseAllowInsecureHttp(value)).toThrow(ConfigurationError);
    for (const environment of ["production", "development"]) {
      for (const url of [http, https]) expect(() => parseApplicationBaseUrl(url, environment, value)).toThrow(ConfigurationError);
    }
  });
  it("명시적인 true만 HTTP production을 열고 기본 개발 HTTP는 유지한다", () => {
    expect(parseApplicationBaseUrl(http, "production", "true").origin).toBe(http);
    expect(parseApplicationBaseUrl(http, "development").origin).toBe(http);
    for (const flag of [undefined, "true", "false"]) expect(parseApplicationBaseUrl(https, "production", flag).origin).toBe(https);
    expect(() => validateRuntimeConfiguration({ databasePath: "/data/transport.sqlite3", applicationBaseUrl: http, environment: "production", allowInsecureHttp: "true" })).not.toThrow();
    expect(() => validateRuntimeConfiguration({ databasePath: "/tmp/transport.sqlite3", applicationBaseUrl: http, environment: "production", allowInsecureHttp: "true" })).toThrow();
  });
  it("HTTP opt-in도 canonical origin 제약과 잘못된 scheme 거부를 유지한다", () => {
    for (const url of [undefined, `${http}/`, `${http}/path`, `${http}?q=1`, `${http}#x`, "http://user:pass@intranet.example.test:8080", "ftp://intranet.example.test", ` ${http}`, "http://INTRANET.example.test:8080"]) {
      expect(() => parseApplicationBaseUrl(url, "production", "true")).toThrow(ConfigurationError);
    }
    const parsed = parseApplicationBaseUrl(http, "production", "true");
    expect(isExactAllowedOrigin(http, parsed)).toBe(true);
    for (const origin of [null, "null", https, "http://intranet.example.test", `${http}/`, `${http},http://evil.test`]) expect(isExactAllowedOrigin(origin, parsed)).toBe(false);
  });
  it("주입은 서버 환경만 사용하고 공유 URL에 외부 HTTP 포트를 유지한다", () => {
    const configuration = readApplicationConfiguration({ APP_BASE_URL: http, NODE_ENV: "production", ALLOW_INSECURE_HTTP: "true", "X-Forwarded-Proto": "https" });
    expect(configuration).toEqual({ applicationBaseUrl: http, environment: "production", allowInsecureHttp: "true" });
    expect(buildProjectShareUrl(http, "production", publicId, "true")).toBe(`${http}/projects/${publicId}`);
    expect(buildProjectShareUrl(http, "production", publicId)).toBeNull();
    expect(buildProjectShareUrl(http, "production", "../invalid", "true")).toBeNull();
  });
  it("잘못된 설정의 readiness는 DB를 열지 않으며 허용 HTTP는 DB readiness를 확인한다", () => {
    for (const flag of [undefined, "false", "TRUE", ""]) {
      const factory = vi.fn();
      const result = checkConfiguredReadiness({ databasePath: "/data/test.sqlite3", applicationBaseUrl: http, environment: "production", allowInsecureHttp: flag, migrationsDirectory, openDatabase: factory });
      expect(result.status).toBe("unavailable");
      expect(factory).not.toHaveBeenCalled();
    }
    const database = openDatabase({ filename: ":memory:", migrationsDirectory }).database;
    const factory = vi.fn(() => database);
    const result = checkConfiguredReadiness({ databasePath: "/data/test.sqlite3", applicationBaseUrl: http, environment: "production", allowInsecureHttp: "true", migrationsDirectory, openDatabase: factory });
    expect(result.status).toBe("ok");
    expect(factory).toHaveBeenCalledOnce();
  });
});

describe.each([http, https])("Issue #8 쿠키 수명주기 %s", (origin) => {
  const url = parseApplicationBaseUrl(origin, "production", "true");
  const secure = url.protocol === "https:";
  const name = secure ? "__Host-mastergantt_edit" : "mastergantt_edit";
  const other = secure ? "mastergantt_edit" : "__Host-mastergantt_edit";
  it("발급·조회·만료가 같은 이름과 보안 속성을 사용한다", () => {
    const issued = serializeEditSessionCookie(token, url, "production");
    expect(issued.startsWith(`${name}=`)).toBe(true);
    for (const attribute of ["Path=/", "HttpOnly", "SameSite=Strict", `Max-Age=${EDIT_SESSION_TTL_SECONDS}`]) expect(issued).toContain(attribute);
    expect(issued.includes("; Secure")).toBe(secure);
    expect(issued).not.toContain("Domain=");
    expect(parseEditSessionCookie(`${name}=${token}`, "production", url)).toEqual({ state: "present", rawToken: token });
    expect(parseEditSessionCookie(`${other}=${token}`, "production", url)).toEqual({ state: "absent" });
    expect(parseEditSessionCookie(`${name}=${token};${name}=${token}`, "production", url)).toEqual({ state: "malformed" });
    const expired = serializeExpiredEditSessionCookie(url, "production");
    expect(expired.startsWith(`${name}=;`)).toBe(true);
    expect(expired).toContain("Max-Age=0");
    expect(expired.includes("; Secure")).toBe(secure);
    expect(expired).not.toContain("Domain=");
  });
});

it("HTTP Handler → Service → SQLite에서 CRUD와 세션 만료·Origin·revision 보호를 유지한다", async () => {
  const database = openDatabase({ filename: ":memory:", migrationsDirectory }).database;
  let now = new Date("2026-09-14T01:00:00Z");
  const service = new ProjectService(database, { clock: () => now });
  const config = { applicationBaseUrl: http, environment: "production", allowInsecureHttp: "true", service };
  const request = (path: string, method: string, body?: unknown, cookie?: string, revision = 1, origin = http) => new Request(`${http}${path}`, {
    method,
    headers: { Origin: origin, "Content-Type": "application/json", "If-Match": `"${revision}"`, ...(cookie ? { Cookie: cookie } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  try {
    const password = "Http123456!";
    const response = await handleCreateProject(request("/api/projects", "POST", { name: "HTTP integration", description: "", ownerName: "HTTP Test Owner", editPassword: password }), { ...config, rateLimiter: new FixedWindowRateLimiter(20, 60_000) });
    expect(response.status).toBe(201);
    const body = await response.json() as CreateProjectResponse;
    const id = body.data.project.publicId;
    const api = `/api/projects/${id}`;
    const cookie = response.headers.get("set-cookie")!.split(";")[0];
    expect(cookie.startsWith("mastergantt_edit=")).toBe(true);
    const current = handleCurrentEditSession(request(`${api}/edit-sessions/current`, "GET", undefined, cookie), id, config);
    expect((await current.json()).data.permission).toBe("edit");
    const taskInput = { externalId: "HTTP-1", name: "HTTP task", type: "task", start: "2026-09-14", duration: 1, progress: 0 };
    const created = await handleCreateTask(request(`${api}/tasks`, "POST", taskInput, cookie), id, config);
    expect(created.status).toBe(201);
    const task = (await created.json() as TaskMutationResponse).data.tasks[0];
    expect((await handleUpdateTask(request(`${api}/tasks/${task.taskId}`, "PATCH", { name: "wrong-origin" }, cookie, 2, "http://evil.test"), id, task.taskId, config)).status).toBe(403);
    expect((await handleUpdateTask(request(`${api}/tasks/${task.taskId}`, "PATCH", { name: "stale" }, cookie, 1), id, task.taskId, config)).status).toBe(412);
    expect((await handleUpdateTask(request(`${api}/tasks/${task.taskId}`, "PATCH", { name: "saved" }, cookie, 2), id, task.taskId, config)).status).toBe(200);
    expect((await handleUpdateProject(request(api, "PATCH", { name: "Updated project" }, cookie, 3), id, config)).status).toBe(200);
    expect(handleDeleteTask(request(`${api}/tasks/${task.taskId}`, "DELETE", undefined, cookie, 4), id, task.taskId, config).status).toBe(200);
    now = new Date(now.getTime() + (EDIT_SESSION_TTL_SECONDS + 1) * 1000);
    const expired = handleCurrentEditSession(request(`${api}/edit-sessions/current`, "GET", undefined, cookie), id, config);
    expect((await expired.json()).data.permission).toBe("readonly");
    expect((await handleUpdateProject(request(api, "PATCH", { name: "expired" }, cookie, 5), id, config)).status).toBe(401);
    const unlocked = await handleUnlockProject(request(`${api}/edit-sessions`, "POST", { editPassword: password }), id, { ...config, globalRateLimiter: new FixedWindowRateLimiter(20, 1000), projectRateLimiter: new FixedWindowRateLimiter(20, 1000) });
    expect(unlocked.status).toBe(204);
    const fresh = unlocked.headers.get("set-cookie")!.split(";")[0];
    const loggedOut = handleLogoutProject(request(`${api}/edit-sessions/current`, "DELETE", undefined, fresh), id, config);
    expect(loggedOut.status).toBe(204);
    expect(loggedOut.headers.get("set-cookie")).toContain("mastergantt_edit=; Max-Age=0");
    expect(handleDeleteProject(request(api, "DELETE", undefined, fresh, 5), id, config).status).toBe(401);
    expect(database.prepare("SELECT COUNT(*) AS n FROM tasks").get()).toEqual({ n: 0 });
  } finally {
    database.close();
  }
});
