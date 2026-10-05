import { randomUUID } from "node:crypto";

import type {
  LogisticsMutationResponse,
  ProjectLogisticsResponse,
} from "../../contracts/logistics";
import type { ApiErrorDetail } from "../../contracts/projects";
import { apiErrorResponse, PublicApiError } from "../http/api-error-core";

function toDetails(messages: string[]): ApiErrorDetail[] {
  return messages.map((message) => ({ code: "INVALID_FIELD", message }));
}

import { parseRequiredIfMatch, readBoundedJson } from "../http/request-core";
import { parseEditSessionCookie } from "../security/cookie-core";
import {
  ConfigurationError,
  isExactAllowedOrigin,
  parseApplicationBaseUrl,
} from "../security/origin-core";
import { isCanonicalUuidV4 } from "../projects/project-contract";
import {
  EditSessionInvalidError,
  RevisionMismatchError,
  type AuthorizationResult,
  type AuthorizedEditSession,
} from "../projects/project-service-core";
import {
  LogisticsConflictError,
  LogisticsEntityNotFoundError,
  LogisticsService,
  LogisticsValidationError,
} from "./logistics-service-core";
import { LogisticsDashboardService } from "./logistics-dashboard-service";
import { parseDateOnly } from "../../domain/scheduling/date-only";
import {
  parseCreateEquipmentInput,
  parseCreateLogisticsSystemInput,
  parseCreateProcessInput,
  parseReplaceTaskLogisticsLinksInput,
  parseSetEquipmentResourceRolesInput,
  parseSetEquipmentSystemsInput,
  parseSetSystemChildrenInput,
  parseSetSystemProcessesInput,
  parseSetSystemResourceRolesInput,
  parseUpdateEquipmentRequest,
  parseUpdateLogisticsSystemInput,
  parseUpdateProcessInput,
} from "./logistics-contract";

const NO_STORE_HEADERS = { "Cache-Control": "private, no-store" };

export interface LogisticsHandlerDependencies {
  logisticsService: LogisticsService | (() => LogisticsService);
  projectService: {
    authorize(publicId: string, rawToken: string | undefined): AuthorizationResult;
    findById?(projectId: number): unknown;
    findCredentialByPublicId?(publicId: string): unknown;
  } | (() => {
    authorize(publicId: string, rawToken: string | undefined): AuthorizationResult;
    findById?(projectId: number): unknown;
    findCredentialByPublicId?(publicId: string): unknown;
  });
  applicationBaseUrl: string | undefined;
  allowInsecureHttp?: string;
  environment: string | undefined;
  requestId?: () => string;
}

function resolve<T>(value: T | (() => T)): T {
  return typeof value === "function" ? (value as () => T)() : value;
}

function appUrl(d: LogisticsHandlerDependencies): URL {
  try {
    return parseApplicationBaseUrl(
      d.applicationBaseUrl,
      d.environment,
      d.allowInsecureHttp,
    );
  } catch (e) {
    if (e instanceof ConfigurationError) {
      throw new PublicApiError(500, "CONFIGURATION_ERROR", "The service is not configured correctly.");
    }
    throw e;
  }
}

function requireOrigin(request: Request, url: URL): void {
  if (!isExactAllowedOrigin(request.headers.get("origin"), url)) {
    throw new PublicApiError(403, "ORIGIN_NOT_ALLOWED", "The request origin is not allowed.");
  }
}

function requireAuthorizedSession(
  request: Request,
  publicId: string,
  d: LogisticsHandlerDependencies,
  url: URL,
): AuthorizedEditSession {
  const cookie = parseEditSessionCookie(
    request.headers.get("cookie"),
    d.environment,
    url,
  );
  const pService = resolve(d.projectService);
  const auth = pService.authorize(
    publicId,
    cookie.state === "present" ? cookie.rawToken : undefined,
  );

  if (auth.kind === "projectNotFound") {
    throw new PublicApiError(404, "PROJECT_NOT_FOUND", "Project not found.");
  }
  if (auth.kind !== "authorized") {
    throw new PublicApiError(401, "EDIT_SESSION_REQUIRED", "A valid edit session is required.");
  }
  return auth.authorization;
}

function mapError(error: unknown, requestId: string): Response {
  let mapped = error;

  if (error instanceof EditSessionInvalidError) {
    mapped = new PublicApiError(401, "EDIT_SESSION_REQUIRED", "A valid edit session is required.");
  } else if (error instanceof RevisionMismatchError) {
    mapped = new PublicApiError(412, "REVISION_MISMATCH", "Project changed. Reload and retry.");
  } else if (error instanceof LogisticsEntityNotFoundError) {
    mapped = new PublicApiError(404, "LOGISTICS_NOT_FOUND", error.message);
  } else if (error instanceof LogisticsConflictError) {
    mapped = new PublicApiError(409, error.code, error.message);
  } else if (error instanceof LogisticsValidationError) {
    mapped = new PublicApiError(400, "INVALID_REQUEST", error.message, toDetails(error.details));
  }

  const response = apiErrorResponse(mapped, requestId);
  response.headers.set("Cache-Control", NO_STORE_HEADERS["Cache-Control"]);
  return response;
}

function mutationResponse(
  body: LogisticsMutationResponse,
  status: 200 | 201 = 200,
): Response {
  return Response.json(body, {
    status,
    headers: {
      ...NO_STORE_HEADERS,
      "Content-Type": "application/json; charset=utf-8",
      ETag: `"${body.data.project.revision}"`,
    },
  });
}

function deleteMutationResponse(body: LogisticsMutationResponse): Response {
  return new Response(null, {
    status: 204,
    headers: {
      ...NO_STORE_HEADERS,
      ETag: `"${body.data.project.revision}"`,
    },
  });
}

// --- Read Handler ---

export async function handleGetProjectLogistics(
  request: Request,
  publicId: string,
  dependencies: LogisticsHandlerDependencies,
): Promise<Response> {
  const requestId = (dependencies.requestId ?? randomUUID)();
  try {
    if (!isCanonicalUuidV4(publicId)) {
      throw new PublicApiError(404, "PROJECT_NOT_FOUND", "Project not found.");
    }
    const url = appUrl(dependencies);
    const cookie = parseEditSessionCookie(
      request.headers.get("cookie"),
      dependencies.environment,
      url,
    );
    const pService = resolve(dependencies.projectService);
    const auth = pService.authorize(
      publicId,
      cookie.state === "present" ? cookie.rawToken : undefined,
    );
    if (auth.kind === "projectNotFound") {
      throw new PublicApiError(404, "PROJECT_NOT_FOUND", "Project not found.");
    }

    const service = resolve(dependencies.logisticsService);
    const projectId = service.getProjectIdByPublicId(publicId);
    if (!projectId) {
      throw new PublicApiError(404, "PROJECT_NOT_FOUND", "Project not found.");
    }
    const project = service.getProjectDto(projectId);
    const logistics = service.getLogisticsDto(projectId);

    const body: ProjectLogisticsResponse = {
      data: {
        project,
        logistics,
        permission: auth.kind === "authorized" ? "edit" : "readonly",
      },
    };

    return Response.json(body, {
      status: 200,
      headers: {
        ...NO_STORE_HEADERS,
        "Content-Type": "application/json; charset=utf-8",
        ETag: `"${project.revision}"`,
      },
    });
  } catch (error) {
    return mapError(error, requestId);
  }
}

// --- Process Handlers ---

export async function handleCreateProcess(
  request: Request,
  publicId: string,
  dependencies: LogisticsHandlerDependencies,
): Promise<Response> {
  const requestId = (dependencies.requestId ?? randomUUID)();
  try {
    if (!isCanonicalUuidV4(publicId)) {
      throw new PublicApiError(404, "PROJECT_NOT_FOUND", "Project not found.");
    }
    const url = appUrl(dependencies);
    requireOrigin(request, url);
    const auth = requireAuthorizedSession(request, publicId, dependencies, url);
    const expectedRevision = parseRequiredIfMatch(request);
    const raw = await readBoundedJson(request);
    const parsed = parseCreateProcessInput(raw);
    if (!parsed.success) {
      throw new PublicApiError(400, "INVALID_REQUEST", "The process input is invalid.", toDetails(parsed.details));
    }

    const service = resolve(dependencies.logisticsService);
    const result = service.createProcess(auth, expectedRevision, parsed.data);
    return mutationResponse(result, 201);
  } catch (error) {
    return mapError(error, requestId);
  }
}

export async function handleUpdateProcess(
  request: Request,
  publicId: string,
  processPublicId: string,
  dependencies: LogisticsHandlerDependencies,
): Promise<Response> {
  const requestId = (dependencies.requestId ?? randomUUID)();
  try {
    if (!isCanonicalUuidV4(publicId)) {
      throw new PublicApiError(404, "PROJECT_NOT_FOUND", "Project not found.");
    }
    const url = appUrl(dependencies);
    requireOrigin(request, url);
    const auth = requireAuthorizedSession(request, publicId, dependencies, url);
    const expectedRevision = parseRequiredIfMatch(request);
    const raw = await readBoundedJson(request);
    const parsed = parseUpdateProcessInput(raw);
    if (!parsed.success) {
      throw new PublicApiError(400, "INVALID_REQUEST", "The process update input is invalid.", toDetails(parsed.details));
    }

    const service = resolve(dependencies.logisticsService);
    const result = service.updateProcess(auth, expectedRevision, processPublicId, parsed.data);
    return mutationResponse(result, 200);
  } catch (error) {
    return mapError(error, requestId);
  }
}

export async function handleDeleteProcess(
  request: Request,
  publicId: string,
  processPublicId: string,
  dependencies: LogisticsHandlerDependencies,
): Promise<Response> {
  const requestId = (dependencies.requestId ?? randomUUID)();
  try {
    if (!isCanonicalUuidV4(publicId)) {
      throw new PublicApiError(404, "PROJECT_NOT_FOUND", "Project not found.");
    }
    const url = appUrl(dependencies);
    requireOrigin(request, url);
    const auth = requireAuthorizedSession(request, publicId, dependencies, url);
    const expectedRevision = parseRequiredIfMatch(request);
    const service = resolve(dependencies.logisticsService);
    const result = service.deleteProcess(auth, expectedRevision, processPublicId, true);
    return deleteMutationResponse(result);
  } catch (error) {
    return mapError(error, requestId);
  }
}

// --- Equipment Handlers ---

export async function handleCreateEquipment(
  request: Request,
  publicId: string,
  dependencies: LogisticsHandlerDependencies,
): Promise<Response> {
  const requestId = (dependencies.requestId ?? randomUUID)();
  try {
    if (!isCanonicalUuidV4(publicId)) {
      throw new PublicApiError(404, "PROJECT_NOT_FOUND", "Project not found.");
    }
    const url = appUrl(dependencies);
    requireOrigin(request, url);
    const auth = requireAuthorizedSession(request, publicId, dependencies, url);
    const expectedRevision = parseRequiredIfMatch(request);
    const raw = await readBoundedJson(request);
    const parsed = parseCreateEquipmentInput(raw);
    if (!parsed.success) {
      throw new PublicApiError(400, "INVALID_REQUEST", "The equipment input is invalid.", toDetails(parsed.details));
    }

    const service = resolve(dependencies.logisticsService);
    const result = service.createEquipment(auth, expectedRevision, parsed.data);
    return mutationResponse(result, 201);
  } catch (error) {
    return mapError(error, requestId);
  }
}

export async function handleUpdateEquipment(
  request: Request,
  publicId: string,
  equipmentPublicId: string,
  dependencies: LogisticsHandlerDependencies,
): Promise<Response> {
  const requestId = (dependencies.requestId ?? randomUUID)();
  try {
    if (!isCanonicalUuidV4(publicId)) {
      throw new PublicApiError(404, "PROJECT_NOT_FOUND", "Project not found.");
    }
    const url = appUrl(dependencies);
    requireOrigin(request, url);
    const auth = requireAuthorizedSession(request, publicId, dependencies, url);
    const expectedRevision = parseRequiredIfMatch(request);
    const raw = await readBoundedJson(request);
    const parsed = parseUpdateEquipmentRequest(raw);
    if (!parsed.success) {
      throw new PublicApiError(400, "INVALID_REQUEST", "The equipment update input is invalid.", toDetails(parsed.details));
    }

    const service = resolve(dependencies.logisticsService);
    const result = service.updateEquipment(auth, expectedRevision, equipmentPublicId, parsed.data);
    return mutationResponse(result, 200);
  } catch (error) {
    return mapError(error, requestId);
  }
}

export async function handleDeleteEquipment(
  request: Request,
  publicId: string,
  equipmentPublicId: string,
  dependencies: LogisticsHandlerDependencies,
): Promise<Response> {
  const requestId = (dependencies.requestId ?? randomUUID)();
  try {
    if (!isCanonicalUuidV4(publicId)) {
      throw new PublicApiError(404, "PROJECT_NOT_FOUND", "Project not found.");
    }
    const url = appUrl(dependencies);
    requireOrigin(request, url);
    const auth = requireAuthorizedSession(request, publicId, dependencies, url);
    const expectedRevision = parseRequiredIfMatch(request);
    const service = resolve(dependencies.logisticsService);
    const result = service.deleteEquipment(auth, expectedRevision, equipmentPublicId, true);
    return deleteMutationResponse(result);
  } catch (error) {
    return mapError(error, requestId);
  }
}

export async function handleSetEquipmentSystems(
  request: Request,
  publicId: string,
  equipmentPublicId: string,
  dependencies: LogisticsHandlerDependencies,
): Promise<Response> {
  const requestId = (dependencies.requestId ?? randomUUID)();
  try {
    if (!isCanonicalUuidV4(publicId)) {
      throw new PublicApiError(404, "PROJECT_NOT_FOUND", "Project not found.");
    }
    const url = appUrl(dependencies);
    requireOrigin(request, url);
    const auth = requireAuthorizedSession(request, publicId, dependencies, url);
    const expectedRevision = parseRequiredIfMatch(request);
    const raw = await readBoundedJson(request);
    const parsed = parseSetEquipmentSystemsInput(raw);
    if (!parsed.success) {
      throw new PublicApiError(400, "INVALID_REQUEST", "The equipment systems input is invalid.", toDetails(parsed.details));
    }

    const service = resolve(dependencies.logisticsService);
    const result = service.setEquipmentSystems(auth, expectedRevision, equipmentPublicId, parsed.data);
    return mutationResponse(result, 200);
  } catch (error) {
    return mapError(error, requestId);
  }
}

// --- Systems Handlers ---

export async function handleCreateSystem(
  request: Request,
  publicId: string,
  dependencies: LogisticsHandlerDependencies,
): Promise<Response> {
  const requestId = (dependencies.requestId ?? randomUUID)();
  try {
    if (!isCanonicalUuidV4(publicId)) {
      throw new PublicApiError(404, "PROJECT_NOT_FOUND", "Project not found.");
    }
    const url = appUrl(dependencies);
    requireOrigin(request, url);
    const auth = requireAuthorizedSession(request, publicId, dependencies, url);
    const expectedRevision = parseRequiredIfMatch(request);
    const raw = await readBoundedJson(request);
    const parsed = parseCreateLogisticsSystemInput(raw);
    if (!parsed.success) {
      throw new PublicApiError(400, "INVALID_REQUEST", "The system input is invalid.", toDetails(parsed.details));
    }

    const service = resolve(dependencies.logisticsService);
    const result = service.createSystem(auth, expectedRevision, parsed.data);
    return mutationResponse(result, 201);
  } catch (error) {
    return mapError(error, requestId);
  }
}

export async function handleUpdateSystem(
  request: Request,
  publicId: string,
  systemPublicId: string,
  dependencies: LogisticsHandlerDependencies,
): Promise<Response> {
  const requestId = (dependencies.requestId ?? randomUUID)();
  try {
    if (!isCanonicalUuidV4(publicId)) {
      throw new PublicApiError(404, "PROJECT_NOT_FOUND", "Project not found.");
    }
    const url = appUrl(dependencies);
    requireOrigin(request, url);
    const auth = requireAuthorizedSession(request, publicId, dependencies, url);
    const expectedRevision = parseRequiredIfMatch(request);
    const raw = await readBoundedJson(request);
    const parsed = parseUpdateLogisticsSystemInput(raw);
    if (!parsed.success) {
      throw new PublicApiError(400, "INVALID_REQUEST", "The system update input is invalid.", toDetails(parsed.details));
    }

    const service = resolve(dependencies.logisticsService);
    const result = service.updateSystem(auth, expectedRevision, systemPublicId, parsed.data);
    return mutationResponse(result, 200);
  } catch (error) {
    return mapError(error, requestId);
  }
}

export async function handleDeleteSystem(
  request: Request,
  publicId: string,
  systemPublicId: string,
  dependencies: LogisticsHandlerDependencies,
): Promise<Response> {
  const requestId = (dependencies.requestId ?? randomUUID)();
  try {
    if (!isCanonicalUuidV4(publicId)) {
      throw new PublicApiError(404, "PROJECT_NOT_FOUND", "Project not found.");
    }
    const url = appUrl(dependencies);
    requireOrigin(request, url);
    const auth = requireAuthorizedSession(request, publicId, dependencies, url);
    const expectedRevision = parseRequiredIfMatch(request);
    const service = resolve(dependencies.logisticsService);
    const result = service.deleteSystem(auth, expectedRevision, systemPublicId, true);
    return deleteMutationResponse(result);
  } catch (error) {
    return mapError(error, requestId);
  }
}

export async function handleSetSystemProcesses(
  request: Request,
  publicId: string,
  systemPublicId: string,
  dependencies: LogisticsHandlerDependencies,
): Promise<Response> {
  const requestId = (dependencies.requestId ?? randomUUID)();
  try {
    if (!isCanonicalUuidV4(publicId)) {
      throw new PublicApiError(404, "PROJECT_NOT_FOUND", "Project not found.");
    }
    const url = appUrl(dependencies);
    requireOrigin(request, url);
    const auth = requireAuthorizedSession(request, publicId, dependencies, url);
    const expectedRevision = parseRequiredIfMatch(request);
    const raw = await readBoundedJson(request);
    const parsed = parseSetSystemProcessesInput(raw);
    if (!parsed.success) {
      throw new PublicApiError(400, "INVALID_REQUEST", "The system processes input is invalid.", toDetails(parsed.details));
    }

    const service = resolve(dependencies.logisticsService);
    const result = service.setSystemProcesses(auth, expectedRevision, systemPublicId, parsed.data);
    return mutationResponse(result, 200);
  } catch (error) {
    return mapError(error, requestId);
  }
}

export async function handleSetSystemChildren(
  request: Request,
  publicId: string,
  coordinatorPublicId: string,
  dependencies: LogisticsHandlerDependencies,
): Promise<Response> {
  const requestId = (dependencies.requestId ?? randomUUID)();
  try {
    if (!isCanonicalUuidV4(publicId)) {
      throw new PublicApiError(404, "PROJECT_NOT_FOUND", "Project not found.");
    }
    const url = appUrl(dependencies);
    requireOrigin(request, url);
    const auth = requireAuthorizedSession(request, publicId, dependencies, url);
    const expectedRevision = parseRequiredIfMatch(request);
    const raw = await readBoundedJson(request);
    const parsed = parseSetSystemChildrenInput(raw);
    if (!parsed.success) {
      throw new PublicApiError(400, "INVALID_REQUEST", "The system children input is invalid.", toDetails(parsed.details));
    }

    const service = resolve(dependencies.logisticsService);
    const result = service.setCoordinatedSystems(auth, expectedRevision, coordinatorPublicId, parsed.data);
    return mutationResponse(result, 200);
  } catch (error) {
    return mapError(error, requestId);
  }
}

export async function handleSetEquipmentResourceRoles(
  request: Request,
  publicId: string,
  equipmentPublicId: string,
  dependencies: LogisticsHandlerDependencies,
): Promise<Response> {
  const requestId = (dependencies.requestId ?? randomUUID)();
  try {
    if (!isCanonicalUuidV4(publicId)) {
      throw new PublicApiError(404, "PROJECT_NOT_FOUND", "Project not found.");
    }
    const url = appUrl(dependencies);
    requireOrigin(request, url);
    const auth = requireAuthorizedSession(request, publicId, dependencies, url);
    const expectedRevision = parseRequiredIfMatch(request);
    const raw = await readBoundedJson(request);
    const parsed = parseSetEquipmentResourceRolesInput(raw);
    if (!parsed.success) {
      throw new PublicApiError(
        400,
        "INVALID_REQUEST",
        "The equipment resource roles input is invalid.",
        toDetails(parsed.details),
      );
    }

    const service = resolve(dependencies.logisticsService);
    const result = service.setEquipmentResourceRoles(
      auth,
      expectedRevision,
      equipmentPublicId,
      parsed.data,
    );
    return mutationResponse(result, 200);
  } catch (error) {
    return mapError(error, requestId);
  }
}

export async function handleSetSystemResourceRoles(
  request: Request,
  publicId: string,
  systemPublicId: string,
  dependencies: LogisticsHandlerDependencies,
): Promise<Response> {
  const requestId = (dependencies.requestId ?? randomUUID)();
  try {
    if (!isCanonicalUuidV4(publicId)) {
      throw new PublicApiError(404, "PROJECT_NOT_FOUND", "Project not found.");
    }
    const url = appUrl(dependencies);
    requireOrigin(request, url);
    const auth = requireAuthorizedSession(request, publicId, dependencies, url);
    const expectedRevision = parseRequiredIfMatch(request);
    const raw = await readBoundedJson(request);
    const parsed = parseSetSystemResourceRolesInput(raw);
    if (!parsed.success) {
      throw new PublicApiError(
        400,
        "INVALID_REQUEST",
        "The system resource roles input is invalid.",
        toDetails(parsed.details),
      );
    }

    const service = resolve(dependencies.logisticsService);
    const result = service.setSystemResourceRoles(
      auth,
      expectedRevision,
      systemPublicId,
      parsed.data,
    );
    return mutationResponse(result, 200);
  } catch (error) {
    return mapError(error, requestId);
  }
}

export async function handleGetTaskLogisticsLinks(
  request: Request,
  publicId: string,
  taskPublicId: string,
  dependencies: LogisticsHandlerDependencies,
): Promise<Response> {
  const requestId = (dependencies.requestId ?? randomUUID)();
  try {
    if (!isCanonicalUuidV4(publicId)) {
      throw new PublicApiError(404, "PROJECT_NOT_FOUND", "Project not found.");
    }
    const url = appUrl(dependencies);
    const cookie = parseEditSessionCookie(
      request.headers.get("cookie"),
      dependencies.environment,
      url,
    );
    const pService = resolve(dependencies.projectService);
    const auth = pService.authorize(
      publicId,
      cookie.state === "present" ? cookie.rawToken : undefined,
    );
    if (auth.kind === "projectNotFound") {
      throw new PublicApiError(404, "PROJECT_NOT_FOUND", "Project not found.");
    }

    const service = resolve(dependencies.logisticsService);
    const projectId = service.getProjectIdByPublicId(publicId);
    if (!projectId) {
      throw new PublicApiError(404, "PROJECT_NOT_FOUND", "Project not found.");
    }

    const links = service.getTaskLogisticsLinks(projectId, taskPublicId);
    const permission = auth.kind === "authorized" ? "edit" : "readonly";

    return Response.json(
      {
        data: {
          taskId: taskPublicId,
          links,
          permission,
        },
      },
      {
        status: 200,
        headers: NO_STORE_HEADERS,
      },
    );
  } catch (error) {
    return mapError(error, requestId);
  }
}

export async function handleReplaceTaskLogisticsLinks(
  request: Request,
  publicId: string,
  taskPublicId: string,
  dependencies: LogisticsHandlerDependencies,
): Promise<Response> {
  const requestId = (dependencies.requestId ?? randomUUID)();
  try {
    if (!isCanonicalUuidV4(publicId)) {
      throw new PublicApiError(404, "PROJECT_NOT_FOUND", "Project not found.");
    }
    const url = appUrl(dependencies);
    requireOrigin(request, url);
    const auth = requireAuthorizedSession(request, publicId, dependencies, url);
    const expectedRevision = parseRequiredIfMatch(request);
    const raw = await readBoundedJson(request);
    const parsed = parseReplaceTaskLogisticsLinksInput(raw);
    if (!parsed.success) {
      throw new PublicApiError(
        400,
        "INVALID_REQUEST",
        "The task logistics links input is invalid.",
        toDetails(parsed.details),
      );
    }

    const service = resolve(dependencies.logisticsService);
    const result = service.replaceTaskLogisticsLinks(
      auth,
      expectedRevision,
      taskPublicId,
      parsed.data,
    );
    return mutationResponse(result, 200);
  } catch (error) {
    return mapError(error, requestId);
  }
}

export async function handleGetLogisticsDashboard(
  request: Request,
  publicId: string,
  dependencies: LogisticsHandlerDependencies & {
    dashboardService: LogisticsDashboardService | (() => LogisticsDashboardService);
  },
): Promise<Response> {
  const requestId = (dependencies.requestId ?? randomUUID)();
  try {
    if (!isCanonicalUuidV4(publicId)) {
      throw new PublicApiError(404, "PROJECT_NOT_FOUND", "Project not found.");
    }

    const url = new URL(request.url);
    const asOfDate = url.searchParams.get("asOfDate") || undefined;
    if (asOfDate) {
      try {
        parseDateOnly(asOfDate, "asOfDate");
      } catch {
        throw new PublicApiError(400, "INVALID_REQUEST", "Invalid asOfDate query parameter.");
      }
    }

    const horizonDaysRaw = url.searchParams.get("horizonDays");
    let horizonDays: number | undefined;
    if (horizonDaysRaw !== null) {
      const parsed = Number(horizonDaysRaw);
      if (!Number.isInteger(parsed) || parsed < 1 || parsed > 90) {
        throw new PublicApiError(400, "INVALID_REQUEST", "horizonDays must be an integer between 1 and 90.");
      }
      horizonDays = parsed;
    }

    const systemViewRaw = url.searchParams.get("systemView");
    const systemView = systemViewRaw === "coordination" ? "coordination" : "direct";

    const activeOnly = url.searchParams.get("activeOnly") === "true";
    const includeDescendantProcesses = url.searchParams.get("includeDescendantProcesses") !== "false";

    const mdPerMmRaw = url.searchParams.get("mdPerMm");
    if (url.searchParams.getAll("mdPerMm").length > 1) {
      throw new PublicApiError(400, "INVALID_REQUEST", "mdPerMm must occur once.");
    }
    let mdPerMm: number | null | undefined;
    if (mdPerMmRaw === "null") mdPerMm = null;
    else if (mdPerMmRaw !== null) {
      const parsed = Number(mdPerMmRaw);
      if (mdPerMmRaw.trim() === "" || !Number.isFinite(parsed) || parsed <= 0) {
        throw new PublicApiError(400, "INVALID_REQUEST", "mdPerMm must be a positive finite number or null.");
      }
      mdPerMm = parsed;
    }

    const parseQueryArray = (paramName: string): string[] | undefined => {
      const all = url.searchParams.getAll(paramName);
      if (all.length === 0) return undefined;
      const list = all.flatMap((item) => item.split(",")).map((s) => s.trim()).filter(Boolean);
      return list.length > 0 ? list : undefined;
    };

    const processIds = parseQueryArray("processIds");
    const equipmentIds = parseQueryArray("equipmentIds");
    const systemIds = parseQueryArray("systemIds");
    const taskAssigneeResourceIds = parseQueryArray("taskAssigneeResourceIds");
    const roleResourceIds = parseQueryArray("roleResourceIds");

    const service = resolve(dependencies.dashboardService);
    const dashboard = service.getDashboard(publicId, {
      asOfDate,
      horizonDays,
      systemView,
      activeOnly,
      includeDescendantProcesses,
      mdPerMm,
      processIds,
      equipmentIds,
      systemIds,
      taskAssigneeResourceIds,
      roleResourceIds,
    });

    if (!dashboard) {
      throw new PublicApiError(404, "PROJECT_NOT_FOUND", "Project not found.");
    }

    return Response.json({ data: dashboard }, { status: 200, headers: NO_STORE_HEADERS });
  } catch (error) {
    return mapError(error, requestId);
  }
}
