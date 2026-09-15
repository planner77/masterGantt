import { getProjectService } from "@/server/projects/project-service";
import { readApplicationConfiguration } from "@/server/security/origin-core";
import { handleSearchAssignmentTargets } from "@/server/resources/resource-catalog-handlers-core";
import { getResourceCatalogService } from "@/server/resources/resource-catalog-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext { params: Promise<{ publicId: string }> }

export async function GET(request: Request, context: RouteContext): Promise<Response> {
  const { publicId } = await context.params;
  return handleSearchAssignmentTargets(request, publicId, {
    resourceService: getResourceCatalogService,
    projectService: getProjectService,
    ...readApplicationConfiguration(process.env),
  });
}
