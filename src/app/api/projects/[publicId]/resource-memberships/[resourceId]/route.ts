import { withApiRequestLogging } from "@/server/http/request-context-core";
import { getProjectService } from "@/server/projects/project-service";
import { getProjectResourceMembershipService } from "@/server/resources/project-resource-membership-service";
import { handleProjectResourceMembership } from "@/server/resources/project-resource-membership-handlers-core";
import { readApplicationConfiguration } from "@/server/security/origin-core";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
interface RouteContext {
  params: Promise<{
    publicId: string;
    resourceId: string;
  }>;
}
export async function DELETE(request: Request, context: RouteContext): Promise<Response> {
  const { publicId, resourceId } = await context.params;
  return withApiRequestLogging(request, { route: "/api/projects/[publicId]/resource-memberships/[resourceId]", trustProxy: process.env.TRUST_PROXY }, requestId => handleProjectResourceMembership(request, publicId, { service: getProjectResourceMembershipService, projectService: getProjectService, ...readApplicationConfiguration(process.env), requestId: () => requestId }, resourceId));
}
