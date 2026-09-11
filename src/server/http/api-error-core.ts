import type {
  ApiErrorDetail,
  ApiErrorResponse,
} from "../../contracts/projects";

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

  return Response.json(body, {
    status: publicError.status,
    headers,
  });
}
