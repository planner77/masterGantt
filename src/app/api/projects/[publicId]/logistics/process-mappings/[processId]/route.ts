import { withApiRequestLogging } from "@/server/http/request-context-core";
import { readApplicationConfiguration } from "@/server/security/origin-core";
import { getProjectService } from "@/server/projects/project-service";
import { getProcessCatalogService } from "@/server/process-catalog/process-catalog-service";
import { handleMapProjectProcess } from "@/server/process-catalog/process-catalog-handlers-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const ROUTE = "/api/projects/[publicId]/logistics/process-mappings/[processId]";
const dependencies = (requestId: string) => ({
  service: getProcessCatalogService,
  projectService: getProjectService,
  ...readApplicationConfiguration(process.env),
  requestId: () => requestId,
});

export async function PUT(request: Request, context: { params: Promise<{ publicId: string; processId: string }> }): Promise<Response> {
  const { publicId, processId } = await context.params;
  return withApiRequestLogging(request, { route: ROUTE, trustProxy: process.env.TRUST_PROXY }, (requestId) =>
    handleMapProjectProcess(request, publicId, processId, dependencies(requestId)),
  );
}
