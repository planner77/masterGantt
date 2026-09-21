import { randomUUID } from "node:crypto";

import type { TaskHierarchyCommandRequest, TaskMutationResponse } from "../../contracts/projects";
import { SchedulingError } from "../../domain/scheduling";
import { apiErrorResponse, PublicApiError } from "../http/api-error-core";
import { parseRequiredIfMatch, readBoundedJson } from "../http/request-core";
import { parseEditSessionCookie } from "../security/cookie-core";
import {
  ConfigurationError,
  isExactAllowedOrigin,
  parseApplicationBaseUrl,
} from "../security/origin-core";
import type { AuthorizationResult, AuthorizedEditSession } from "./project-service-core";
import {
  EditSessionInvalidError,
  EmptySummaryNotAllowedError,
  InvalidParentTaskError,
  InvalidTaskInputError,
  PersistedScheduleInvalidError,
  RevisionMismatchError,
  TaskLimitExceededError,
  TaskNotFoundError,
  UnsupportedScheduleStructureError,
} from "./project-service-core";
import { parseTaskHierarchyCommand } from "./task-hierarchy-contract";
import {
  TaskCopyAssignmentUnsupportedError,
  TaskHierarchyNoopError,
} from "./task-hierarchy-service-core";

const NO_STORE_HEADERS = { "Cache-Control": "private, no-store" };

interface AuthorizationApi {
  authorize(publicId: string, rawToken: string | undefined): AuthorizationResult;
}

interface HierarchyApi {
  execute(
    authorization: AuthorizedEditSession,
    expectedRevision: number,
    command: TaskHierarchyCommandRequest,
  ): TaskMutationResponse;
}

type Dependency<T> = T | (() => T);

export interface TaskHierarchyHandlerDependencies {
  authorizationService: Dependency<AuthorizationApi>;
  hierarchyService: Dependency<HierarchyApi>;
  applicationBaseUrl: string | undefined;
  allowInsecureHttp?: string;
  environment: string | undefined;
  requestId?: () => string;
}

function resolve<T>(value: Dependency<T>): T {
  return typeof value === "function" ? (value as () => T)() : value;
}

function applicationUrl(dependencies: TaskHierarchyHandlerDependencies): URL {
  try {
    return parseApplicationBaseUrl(
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
}

function authorize(
  request: Request,
  publicId: string,
  service: AuthorizationApi,
  environment: string | undefined,
  url: URL,
): AuthorizedEditSession {
  if (!isExactAllowedOrigin(request.headers.get("origin"), url)) {
    throw new PublicApiError(403, "ORIGIN_NOT_ALLOWED", "The request origin is not allowed.");
  }
  const cookie = parseEditSessionCookie(request.headers.get("cookie"), environment, url);
  const result = service.authorize(publicId, cookie.state === "present" ? cookie.rawToken : undefined);
  if (result.kind === "projectNotFound") throw new PublicApiError(404, "PROJECT_NOT_FOUND", "Project not found.");
  if (result.kind === "unauthorized") {
    throw new PublicApiError(401, "EDIT_SESSION_REQUIRED", "A valid edit session is required.");
  }
  return result.authorization;
}

function finishError(error: unknown, requestId: string): Response {
  let mapped: unknown = error;
  if (error instanceof EditSessionInvalidError) {
    mapped = new PublicApiError(401, "EDIT_SESSION_REQUIRED", "A valid edit session is required.");
  } else if (error instanceof RevisionMismatchError) {
    mapped = new PublicApiError(412, "REVISION_MISMATCH", "Project changed. Reload and retry.");
  } else if (error instanceof TaskNotFoundError) {
    mapped = new PublicApiError(404, "TASK_NOT_FOUND", "Task not found.");
  } else if (error instanceof TaskHierarchyNoopError) {
    mapped = new PublicApiError(409, "TASK_COMMAND_NOT_AVAILABLE", "The task command is not available for this position.");
  } else if (error instanceof TaskCopyAssignmentUnsupportedError) {
    mapped = new PublicApiError(
      409,
      "TASK_COPY_ASSIGNMENTS_UNSUPPORTED",
      "Tasks with resource assignments cannot be copied by this command.",
    );
  } else if (error instanceof InvalidParentTaskError) {
    mapped = new PublicApiError(409, "INVALID_PARENT_TASK", "The selected task cannot contain child tasks.");
  } else if (error instanceof EmptySummaryNotAllowedError) {
    mapped = new PublicApiError(409, "EMPTY_SUMMARY_NOT_ALLOWED", "The hierarchy command would leave an empty summary.");
  } else if (error instanceof UnsupportedScheduleStructureError) {
    mapped = new PublicApiError(409, "UNSUPPORTED_SCHEDULE_STRUCTURE", "This schedule structure is not supported by this operation.");
  } else if (error instanceof TaskLimitExceededError) {
    mapped = new PublicApiError(409, "TASK_LIMIT_EXCEEDED", "The project task limit has been reached.");
  } else if (error instanceof InvalidTaskInputError) {
    mapped = new PublicApiError(400, "INVALID_REQUEST", "The hierarchy command is invalid.");
  } else if (error instanceof SchedulingError) {
    mapped = new PublicApiError(422, error.code, "The task schedule is invalid.");
  } else if (error instanceof PersistedScheduleInvalidError) {
    mapped = new PublicApiError(500, "INTERNAL_ERROR", "The request could not be completed.");
  }
  const response = apiErrorResponse(mapped, requestId);
  response.headers.set("Cache-Control", NO_STORE_HEADERS["Cache-Control"]);
  return response;
}

export async function handleTaskHierarchyCommand(
  request: Request,
  publicId: string,
  dependencies: TaskHierarchyHandlerDependencies,
): Promise<Response> {
  const requestId = (dependencies.requestId ?? randomUUID)();
  try {
    const url = applicationUrl(dependencies);
    if (!isExactAllowedOrigin(request.headers.get("origin"), url)) {
      throw new PublicApiError(403, "ORIGIN_NOT_ALLOWED", "The request origin is not allowed.");
    }
    const raw = await readBoundedJson(request);
    const parsed = parseTaskHierarchyCommand(raw);
    if (!parsed.success) {
      throw new PublicApiError(400, "INVALID_REQUEST", "The task hierarchy command is invalid.", parsed.details);
    }
    const authorization = authorize(
      request,
      publicId,
      resolve(dependencies.authorizationService),
      dependencies.environment,
      url,
    );
    const expectedRevision = parseRequiredIfMatch(request);
    const result = resolve(dependencies.hierarchyService).execute(
      authorization,
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
    return finishError(error, requestId);
  }
}
