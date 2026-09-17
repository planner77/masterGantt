import { afterEach, describe, expect, it, vi } from "vitest";

import {
  handleUnlockResourceCatalogAdmin,
  type ResourceAdminAuthDiagnosticEntry,
  type ResourceAdminAuthDiagnosticLogger,
  type ResourceHandlerDependencies,
} from "../../../src/server/resources/resource-catalog-handlers-core";
import type { ResourceCatalogService } from "../../../src/server/resources/resource-catalog-service-core";

const APP_ORIGIN = "http://localhost:3000";
const ENDPOINT = `${APP_ORIGIN}/api/resource-catalog/admin-sessions`;
const CORRECT_PASSWORD = "correct-resource-admin-password";
const RAW_SESSION_TOKEN = "A".repeat(43);

interface HarnessOptions extends Partial<ResourceHandlerDependencies> {
  unlockAdmin?: (candidate: string, configuredPassword: string | undefined) => { rawToken: string; expiresAt: string } | undefined;
}

function createHarness(options: HarnessOptions = {}) {
  const entries: ResourceAdminAuthDiagnosticEntry[] = [];
  const logger: ResourceAdminAuthDiagnosticLogger = {
    info: (entry) => entries.push(entry),
    warn: (entry) => entries.push(entry),
    error: (entry) => entries.push(entry),
  };
  const service = {
    unlockAdmin: options.unlockAdmin ?? ((candidate: string, configuredPassword: string | undefined) => (
      candidate === configuredPassword
        ? { rawToken: RAW_SESSION_TOKEN, expiresAt: "2026-09-18T04:00:00.000Z" }
        : undefined
    )),
  } as unknown as ResourceCatalogService;

  const dependencies: ResourceHandlerDependencies = {
    resourceService: service,
    applicationBaseUrl: APP_ORIGIN,
    environment: "test",
    adminPassword: CORRECT_PASSWORD,
    requestId: () => "request-61",
    diagnosticNow: () => new Date("2026-09-17T20:30:00.000Z"),
    adminAuthLogger: logger,
    adminAuthConfigurationState: { logged: false },
    ...options,
  };

  return { dependencies, entries };
}

function request(
  body: string | object,
  options: { origin?: string; contentType?: string; cookie?: string; authorization?: string } = {},
): Request {
  const headers = new Headers({
    Origin: options.origin ?? APP_ORIGIN,
    "Content-Type": options.contentType ?? "application/json",
  });
  if (options.cookie) headers.set("Cookie", options.cookie);
  if (options.authorization) headers.set("Authorization", options.authorization);
  return new Request(ENDPOINT, {
    method: "POST",
    headers,
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function failure(entries: ResourceAdminAuthDiagnosticEntry[]) {
  return entries.find((entry) => entry.event === "resource_catalog_admin_auth_failed");
}

async function errorCode(response: Response): Promise<string | undefined> {
  const body = await response.json() as { error?: { code?: string; requestId?: string } };
  return body.error?.code;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("resource catalog administrator authentication diagnostics", () => {
  it("logs start, one-time configuration, success and completion with the API requestId", async () => {
    const { dependencies, entries } = createHarness();

    const response = await handleUnlockResourceCatalogAdmin(request({ password: CORRECT_PASSWORD }), dependencies);

    expect(response.status).toBe(201);
    expect(response.headers.get("set-cookie")).toContain("mastergantt_resource_admin=");
    expect(entries.map((entry) => entry.event)).toEqual([
      "resource_catalog_admin_auth_started",
      "resource_catalog_admin_auth_configuration",
      "resource_catalog_admin_auth_succeeded",
      "resource_catalog_admin_auth_completed",
    ]);
    expect(entries.every((entry) => entry.requestId === "request-61")).toBe(true);
    expect(entries.at(-1)).toMatchObject({
      level: "info",
      result: "success",
      reason_code: null,
      status: 201,
      configured: true,
      policyValid: true,
    });
    expect(JSON.stringify(entries)).not.toContain(RAW_SESSION_TOKEN);
  });

  it("classifies a password mismatch while keeping the public error generic", async () => {
    const { dependencies, entries } = createHarness();

    const response = await handleUnlockResourceCatalogAdmin(request({ password: "wrong-password-value" }), dependencies);

    expect(response.status).toBe(401);
    expect(await errorCode(response)).toBe("RESOURCE_ADMIN_AUTH_FAILED");
    expect(failure(entries)).toMatchObject({
      reason_code: "ADMIN_PASSWORD_MISMATCH",
      status: 401,
      configured: true,
      policyValid: true,
    });
  });

  it("distinguishes an unset administrator password without exposing it through the API", async () => {
    const { dependencies, entries } = createHarness({ adminPassword: undefined });

    const response = await handleUnlockResourceCatalogAdmin(request({ password: "candidate-password-value" }), dependencies);

    expect(response.status).toBe(401);
    expect(await errorCode(response)).toBe("RESOURCE_ADMIN_AUTH_FAILED");
    expect(failure(entries)).toMatchObject({
      reason_code: "ADMIN_PASSWORD_NOT_CONFIGURED",
      configured: false,
      policyValid: false,
    });
  });

  it("distinguishes a configured password that violates the minimum policy", async () => {
    const { dependencies, entries } = createHarness({ adminPassword: "too-short" });

    const response = await handleUnlockResourceCatalogAdmin(request({ password: "too-short" }), dependencies);

    expect(response.status).toBe(401);
    expect(await errorCode(response)).toBe("RESOURCE_ADMIN_AUTH_FAILED");
    expect(failure(entries)).toMatchObject({
      reason_code: "ADMIN_PASSWORD_POLICY_INVALID",
      configured: true,
      policyValid: false,
    });
  });

  it("classifies rejected origins", async () => {
    const { dependencies, entries } = createHarness();

    const response = await handleUnlockResourceCatalogAdmin(
      request({ password: CORRECT_PASSWORD }, { origin: "http://other-host:3000" }),
      dependencies,
    );

    expect(response.status).toBe(403);
    expect(await errorCode(response)).toBe("ORIGIN_NOT_ALLOWED");
    expect(failure(entries)).toMatchObject({ reason_code: "ORIGIN_NOT_ALLOWED", status: 403 });
  });

  it("normalizes malformed request bodies to INVALID_REQUEST diagnostics without changing the public API error", async () => {
    const { dependencies, entries } = createHarness();

    const response = await handleUnlockResourceCatalogAdmin(request("{"), dependencies);

    expect(response.status).toBe(400);
    expect(await errorCode(response)).toBe("INVALID_JSON");
    expect(failure(entries)).toMatchObject({ reason_code: "INVALID_REQUEST", status: 400 });
  });

  it("classifies application configuration errors", async () => {
    const { dependencies, entries } = createHarness({ applicationBaseUrl: undefined });

    const response = await handleUnlockResourceCatalogAdmin(request({ password: CORRECT_PASSWORD }), dependencies);

    expect(response.status).toBe(500);
    expect(await errorCode(response)).toBe("CONFIGURATION_ERROR");
    expect(failure(entries)).toMatchObject({ reason_code: "CONFIGURATION_ERROR", status: 500 });
  });

  it("classifies unexpected exceptions without logging the exception message", async () => {
    const exceptionSecret = "unexpected-secret-marker";
    const { dependencies, entries } = createHarness({
      unlockAdmin: () => {
        throw new Error(`failure-${exceptionSecret}`);
      },
    });

    const response = await handleUnlockResourceCatalogAdmin(request({ password: CORRECT_PASSWORD }), dependencies);

    expect(response.status).toBe(500);
    expect(await errorCode(response)).toBe("INTERNAL_ERROR");
    expect(failure(entries)).toMatchObject({ reason_code: "UNEXPECTED_ERROR", status: 500 });
    expect(JSON.stringify(entries)).not.toContain(exceptionSecret);
  });

  it("never logs candidate/server passwords, Cookie, Authorization or returned session tokens", async () => {
    const candidateSecret = "candidate-super-secret-value";
    const serverSecret = "server-super-secret-password";
    const cookieSecret = "cookie-secret-marker";
    const authorizationSecret = "authorization-secret-marker";
    const { dependencies, entries } = createHarness({ adminPassword: serverSecret });

    const response = await handleUnlockResourceCatalogAdmin(
      request(
        { password: candidateSecret },
        { cookie: `other=${cookieSecret}`, authorization: `Bearer ${authorizationSecret}` },
      ),
      dependencies,
    );

    expect(response.status).toBe(401);
    const serialized = JSON.stringify(entries);
    expect(serialized).not.toContain(candidateSecret);
    expect(serialized).not.toContain(serverSecret);
    expect(serialized).not.toContain(cookieSecret);
    expect(serialized).not.toContain(authorizationSecret);
    expect(serialized).not.toContain(RAW_SESSION_TOKEN);
  });

  it("emits the password configuration diagnostic only once for a shared process state", async () => {
    const state = { logged: false };
    const { dependencies, entries } = createHarness({ adminAuthConfigurationState: state });

    await handleUnlockResourceCatalogAdmin(request({ password: "wrong-password-value" }), dependencies);
    await handleUnlockResourceCatalogAdmin(request({ password: "wrong-password-value" }), dependencies);

    expect(entries.filter((entry) => entry.event === "resource_catalog_admin_auth_configuration")).toHaveLength(1);
  });

  it("uses JSON console output by default so container stdout/stderr captures diagnostics", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { dependencies } = createHarness({ adminAuthLogger: undefined });

    const response = await handleUnlockResourceCatalogAdmin(request({ password: "wrong-password-value" }), dependencies);

    expect(response.status).toBe(401);
    expect(info).toHaveBeenCalled();
    expect(warn).toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
    for (const [line] of [...info.mock.calls, ...warn.mock.calls]) {
      expect(() => JSON.parse(String(line))).not.toThrow();
      expect(String(line)).not.toContain("wrong-password-value");
      expect(String(line)).not.toContain(CORRECT_PASSWORD);
    }
  });
});
