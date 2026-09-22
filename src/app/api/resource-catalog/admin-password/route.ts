import { handleChangeResourceCatalogAdminPassword } from "@/server/resources/resource-catalog-handlers-core";
import { getResourceCatalogService } from "@/server/resources/resource-catalog-service";
import { readApplicationConfiguration } from "@/server/config/application-configuration";
import { withApiRequestLogging } from "@/server/observability/api-request-logging";

const ROUTE = "/api/resource-catalog/admin-password";

function dependencies(requestId: string) {
  return {
    resourceService: getResourceCatalogService,
    ...readApplicationConfiguration(process.env),
    adminPassword: process.env.RESOURCE_CATALOG_ADMIN_PASSWORD,
    requestId: () => requestId,
  };
}

export async function PUT(request: Request): Promise<Response> {
  return withApiRequestLogging(request, { route: ROUTE, trustProxy: process.env.TRUST_PROXY }, (requestId) =>
    handleChangeResourceCatalogAdminPassword(request, dependencies(requestId)),
  );
}
