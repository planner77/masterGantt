import { randomUUID } from "node:crypto";

import type {
  CreateTemplateFromProjectRequest,
  DuplicateProjectTemplateRequest,
  InstantiateProjectTemplateRequest,
  InstantiateProjectTemplateResponse,
  ProjectTemplateDetailResponse,
  ProjectTemplateListResponse,
  ProjectTemplateMutationResponse,
  UpdateProjectTemplateRequest,
} from "../../contracts/project-templates";
import { apiErrorResponse, PublicApiError } from "../http/api-error-core";
import { parseRequiredIfMatch, readBoundedJson } from "../http/request-core";
import { parseEditSessionCookie, serializeEditSessionCookie } from "../security/cookie-core";
import {
  ConfigurationError,
  isExactAllowedOrigin,
  parseApplicationBaseUrl,
} from "../security/origin-core";
import { PasswordHashCapacityError } from "../security/password-core";
import {
  UNATTRIBUTED_CREATE_RATE_KEY,
  type FixedWindowRateLimiter,
} from "../security/rate-limit-core";
import { isCanonicalUuidV4 } from "../projects/project-contract";
import type { AuthorizationResult } from "../projects/project-service-core";
import {
  EditSessionInvalidError,
  RevisionMismatchError,
} from "../projects/project-service-core";
import {
  ProjectTemplateError,
  type ProjectTemplateService,
} from "./project-template-service-core";

const NO_STORE_HEADERS = { "Cache-Control": "private, no-store" };

export interface ProjectTemplateHandlerDependencies {
  templateService: ProjectTemplateService | (() => ProjectTemplateService);
  projectService?:
    | { authorize(publicId: string, rawToken: string | undefined): AuthorizationResult }
    | (() => { authorize(publicId: string, rawToken: string | undefined): AuthorizationResult });
  rateLimiter?: Pick<FixedWindowRateLimiter, "consume">;
  applicationBaseUrl?: string;
  allowInsecureHttp?: string;
  environment?: string;
  requestId?: () => string;
}

function resolve<T>(value: T | (() => T)): T {
  return typeof value === "function" ? (value as () => T)() : value;
}

function verifyOrigin(request: Request, dependencies: ProjectTemplateHandlerDependencies): URL {
  let applicationUrl: URL;
  try {
    applicationUrl = parseApplicationBaseUrl(
      dependencies.applicationBaseUrl,
      dependencies.environment,
      dependencies.allowInsecureHttp,
    );
  } catch (error) {
    if (error instanceof ConfigurationError) {
      throw new PublicApiError(500, "CONFIGURATION_ERROR", "The service is not configured correctly.");
    }
    throw error;
  }
  if (!isExactAllowedOrigin(request.headers.get("origin"), applicationUrl)) {
    throw new PublicApiError(403, "ORIGIN_NOT_ALLOWED", "The request origin is not allowed.");
  }
  return applicationUrl;
}

function mapServiceError(error: unknown): never {
  if (error instanceof ProjectTemplateError) {
    switch (error.code) {
      case "TEMPLATE_NOT_FOUND":
        throw new PublicApiError(404, "TEMPLATE_NOT_FOUND", error.message);
      case "TEMPLATE_INACTIVE":
        throw new PublicApiError(400, "TEMPLATE_INACTIVE", error.message);
      case "SOURCE_PROJECT_NOT_FOUND":
        throw new PublicApiError(404, "PROJECT_NOT_FOUND", error.message);
      case "UNAUTHORIZED":
        throw new PublicApiError(401, "EDIT_SESSION_REQUIRED", error.message);
      case "REVISION_MISMATCH":
        throw new PublicApiError(412, "REVISION_MISMATCH", error.message);
      case "INVALID_TEMPLATE_REQUEST":
        throw new PublicApiError(400, "INVALID_REQUEST", error.message);
      default:
        throw new PublicApiError(400, "INVALID_REQUEST", error.message);
    }
  }
  if (error instanceof EditSessionInvalidError) {
    throw new PublicApiError(401, "EDIT_SESSION_REQUIRED", "A valid edit session is required.");
  }
  if (error instanceof RevisionMismatchError) {
    throw new PublicApiError(412, "REVISION_MISMATCH", "Project changed. Reload and retry.");
  }
  if (error instanceof PasswordHashCapacityError) {
    throw new PublicApiError(429, "RATE_LIMITED", "The password service is busy. Retry shortly.", [], {
      "Retry-After": "1",
    });
  }
  throw error;
}

export async function handleListTemplates(
  request: Request,
  dependencies: ProjectTemplateHandlerDependencies,
): Promise<Response> {
  const requestId = (dependencies.requestId ?? randomUUID)();
  try {
    const url = new URL(request.url);
    const activeOnly = url.searchParams.get("activeOnly") !== "false";
    const query = url.searchParams.get("search") ?? url.searchParams.get("query") ?? undefined;

    const templates = resolve(dependencies.templateService).listTemplates({
      activeOnly,
      query,
    });

    const body: ProjectTemplateListResponse = { data: templates };
    return Response.json(body, {
      status: 200,
      headers: {
        ...NO_STORE_HEADERS,
        "Content-Type": "application/json; charset=utf-8",
      },
    });
  } catch (error) {
    const response = apiErrorResponse(error, requestId);
    response.headers.set("Cache-Control", NO_STORE_HEADERS["Cache-Control"]);
    return response;
  }
}

export async function handleCreateTemplateFromProject(
  request: Request,
  dependencies: ProjectTemplateHandlerDependencies,
): Promise<Response> {
  const requestId = (dependencies.requestId ?? randomUUID)();
  try {
    const applicationUrl = verifyOrigin(request, dependencies);

    if (!dependencies.projectService) {
      throw new PublicApiError(500, "CONFIGURATION_ERROR", "Project service not configured.");
    }

    const payload = (await readBoundedJson(request)) as CreateTemplateFromProjectRequest;
    if (!payload || typeof payload !== "object") {
      throw new PublicApiError(400, "INVALID_REQUEST", "Invalid request body.");
    }

    const { sourceProjectPublicId, name, description } = payload;
    if (!sourceProjectPublicId || !isCanonicalUuidV4(sourceProjectPublicId)) {
      throw new PublicApiError(400, "INVALID_REQUEST", "Valid sourceProjectPublicId is required.");
    }
    if (!name || typeof name !== "string" || name.trim().length === 0) {
      throw new PublicApiError(400, "INVALID_REQUEST", "Template name is required.");
    }

    const cookie = parseEditSessionCookie(request.headers.get("cookie"), dependencies.environment, applicationUrl);
    const authorization = resolve(dependencies.projectService).authorize(
      sourceProjectPublicId,
      cookie.state === "present" ? cookie.rawToken : undefined,
    );

    if (authorization.kind === "projectNotFound") {
      throw new PublicApiError(404, "PROJECT_NOT_FOUND", "Project not found.");
    }
    if (authorization.kind !== "authorized") {
      throw new PublicApiError(401, "EDIT_SESSION_REQUIRED", "A valid edit session is required.");
    }

    const expectedRevision = parseRequiredIfMatch(request);

    try {
      const template = resolve(dependencies.templateService).createTemplateFromProject(
        authorization.authorization,
        expectedRevision,
        {
          name: name.trim(),
          description: typeof description === "string" ? description.trim() : undefined,
        },
      );

      const body: ProjectTemplateDetailResponse = { data: template };
      return Response.json(body, {
        status: 201,
        headers: {
          ...NO_STORE_HEADERS,
          "Content-Type": "application/json; charset=utf-8",
          Location: `/api/project-templates/${template.id}`,
        },
      });
    } catch (error) {
      mapServiceError(error);
    }
  } catch (error) {
    const response = apiErrorResponse(error, requestId);
    response.headers.set("Cache-Control", NO_STORE_HEADERS["Cache-Control"]);
    return response;
  }
}

export async function handleGetTemplate(
  request: Request,
  templateId: string,
  dependencies: ProjectTemplateHandlerDependencies,
): Promise<Response> {
  const requestId = (dependencies.requestId ?? randomUUID)();
  try {
    try {
      const template = resolve(dependencies.templateService).getTemplate(templateId);
      const body: ProjectTemplateDetailResponse = { data: template };
      return Response.json(body, {
        status: 200,
        headers: {
          ...NO_STORE_HEADERS,
          "Content-Type": "application/json; charset=utf-8",
        },
      });
    } catch (error) {
      mapServiceError(error);
    }
  } catch (error) {
    const response = apiErrorResponse(error, requestId);
    response.headers.set("Cache-Control", NO_STORE_HEADERS["Cache-Control"]);
    return response;
  }
}

export async function handleUpdateTemplate(
  request: Request,
  templateId: string,
  dependencies: ProjectTemplateHandlerDependencies,
): Promise<Response> {
  const requestId = (dependencies.requestId ?? randomUUID)();
  try {
    verifyOrigin(request, dependencies);

    const payload = (await readBoundedJson(request)) as UpdateProjectTemplateRequest;
    if (!payload || typeof payload !== "object") {
      throw new PublicApiError(400, "INVALID_REQUEST", "Invalid request body.");
    }

    try {
      const updated = resolve(dependencies.templateService).updateTemplate(templateId, payload);
      const body: ProjectTemplateMutationResponse = { data: updated };
      return Response.json(body, {
        status: 200,
        headers: {
          ...NO_STORE_HEADERS,
          "Content-Type": "application/json; charset=utf-8",
        },
      });
    } catch (error) {
      mapServiceError(error);
    }
  } catch (error) {
    const response = apiErrorResponse(error, requestId);
    response.headers.set("Cache-Control", NO_STORE_HEADERS["Cache-Control"]);
    return response;
  }
}

export async function handleDeleteTemplate(
  request: Request,
  templateId: string,
  dependencies: ProjectTemplateHandlerDependencies,
): Promise<Response> {
  const requestId = (dependencies.requestId ?? randomUUID)();
  try {
    verifyOrigin(request, dependencies);

    try {
      resolve(dependencies.templateService).deleteTemplate(templateId);
      return Response.json(
        { success: true },
        {
          status: 200,
          headers: {
            ...NO_STORE_HEADERS,
            "Content-Type": "application/json; charset=utf-8",
          },
        },
      );
    } catch (error) {
      mapServiceError(error);
    }
  } catch (error) {
    const response = apiErrorResponse(error, requestId);
    response.headers.set("Cache-Control", NO_STORE_HEADERS["Cache-Control"]);
    return response;
  }
}

export async function handleDuplicateTemplate(
  request: Request,
  templateId: string,
  dependencies: ProjectTemplateHandlerDependencies,
): Promise<Response> {
  const requestId = (dependencies.requestId ?? randomUUID)();
  try {
    verifyOrigin(request, dependencies);

    let customName: string | undefined;
    try {
      const payload = (await readBoundedJson(request)) as DuplicateProjectTemplateRequest | null;
      if (payload && typeof payload.name === "string") {
        customName = payload.name;
      }
    } catch {
      // empty body is acceptable for duplicate
    }

    try {
      const duplicated = resolve(dependencies.templateService).duplicateTemplate(
        templateId,
        customName ? { name: customName } : undefined,
      );
      const body: ProjectTemplateDetailResponse = { data: duplicated };
      return Response.json(body, {
        status: 201,
        headers: {
          ...NO_STORE_HEADERS,
          "Content-Type": "application/json; charset=utf-8",
          Location: `/api/project-templates/${duplicated.id}`,
        },
      });
    } catch (error) {
      mapServiceError(error);
    }
  } catch (error) {
    const response = apiErrorResponse(error, requestId);
    response.headers.set("Cache-Control", NO_STORE_HEADERS["Cache-Control"]);
    return response;
  }
}

export async function handleInstantiateTemplate(
  request: Request,
  templateId: string,
  dependencies: ProjectTemplateHandlerDependencies,
): Promise<Response> {
  const requestId = (dependencies.requestId ?? randomUUID)();
  try {
    const applicationUrl = verifyOrigin(request, dependencies);

    if (dependencies.rateLimiter) {
      const rate = dependencies.rateLimiter.consume(UNATTRIBUTED_CREATE_RATE_KEY);
      if (!rate.allowed) {
        throw new PublicApiError(429, "RATE_LIMITED", "Too many project creation attempts.", [], {
          "Retry-After": String(rate.retryAfterSeconds),
        });
      }
    }

    const payload = (await readBoundedJson(request)) as InstantiateProjectTemplateRequest;
    if (!payload || typeof payload !== "object") {
      throw new PublicApiError(400, "INVALID_REQUEST", "Invalid request body.");
    }

    if (!payload.name || typeof payload.name !== "string" || payload.name.trim().length === 0) {
      throw new PublicApiError(400, "INVALID_REQUEST", "Project name is required.");
    }
    if (!payload.ownerName || typeof payload.ownerName !== "string" || payload.ownerName.trim().length === 0) {
      throw new PublicApiError(400, "INVALID_REQUEST", "Owner name is required.");
    }
    if (!payload.editPassword || typeof payload.editPassword !== "string") {
      throw new PublicApiError(400, "INVALID_REQUEST", "Edit password is required.");
    }
    if (!payload.projectStartDate || typeof payload.projectStartDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(payload.projectStartDate)) {
      throw new PublicApiError(400, "INVALID_REQUEST", "Valid projectStartDate (YYYY-MM-DD) is required.");
    }

    try {
      const result = await resolve(dependencies.templateService).instantiateProject(templateId, payload);
      const body: InstantiateProjectTemplateResponse = result.response;

      return Response.json(body, {
        status: 201,
        headers: {
          ...NO_STORE_HEADERS,
          "Content-Type": "application/json; charset=utf-8",
          ETag: `"${body.data.project.revision}"`,
          Location: `/projects/${body.data.project.publicId}`,
          "Set-Cookie": serializeEditSessionCookie(result.rawSessionToken, applicationUrl, dependencies.environment),
        },
      });
    } catch (error) {
      mapServiceError(error);
    }
  } catch (error) {
    const response = apiErrorResponse(error, requestId);
    response.headers.set("Cache-Control", NO_STORE_HEADERS["Cache-Control"]);
    return response;
  }
}
