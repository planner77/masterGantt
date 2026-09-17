import type {
  ApiErrorDetail,
  ApiErrorResponse,
} from "../../contracts/projects";
import { safeErrorFields } from "../logging/logger-core";
import { getServerLogger } from "../logging/logger";
import { getRequestContext } from "./request-context-core";

export class PublicApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly publicMessage: string,
    readonly details: ApiErrorDetail[] = [],
    readonly responseHeaders: HeadersInit = {},
  ) {
    super(publicMessage);
    this.name = "PublicApiError";
  }
}

function logApiError(error: unknown, publicError: PublicApiError, requestId: string): void {
  const context = getRequestContext();
  const logger = context?.logger ?? getServerLogger();
  const level = publicError.status >= 500 ? "error" : publicError.status >= 400 ? "warn" : "info";
  const unexpected = !(error instanceof PublicApiError);

  logger[level](unexpected ? "http_request_unexpected_error" : "http_request_rejected", {
    requestId,
    ...(context ? {
      method: context.method,
      route: context.route,
    } : {}),
    status: publicError.status,
    errorCode: publicError.code,
    ...(unexpected ? safeErrorFields(error, process.env.NODE_ENV) : {}),
  });
}

export function apiErrorResponse(
  error: unknown,
  requestId: string,
): Response {
  const publicError = error instanceof PublicApiError
    ? error
    : new PublicApiError(
      500,
      "INTERNAL_ERROR",
      "The request could not be completed.",
    );
  const body: ApiErrorResponse = {
    error: {
      code: publicError.code,
      message: publicError.publicMessage,
      details: publicError.details,
      requestId,
    },
  };
  const headers = new Headers(publicError.responseHeaders);
  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.set("X-Request-ID", requestId);

  logApiError(error, publicError, requestId);

  return Response.json(body, {
    status: publicError.status,
    headers,
  });
}
