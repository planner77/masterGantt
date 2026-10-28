import { withApiRequestLogging } from "@/server/http/request-context-core";
import { readApplicationConfiguration } from "@/server/security/origin-core";
import { getDatabase } from "@/server/db";
import { getProjectService } from "@/server/projects/project-service";
import { ProjectIssueService } from "@/server/projects/project-issue-service-core";
import { handleProjectIssues } from "@/server/projects/project-issue-handlers-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
interface RouteContext { params: Promise<{ publicId: string; issueId: string }> }
export async function PATCH(request: Request, context: RouteContext): Promise<Response> {
  const { publicId, issueId } = await context.params;
  return withApiRequestLogging(request, {
    route: "/api/projects/[publicId]/issues/[issueId]/credential", trustProxy: process.env.TRUST_PROXY,
  }, requestId => handleProjectIssues(request, publicId, {
    service: () => new ProjectIssueService(getDatabase()),
    projectService: getProjectService, ...readApplicationConfiguration(process.env),
    requestId: () => requestId,
  }, issueId, true));
}
