import { withApiRequestLogging } from "@/server/http/request-context-core";
import { readApplicationConfiguration } from "@/server/security/origin-core";
import { getProjectMasterService } from "@/server/project-master/project-master-service";
import { handleGetProjectMasterSelection } from "@/server/project-master/project-master-handlers-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const ROUTE = "/api/project-master/catalog";

export async function GET(request: Request): Promise<Response> {
  return withApiRequestLogging(request, { route: ROUTE, trustProxy: process.env.TRUST_PROXY }, (requestId) =>
    handleGetProjectMasterSelection({ service: getProjectMasterService, requestId: () => requestId }),
  );
}
