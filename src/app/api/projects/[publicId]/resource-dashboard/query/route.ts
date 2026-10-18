import { withApiRequestLogging } from "@/server/http/request-context-core";
import { handleResourceDrill } from "@/server/resources/resource-dashboard-handlers-core";
import { getResourceDashboardService } from "@/server/resources/resource-dashboard-service";
import { readApplicationConfiguration } from "@/server/security/origin-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const ROUTE = "/api/projects/[publicId]/resource-dashboard/query";

export async function POST(request: Request, context: { params: Promise<{ publicId: string }> }) {
  const { publicId } = await context.params;
  return withApiRequestLogging(request, { route: ROUTE, trustProxy: process.env.TRUST_PROXY }, (requestId) =>
    handleResourceDrill(request, publicId, { service: getResourceDashboardService, ...readApplicationConfiguration(process.env), requestId: () => requestId }, true));
}
