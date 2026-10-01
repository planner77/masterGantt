import { withApiRequestLogging } from "@/server/http/request-context-core";
import { readApplicationConfiguration } from "@/server/security/origin-core";
import { getProjectMasterService } from "@/server/project-master/project-master-service";
import { handleChangeProjectMasterAdminPassword } from "@/server/project-master/project-master-handlers-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const ROUTE = "/api/project-master/admin-password";
const deps = (requestId: string) => ({
  service: getProjectMasterService,
  ...readApplicationConfiguration(process.env),
  adminPassword: process.env.PROJECT_MASTER_ADMIN_PASSWORD,
  requestId: () => requestId,
});

export async function PUT(request: Request): Promise<Response> {
  return withApiRequestLogging(request, { route: ROUTE, trustProxy: process.env.TRUST_PROXY }, (requestId) =>
    handleChangeProjectMasterAdminPassword(request, deps(requestId)),
  );
}
