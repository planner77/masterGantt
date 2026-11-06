import { randomUUID } from "node:crypto";
import { apiErrorResponse, PublicApiError } from "../http/api-error-core";
import { parseEditSessionCookie } from "../security/cookie-core";
import { ConfigurationError, parseApplicationBaseUrl } from "../security/origin-core";
import type { ScheduleViewSourceService } from "./schedule-view-source-service-core";

export interface ScheduleViewSourceHandlerDependencies {
  service: Pick<ScheduleViewSourceService, "get"> | (() => Pick<ScheduleViewSourceService, "get">);
  applicationBaseUrl: string | undefined;
  environment: string | undefined;
  allowInsecureHttp?: string;
  requestId?: () => string;
}

export async function handleGetScheduleViewSource(request: Request, publicId: string, dependencies: ScheduleViewSourceHandlerDependencies): Promise<Response> {
  const requestId = (dependencies.requestId ?? randomUUID)();
  let response: Response;
  try {
    if (request.method !== "GET") throw new PublicApiError(405, "METHOD_NOT_ALLOWED", "The request method is not allowed.", [], { Allow: "GET" });
    const applicationUrl = parseApplicationBaseUrl(dependencies.applicationBaseUrl, dependencies.environment, dependencies.allowInsecureHttp);
    const cookie = parseEditSessionCookie(request.headers.get("cookie"), dependencies.environment, applicationUrl);
    const service = typeof dependencies.service === "function" ? dependencies.service() : dependencies.service;
    response = Response.json(service.get(publicId, cookie.state === "present" ? cookie.rawToken : undefined));
  } catch (error) {
    response = apiErrorResponse(error instanceof ConfigurationError
      ? new PublicApiError(500, "CONFIGURATION_ERROR", "The service is not configured correctly.") : error, requestId);
  }
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("X-Content-Type-Options", "nosniff");
  return response;
}
