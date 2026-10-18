import { withApiRequestLogging } from "@/server/http/request-context-core";
import { readApplicationConfiguration } from "@/server/security/origin-core";
import { getProjectService } from "@/server/projects/project-service";
import { getProcessCatalogService } from "@/server/process-catalog/process-catalog-service";
import { handleGetProjectProcessContext } from "@/server/process-catalog/process-catalog-handlers-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const ROUTE = "/api/projects/[publicId]/logistics/process-context";
const dependencies = (requestId: string) => ({
  service: getProcessCatalogService,
  projectService: getProjectService,
  ...readApplicationConfiguration(process.env),
  requestId: () => requestId,
});

export async function GET(request: Request, context: { params: Promise<{ publicId: string }> }): Promise<Response> {
  const { publicId } = await context.params;
  return withApiRequestLogging(request, { route: ROUTE, trustProxy: process.env.TRUST_PROXY }, (requestId) =>
    handleGetProjectProcessContext(request, publicId, dependencies(requestId)),
  );
}
