import { readApplicationConfiguration } from "@/server/security/origin-core";
import {
  handleCreateCatalogTarget,
  handleGetResourceCatalog,
} from "@/server/resources/resource-catalog-handlers-core";
import { getResourceCatalogService } from "@/server/resources/resource-catalog-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function dependencies() {
  return {
    resourceService: getResourceCatalogService,
    ...readApplicationConfiguration(process.env),
    adminPassword: process.env.RESOURCE_CATALOG_ADMIN_PASSWORD,
  };
}

export async function GET(request: Request): Promise<Response> {
  return handleGetResourceCatalog(request, dependencies());
}

export async function POST(request: Request): Promise<Response> {
  return handleCreateCatalogTarget(request, "resource", dependencies());
}
