import { randomUUID } from "node:crypto";

import type {
  ChangeEditPasswordRequest,
  CurrentEditSessionResponse,
  UnlockProjectRequest,
} from "../../contracts/projects";
import { apiErrorResponse, PublicApiError } from "../http/api-error-core";
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
import type { FixedWindowRateLimiter } from "../security/rate-limit-core";
import {
  isCanonicalUuidV4,
  parseChangeEditPasswordInput,
  parseUnlockProjectInput,
} from "./project-contract";
import {
  EditSessionInvalidError,
  RevisionMismatchError,
  type AuthorizationResult,
  type AuthorizedEditSession,
  type LogoutResult,
  type UnlockedProject,
} from "./project-service-core";

const NO_STORE_HEADERS = { "Cache-Control": "private, no-store" };
const INVALID_CREDENTIALS = new PublicApiError(
  401,
  "INVALID_CREDENTIALS",
  "The project identifier or edit password is invalid.",
);

interface EditSessionServiceApi {
  unlock(publicId: string, editPassword: string): Promise<UnlockedProject | undefined>;
  getCurrentEditSession(
    publicId: string,
    rawToken: string | undefined,
  ): CurrentEditSessionResponse | undefined;
  authorize(publicId: string, rawToken: string | undefined): AuthorizationResult;
  rotatePassword(
    authorization: AuthorizedEditSession,
    expectedRevision: number,
    newEditPassword: string,
  ): Promise<{ rawSessionToken: string; revision: number }>;
  logout(
    publicId: string,
    cookie: ReturnType<typeof parseEditSessionCookie>,
  ): LogoutResult;
}

type ServiceDependency = EditSessionServiceApi | (() => EditSessionServiceApi);

interface CommonDependencies {
  service: ServiceDependency;
  environment: string | undefined;
  requestId?: () => string;
}

export interface UnlockHandlerDependencies extends CommonDependencies {
  applicationBaseUrl: string | undefined;
  globalRateLimiter: Pick<FixedWindowRateLimiter, "consume">;
  projectRateLimiter: Pick<FixedWindowRateLimiter, "consume">;
}

export type CurrentSessionHandlerDependencies = CommonDependencies;

export interface LogoutHandlerDependencies extends CommonDependencies {
  applicationBaseUrl: string | undefined;
}

export interface ChangePasswordHandlerDependencies extends CommonDependencies {
  applicationBaseUrl: string | undefined;
}

function resolveService(dependency: ServiceDependency): EditSessionServiceApi {
  return typeof dependency === "function" ? dependency() : dependency;
}

function configurationError(): PublicApiError {
  return new PublicApiError(
    500,
    "CONFIGURATION_ERROR",
    "The service is not configured correctly.",
  );
}

function applicationUrl(
  configured: string | undefined,
  environment: string | undefined,
): URL {
  try {
    return parseApplicationBaseUrl(configured, environment);
  } catch (error) {
    if (error instanceof ConfigurationError) {
      throw configurationError();
    }
    throw error;
  }
}

function requireOrigin(request: Request, url: URL): void {
  if (!isExactAllowedOrigin(request.headers.get("origin"), url)) {
    throw new PublicApiError(
      403,
      "ORIGIN_NOT_ALLOWED",
      "The request origin is not allowed.",
    );
  }
}

function projectNotFound(): PublicApiError {
  return new PublicApiError(404, "PROJECT_NOT_FOUND", "Project not found.");
}

function sessionRequired(): PublicApiError {
  return new PublicApiError(
    401,
    "EDIT_SESSION_REQUIRED",
    "A valid edit session is required.",
  );
}

function unwrapAuthorization(result: AuthorizationResult): AuthorizedEditSession {
  if (result.kind === "projectNotFound") {
    throw projectNotFound();
  }
  if (result.kind === "unauthorized") {
    throw sessionRequired();
  }
  return result.authorization;
}

function finishError(error: unknown, requestId: string): Response {
  let mapped = error;
  if (error instanceof EditSessionInvalidError) {
    mapped = sessionRequired();
  } else if (error instanceof RevisionMismatchError) {
    mapped = new PublicApiError(
      412,
      "REVISION_MISMATCH",
      "Project changed. Reload and retry.",
    );
  } else if (error instanceof PasswordHashCapacityError) {
    mapped = new PublicApiError(
      429,
      "RATE_LIMITED",
      "The password service is busy. Retry shortly.",
      [],
      { "Retry-After": "1" },
    );
  }
  const response = apiErrorResponse(mapped, requestId);
  response.headers.set("Cache-Control", NO_STORE_HEADERS["Cache-Control"]);
  return response;
}

export async function handleUnlockProject(
  request: Request,
  publicId: string,
  dependencies: UnlockHandlerDependencies,
): Promise<Response> {
  const requestId = (dependencies.requestId ?? randomUUID)();
  try {
    const url = applicationUrl(
      dependencies.applicationBaseUrl,
      dependencies.environment,
    );
    requireOrigin(request, url);
    const raw = await readBoundedJson(request);
    const parsed = parseUnlockProjectInput(raw);
    if (!parsed.success) {
      throw new PublicApiError(
        400,
        "INVALID_REQUEST",
        "The edit session input is invalid.",
        parsed.details,
      );
    }

    const global = dependencies.globalRateLimiter.consume("unattributed");
    if (!global.allowed) {
      throw new PublicApiError(
        429,
        "RATE_LIMITED",
        "Too many edit session attempts.",
        [],
        { "Retry-After": String(global.retryAfterSeconds) },
      );
    }
    const projectKey = isCanonicalUuidV4(publicId) ? publicId : "invalid-project";
    const perProject = dependencies.projectRateLimiter.consume(projectKey);
    if (!perProject.allowed) {
      throw new PublicApiError(
        429,
        "RATE_LIMITED",
        "Too many edit session attempts.",
        [],
        { "Retry-After": String(perProject.retryAfterSeconds) },
      );
    }

    const unlocked = await resolveService(dependencies.service).unlock(
      publicId,
      (parsed.data as UnlockProjectRequest).editPassword,
    );
    if (!unlocked) {
      throw INVALID_CREDENTIALS;
    }
    return new Response(null, {
      status: 204,
      headers: {
        ...NO_STORE_HEADERS,
        "Set-Cookie": serializeEditSessionCookie(
          unlocked.rawSessionToken,
          url,
          dependencies.environment,
        ),
      },
    });
  } catch (error) {
    return finishError(error, requestId);
  }
}

export function handleCurrentEditSession(
  request: Request,
  publicId: string,
  dependencies: CurrentSessionHandlerDependencies,
): Response {
  const requestId = (dependencies.requestId ?? randomUUID)();
  try {
    if (!isCanonicalUuidV4(publicId)) {
      throw projectNotFound();
    }
    const cookie = parseEditSessionCookie(
      request.headers.get("cookie"),
      dependencies.environment,
    );
    const current = resolveService(dependencies.service).getCurrentEditSession(
      publicId,
      cookie.state === "present" ? cookie.rawToken : undefined,
    );
    if (!current) {
      throw projectNotFound();
    }
    return Response.json(current, {
      status: 200,
      headers: {
        ...NO_STORE_HEADERS,
        "Content-Type": "application/json; charset=utf-8",
      },
    });
  } catch (error) {
    return finishError(error, requestId);
  }
}

export function handleLogoutProject(
  request: Request,
  publicId: string,
  dependencies: LogoutHandlerDependencies,
): Response {
  const requestId = (dependencies.requestId ?? randomUUID)();
  try {
    const url = applicationUrl(
      dependencies.applicationBaseUrl,
      dependencies.environment,
    );
    requireOrigin(request, url);
    if (!isCanonicalUuidV4(publicId)) {
      throw projectNotFound();
    }
    const cookie = parseEditSessionCookie(
      request.headers.get("cookie"),
      dependencies.environment,
    );
    const result = resolveService(dependencies.service).logout(publicId, cookie);
    if (result.kind === "projectNotFound") {
      throw projectNotFound();
    }
    const headers = new Headers(NO_STORE_HEADERS);
    if (result.kind === "clearCookie") {
      headers.set(
        "Set-Cookie",
        serializeExpiredEditSessionCookie(url, dependencies.environment),
      );
    }
    return new Response(null, { status: 204, headers });
  } catch (error) {
    return finishError(error, requestId);
  }
}

export async function handleChangeEditPassword(
  request: Request,
  publicId: string,
  dependencies: ChangePasswordHandlerDependencies,
): Promise<Response> {
  const requestId = (dependencies.requestId ?? randomUUID)();
  try {
    const url = applicationUrl(
      dependencies.applicationBaseUrl,
      dependencies.environment,
    );
    requireOrigin(request, url);
    const raw = await readBoundedJson(request);
    const parsed = parseChangeEditPasswordInput(raw);
    if (!parsed.success) {
      throw new PublicApiError(
        400,
        "INVALID_REQUEST",
        "The password change input is invalid.",
        parsed.details,
      );
    }
    const cookie = parseEditSessionCookie(
      request.headers.get("cookie"),
      dependencies.environment,
    );
    const service = resolveService(dependencies.service);
    const authorization = unwrapAuthorization(
      service.authorize(
        publicId,
        cookie.state === "present" ? cookie.rawToken : undefined,
      ),
    );
    const expectedRevision = parseRequiredIfMatch(request);
    const rotated = await service.rotatePassword(
      authorization,
      expectedRevision,
      (parsed.data as ChangeEditPasswordRequest).newEditPassword,
    );
    return new Response(null, {
      status: 204,
      headers: {
        ...NO_STORE_HEADERS,
        ETag: `"${rotated.revision}"`,
        "Set-Cookie": serializeEditSessionCookie(
          rotated.rawSessionToken,
          url,
          dependencies.environment,
        ),
      },
    });
  } catch (error) {
    return finishError(error, requestId);
  }
}
