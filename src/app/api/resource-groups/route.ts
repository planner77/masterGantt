import { withApiRequestLogging } from "@/server/http/request-context-core";
import { readApplicationConfiguration } from "@/server/security/origin-core";
import {
  handleCreateCatalogTarget,
  handleGetResourceCatalog,
} from "@/server/resources/resource-catalog-handlers-core";
import { getResourceCatalogService } from "@/server/resources/resource-catalog-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ROUTE = "/api/resource-groups";

function dependencies(requestId: string) {
  return {
    resourceService: getResourceCatalogService,
    ...readApplicationConfiguration(process.env),
    adminPassword: process.env.RESOURCE_CATALOG_ADMIN_PASSWORD,
    requestId: () => requestId,
  };
}

export async function GET(request: Request): Promise<Response> {
  return withApiRequestLogging(request, { route: ROUTE, trustProxy: process.env.TRUST_PROXY }, (requestId) =>
    handleGetResourceCatalog(request, dependencies(requestId)),
  );
}

export async function POST(request: Request): Promise<Response> {
  return withApiRequestLogging(request, { route: ROUTE, trustProxy: process.env.TRUST_PROXY }, (requestId) =>
    handleCreateCatalogTarget(request, "group", dependencies(requestId)),
  );
}
