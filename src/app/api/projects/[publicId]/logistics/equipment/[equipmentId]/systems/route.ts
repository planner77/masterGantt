import { withApiRequestLogging } from "@/server/http/request-context-core";
import { readApplicationConfiguration } from "@/server/security/origin-core";
import { getLogisticsService } from "@/server/logistics/logistics-service";
import { handleSetEquipmentSystems } from "@/server/logistics/logistics-handlers-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ROUTE = "/api/projects/[publicId]/logistics/equipment/[equipmentId]/systems";

export async function PUT(
  request: Request,
  context: { params: Promise<{ publicId: string; equipmentId: string }> },
) {
  const { publicId, equipmentId } = await context.params;
  return withApiRequestLogging(
    request,
    { route: ROUTE, trustProxy: process.env.TRUST_PROXY },
    (requestId) => {
      const { logistics, project } = getLogisticsService();
      return handleSetEquipmentSystems(request, publicId, equipmentId, {
        logisticsService: logistics,
        projectService: project,
        ...readApplicationConfiguration(process.env),
        requestId: () => requestId,
      });
    },
  );
}
