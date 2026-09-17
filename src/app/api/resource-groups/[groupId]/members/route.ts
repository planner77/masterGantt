import { withApiRequestLogging } from "@/server/http/request-context-core";
import { readApplicationConfiguration } from "@/server/security/origin-core";
import { handleReplaceResourceGroupMembers } from "@/server/resources/resource-catalog-handlers-core";
import { getResourceCatalogService } from "@/server/resources/resource-catalog-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ROUTE = "/api/resource-groups/[groupId]/members";
interface RouteContext { params: Promise<{ groupId: string }> }

export async function PUT(request: Request, context: RouteContext): Promise<Response> {
  const { groupId } = await context.params;
  return withApiRequestLogging(request, { route: ROUTE, trustProxy: process.env.TRUST_PROXY }, (requestId) =>
    handleReplaceResourceGroupMembers(request, groupId, {
      resourceService: getResourceCatalogService,
      ...readApplicationConfiguration(process.env),
      adminPassword: process.env.RESOURCE_CATALOG_ADMIN_PASSWORD,
      requestId: () => requestId,
    }),
  );
}
