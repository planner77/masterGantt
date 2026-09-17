import { withApiRequestLogging } from "@/server/http/request-context-core";
import { getServerLogger } from "@/server/logging/logger";
import { readApplicationConfiguration } from "@/server/security/origin-core";
import {
  handleLogoutResourceCatalogAdmin,
  handleUnlockResourceCatalogAdmin,
  type ResourceAdminAuthDiagnosticEntry,
  type ResourceAdminAuthDiagnosticLogger,
} from "@/server/resources/resource-catalog-handlers-core";
import { getResourceCatalogService } from "@/server/resources/resource-catalog-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ROUTE = "/api/resource-catalog/admin-sessions";
const adminAuthConfigurationState = { logged: false };
const logger = getServerLogger();

function logAdminAuthEntry(level: "info" | "warn" | "error", entry: ResourceAdminAuthDiagnosticEntry): void {
  const { event, ...fields } = entry;
  logger[level](event, fields);
}

const adminAuthLogger: ResourceAdminAuthDiagnosticLogger = {
  info: (entry) => logAdminAuthEntry("info", entry),
  warn: (entry) => logAdminAuthEntry("warn", entry),
  error: (entry) => logAdminAuthEntry("error", entry),
};

const dependencies = (requestId: string) => ({
  resourceService: getResourceCatalogService,
  ...readApplicationConfiguration(process.env),
  adminPassword: process.env.RESOURCE_CATALOG_ADMIN_PASSWORD,
  adminAuthConfigurationState,
  adminAuthLogger,
  requestId: () => requestId,
});

export async function POST(request: Request): Promise<Response> {
  return withApiRequestLogging(request, { route: ROUTE, trustProxy: process.env.TRUST_PROXY }, (requestId) =>
    handleUnlockResourceCatalogAdmin(request, dependencies(requestId)),
  );
}

export async function DELETE(request: Request): Promise<Response> {
  return withApiRequestLogging(request, { route: ROUTE, trustProxy: process.env.TRUST_PROXY }, (requestId) =>
    handleLogoutResourceCatalogAdmin(request, dependencies(requestId)),
  );
}
