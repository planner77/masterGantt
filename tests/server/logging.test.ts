import { describe, expect, it } from "vitest";

import {
  createStructuredLogger,
  resolveLogConfiguration,
  type StructuredLogSink,
} from "../../src/server/logging/logger-core";
import {
  isValidRequestId,
  resolveRequestId,
  withApiRequestLogging,
} from "../../src/server/http/request-context-core";
import {
  apiErrorResponse,
  PublicApiError,
} from "../../src/server/http/api-error-core";

function captureLogger(level = "debug") {
  const lines: Record<"debug" | "info" | "warn" | "error", string[]> = {
    debug: [],
    info: [],
    warn: [],
    error: [],
  };
  const sink: StructuredLogSink = {
    debug: (line) => lines.debug.push(line),
    info: (line) => lines.info.push(line),
    warn: (line) => lines.warn.push(line),
    error: (line) => lines.error.push(line),
  };
  const logger = createStructuredLogger({
    level,
    environment: "test",
    component: "test",
    sink,
    now: () => new Date("2026-09-18T00:00:00.000Z"),
  });
  return { logger, lines };
}

function parsed(line: string): Record<string, unknown> {
  return JSON.parse(line) as Record<string, unknown>;
}

describe("structured logging", () => {
  it("applies environment defaults and safely falls back from an invalid LOG_LEVEL", () => {
    expect(resolveLogConfiguration(undefined, "development")).toEqual({ level: "debug" });
    expect(resolveLogConfiguration(undefined, "production")).toEqual({ level: "info" });
    expect(resolveLogConfiguration("ERROR", "production")).toEqual({ level: "error" });
    expect(resolveLogConfiguration("verbose", "production")).toEqual({
      level: "info",
      invalidValue: "verbose",
    });

    const { lines } = captureLogger("verbose");
    expect(lines.warn).toHaveLength(1);
    expect(parsed(lines.warn[0])).toMatchObject({
      event: "logging_configuration_invalid",
      fallbackLevel: "info",
    });
  });

  it("filters lower levels and emits one JSON object per accepted event", () => {
    const { logger, lines } = captureLogger("warn");
    logger.debug("debug_event");
    logger.info("info_event");
    logger.warn("warn_event", { requestId: "req" });
    logger.error("error_event");

    expect(lines.debug).toHaveLength(0);
    expect(lines.info).toHaveLength(0);
    expect(lines.warn).toHaveLength(1);
    expect(lines.error).toHaveLength(1);
    expect(parsed(lines.warn[0])).toMatchObject({
      level: "warn",
      event: "warn_event",
      component: "test",
      environment: "test",
      requestId: "req",
    });
  });

  it("redacts sensitive keys recursively without changing application behavior", () => {
    const { logger, lines } = captureLogger();
    logger.info("security_event", {
      password: "plain-password",
      Cookie: "session=secret",
      nested: {
        authorization: "Bearer secret",
        safe: "visible",
      },
    });

    const entry = parsed(lines.info[0]);
    expect(entry.password).toBe("[REDACTED]");
    expect(entry.Cookie).toBe("[REDACTED]");
    expect(entry.nested).toEqual({ authorization: "[REDACTED]", safe: "visible" });
    expect(lines.info[0]).not.toContain("plain-password");
    expect(lines.info[0]).not.toContain("Bearer secret");
  });
});

describe("request correlation", () => {
  it("accepts canonical UUID and Nginx request IDs only", () => {
    expect(isValidRequestId("123e4567-e89b-42d3-a456-426614174000")).toBe(true);
    expect(isValidRequestId("0123456789abcdef0123456789abcdef")).toBe(true);
    expect(isValidRequestId("not-a-request-id")).toBe(false);
  });

  it("trusts X-Request-ID only when TRUST_PROXY is enabled and the value is valid", () => {
    const forwarded = "0123456789abcdef0123456789abcdef";
    const request = new Request("http://localhost/api/projects", {
      headers: { "X-Request-ID": forwarded },
    });

    expect(resolveRequestId(request, "true", () => "generated")).toBe(forwarded);
    expect(resolveRequestId(request, "false", () => "generated")).toBe("generated");

    const invalid = new Request("http://localhost/api/projects", {
      headers: { "X-Request-ID": "invalid" },
    });
    expect(resolveRequestId(invalid, "true", () => "generated")).toBe("generated");
  });

  it("keeps the same requestId in error body, response header, rejection log, and completion log", async () => {
    const requestId = "123e4567-e89b-42d3-a456-426614174000";
    const { logger, lines } = captureLogger();
    const request = new Request("http://localhost/api/projects", { method: "POST" });

    const response = await withApiRequestLogging(
      request,
      {
        route: "/api/projects",
        logger,
        requestId: () => requestId,
        now: (() => {
          let value = 100;
          return () => value++;
        })(),
      },
      (correlationId) => apiErrorResponse(
        new PublicApiError(400, "INVALID_REQUEST", "Invalid request."),
        correlationId,
      ),
    );

    expect(response.status).toBe(400);
    expect(response.headers.get("x-request-id")).toBe(requestId);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "INVALID_REQUEST", requestId },
    });
    expect(lines.warn.map(parsed)).toEqual(expect.arrayContaining([
      expect.objectContaining({ event: "http_request_rejected", requestId, status: 400 }),
      expect.objectContaining({ event: "http_request_completed", requestId, status: 400 }),
    ]));
  });

  it("keeps unexpected server details out of the client response and logs a 500", async () => {
    const requestId = "123e4567-e89b-42d3-a456-426614174000";
    const { logger, lines } = captureLogger();
    const request = new Request("http://localhost/api/projects/1", { method: "PATCH" });

    const response = await withApiRequestLogging(
      request,
      { route: "/api/projects/[publicId]", logger, requestId: () => requestId },
      (correlationId) => apiErrorResponse(new Error("internal database detail"), correlationId),
    );
    const body = JSON.stringify(await response.json());

    expect(response.status).toBe(500);
    expect(body).toContain("INTERNAL_ERROR");
    expect(body).not.toContain("internal database detail");
    expect(lines.error.map(parsed)).toEqual(expect.arrayContaining([
      expect.objectContaining({ event: "http_request_unexpected_error", requestId, status: 500 }),
      expect.objectContaining({ event: "http_request_completed", requestId, status: 500 }),
    ]));
  });

  it("does not emit repetitive request completion logs for health probes", async () => {
    const { logger, lines } = captureLogger();
    const request = new Request("http://localhost/api/health/ready");

    const response = await withApiRequestLogging(
      request,
      { route: "/api/health/ready", logger, requestId: () => "123e4567-e89b-42d3-a456-426614174000" },
      () => Response.json({ status: "ok" }),
    );

    expect(response.status).toBe(200);
    expect(lines.info).toHaveLength(0);
    expect(lines.warn).toHaveLength(0);
    expect(lines.error).toHaveLength(0);
  });
});
