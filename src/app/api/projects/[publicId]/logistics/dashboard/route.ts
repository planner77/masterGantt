import { withApiRequestLogging } from "@/server/http/request-context-core";
import { readApplicationConfiguration } from "@/server/security/origin-core";
import { getLogisticsService } from "@/server/logistics/logistics-service";
import { handleGetLogisticsDashboard } from "@/server/logistics/logistics-handlers-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ROUTE = "/api/projects/[publicId]/logistics/dashboard";

export async function GET(
  request: Request,
  context: { params: Promise<{ publicId: string }> },
) {
  const { publicId } = await context.params;
  return withApiRequestLogging(
    request,
    { route: ROUTE, trustProxy: process.env.TRUST_PROXY },
    (requestId) => {
      const { logistics, project, dashboard } = getLogisticsService();
      return handleGetLogisticsDashboard(request, publicId, {
        logisticsService: logistics,
        projectService: project,
        dashboardService: dashboard,
        ...readApplicationConfiguration(process.env),
        requestId: () => requestId,
      });
    },
  );
}
