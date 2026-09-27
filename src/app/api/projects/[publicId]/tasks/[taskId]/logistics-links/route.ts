import { withApiRequestLogging } from "@/server/http/request-context-core";
import { readApplicationConfiguration } from "@/server/security/origin-core";
import { getLogisticsService } from "@/server/logistics/logistics-service";
import {
  handleGetTaskLogisticsLinks,
  handleReplaceTaskLogisticsLinks,
} from "@/server/logistics/logistics-handlers-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ROUTE = "/api/projects/[publicId]/tasks/[taskId]/logistics-links";

export async function GET(
  request: Request,
  context: { params: Promise<{ publicId: string; taskId: string }> },
) {
  const { publicId, taskId } = await context.params;
  return withApiRequestLogging(
    request,
    { route: ROUTE, trustProxy: process.env.TRUST_PROXY },
    (requestId) => {
      const { logistics, project } = getLogisticsService();
      return handleGetTaskLogisticsLinks(request, publicId, taskId, {
        logisticsService: logistics,
        projectService: project,
        ...readApplicationConfiguration(process.env),
        requestId: () => requestId,
      });
    },
  );
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ publicId: string; taskId: string }> },
) {
  const { publicId, taskId } = await context.params;
  return withApiRequestLogging(
    request,
    { route: ROUTE, trustProxy: process.env.TRUST_PROXY },
    (requestId) => {
      const { logistics, project } = getLogisticsService();
      return handleReplaceTaskLogisticsLinks(request, publicId, taskId, {
        logisticsService: logistics,
        projectService: project,
        ...readApplicationConfiguration(process.env),
        requestId: () => requestId,
      });
    },
  );
}
