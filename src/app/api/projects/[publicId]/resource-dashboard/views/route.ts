import { withApiRequestLogging } from "@/server/http/request-context-core";
import { handleWbsViewQuery } from "@/server/resources/wbs-dashboard-views-handlers-core";
import { getResourceDashboardService } from "@/server/resources/resource-dashboard-service";
import { readApplicationConfiguration } from "@/server/security/origin-core";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const ROUTE = "/api/projects/[publicId]/resource-dashboard/views";
export async function POST(request: Request, context: { params: Promise<{ publicId: string }> }) {
  const { publicId } = await context.params;
  return withApiRequestLogging(request, { route: ROUTE, trustProxy: process.env.TRUST_PROXY }, requestId =>
    handleWbsViewQuery(request, publicId, { service: getResourceDashboardService, ...readApplicationConfiguration(process.env), requestId: () => requestId }));
}
