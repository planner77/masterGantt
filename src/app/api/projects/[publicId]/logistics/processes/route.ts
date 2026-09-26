import { withApiRequestLogging } from "@/server/http/request-context-core";
import { readApplicationConfiguration } from "@/server/security/origin-core";
import { getLogisticsService } from "@/server/logistics/logistics-service";
import { handleCreateProcess } from "@/server/logistics/logistics-handlers-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ROUTE = "/api/projects/[publicId]/logistics/processes";

export async function POST(
  request: Request,
  context: { params: Promise<{ publicId: string }> },
) {
  const { publicId } = await context.params;
  return withApiRequestLogging(
    request,
    { route: ROUTE, trustProxy: process.env.TRUST_PROXY },
    (requestId) => {
      const { logistics, project } = getLogisticsService();
      return handleCreateProcess(request, publicId, {
        logisticsService: logistics,
        projectService: project,
        ...readApplicationConfiguration(process.env),
        requestId: () => requestId,
      });
    },
  );
}
