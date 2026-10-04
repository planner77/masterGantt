import { withApiRequestLogging } from "@/server/http/request-context-core";
import { getDatabase } from "@/server/db";
import { getProjectService } from "@/server/projects/project-service";
import { handleProjectExcelExport } from "@/server/exports/project-excel-export-handler-core";
import { readApplicationConfiguration } from "@/server/security/origin-core";
import { ResourceWorkloadService } from "@/server/resources/resource-workload-service-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ROUTE = "/api/projects/[publicId]/exports/excel";

interface RouteContext {
  params: Promise<{ publicId: string }>;
}

export async function POST(request: Request, context: RouteContext): Promise<Response> {
  const { publicId } = await context.params;
  return withApiRequestLogging(request, { route: ROUTE, trustProxy: process.env.TRUST_PROXY }, (requestId) =>
    handleProjectExcelExport(request, publicId, {
      service: getProjectService,
      ...readApplicationConfiguration(process.env),
      requestId: () => requestId,
      getResourceWorkload: (projectPublicId) =>
        new ResourceWorkloadService(getDatabase()).get(projectPublicId, null, null, process.env.RESOURCE_MD_PER_MM),
    }),
  );
}
