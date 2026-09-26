import { withApiRequestLogging } from "@/server/http/request-context-core";
import { readApplicationConfiguration } from "@/server/security/origin-core";
import { getLogisticsService } from "@/server/logistics/logistics-service";
import {
  handleDeleteSystem,
  handleUpdateSystem,
} from "@/server/logistics/logistics-handlers-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ROUTE = "/api/projects/[publicId]/logistics/systems/[systemId]";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ publicId: string; systemId: string }> },
) {
  const { publicId, systemId } = await context.params;
  return withApiRequestLogging(
    request,
    { route: ROUTE, trustProxy: process.env.TRUST_PROXY },
    (requestId) => {
      const { logistics, project } = getLogisticsService();
      return handleUpdateSystem(request, publicId, systemId, {
        logisticsService: logistics,
        projectService: project,
        ...readApplicationConfiguration(process.env),
        requestId: () => requestId,
      });
    },
  );
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ publicId: string; systemId: string }> },
) {
  const { publicId, systemId } = await context.params;
  return withApiRequestLogging(
    request,
    { route: ROUTE, trustProxy: process.env.TRUST_PROXY },
    (requestId) => {
      const { logistics, project } = getLogisticsService();
      return handleDeleteSystem(request, publicId, systemId, {
        logisticsService: logistics,
        projectService: project,
        ...readApplicationConfiguration(process.env),
        requestId: () => requestId,
      });
    },
  );
}
