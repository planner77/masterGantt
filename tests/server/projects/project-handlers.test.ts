import { describe, expect, it, vi } from "vitest";

import type {
  CreateProjectResponse,
  ProjectListResponse,
  ProjectSnapshotResponse,
} from "../../../src/contracts/projects";
import {
  handleCreateProject,
  handleProjectCollectionGet,
  handleReadProject,
  type CreateProjectHandlerDependencies,
} from "../../../src/server/projects/project-handlers-core";
import { PasswordHashCapacityError } from "../../../src/server/security/password-core";
import { FixedWindowRateLimiter } from "../../../src/server/security/rate-limit-core";

const publicId = "2fd0c93f-cd37-4b68-9f09-412239d99c79";
const createResponse: CreateProjectResponse = {
  data: {
    project: {
      publicId,
      name: "Plant Expansion",
      description: "Phase 1",
      ownerName: "Plant Owner",
      revision: 1,
      calendar: {
        timezone: "Asia/Seoul",
        weekendDays: [6, 0],
        holidays: [],
      },
    },
    permission: "edit",
  },
};
const readonlyResponse: ProjectSnapshotResponse = {
  data: {
    project: createResponse.data.project,
    tasks: [],
    links: [],
    permission: "readonly",
  },
};
const listResponse: ProjectListResponse = {
  data: {
    projects: [
      {
        publicId,
        name: "Plant Expansion",
        description: "Phase 1",
        ownerName: "Plant Owner",
        createdAt: "2026-09-11T01:00:00.000Z",
        updatedAt: "2026-09-12T01:00:00.000Z",
      },
    ],
  },
};

function request(
  body: BodyInit = JSON.stringify({
    name: "Plant Expansion",
    description: "Phase 1",
    ownerName: "Plant Owner",
    editPassword: "password phrase",
  }),
  headers: HeadersInit = {},
): Request {
  return new Request("https://gantt.example.com/api/projects", {
    method: "POST",
    headers: {
      Origin: "https://gantt.example.com",
      "Content-Type": "application/json",
      ...headers,
    },
    body,
  });
}

function dependencies(
  overrides: Partial<CreateProjectHandlerDependencies> = {},
): CreateProjectHandlerDependencies {
  return {
    service: {
      create: vi.fn(async () => ({
        response: createResponse,
        rawSessionToken: "A".repeat(43),
      })),
      getReadonlySnapshot: vi.fn(() => readonlyResponse),
    },
    rateLimiter: new FixedWindowRateLimiter(5, 60 * 60 * 1_000),
    applicationBaseUrl: "https://gantt.example.com",
    environment: "production",
    requestId: () => "request-id",
    ...overrides,
  };
}

async function errorBody(response: Response) {
  return response.json() as Promise<{
    error: {
      code: string;
      message: string;
      details: unknown[];
      requestId: string;
    };
  }>;
}

describe("POST /api/projects handler", () => {
  it("returns the public contract, headers, and a hardened production cookie", async () => {
    const response = await handleCreateProject(request(), dependencies());

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual(createResponse);
    expect(response.headers.get("location")).toBe(`/projects/${publicId}`);
    expect(response.headers.get("etag")).toBe('"1"');
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("content-type")).toBe(
      "application/json; charset=utf-8",
    );
    const cookie = response.headers.get("set-cookie") ?? "";
    expect(cookie).toContain(`__Host-mastergantt_edit=${"A".repeat(43)}`);
    expect(cookie).toContain("Path=/");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Strict");
    expect(cookie).toContain("Max-Age=28800");
    expect(cookie).toContain("Secure");
    expect(cookie).not.toContain("Domain=");
  });

  it.each([
    [undefined, "missing"],
    ["null", "null"],
    ["http://gantt.example.com", "scheme"],
    ["https://evil.example.com", "host"],
    ["https://gantt.example.com:444", "port"],
    ["https://gantt.example.com, https://evil.example.com", "multiple"],
  ])("rejects %s origin (%s)", async (origin, label) => {
    void label;
    const headers: HeadersInit = { "Content-Type": "application/json" };
    if (origin !== undefined) {
      Object.assign(headers, { Origin: origin });
    }
    const response = await handleCreateProject(
      new Request("https://gantt.example.com/api/projects", {
        method: "POST",
        headers,
        body: "{}",
      }),
      dependencies(),
    );

    expect(response.status).toBe(403);
    expect((await errorBody(response)).error).toMatchObject({
      code: "ORIGIN_NOT_ALLOWED",
      requestId: "request-id",
    });
  });

  it("maps malformed JSON, schema, media type, and both body limits", async () => {
    const cases = [
      {
        request: request("{"),
        status: 400,
        code: "INVALID_JSON",
      },
      {
        request: request(JSON.stringify({
          name: "Name",
          ownerName: "Owner",
          description: "",
          editPassword: "password phrase",
          secretExtra: "must not echo",
        })),
        status: 400,
        code: "INVALID_REQUEST",
      },
      {
        request: request("{}", { "Content-Type": "text/plain" }),
        status: 415,
        code: "UNSUPPORTED_MEDIA_TYPE",
      },
      {
        request: request("{}", { "Content-Length": "32769" }),
        status: 413,
        code: "REQUEST_TOO_LARGE",
      },
      {
        request: request(new Uint8Array(32 * 1_024 + 1)),
        status: 413,
        code: "REQUEST_TOO_LARGE",
      },
    ];

    for (const testCase of cases) {
      const response = await handleCreateProject(
        testCase.request,
        dependencies(),
      );
      const body = await errorBody(response);
      expect(response.status).toBe(testCase.status);
      expect(body.error.code).toBe(testCase.code);
      expect(JSON.stringify(body)).not.toContain("must not echo");
    }
  });

  it("limits all unattributed callers to five valid attempts per hour", async () => {
    const service = {
      create: vi.fn(async () => ({
        response: createResponse,
        rawSessionToken: "A".repeat(43),
      })),
      getReadonlySnapshot: vi.fn(() => readonlyResponse),
    };
    const deps = dependencies({
      service,
      rateLimiter: new FixedWindowRateLimiter(5, 60 * 60 * 1_000),
    });

    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect((await handleCreateProject(request(), deps)).status).toBe(201);
    }
    const rejected = await handleCreateProject(request(), deps);
    expect(rejected.status).toBe(429);
    expect(rejected.headers.get("retry-after")).toBeTruthy();
    expect((await errorBody(rejected)).error.code).toBe("RATE_LIMITED");
    expect(service.create).toHaveBeenCalledTimes(5);
  });

  it("maps KDF capacity and configuration failures without exposing internals", async () => {
    const capacity = dependencies({
      service: {
        create: vi.fn(async () => {
          throw new PasswordHashCapacityError();
        }),
        getReadonlySnapshot: vi.fn(() => readonlyResponse),
      },
    });
    const busy = await handleCreateProject(request(), capacity);
    expect(busy.status).toBe(429);
    expect(busy.headers.get("retry-after")).toBe("1");

    const badConfiguration = await handleCreateProject(
      request(),
      dependencies({ applicationBaseUrl: "/private/path" }),
    );
    expect(badConfiguration.status).toBe(500);
    const body = await errorBody(badConfiguration);
    expect(body.error.code).toBe("CONFIGURATION_ERROR");
    expect(JSON.stringify(body)).not.toContain("/private/path");
  });

  it("sanitizes unexpected errors and never returns submitted secrets", async () => {
    const password = "do not expose this password";
    const response = await handleCreateProject(
      request(JSON.stringify({
        name: "Name",
        ownerName: "Owner",
        description: "",
        editPassword: password,
      })),
      dependencies({
        service: {
          create: vi.fn(async () => {
            throw new Error(
              `SQLITE failure /data/private.sqlite3 password=${password}`,
            );
          }),
          getReadonlySnapshot: vi.fn(() => readonlyResponse),
        },
      }),
    );
    const body = await errorBody(response);

    expect(response.status).toBe(500);
    expect(body.error).toEqual({
      code: "INTERNAL_ERROR",
      message: "The request could not be completed.",
      details: [],
      requestId: "request-id",
    });
    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain(password);
    expect(serialized).not.toContain("SQLITE");
    expect(serialized).not.toContain("/data");
  });

  it("resolves database dependencies inside the sanitized handler boundary", async () => {
    const response = await handleCreateProject(
      request(),
      dependencies({
        service: () => {
          throw new Error("DATABASE_PATH=/data/private.sqlite3");
        },
      }),
    );
    const body = await errorBody(response);
    expect(response.status).toBe(500);
    expect(body.error.code).toBe("INTERNAL_ERROR");
    expect(JSON.stringify(body)).not.toContain("DATABASE_PATH");
    expect(JSON.stringify(body)).not.toContain("/data");
  });
});

describe("readonly and collection GET handlers", () => {
  it("returns readonly data with ETag and never mutates state", async () => {
    const getReadonlySnapshot = vi.fn(() => readonlyResponse);
    const response = handleReadProject(publicId, {
      service: { getReadonlySnapshot },
      requestId: () => "request-id",
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("etag")).toBe('"1"');
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("content-type")).toBe(
      "application/json; charset=utf-8",
    );
    expect(await response.json()).toEqual(readonlyResponse);
    expect(getReadonlySnapshot).toHaveBeenCalledOnce();
  });

  it("returns the same sanitized 404 for malformed and absent IDs", async () => {
    const getReadonlySnapshot = vi.fn(() => undefined);
    const malformed = handleReadProject("NOT-A-UUID", {
      service: { getReadonlySnapshot },
      requestId: () => "request-id",
    });
    const absent = handleReadProject(publicId, {
      service: { getReadonlySnapshot },
      requestId: () => "request-id",
    });

    expect(malformed.status).toBe(404);
    expect(absent.status).toBe(404);
    expect(await malformed.json()).toEqual(await absent.json());
    expect(getReadonlySnapshot).toHaveBeenCalledOnce();
  });

  it("returns the public project list without requiring authentication", async () => {
    const listProjects = vi.fn(() => listResponse);
    const response = handleProjectCollectionGet({
      service: { listProjects },
      requestId: () => "request-id",
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("content-type")).toBe(
      "application/json; charset=utf-8",
    );
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(await response.json()).toEqual(listResponse);
    expect(listProjects).toHaveBeenCalledOnce();
  });

  it("allows an empty project list", async () => {
    const response = handleProjectCollectionGet({
      service: { listProjects: () => ({ data: { projects: [] } }) },
      requestId: () => "request-id",
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: { projects: [] } });
  });

  it("sanitizes project list failures and keeps them uncached", async () => {
    const response = handleProjectCollectionGet({
      service: () => {
        throw new Error("SQLITE failure /data/private.sqlite3");
      },
      requestId: () => "request-id",
    });
    const body = await errorBody(response);

    expect(response.status).toBe(500);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(body.error).toEqual({
      code: "INTERNAL_ERROR",
      message: "The request could not be completed.",
      details: [],
      requestId: "request-id",
    });
    expect(JSON.stringify(body)).not.toContain("SQLITE");
    expect(JSON.stringify(body)).not.toContain("/data");
  });
});
