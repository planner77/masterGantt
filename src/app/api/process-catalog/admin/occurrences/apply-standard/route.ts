import { withApiRequestLogging } from "@/server/http/request-context-core";
import { readApplicationConfiguration } from "@/server/security/origin-core";
import { getProcessCatalogService } from "@/server/process-catalog/process-catalog-service";
import { handleApplyProcessStandards } from "@/server/process-catalog/process-catalog-handlers-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const ROUTE = "/api/process-catalog/admin/occurrences/apply-standard";
const dependencies = (requestId: string) => ({
  service: getProcessCatalogService,
  ...readApplicationConfiguration(process.env),
  requestId: () => requestId,
});

export async function POST(request: Request): Promise<Response> {
  return withApiRequestLogging(request, { route: ROUTE, trustProxy: process.env.TRUST_PROXY }, (requestId) =>
    handleApplyProcessStandards(request, dependencies(requestId)),
  );
}
