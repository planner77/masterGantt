import { getProjectService } from "@/server/projects/project-service";
import { readApplicationConfiguration } from "@/server/security/origin-core";
import { handleReplaceTaskAssignments } from "@/server/resources/resource-catalog-handlers-core";
import { getResourceCatalogService } from "@/server/resources/resource-catalog-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext { params: Promise<{ publicId: string; taskId: string }> }

export async function PUT(request: Request, context: RouteContext): Promise<Response> {
  const { publicId, taskId } = await context.params;
  return handleReplaceTaskAssignments(request, publicId, taskId, {
    resourceService: getResourceCatalogService,
    projectService: getProjectService,
    ...readApplicationConfiguration(process.env),
  });
}
