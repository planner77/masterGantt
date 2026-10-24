import { randomUUID } from "node:crypto";
import type { LegacyBindingScopeService } from "./legacy-binding-scope-service-core";
import { logisticsRouteAccess, type LogisticsReadDependencies } from "./logistics-retirement-handlers-core";
import { LogisticsTargetError } from "./logistics-targets-service-core";
import { apiErrorResponse, PublicApiError } from "../http/api-error-core";
import { parseRequiredIfMatch, readBoundedJson } from "../http/request-core";

type Dependencies = LogisticsReadDependencies & {
  service: Pick<LegacyBindingScopeService, "get" | "preview" | "apply"> |
    (() => Pick<LegacyBindingScopeService, "get" | "preview" | "apply">);
};
const resolve = <T,>(value: T | (() => T)): T =>
  typeof value === "function" ? (value as () => T)() : value;
const headers = (revision: number) => ({
  "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", ETag: `"${revision}"`,
});
function fail(error: unknown, d: Dependencies): Response {
  const mapped = error instanceof LogisticsTargetError
    ? new PublicApiError(error.status, error.code, error.message) : error;
  const response = apiErrorResponse(mapped, (d.requestId ?? randomUUID)());
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("X-Content-Type-Options", "nosniff");
  return response;
}
export function handleGetLegacyBindingSources(request: Request, projectId: string, taskId: string, d: Dependencies) {
  try {
    const auth = logisticsRouteAccess(request, projectId, d);
    if (new URL(request.url).search) throw new PublicApiError(400, "INVALID_REQUEST", "Unknown query parameters.");
    const data = resolve(d.service).get(projectId, taskId);
    return Response.json({ data: { ...data, permission: auth.kind === "authorized" ? "edit" : "readonly" } },
      { headers: headers(data.projectRevision) });
  } catch (error) { return fail(error, d); }
}
export async function handleLegacyBindingScopeMutation(
  request: Request, projectId: string, taskId: string, d: Dependencies, mode: "preview" | "apply",
) {
  try {
    const auth = logisticsRouteAccess(request, projectId, d, true);
    if (auth.kind !== "authorized") throw new PublicApiError(401, "EDIT_SESSION_REQUIRED", "Edit session required.");
    if (new URL(request.url).search) throw new PublicApiError(400, "INVALID_REQUEST", "Unknown query parameters.");
    const revision = parseRequiredIfMatch(request);
    const input = await readBoundedJson(request);
    const service = resolve(d.service);
    const result = mode === "preview"
      ? service.preview(auth.authorization, revision, taskId, input)
      : service.apply(auth.authorization, revision, taskId, input);
    return Response.json(result, { headers: headers(result.data.projectRevision) });
  } catch (error) { return fail(error, d); }
}
