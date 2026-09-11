import { randomUUID } from "node:crypto";

import type {
  CreateProjectResponse,
  ProjectSnapshotResponse,
} from "../../contracts/projects";
import {
  apiErrorResponse,
  PublicApiError,
} from "../http/api-error-core";
import { readBoundedJson } from "../http/request-core";
import { serializeEditSessionCookie } from "../security/cookie-core";
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
  type CreateProjectInput,
} from "./project-contract";
import type { CreatedProject } from "./project-service-core";

interface ProjectServiceApi {
  create(input: CreateProjectInput): Promise<CreatedProject>;
  getReadonlySnapshot(publicId: string): ProjectSnapshotResponse | undefined;
}

export interface CreateProjectHandlerDependencies {
  service: ProjectServiceApi | (() => ProjectServiceApi);
  rateLimiter: Pick<FixedWindowRateLimiter, "consume">;
  applicationBaseUrl: string | undefined;
  environment: string | undefined;
  requestId?: () => string;
}

export interface ReadProjectHandlerDependencies {
  service:
    | Pick<ProjectServiceApi, "getReadonlySnapshot">
    | (() => Pick<ProjectServiceApi, "getReadonlySnapshot">);
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
  requestId: () => string = randomUUID,
): Response {
  const response = apiErrorResponse(
    new PublicApiError(
      405,
      "METHOD_NOT_ALLOWED",
      "Project discovery is not enabled.",
      [],
      { Allow: "POST" },
    ),
    requestId(),
  );
  response.headers.set("Cache-Control", NO_STORE_HEADERS["Cache-Control"]);
  return response;
}
