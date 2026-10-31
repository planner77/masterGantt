import { randomUUID } from "node:crypto";
import type { CountryCalendarAdminResponse, CountryCalendarImportApplyRequest, CountryCalendarImportEnvelope, UpdateCountryCalendarMetadataRequest } from "../../contracts/country-calendar-admin";
import { apiErrorResponse, PublicApiError } from "../http/api-error-core";
import { parseRequiredIfMatch, readBoundedJson } from "../http/request-core";
import { ConfigurationError, isExactAllowedOrigin, parseApplicationBaseUrl } from "../security/origin-core";
import { parseProjectMasterAdminCookie } from "../security/project-master-admin-cookie-core";
import type { CountryCalendarAdminService } from "./country-calendar-admin-service-core";
import { calendarCountry, calendarYear, invalidCountryCalendar } from "./country-calendar-validation-core";

export interface CountryCalendarAdminHandlerDependencies {
  service: CountryCalendarAdminService | (() => CountryCalendarAdminService);
  applicationBaseUrl?: string;
  environment?: string;
  allowInsecureHttp?: string;
  requestId?: () => string;
}
export type CountryCalendarAdminOperation = "get" | "metadata" | "createDate" | "updateDate" | "deleteDate" | "preview" | "apply";
const NO_STORE = { "Cache-Control": "private, no-store" };

export async function handleCountryCalendarAdmin(request: Request, operation: CountryCalendarAdminOperation, params: { countryCode?: string; year?: string; date?: string }, deps: CountryCalendarAdminHandlerDependencies): Promise<Response> {
  const requestId = (deps.requestId ?? randomUUID)();
  try {
    let url: URL;
    try { url = parseApplicationBaseUrl(deps.applicationBaseUrl, deps.environment, deps.allowInsecureHttp); }
    catch (error) { if (error instanceof ConfigurationError) throw new PublicApiError(500, "CONFIGURATION_ERROR", "The service is not configured correctly."); throw error; }
    if (operation !== "get" && !isExactAllowedOrigin(request.headers.get("origin"), url)) throw new PublicApiError(403, "ORIGIN_NOT_ALLOWED", "The request origin is not allowed.");
    const token = parseProjectMasterAdminCookie(request.headers.get("cookie"), deps.environment, url);
    const service = typeof deps.service === "function" ? deps.service() : deps.service;
    service.requireAdmin(token);
    const revision = operation === "get" ? 0 : parseRequiredIfMatch(request);
    let result: CountryCalendarAdminResponse | ReturnType<CountryCalendarAdminService["previewImport"]>;
    if (operation === "preview" || operation === "apply") {
      // 1 MiB file text can expand sixfold through JSON escaping; the inner file
      // bound is independently enforced by the service after this bounded read.
      const body = await readBoundedJson(request, 8 * 1024 * 1024);
      result = operation === "preview" ? service.previewImport(token, revision, body as CountryCalendarImportEnvelope) : service.applyImport(token, revision, body as CountryCalendarImportApplyRequest);
    } else {
      const code = calendarCountry(params.countryCode);
      if (!/^\d{4}$/.test(params.year ?? "")) invalidCountryCalendar("year", "Use a four-digit year.");
      const year = calendarYear(Number(params.year));
      if (operation === "get") result = service.getAdminDataset(token, code, year);
      else if (operation === "deleteDate") result = service.deleteDate(token, code, year, params.date ?? "", revision);
      else {
        const body = await readBoundedJson(request, 16 * 1024);
        result = operation === "metadata" ? service.updateMetadata(token, code, year, revision, body as UpdateCountryCalendarMetadataRequest)
          : operation === "createDate" ? service.addDate(token, code, year, revision, body)
          : service.updateDate(token, code, year, params.date ?? "", revision, body);
      }
    }
    return Response.json(result, { status: operation === "createDate" ? 201 : 200, headers: { ...NO_STORE, ETag: `"${result.data.revision}"` } });
  } catch (error) {
    const response = apiErrorResponse(error, requestId);
    response.headers.set("Cache-Control", NO_STORE["Cache-Control"]);
    return response;
  }
}
