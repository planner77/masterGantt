import { readFileSync, readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";

import { describe, expect, it, vi } from "vitest";

import type {
  CurrentEditSessionResponse,
  ProjectMetadataMutationResponse,
} from "../../../src/contracts/projects";
import {
  handleChangeEditPassword,
  handleCurrentEditSession,
  handleLogoutProject,
  handleUnlockProject,
} from "../../../src/server/projects/edit-session-handlers-core";
import {
  handleDeleteProject,
  handleUpdateProject,
} from "../../../src/server/projects/project-handlers-core";
import {
  RevisionMismatchError,
  type AuthorizationResult,
  type AuthorizedEditSession,
} from "../../../src/server/projects/project-service-core";
import { PasswordHashCapacityError } from "../../../src/server/security/password-core";
import { FixedWindowRateLimiter } from "../../../src/server/security/rate-limit-core";
import {
  NEXT_AUTOMATIC_METHOD_SECURITY,
  ROUTE_SECURITY_INVENTORY,
} from "../../../src/server/security/route-security-inventory";

const publicId = "2fd0c93f-cd37-4b68-9f09-412239d99c79";
const rawToken = "A".repeat(43);
const cookie = `__Host-mastergantt_edit=${rawToken}`;
const authorization: AuthorizedEditSession = {
  projectId: 1,
  projectPublicId: publicId,
  projectRevision: 1,
  projectAuthVersion: 1,
  sessionId: 1,
  tokenHash: Buffer.alloc(32, 1),
  expiresAt: "2026-09-11T09:00:00.000Z",
};
const authorized: AuthorizationResult = { kind: "authorized", authorization };
const mutationResponse: ProjectMetadataMutationResponse = {
  data: {
    project: {
      publicId,
      name: "Updated",
      description: "Description",
      revision: 2,
      calendar: { timezone: "Asia/Seoul", weekendDays: [6, 0], holidays: [] },
    },
    tasks: [],
    links: [],
    warnings: [],
    operation: { kind: "projectMetadata", changedFields: ["name"] },
  },
};

function jsonRequest(
  path: string,
  method: string,
  body: unknown,
  headers: HeadersInit = {},
): Request {
  return new Request(`https://gantt.example.com${path}`, {
    method,
    headers: {
      Origin: "https://gantt.example.com",
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

function service(overrides: Record<string, unknown> = {}) {
  return {
    unlock: vi.fn(async () => ({ rawSessionToken: rawToken })),
    getCurrentEditSession: vi.fn((): CurrentEditSessionResponse => ({
      data: { permission: "edit", expiresAt: authorization.expiresAt },
    })),
    authorize: vi.fn((): AuthorizationResult => authorized),
    updateMetadata: vi.fn(() => mutationResponse),
    deleteProject: vi.fn(),
    rotatePassword: vi.fn(async () => ({ rawSessionToken: rawToken, revision: 2 })),
    logout: vi.fn(() => ({ kind: "clearCookie" as const })),
    ...overrides,
  };
}

async function error(response: Response) {
  return response.json() as Promise<{ error: { code: string; message: string; details: unknown[]; requestId: string } }>;
}

const common = {
  applicationBaseUrl: "https://gantt.example.com",
  environment: "production",
  requestId: () => "request-id",
};

describe("W05 edit session handlers", () => {
  it("unlocks with bounded rate checks and emits only a hardened cookie", async () => {
    const api = service();
    const response = await handleUnlockProject(
      jsonRequest(`/api/projects/${publicId}/edit-sessions`, "POST", { editPassword: "password phrase" }),
      publicId,
      {
        ...common,
        service: api,
        globalRateLimiter: new FixedWindowRateLimiter(50, 1_000, 1),
        projectRateLimiter: new FixedWindowRateLimiter(10, 1_000, 10),
      },
    );
    expect(response.status).toBe(204);
    expect(await response.text()).toBe("");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("set-cookie")).toContain(`__Host-mastergantt_edit=${rawToken}`);
    expect(JSON.stringify([...response.headers])).not.toContain("password phrase");
  });

  it("returns identical generic errors for wrong and unknown credentials", async () => {
    const deps = {
      ...common,
      service: service({ unlock: vi.fn(async () => undefined) }),
      globalRateLimiter: new FixedWindowRateLimiter(50, 1_000, 1),
      projectRateLimiter: new FixedWindowRateLimiter(10, 1_000, 10),
    };
    const wrong = await handleUnlockProject(
      jsonRequest(`/api/projects/${publicId}/edit-sessions`, "POST", { editPassword: "wrong" }),
      publicId,
      deps,
    );
    const unknown = await handleUnlockProject(
      jsonRequest(`/api/projects/${publicId}/edit-sessions`, "POST", { editPassword: "wrong" }),
      "11111111-1111-4111-8111-111111111111",
      deps,
    );
    expect(wrong.status).toBe(401);
    expect(await wrong.json()).toEqual(await unknown.json());
  });

  it("checks configuration/origin and input before KDF or rate-limited service work", async () => {
    const api = service();
    const global = { consume: vi.fn(() => ({ allowed: true, retryAfterSeconds: 0 })) };
    const rejectedOrigin = await handleUnlockProject(
      jsonRequest(`/api/projects/${publicId}/edit-sessions`, "POST", { editPassword: "password" }, { Origin: "https://evil.test" }),
      publicId,
      { ...common, service: api, globalRateLimiter: global, projectRateLimiter: global },
    );
    expect(rejectedOrigin.status).toBe(403);
    expect(global.consume).not.toHaveBeenCalled();
    expect(api.unlock).not.toHaveBeenCalled();

    const invalidInput = await handleUnlockProject(
      jsonRequest(`/api/projects/${publicId}/edit-sessions`, "POST", { editPassword: 1 }),
      publicId,
      { ...common, service: api, globalRateLimiter: global, projectRateLimiter: global },
    );
    expect(invalidInput.status).toBe(400);
    expect(global.consume).not.toHaveBeenCalled();
  });

  it("enforces both unlock limits and maps KDF capacity", async () => {
    const rejected = { consume: () => ({ allowed: false, retryAfterSeconds: 9 }) };
    const allowed = { consume: () => ({ allowed: true, retryAfterSeconds: 0 }) };
    const globalResponse = await handleUnlockProject(
      jsonRequest(`/api/projects/${publicId}/edit-sessions`, "POST", { editPassword: "x" }),
      publicId,
      { ...common, service: service(), globalRateLimiter: rejected, projectRateLimiter: allowed },
    );
    expect(globalResponse.status).toBe(429);
    expect(globalResponse.headers.get("retry-after")).toBe("9");
    const projectResponse = await handleUnlockProject(
      jsonRequest(`/api/projects/${publicId}/edit-sessions`, "POST", { editPassword: "x" }),
      publicId,
      { ...common, service: service(), globalRateLimiter: allowed, projectRateLimiter: rejected },
    );
    expect(projectResponse.status).toBe(429);

    const busy = await handleUnlockProject(
      jsonRequest(`/api/projects/${publicId}/edit-sessions`, "POST", { editPassword: "x" }),
      publicId,
      {
        ...common,
        service: service({ unlock: vi.fn(async () => { throw new PasswordHashCapacityError(); }) }),
        globalRateLimiter: allowed,
        projectRateLimiter: allowed,
      },
    );
    expect(busy.status).toBe(429);
    expect(busy.headers.get("retry-after")).toBe("1");
  });

  it("current GET reports only permission/expiry and never changes cookies", async () => {
    const api = service();
    const response = handleCurrentEditSession(
      new Request(`https://gantt.example.com/api/projects/${publicId}/edit-sessions/current`, { headers: { Cookie: cookie } }),
      publicId,
      { ...common, service: api },
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: { permission: "edit", expiresAt: authorization.expiresAt } });
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(api.getCurrentEditSession).toHaveBeenCalledWith(publicId, rawToken);
  });

  it("logout clears malformed/unmatched cookies but preserves a demonstrably cross-project cookie", () => {
    const malformed = handleLogoutProject(
      new Request(`https://gantt.example.com/api/projects/${publicId}/edit-sessions/current`, {
        method: "DELETE",
        headers: { Origin: "https://gantt.example.com", Cookie: "__Host-mastergantt_edit=bad" },
      }),
      publicId,
      { ...common, service: service() },
    );
    expect(malformed.status).toBe(204);
    expect(malformed.headers.get("set-cookie")).toContain("Max-Age=0");

    const cross = handleLogoutProject(
      new Request(`https://gantt.example.com/api/projects/${publicId}/edit-sessions/current`, {
        method: "DELETE",
        headers: { Origin: "https://gantt.example.com", Cookie: cookie },
      }),
      publicId,
      { ...common, service: service({ logout: vi.fn(() => ({ kind: "preserveCookie" as const })) }) },
    );
    expect(cross.status).toBe(204);
    expect(cross.headers.get("set-cookie")).toBeNull();
  });
});

describe("W05 protected project handlers", () => {
  it("returns canonical metadata mutation data, ETag, and no permission assertion", async () => {
    const response = await handleUpdateProject(
      jsonRequest(`/api/projects/${publicId}`, "PATCH", { name: "Updated" }, { Cookie: cookie, "If-Match": '"1"' }),
      publicId,
      { ...common, service: service() },
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("etag")).toBe('"2"');
    expect(await response.json()).toEqual(mutationResponse);
    expect(JSON.stringify(mutationResponse)).not.toContain("permission");
  });

  it("uses input, session, If-Match, and stale error priority", async () => {
    const api = service({ authorize: vi.fn(() => ({ kind: "unauthorized" as const })) });
    const invalid = await handleUpdateProject(
      jsonRequest(`/api/projects/${publicId}`, "PATCH", {}, {}),
      publicId,
      { ...common, service: api },
    );
    expect(invalid.status).toBe(400);
    expect(api.authorize).not.toHaveBeenCalled();

    const noSession = await handleUpdateProject(
      jsonRequest(`/api/projects/${publicId}`, "PATCH", { name: "X" }),
      publicId,
      { ...common, service: api },
    );
    expect(noSession.status).toBe(401);
    expect((await error(noSession)).error.code).toBe("EDIT_SESSION_REQUIRED");

    const missing = await handleUpdateProject(
      jsonRequest(`/api/projects/${publicId}`, "PATCH", { name: "X" }, { Cookie: cookie }),
      publicId,
      { ...common, service: service() },
    );
    expect(missing.status).toBe(428);
    const malformed = await handleUpdateProject(
      jsonRequest(`/api/projects/${publicId}`, "PATCH", { name: "X" }, { Cookie: cookie, "If-Match": "1" }),
      publicId,
      { ...common, service: service() },
    );
    expect(malformed.status).toBe(400);
    const stale = await handleUpdateProject(
      jsonRequest(`/api/projects/${publicId}`, "PATCH", { name: "X" }, { Cookie: cookie, "If-Match": '"1"' }),
      publicId,
      { ...common, service: service({ updateMetadata: vi.fn(() => { throw new RevisionMismatchError(); }) }) },
    );
    expect(stale.status).toBe(412);
  });

  it("deletes with a bodyless 204, no-store, and an expired edit cookie", async () => {
    const api = service();
    const response = handleDeleteProject(
      new Request(`https://gantt.example.com/api/projects/${publicId}`, {
        method: "DELETE",
        headers: {
          Origin: "https://gantt.example.com",
          Cookie: cookie,
          "If-Match": '"1"',
        },
      }),
      publicId,
      { ...common, service: api },
    );

    expect(response.status).toBe(204);
    expect(await response.text()).toBe("");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
    expect(api.deleteProject).toHaveBeenCalledWith(authorization, 1);
  });

  it("rejects delete for bad origin, missing target/session, precondition, and stale revision", async () => {
    const request = (headers: HeadersInit = {}) => new Request(
      `https://gantt.example.com/api/projects/${publicId}`,
      {
        method: "DELETE",
        headers: {
          Origin: "https://gantt.example.com",
          Cookie: cookie,
          "If-Match": '"1"',
          ...headers,
        },
      },
    );
    const forbiddenApi = service();
    const forbidden = handleDeleteProject(
      request({ Origin: "https://evil.test" }),
      publicId,
      { ...common, service: forbiddenApi },
    );
    expect(forbidden.status).toBe(403);
    expect(forbiddenApi.authorize).not.toHaveBeenCalled();

    const missingProject = handleDeleteProject(request(), publicId, {
      ...common,
      service: service({ authorize: vi.fn(() => ({ kind: "projectNotFound" as const })) }),
    });
    expect(missingProject.status).toBe(404);

    const unauthenticatedApi = service({
      authorize: vi.fn(() => ({ kind: "unauthorized" as const })),
    });
    const unauthenticated = handleDeleteProject(
      request({ Cookie: "" }),
      publicId,
      { ...common, service: unauthenticatedApi },
    );
    expect(unauthenticated.status).toBe(401);
    expect(unauthenticatedApi.deleteProject).not.toHaveBeenCalled();

    const missingIfMatch = handleDeleteProject(
      request({ "If-Match": "" }),
      publicId,
      { ...common, service: service() },
    );
    expect(missingIfMatch.status).toBe(400);
    const noIfMatch = new Request(
      `https://gantt.example.com/api/projects/${publicId}`,
      { method: "DELETE", headers: { Origin: "https://gantt.example.com", Cookie: cookie } },
    );
    expect(handleDeleteProject(noIfMatch, publicId, {
      ...common,
      service: service(),
    }).status).toBe(428);

    const stale = handleDeleteProject(request(), publicId, {
      ...common,
      service: service({
        deleteProject: vi.fn(() => { throw new RevisionMismatchError(); }),
      }),
    });
    expect(stale.status).toBe(412);
  });

  it("rotates with a bodyless 204, new ETag/cookie, and capacity mapping", async () => {
    const response = await handleChangeEditPassword(
      jsonRequest(`/api/projects/${publicId}/edit-password`, "PUT", { newEditPassword: "new password phrase" }, { Cookie: cookie, "If-Match": '"1"' }),
      publicId,
      { ...common, service: service() },
    );
    expect(response.status).toBe(204);
    expect(await response.text()).toBe("");
    expect(response.headers.get("etag")).toBe('"2"');
    expect(response.headers.get("set-cookie")).toContain(rawToken);

    const busy = await handleChangeEditPassword(
      jsonRequest(`/api/projects/${publicId}/edit-password`, "PUT", { newEditPassword: "new password phrase" }, { Cookie: cookie, "If-Match": '"1"' }),
      publicId,
      { ...common, service: service({ rotatePassword: vi.fn(async () => { throw new PasswordHashCapacityError(); }) }) },
    );
    expect(busy.status).toBe(429);
  });

  it.each([
    ["PATCH", "metadata"],
    ["PUT", "password"],
    ["DELETE", "logout"],
  ])("rejects cross Origin for %s %s before service access", async (method) => {
    const api = service();
    const request = jsonRequest(`/api/projects/${publicId}`, method, method === "PUT" ? { newEditPassword: "new password phrase" } : { name: "X" }, {
      Origin: "https://evil.test",
      Cookie: cookie,
      "If-Match": '"1"',
    });
    const response = method === "PATCH"
      ? await handleUpdateProject(request, publicId, { ...common, service: api })
      : method === "PUT"
        ? await handleChangeEditPassword(request, publicId, { ...common, service: api })
        : handleLogoutProject(request, publicId, { ...common, service: api });
    expect(response.status).toBe(403);
    expect(api.authorize).not.toHaveBeenCalled();
    expect(api.logout).not.toHaveBeenCalled();
  });
});

describe("route security inventory", () => {
  it("enumerates every explicit route/method and maps state-changing methods to a policy", () => {
    expect(ROUTE_SECURITY_INVENTORY.map(({ template, method }) => `${method} ${template}`)).toEqual([
      "GET /api/health/live",
      "GET /api/health/ready",
      "GET /api/projects",
      "POST /api/projects",
      "GET /api/projects/{publicId}",
      "PATCH /api/projects/{publicId}",
      "DELETE /api/projects/{publicId}",
      "POST /api/projects/{publicId}/copy",
      "POST /api/projects/{publicId}/exports/excel",
      "POST /api/projects/{publicId}/edit-sessions",
      "GET /api/projects/{publicId}/edit-sessions/current",
      "DELETE /api/projects/{publicId}/edit-sessions/current",
      "PUT /api/projects/{publicId}/edit-password",
      "POST /api/projects/{publicId}/tasks",
      "PATCH /api/projects/{publicId}/tasks/{taskId}",
      "DELETE /api/projects/{publicId}/tasks/{taskId}",
      "POST /api/resource-catalog/admin-sessions",
      "DELETE /api/resource-catalog/admin-sessions",
      "GET /api/resources",
      "POST /api/resources",
      "PATCH /api/resources/{resourceId}",
      "GET /api/resource-groups",
      "POST /api/resource-groups",
      "PATCH /api/resource-groups/{groupId}",
      "PUT /api/resource-groups/{groupId}/members",
      "GET /api/projects/{publicId}/assignment-targets",
      "GET /api/projects/{publicId}/assigned-targets",
      "GET /api/projects/{publicId}/resource-workload",
      "GET /api/work-calendars/countries",
      "GET /api/projects/{publicId}/work-calendar",
      "POST /api/projects/{publicId}/work-calendar/preview",
      "PUT /api/projects/{publicId}/work-calendar",
      "PUT /api/projects/{publicId}/tasks/{taskId}/assignments",
    ]);
    for (const route of ROUTE_SECURITY_INVENTORY.filter(({ mutatesState }) => mutatesState)) {
      expect(route.method).not.toBe("GET");
      expect(route.policy).not.toBe("public-read");
    }
    expect(ROUTE_SECURITY_INVENTORY.filter(({ method }) => method === "GET").every(({ mutatesState }) => !mutatesState))
      .toBe(true);
    expect(ROUTE_SECURITY_INVENTORY.find(({ template }) => template === "/api/projects/{publicId}/exports/excel"))
      .toMatchObject({ method: "POST", policy: "origin-if-match-read", mutatesState: false });
  });

  it("matches the exported methods in every API route source", () => {
    const apiRoot = join(process.cwd(), "src", "app", "api");
    const routeFiles = readdirSync(apiRoot, { recursive: true, withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name === "route.ts")
      .map((entry) => join(entry.parentPath, entry.name));
    const actual: string[] = [];
    for (const filename of routeFiles) {
      const relativePath = relative(apiRoot, filename).split(sep).join("/");
      const template = `/api/${relativePath
        .replace(/\/route\.ts$/, "")
        .replace(/\[([^\]]+)\]/g, "{$1}")}`;
      const source = readFileSync(filename, "utf8");
      for (const match of source.matchAll(/export (?:(?:async )?function (GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b|const (GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b)/g)) {
        actual.push(`${match[1] ?? match[2]} ${template}`);
      }
    }
    actual.sort();
    const inventoried = ROUTE_SECURITY_INVENTORY
      .map(({ method, template }) => `${method} ${template}`)
      .sort();
    expect(inventoried).toEqual(actual);
    expect(Object.fromEntries(ROUTE_SECURITY_INVENTORY.map((route) => [
      `${route.method} ${route.template}`,
      route.policy,
    ]))).toMatchObject({
      "GET /api/projects": "public-read",
      "POST /api/projects": "origin-and-create-limit",
      "PATCH /api/projects/{publicId}": "origin-session-if-match",
      "DELETE /api/projects/{publicId}": "origin-session-if-match",
      "POST /api/projects/{publicId}/exports/excel": "origin-if-match-read",
      "POST /api/projects/{publicId}/edit-sessions": "origin-and-password-limit",
      "DELETE /api/projects/{publicId}/edit-sessions/current": "origin-and-target-logout",
      "PUT /api/projects/{publicId}/edit-password": "origin-session-if-match",
      "POST /api/projects/{publicId}/tasks": "origin-session-if-match",
      "PATCH /api/projects/{publicId}/tasks/{taskId}": "origin-session-if-match",
      "DELETE /api/projects/{publicId}/tasks/{taskId}": "origin-session-if-match",
    });
  });

  it("documents framework HEAD/OPTIONS as stateless and without credentialed CORS", () => {
    expect(NEXT_AUTOMATIC_METHOD_SECURITY.HEAD).toContain("stateless");
    expect(NEXT_AUTOMATIC_METHOD_SECURITY.OPTIONS).toContain("no credentialed CORS");
  });
});