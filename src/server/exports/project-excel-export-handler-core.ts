import { randomUUID } from "node:crypto";

import type { ProjectSnapshotResponse } from "@/contracts/projects";
import { apiErrorResponse, PublicApiError } from "@/server/http/api-error-core";
import { parseRequiredIfMatch, readBoundedJson } from "@/server/http/request-core";
import { isCanonicalUuidV4 } from "@/server/projects/project-contract";
import {
  ConfigurationError,
  isExactAllowedOrigin,
  parseApplicationBaseUrl,
} from "@/server/security/origin-core";
import { parseProjectExcelExportInput } from "./project-excel-export-contract";
import {
  buildProjectExcelWorkbook,
  ProjectExcelExportError,
} from "./project-excel-export-core";

const EXPORT_BODY_LIMIT_BYTES = 8 * 1_024;
const NO_STORE = "private, no-store";

interface ExportProjectService {
  getReadonlySnapshot(publicId: string): ProjectSnapshotResponse | undefined;
}

export interface ProjectExcelExportHandlerDependencies {
  service:
    | Pick<ExportProjectService, "getReadonlySnapshot">
    | (() => Pick<ExportProjectService, "getReadonlySnapshot">);
  applicationBaseUrl: string | undefined;
  allowInsecureHttp?: string;
  environment: string | undefined;
  requestId?: () => string;
  buildWorkbook?: typeof buildProjectExcelWorkbook;
}

function resolveDependency<T>(dependency: T | (() => T)): T {
  return typeof dependency === "function" ? (dependency as () => T)() : dependency;
}

export async function handleProjectExcelExport(
  request: Request,
  publicId: string,
  dependencies: ProjectExcelExportHandlerDependencies,
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
        throw new PublicApiError(500, "CONFIGURATION_ERROR", "The service is not configured correctly.");
      }
      throw error;
    }

    if (!isExactAllowedOrigin(request.headers.get("origin"), applicationUrl)) {
      throw new PublicApiError(403, "ORIGIN_NOT_ALLOWED", "The request origin is not allowed.");
    }
    if (!isCanonicalUuidV4(publicId)) {
      throw new PublicApiError(404, "PROJECT_NOT_FOUND", "Project not found.");
    }

    const expectedRevision = parseRequiredIfMatch(request);
    const rawInput = await readBoundedJson(request, EXPORT_BODY_LIMIT_BYTES);
    const parsed = parseProjectExcelExportInput(rawInput);
    if (!parsed.success) {
      throw new PublicApiError(400, "INVALID_REQUEST", "The export input is invalid.", parsed.details);
    }

    const snapshot = resolveDependency(dependencies.service).getReadonlySnapshot(publicId);
    if (!snapshot) {
      throw new PublicApiError(404, "PROJECT_NOT_FOUND", "Project not found.");
    }
    if (snapshot.data.project.revision !== expectedRevision) {
      throw new PublicApiError(412, "REVISION_MISMATCH", "Project changed. Reload and retry.");
    }

    let workbook: Uint8Array<ArrayBuffer>;
    try {
      workbook = (dependencies.buildWorkbook ?? buildProjectExcelWorkbook)(snapshot, parsed.data);
    } catch (error) {
      if (error instanceof ProjectExcelExportError) {
        throw new PublicApiError(
          422,
          error.code,
          error.code === "EXPORT_LIMIT_EXCEEDED"
            ? "The project is too large for the configured Excel export limits."
            : "The project contains data that cannot be exported safely.",
        );
      }
      throw error;
    }

    const filename = `mastergantt-${publicId}-r${expectedRevision}.xlsx`;
    const body = workbook.buffer.slice(workbook.byteOffset, workbook.byteOffset + workbook.byteLength);
    return new Response(body, {
      status: 200,
      headers: {
        "Cache-Control": NO_STORE,
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "X-Content-Type-Options": "nosniff",
        ETag: `"${expectedRevision}"`,
      },
    });
  } catch (error) {
    const response = apiErrorResponse(error, requestId);
    response.headers.set("Cache-Control", NO_STORE);
    return response;
  }
}
