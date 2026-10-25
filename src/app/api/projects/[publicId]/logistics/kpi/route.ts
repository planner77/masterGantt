import { withApiRequestLogging } from "@/server/http/request-context-core";
import { readApplicationConfiguration } from "@/server/security/origin-core";
import { getDatabase } from "@/server/db";
import { getLogisticsService } from "@/server/logistics/logistics-service";
import { LogisticsKpiService } from "@/server/logistics/logistics-kpi-service-core";
import { handleGetLogisticsKpi } from "@/server/logistics/logistics-kpi-handlers-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const ROUTE = "/api/projects/[publicId]/logistics/kpi";
export async function GET(request: Request, context: { params: Promise<{ publicId: string }> }) {
  const { publicId } = await context.params;
  return withApiRequestLogging(request, { route: ROUTE, trustProxy: process.env.TRUST_PROXY }, requestId => {
    const { logistics, project } = getLogisticsService();
    return handleGetLogisticsKpi(request, publicId, {
      logisticsService: logistics, projectService: project,
      dashboardService: new LogisticsKpiService(getDatabase(), { mdPerMmEnvironment: process.env.RESOURCE_MD_PER_MM }),
      ...readApplicationConfiguration(process.env), requestId: () => requestId,
    });
  });
}
