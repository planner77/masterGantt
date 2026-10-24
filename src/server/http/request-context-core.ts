import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";

import type { StructuredLogger } from "../logging/logger-core";
import { getServerLogger } from "../logging/logger";
import { projectScopedAccessResponse } from "../security/project-read-access-core";

const REQUEST_ID_PATTERN = /^(?:[0-9a-f]{32}|[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i;

export interface RequestContext {
  requestId: string;
  method: string;
  route: string;
  startedAt: number;
  logger: StructuredLogger;
  sqlMetrics?: SqlRequestMetrics;
}

export interface SqlRequestMetrics {
  calls: number;
  executionMs: number;
  errors: number;
}

export interface ApiRequestLoggingOptions {
  route: string;
  trustProxy?: string;
  logger?: StructuredLogger;
  now?: () => number;
  requestId?: () => string;
  /** Isolated test use only; never enabled for normal production requests. */
  observeSqlMetrics?: boolean;
}

const requestContext = new AsyncLocalStorage<RequestContext>();

export function getRequestContext(): RequestContext | undefined {
  return requestContext.getStore();
}

function trustProxyEnabled(value: string | undefined): boolean {
  return value?.trim().toLowerCase() === "true";
}

export function isValidRequestId(value: string | null | undefined): value is string {
  if (!value || value.length > 64) return false;
  return REQUEST_ID_PATTERN.test(value);
}

export function resolveRequestId(
  request: Request,
  trustProxy: string | undefined,
  generate: () => string = randomUUID,
): string {
  if (trustProxyEnabled(trustProxy)) {
    const forwarded = request.headers.get("x-request-id")?.trim();
    if (isValidRequestId(forwarded)) return forwarded;
  }
  return generate();
}

function completionLevel(status: number): "info" | "warn" | "error" {
  if (status >= 500) return "error";
  if (status >= 400) return "warn";
  return "info";
}

function isHealthRoute(route: string): boolean {
  return route.startsWith("/api/health/");
}

export async function withApiRequestLogging(
  request: Request,
  options: ApiRequestLoggingOptions,
  handler: (requestId: string) => Response | Promise<Response>,
): Promise<Response> {
  const logger = options.logger ?? getServerLogger();
  const now = options.now ?? Date.now;
  const requestId = resolveRequestId(request, options.trustProxy, options.requestId);
  const context: RequestContext = {
    requestId,
    method: request.method,
    route: options.route,
    startedAt: now(),
    logger,
    ...((options.observeSqlMetrics === true ||
      (process.env.NODE_ENV === "development" && process.env.ISSUE_751_SQL_METRICS === "true"))
      ? { sqlMetrics: { calls: 0, executionMs: 0, errors: 0 } } : {}),
  };

  const sqlFields = () => context.sqlMetrics ? {
    sqlStatementCount: context.sqlMetrics.calls,
    sqlExecutionMs: Math.round(context.sqlMetrics.executionMs * 100) / 100,
    sqlErrorCount: context.sqlMetrics.errors,
  } : {};

  return requestContext.run(context, async () => {
    try {
      const locked = await projectScopedAccessResponse(request, requestId);
      const response = locked ?? await handler(requestId);
      response.headers.set("X-Request-ID", requestId);
      if (!isHealthRoute(options.route)) {
        const level = completionLevel(response.status);
        logger[level]("http_request_completed", {
          requestId,
          method: request.method,
          route: options.route,
          status: response.status,
          durationMs: Math.max(0, now() - context.startedAt),
          ...sqlFields(),
        });
      }
      return response;
    } catch (error) {
      logger.error("http_request_unhandled", {
        requestId,
        method: request.method,
        route: options.route,
        durationMs: Math.max(0, now() - context.startedAt),
        ...sqlFields(),
        errorType: error instanceof Error ? error.name : typeof error,
      });
      throw error;
    }
  });
}
