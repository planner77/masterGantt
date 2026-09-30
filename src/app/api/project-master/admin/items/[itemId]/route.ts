import { withApiRequestLogging } from "@/server/http/request-context-core";
import { readApplicationConfiguration } from "@/server/security/origin-core";
import { getProjectMasterService } from "@/server/project-master/project-master-service";
import { handleUpdateProjectMasterItem } from "@/server/project-master/project-master-handlers-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const ROUTE = "/api/project-master/admin/items/[itemId]";
interface RouteContext { params: Promise<{ itemId: string }> }
const deps = (requestId: string) => ({
  service: getProjectMasterService,
  ...readApplicationConfiguration(process.env),
  adminPassword: process.env.PROJECT_MASTER_ADMIN_PASSWORD,
  requestId: () => requestId,
});

export async function PATCH(request: Request, context: RouteContext): Promise<Response> {
  const { itemId } = await context.params;
  return withApiRequestLogging(request, { route: ROUTE, trustProxy: process.env.TRUST_PROXY }, (requestId) =>
    handleUpdateProjectMasterItem(request, itemId, deps(requestId)),
  );
}
