import { withApiRequestLogging } from "@/server/http/request-context-core";
import { readApplicationConfiguration } from "@/server/security/origin-core";
import { getProjectService } from "@/server/projects/project-service";
import { handleMilestoneMembershipCommand } from "@/server/projects/task-handlers-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ publicId: string }> }): Promise<Response> {
  const { publicId } = await context.params;
  return withApiRequestLogging(request, { route: "/api/projects/[publicId]/milestone-memberships", trustProxy: process.env.TRUST_PROXY }, (requestId) =>
    handleMilestoneMembershipCommand(request, publicId, { service: getProjectService, ...readApplicationConfiguration(process.env), requestId: () => requestId }),
  );
}
