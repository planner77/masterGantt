import { withApiRequestLogging } from "@/server/http/request-context-core";
import { handleGetMilestoneDashboard } from "@/server/projects/milestone-dashboard-handlers-core";
import { getMilestoneDashboardService } from "@/server/projects/milestone-dashboard-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const ROUTE = "/api/projects/[publicId]/milestone-dashboard";

export async function GET(request: Request, context: { params: Promise<{ publicId: string }> }) {
  const { publicId } = await context.params;
  return withApiRequestLogging(request, { route: ROUTE, trustProxy: process.env.TRUST_PROXY }, (requestId) =>
    handleGetMilestoneDashboard(request, publicId, { service: getMilestoneDashboardService, requestId: () => requestId }));
}
