import { readApplicationConfiguration } from "@/server/security/origin-core";
import {
  handleLogoutResourceCatalogAdmin,
  handleUnlockResourceCatalogAdmin,
} from "@/server/resources/resource-catalog-handlers-core";
import { getResourceCatalogService } from "@/server/resources/resource-catalog-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const adminAuthConfigurationState = { logged: false };

const dependencies = () => ({
  resourceService: getResourceCatalogService,
  ...readApplicationConfiguration(process.env),
  adminPassword: process.env.RESOURCE_CATALOG_ADMIN_PASSWORD,
  adminAuthConfigurationState,
});

export async function POST(request: Request): Promise<Response> {
  return handleUnlockResourceCatalogAdmin(request, dependencies());
}

export async function DELETE(request: Request): Promise<Response> {
  return handleLogoutResourceCatalogAdmin(request, dependencies());
}
