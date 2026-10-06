import { randomUUID } from "node:crypto";

import type {
  CountryCalendarImportApplyRequest,
  CountryCalendarImportEnvelope,
  CreateCountryCalendarDateRequest,
  UpdateCountryCalendarDateRequest,
  UpdateCountryCalendarMetadataRequest,
} from "../../contracts/country-calendar-admin";
import type { WorkCalendarCountryCode } from "../../contracts/work-calendar";
import { apiErrorResponse, PublicApiError } from "../http/api-error-core";
import { parseRequiredIfMatch, readBoundedJson } from "../http/request-core";
import type { ProjectMasterService } from "../project-master/project-master-service-core";
import { ConfigurationError, isExactAllowedOrigin, parseApplicationBaseUrl } from "../security/origin-core";
import { parseProjectMasterAdminCookie } from "../security/project-master-admin-cookie-core";
import {
  CountryCalendarCatalogConflictError,
  CountryCalendarCatalogInvalidInputError,
  CountryCalendarCatalogNotFoundError,
  CountryCalendarCatalogPreviewMismatchError,
  CountryCalendarCatalogRevisionMismatchError,
  type CountryCalendarCatalogService,
} from "./country-calendar-catalog-core";

interface Dependencies {
  catalogService: CountryCalendarCatalogService | (() => CountryCalendarCatalogService);
  projectMasterService: ProjectMasterService | (() => ProjectMasterService);
  applicationBaseUrl?: string;
  allowInsecureHttp?: string;
  environment?: string;
  requestId?: () => string;
}

const NO_STORE = { "Cache-Control": "private, no-store" };
const IMPORT_ENVELOPE_LIMIT_BYTES = 1_200_000;

function resolve<T>(value: T | (() => T)): T {
  return typeof value === "function" ? (value as () => T)() : value;
}

function appUrl(dependencies: Dependencies): URL {
  try {
    return parseApplicationBaseUrl(dependencies.applicationBaseUrl, dependencies.environment, dependencies.allowInsecureHttp);
  } catch (error) {
    if (error instanceof ConfigurationError) throw new PublicApiError(500, "CONFIGURATION_ERROR", "The service is not configured correctly.");
    throw error;
  }
}

function requireOrigin(request: Request, url: URL): void {
  if (!isExactAllowedOrigin(request.headers.get("origin"), url)) {
    throw new PublicApiError(403, "ORIGIN_NOT_ALLOWED", "The request origin is not allowed.");
  }
}

function requireAdmin(request: Request, dependencies: Dependencies, url: URL): void {
  const token = parseProjectMasterAdminCookie(request.headers.get("cookie"), dependencies.environment, url);
  if (!resolve(dependencies.projectMasterService).authorizeAdmin(token)) {
    throw new PublicApiError(401, "PROJECT_MASTER_ADMIN_REQUIRED", "Project master administrator authentication is required.");
  }
}

function countryCode(value: string): WorkCalendarCountryCode {
  if (!["KR","CN","VN","PH","TH","MX","US"].includes(value)) throw new CountryCalendarCatalogInvalidInputError();
  return value as WorkCalendarCountryCode;
}

function yearValue(value: string): number {
  if (!/^\d{4}$/.test(value)) throw new CountryCalendarCatalogInvalidInputError();
  return Number(value);
}

function mapped(error: unknown): unknown {
  if (error instanceof CountryCalendarCatalogRevisionMismatchError) {
    return new PublicApiError(412, "COUNTRY_CALENDAR_REVISION_MISMATCH", "Country calendar catalog changed. Reload and retry.");
  }
  if (error instanceof CountryCalendarCatalogNotFoundError) {
    return new PublicApiError(404, "COUNTRY_CALENDAR_DATE_NOT_FOUND", "Country calendar date was not found.");
  }
  if (error instanceof CountryCalendarCatalogConflictError) {
    return new PublicApiError(409, "COUNTRY_CALENDAR_CONFLICT", "Country calendar change conflicts with the current dataset state.");
  }
  if (error instanceof CountryCalendarCatalogPreviewMismatchError) {
    return new PublicApiError(409, "COUNTRY_CALENDAR_IMPORT_PREVIEW_MISMATCH", "Import apply must match the reviewed preview.");
  }
  if (error instanceof CountryCalendarCatalogInvalidInputError) {
    return new PublicApiError(400, "INVALID_COUNTRY_CALENDAR_INPUT", "Country calendar input is invalid.");
  }
  return error;
}

function response(body: unknown, status: number, revision: number): Response {
  return Response.json(body, {
    status,
    headers: {
      ...NO_STORE,
      "Content-Type": "application/json; charset=utf-8",
      ETag: `"${revision}"`,
    },
  });
}

function fail(error: unknown, requestId: string): Response {
  const result = apiErrorResponse(mapped(error), requestId);
  result.headers.set("Cache-Control", NO_STORE["Cache-Control"]);
  return result;
}

export function handleGetCountryCalendarAdmin(
  request: Request,
  codeValue: string,
  yearText: string,
  dependencies: Dependencies,
): Response {
  const requestId = (dependencies.requestId ?? randomUUID)();
  try {
    const url = appUrl(dependencies);
    requireAdmin(request, dependencies, url);
    const result = resolve(dependencies.catalogService).getAdminDataset(countryCode(codeValue), yearValue(yearText));
    return response(result, 200, result.data.revision);
  } catch (error) { return fail(error, requestId); }
}

export async function handleUpdateCountryCalendarMetadata(
  request: Request,
  codeValue: string,
  yearText: string,
  dependencies: Dependencies,
): Promise<Response> {
  const requestId = (dependencies.requestId ?? randomUUID)();
  try {
    const url = appUrl(dependencies); requireOrigin(request, url); requireAdmin(request, dependencies, url);
    const revision = parseRequiredIfMatch(request);
    const body = await readBoundedJson(request, 16 * 1024) as UpdateCountryCalendarMetadataRequest;
    const result = resolve(dependencies.catalogService).updateMetadata(countryCode(codeValue), yearValue(yearText), revision, body);
    return response(result, 200, result.data.revision);
  } catch (error) { return fail(error, requestId); }
}

export async function handleCreateCountryCalendarDate(
  request: Request,
  codeValue: string,
  yearText: string,
  dependencies: Dependencies,
): Promise<Response> {
  const requestId = (dependencies.requestId ?? randomUUID)();
  try {
    const url = appUrl(dependencies); requireOrigin(request, url); requireAdmin(request, dependencies, url);
    const revision = parseRequiredIfMatch(request);
    const body = await readBoundedJson(request, 16 * 1024) as CreateCountryCalendarDateRequest;
    const result = resolve(dependencies.catalogService).addDate(countryCode(codeValue), yearValue(yearText), revision, body);
    return response(result, 201, result.data.revision);
  } catch (error) { return fail(error, requestId); }
}

export async function handleUpdateCountryCalendarDate(
  request: Request,
  codeValue: string,
  yearText: string,
  date: string,
  dependencies: Dependencies,
): Promise<Response> {
  const requestId = (dependencies.requestId ?? randomUUID)();
  try {
    const url = appUrl(dependencies); requireOrigin(request, url); requireAdmin(request, dependencies, url);
    const revision = parseRequiredIfMatch(request);
    const body = await readBoundedJson(request, 16 * 1024) as UpdateCountryCalendarDateRequest;
    const result = resolve(dependencies.catalogService).updateDate(countryCode(codeValue), yearValue(yearText), date, revision, body);
    return response(result, 200, result.data.revision);
  } catch (error) { return fail(error, requestId); }
}

export function handleDeleteCountryCalendarDate(
  request: Request,
  codeValue: string,
  yearText: string,
  date: string,
  dependencies: Dependencies,
): Response {
  const requestId = (dependencies.requestId ?? randomUUID)();
  try {
    const url = appUrl(dependencies); requireOrigin(request, url); requireAdmin(request, dependencies, url);
    const revision = parseRequiredIfMatch(request);
    const result = resolve(dependencies.catalogService).deleteDate(countryCode(codeValue), yearValue(yearText), date, revision);
    return response(result, 200, result.data.revision);
  } catch (error) { return fail(error, requestId); }
}

function envelope(value: unknown): CountryCalendarImportEnvelope {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new CountryCalendarCatalogInvalidInputError();
  const candidate = value as Partial<CountryCalendarImportEnvelope>;
  if ((candidate.format !== "json" && candidate.format !== "csv") || typeof candidate.content !== "string") {
    throw new CountryCalendarCatalogInvalidInputError();
  }
  return { format: candidate.format, content: candidate.content };
}

function importApplyRequest(value: unknown): CountryCalendarImportApplyRequest {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new CountryCalendarCatalogInvalidInputError();
  const candidate = value as Partial<CountryCalendarImportApplyRequest>;
  if (typeof candidate.previewToken !== "string" || candidate.previewToken.length < 32 || candidate.previewToken.length > 128) {
    throw new CountryCalendarCatalogInvalidInputError();
  }
  return { previewToken: candidate.previewToken, envelope: envelope(candidate.envelope) };
}

export async function handlePreviewCountryCalendarImport(request: Request, dependencies: Dependencies): Promise<Response> {
  const requestId = (dependencies.requestId ?? randomUUID)();
  try {
    const url = appUrl(dependencies); requireOrigin(request, url); requireAdmin(request, dependencies, url);
    const body = envelope(await readBoundedJson(request, IMPORT_ENVELOPE_LIMIT_BYTES));
    const result = resolve(dependencies.catalogService).previewImport(body);
    return response(result, 200, result.data.revision);
  } catch (error) { return fail(error, requestId); }
}

export async function handleApplyCountryCalendarImport(request: Request, dependencies: Dependencies): Promise<Response> {
  const requestId = (dependencies.requestId ?? randomUUID)();
  try {
    const url = appUrl(dependencies); requireOrigin(request, url); requireAdmin(request, dependencies, url);
    const revision = parseRequiredIfMatch(request);
    const body = importApplyRequest(await readBoundedJson(request, IMPORT_ENVELOPE_LIMIT_BYTES));
    const result = resolve(dependencies.catalogService).applyImport(revision, body.previewToken, body.envelope);
    return response(result, 200, result.data.revision);
  } catch (error) { return fail(error, requestId); }
}
