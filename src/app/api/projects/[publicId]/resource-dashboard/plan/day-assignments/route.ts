import { withApiRequestLogging } from "@/server/http/request-context-core";
import { handleGetResourcePlan } from "@/server/resources/resource-dashboard-handlers-core";
import { getResourceDashboardService } from "@/server/resources/resource-dashboard-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const ROUTE = "/api/projects/[publicId]/resource-dashboard/plan/day-assignments";

export async function GET(request: Request, context: { params: Promise<{ publicId: string }> }) {
  const { publicId } = await context.params;
  return withApiRequestLogging(request, { route: ROUTE, trustProxy: process.env.TRUST_PROXY }, (requestId) =>
    handleGetResourcePlan(request, publicId, { service: getResourceDashboardService, requestId: () => requestId }, "day-assignments"));
}
