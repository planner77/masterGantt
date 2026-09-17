import { withApiRequestLogging } from "@/server/http/request-context-core";
import { readApplicationConfiguration } from "@/server/security/origin-core";
import { handleUpdateCatalogTarget } from "@/server/resources/resource-catalog-handlers-core";
import { getResourceCatalogService } from "@/server/resources/resource-catalog-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ROUTE = "/api/resources/[resourceId]";
interface RouteContext { params: Promise<{ resourceId: string }> }

export async function PATCH(request: Request, context: RouteContext): Promise<Response> {
  const { resourceId } = await context.params;
  return withApiRequestLogging(request, { route: ROUTE, trustProxy: process.env.TRUST_PROXY }, (requestId) =>
    handleUpdateCatalogTarget(request, "resource", resourceId, {
      resourceService: getResourceCatalogService,
      ...readApplicationConfiguration(process.env),
      adminPassword: process.env.RESOURCE_CATALOG_ADMIN_PASSWORD,
      requestId: () => requestId,
    }),
  );
}
