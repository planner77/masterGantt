import { randomUUID } from "node:crypto";

import type { ReplaceTaskAssignmentsResponse } from "@/contracts/resources";
import { apiErrorResponse, PublicApiError } from "@/server/http/api-error-core";
import { getProjectService } from "@/server/projects/project-service";
import { readApplicationConfiguration } from "@/server/security/origin-core";
import { handleReplaceTaskAssignments } from "@/server/resources/resource-catalog-handlers-core";
import {
  getResourceCatalogService,
} from "@/server/resources/resource-catalog-service";
import type {
  ReplaceTaskAssignmentsMutationResult,
} from "@/server/resources/resource-catalog-service-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext { params: Promise<{ publicId: string; taskId: string }> }

const NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store",
  "Content-Type": "application/json; charset=utf-8",
};

export async function PUT(request: Request, context: RouteContext): Promise<Response> {
  const { publicId, taskId } = await context.params;
  const mutationResponse = await handleReplaceTaskAssignments(request, publicId, taskId, {
    resourceService: getResourceCatalogService,
    projectService: getProjectService,
    ...readApplicationConfiguration(process.env),
  });

  if (!mutationResponse.ok) return mutationResponse;

  try {
    const mutation = await mutationResponse.json() as ReplaceTaskAssignmentsMutationResult;
    const snapshot = getProjectService().getReadonlySnapshot(publicId);
    if (
      !snapshot ||
      snapshot.data.project.revision !== mutation.data.projectRevision ||
      !Array.isArray(snapshot.data.assignments)
    ) {
      throw new Error("Canonical Project snapshot is inconsistent after assignment mutation.");
    }

    const result: ReplaceTaskAssignmentsResponse = {
      data: {
        project: snapshot.data.project,
        tasks: snapshot.data.tasks,
        links: snapshot.data.links,
        assignments: snapshot.data.assignments,
        catalogRevision: mutation.data.catalogRevision,
        warnings: [],
        operation: mutation.data.operation,
      },
    };

    return Response.json(result, {
      status: 200,
      headers: {
        ...NO_STORE_HEADERS,
        ETag: `"${result.data.project.revision}"`,
      },
    });
  } catch {
    const response = apiErrorResponse(
      new PublicApiError(
        500,
        "INTERNAL_ERROR",
        "The request could not be completed.",
      ),
      randomUUID(),
    );
    response.headers.set("Cache-Control", NO_STORE_HEADERS["Cache-Control"]);
    return response;
  }
}
