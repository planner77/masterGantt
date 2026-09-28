import { randomUUID } from "node:crypto";

import type { ProjectSnapshotResponse } from "@/contracts/projects";
import { apiErrorResponse, PublicApiError } from "../http/api-error-core";
import { parseRequiredIfMatch, readBoundedJson } from "../http/request-core";
import { isCanonicalUuidV4 } from "../projects/project-contract";
import {
  ConfigurationError,
  isExactAllowedOrigin,
  parseApplicationBaseUrl,
} from "../security/origin-core";
import { parseProjectSvgExportInput } from "./project-svg-export-contract";
import { buildProjectGanttSvg, ProjectSvgExportError } from "./project-svg-export-core";

const BODY_LIMIT_BYTES = 8 * 1_024;
const NO_STORE = "private, no-store";

interface ExportProjectService {
  getReadonlySnapshot(publicId: string): ProjectSnapshotResponse | undefined;
}

export interface ProjectSvgExportHandlerDependencies {
  service: ExportProjectService | (() => ExportProjectService);
  applicationBaseUrl: string | undefined;
  allowInsecureHttp?: string;
  environment: string | undefined;
  requestId?: () => string;
  buildSvg?: typeof buildProjectGanttSvg;
}

function resolveDependency<T>(dependency: T | (() => T)): T {
  return typeof dependency === "function" ? (dependency as () => T)() : dependency;
}

export async function handleProjectSvgExport(
  request: Request,
  publicId: string,
  dependencies: ProjectSvgExportHandlerDependencies,
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
    const rawInput = await readBoundedJson(request, BODY_LIMIT_BYTES);
    const parsed = parseProjectSvgExportInput(rawInput);
    if (!parsed.success) {
      throw new PublicApiError(400, "INVALID_REQUEST", "The export input is invalid.", parsed.details);
    }

    const snapshot = resolveDependency(dependencies.service).getReadonlySnapshot(publicId);
    if (!snapshot) throw new PublicApiError(404, "PROJECT_NOT_FOUND", "Project not found.");
    if (snapshot.data.project.revision !== expectedRevision) {
      throw new PublicApiError(412, "REVISION_MISMATCH", "Project changed. Reload and retry.");
    }
    let svg: string;
    try {
      svg = (dependencies.buildSvg ?? buildProjectGanttSvg)(snapshot, parsed.data);
    } catch (error) {
      if (error instanceof ProjectSvgExportError) {
        throw new PublicApiError(
          422,
          error.code,
          error.code === "EXPORT_LIMIT_EXCEEDED"
            ? "The project is too large for the configured SVG export limits."
            : error.code === "EXPORT_RANGE_NO_OVERLAP"
              ? "The selected range does not overlap the project timeline."
              : "The project contains data that cannot be exported safely.",
        );
      }
      throw error;
    }

    const rangeSuffix = parsed.data.scope === "range"
      ? `-${parsed.data.startDate}-${parsed.data.endDate}`
      : "";
    const filename = `mastergantt-${publicId}-r${expectedRevision}${rangeSuffix}.svg`;
    return new Response(svg, {
      status: 200,
      headers: {
        "Cache-Control": NO_STORE,
        "Content-Type": "image/svg+xml; charset=utf-8",
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
