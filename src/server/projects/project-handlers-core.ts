import { randomUUID } from "node:crypto";

import type {
  CreateProjectResponse,
  ProjectListResponse,
  ProjectMetadataMutationResponse,
  ProjectSnapshotResponse,
  UpdateProjectRequest,
} from "../../contracts/projects";
import {
  apiErrorResponse,
  PublicApiError,
} from "../http/api-error-core";
import { parseRequiredIfMatch, readBoundedJson } from "../http/request-core";
import {
  parseEditSessionCookie,
  serializeEditSessionCookie,
  serializeExpiredEditSessionCookie,
} from "../security/cookie-core";
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
import {
  isCanonicalUuidV4,
  parseCreateProjectInput,
  parseUpdateProjectInput,
  type CreateProjectInput,
} from "./project-contract";
import {
  EditSessionInvalidError,
  RevisionMismatchError,
  type AuthorizationResult,
  type AuthorizedEditSession,
  type CreatedProject,
} from "./project-service-core";

interface ProjectServiceApi {
  create(input: CreateProjectInput): Promise<CreatedProject>;
  listProjects(): ProjectListResponse;
  getReadonlySnapshot(publicId: string): ProjectSnapshotResponse | undefined;
  authorize(publicId: string, rawToken: string | undefined): AuthorizationResult;
  updateMetadata(
    authorization: AuthorizedEditSession,
    expectedRevision: number,
    input: UpdateProjectRequest,
  ): ProjectMetadataMutationResponse;
  deleteProject(
    authorization: AuthorizedEditSession,
    expectedRevision: number,
  ): void;
}

export interface UpdateProjectHandlerDependencies {
  service:
    | Pick<ProjectServiceApi, "authorize" | "updateMetadata">
    | (() => Pick<ProjectServiceApi, "authorize" | "updateMetadata">);
  applicationBaseUrl: string | undefined;
  allowInsecureHttp?: string;
  environment: string | undefined;
  requestId?: () => string;
}

export interface DeleteProjectHandlerDependencies {
  service:
    | Pick<ProjectServiceApi, "authorize" | "deleteProject">
    | (() => Pick<ProjectServiceApi, "authorize" | "deleteProject">);
  applicationBaseUrl: string | undefined;
  allowInsecureHttp?: string;
  environment: string | undefined;
  requestId?: () => string;
}

export interface CreateProjectHandlerDependencies {
  service:
    | Pick<ProjectServiceApi, "create" | "getReadonlySnapshot">
    | (() => Pick<ProjectServiceApi, "create" | "getReadonlySnapshot">);
  rateLimiter: Pick<FixedWindowRateLimiter, "consume">;
  applicationBaseUrl: string | undefined;
  allowInsecureHttp?: string;
  environment: string | undefined;
  requestId?: () => string;
}

export interface ReadProjectHandlerDependencies {
  service:
    | Pick<ProjectServiceApi, "getReadonlySnapshot">
    | (() => Pick<ProjectServiceApi, "getReadonlySnapshot">);
  requestId?: () => string;
}

export interface ListProjectsHandlerDependencies {
  service:
    | Pick<ProjectServiceApi, "listProjects">
    | (() => Pick<ProjectServiceApi, "listProjects">);
  requestId?: () => string;
}

const NO_STORE_HEADERS = { "Cache-Control": "private, no-store" };

function configurationApiError(): PublicApiError {
  return new PublicApiError(
    500,
    "CONFIGURATION_ERROR",
    "The service is not configured correctly.",
  );
}

function resolveDependency<T>(dependency: T | (() => T)): T {
  return typeof dependency === "function"
    ? (dependency as () => T)()
    : dependency;
}

export async function handleCreateProject(
  request: Request,
  dependencies: CreateProjectHandlerDependencies,
): Promise<Response> {
  const requestId = (dependencies.requestId ?? randomUUID)();

  try {
    let applicationUrl: URL;
    try {
      applicationUrl = parseApplicationBaseUrl(
        dependencies.applicationBaseUrl,
        dependencies.environment,
        dependencies.allowInsecureHttp,
      );
    } catch (error) {
      if (error instanceof ConfigurationError) {
        throw configurationApiError();
      }
      throw error;
    }

    if (!isExactAllowedOrigin(request.headers.get("origin"), applicationUrl)) {
      throw new PublicApiError(
        403,
        "ORIGIN_NOT_ALLOWED",
        "The request origin is not allowed.",
      );
    }

    const rawInput = await readBoundedJson(request);
    const parsed = parseCreateProjectInput(rawInput);
    if (!parsed.success) {
      throw new PublicApiError(
        400,
        "INVALID_REQUEST",
        "The project input is invalid.",
        parsed.details,
      );
    }

    const rateLimit = dependencies.rateLimiter.consume(
      UNATTRIBUTED_CREATE_RATE_KEY,
    );
    if (!rateLimit.allowed) {
      throw new PublicApiError(
        429,
        "RATE_LIMITED",
        "Too many project creation attempts.",
        [],
        { "Retry-After": String(rateLimit.retryAfterSeconds) },
      );
    }

    let created: CreatedProject;
    try {
      created = await resolveDependency(dependencies.service).create(parsed.data);
    } catch (error) {
      if (error instanceof PasswordHashCapacityError) {
        throw new PublicApiError(
          429,
          "RATE_LIMITED",
          "The password service is busy. Retry shortly.",
          [],
          { "Retry-After": "1" },
        );
      }
      throw error;
    }

    const responseBody: CreateProjectResponse = created.response;
    const publicId = responseBody.data.project.publicId;
    return Response.json(responseBody, {
      status: 201,
      headers: {
        ...NO_STORE_HEADERS,
        "Content-Type": "application/json; charset=utf-8",
        ETag: `"${responseBody.data.project.revision}"`,
        Location: `/projects/${publicId}`,
        "Set-Cookie": serializeEditSessionCookie(
          created.rawSessionToken,
          applicationUrl,
          dependencies.environment,
        ),
      },
    });
  } catch (error) {
    const response = apiErrorResponse(error, requestId);
    response.headers.set("Cache-Control", NO_STORE_HEADERS["Cache-Control"]);
    return response;
  }
}

export function handleReadProject(
  publicId: string,
  dependencies: ReadProjectHandlerDependencies,
): Response {
  const requestId = (dependencies.requestId ?? randomUUID)();

  try {
    if (!isCanonicalUuidV4(publicId)) {
      throw new PublicApiError(
        404,
        "PROJECT_NOT_FOUND",
        "Project not found.",
      );
    }

    const snapshot = resolveDependency(
      dependencies.service,
    ).getReadonlySnapshot(publicId);
    if (!snapshot) {
      throw new PublicApiError(
        404,
        "PROJECT_NOT_FOUND",
        "Project not found.",
      );
    }

    return Response.json(snapshot, {
      status: 200,
      headers: {
        ...NO_STORE_HEADERS,
        "Content-Type": "application/json; charset=utf-8",
        ETag: `"${snapshot.data.project.revision}"`,
      },
    });
  } catch (error) {
    const response = apiErrorResponse(error, requestId);
    response.headers.set("Cache-Control", NO_STORE_HEADERS["Cache-Control"]);
    return response;
  }
}

export function handleProjectCollectionGet(
  dependencies: ListProjectsHandlerDependencies,
): Response {
  const requestId = (dependencies.requestId ?? randomUUID)();

  try {
    const responseBody = resolveDependency(dependencies.service).listProjects();
    return Response.json(responseBody, {
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

export async function handleUpdateProject(
  request: Request,
  publicId: string,
  dependencies: UpdateProjectHandlerDependencies,
): Promise<Response> {
  const requestId = (dependencies.requestId ?? randomUUID)();
  try {
    let applicationUrl: URL;
    try {
      applicationUrl = parseApplicationBaseUrl(
        dependencies.applicationBaseUrl,
        dependencies.environment,
        dependencies.allowInsecureHttp,
      );
    } catch (error) {
      if (error instanceof ConfigurationError) {
        throw configurationApiError();
      }
      throw error;
    }
    if (!isExactAllowedOrigin(request.headers.get("origin"), applicationUrl)) {
      throw new PublicApiError(
        403,
        "ORIGIN_NOT_ALLOWED",
        "The request origin is not allowed.",
      );
    }

    const rawInput = await readBoundedJson(request);
    const parsed = parseUpdateProjectInput(rawInput);
    if (!parsed.success) {
      throw new PublicApiError(
        400,
        "INVALID_REQUEST",
        "The project metadata input is invalid.",
        parsed.details,
      );
    }

    const cookie = parseEditSessionCookie(
      request.headers.get("cookie"),
      dependencies.environment,
      applicationUrl,
    );
    const service = resolveDependency(dependencies.service);
    const authorization = service.authorize(
      publicId,
      cookie.state === "present" ? cookie.rawToken : undefined,
    );
    if (authorization.kind === "projectNotFound") {
      throw new PublicApiError(404, "PROJECT_NOT_FOUND", "Project not found.");
    }
    if (authorization.kind === "unauthorized") {
      throw new PublicApiError(
        401,
        "EDIT_SESSION_REQUIRED",
        "A valid edit session is required.",
      );
    }
    const expectedRevision = parseRequiredIfMatch(request);
    const result = service.updateMetadata(
      authorization.authorization,
      expectedRevision,
      parsed.data,
    );
    return Response.json(result, {
      status: 200,
      headers: {
        ...NO_STORE_HEADERS,
        "Content-Type": "application/json; charset=utf-8",
        ETag: `"${result.data.project.revision}"`,
      },
    });
  } catch (error) {
    let mapped = error;
    if (error instanceof EditSessionInvalidError) {
      mapped = new PublicApiError(
        401,
        "EDIT_SESSION_REQUIRED",
        "A valid edit session is required.",
      );
    } else if (error instanceof RevisionMismatchError) {
      mapped = new PublicApiError(
        412,
        "REVISION_MISMATCH",
        "Project changed. Reload and retry.",
      );
    }
    const response = apiErrorResponse(mapped, requestId);
    response.headers.set("Cache-Control", NO_STORE_HEADERS["Cache-Control"]);
    return response;
  }
}

export function handleDeleteProject(
  request: Request,
  publicId: string,
  dependencies: DeleteProjectHandlerDependencies,
): Response {
  const requestId = (dependencies.requestId ?? randomUUID)();
  try {
    let applicationUrl: URL;
    try {
      applicationUrl = parseApplicationBaseUrl(
        dependencies.applicationBaseUrl,
        dependencies.environment,
        dependencies.allowInsecureHttp,
      );
    } catch (error) {
      if (error instanceof ConfigurationError) {
        throw configurationApiError();
      }
      throw error;
    }
    if (!isExactAllowedOrigin(request.headers.get("origin"), applicationUrl)) {
      throw new PublicApiError(
        403,
        "ORIGIN_NOT_ALLOWED",
        "The request origin is not allowed.",
      );
    }

    const cookie = parseEditSessionCookie(
      request.headers.get("cookie"),
      dependencies.environment,
      applicationUrl,
    );
    const service = resolveDependency(dependencies.service);
    const authorization = service.authorize(
      publicId,
      cookie.state === "present" ? cookie.rawToken : undefined,
    );
    if (authorization.kind === "projectNotFound") {
      throw new PublicApiError(404, "PROJECT_NOT_FOUND", "Project not found.");
    }
    if (authorization.kind === "unauthorized") {
      throw new PublicApiError(
        401,
        "EDIT_SESSION_REQUIRED",
        "A valid edit session is required.",
      );
    }

    const expectedRevision = parseRequiredIfMatch(request);
    service.deleteProject(authorization.authorization, expectedRevision);
    return new Response(null, {
      status: 204,
      headers: {
        ...NO_STORE_HEADERS,
        "Set-Cookie": serializeExpiredEditSessionCookie(
          applicationUrl,
          dependencies.environment,
        ),
      },
    });
  } catch (error) {
    let mapped = error;
    if (error instanceof EditSessionInvalidError) {
      mapped = new PublicApiError(
        401,
        "EDIT_SESSION_REQUIRED",
        "A valid edit session is required.",
      );
    } else if (error instanceof RevisionMismatchError) {
      mapped = new PublicApiError(
        412,
        "REVISION_MISMATCH",
        "Project changed. Reload and retry.",
      );
    }
    const response = apiErrorResponse(mapped, requestId);
    response.headers.set("Cache-Control", NO_STORE_HEADERS["Cache-Control"]);
    return response;
  }
}
