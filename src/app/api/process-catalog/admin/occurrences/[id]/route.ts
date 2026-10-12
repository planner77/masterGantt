import { withApiRequestLogging } from "@/server/http/request-context-core";
import { readApplicationConfiguration } from "@/server/security/origin-core";
import { getProcessCatalogService } from "@/server/process-catalog/process-catalog-service";
import { handleMutateProcessCatalog } from "@/server/process-catalog/process-catalog-handlers-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const ROUTE = "/api/process-catalog/admin/occurrences/[id]";
const dependencies = (requestId: string) => ({
  service: getProcessCatalogService,
  ...readApplicationConfiguration(process.env),
  requestId: () => requestId,
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await context.params;
  return withApiRequestLogging(request, { route: ROUTE, trustProxy: process.env.TRUST_PROXY }, (requestId) =>
    handleMutateProcessCatalog(request, "occurrences", "update", id, dependencies(requestId)),
  );
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await context.params;
  return withApiRequestLogging(request, { route: ROUTE, trustProxy: process.env.TRUST_PROXY }, (requestId) =>
    handleMutateProcessCatalog(request, "occurrences", "delete", id, dependencies(requestId)),
  );
}
