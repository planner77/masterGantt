import { withApiRequestLogging } from "@/server/http/request-context-core";
import { handleCopyProject } from "@/server/projects/project-copy-handler-core";
import { getProjectCopyService, getProjectService } from "@/server/projects/project-service";
import { readApplicationConfiguration } from "@/server/security/origin-core";
import { projectCreateRateLimiter } from "@/server/security/rate-limit-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ROUTE = "/api/projects/[publicId]/copy";
interface RouteContext { params: Promise<{ publicId: string }> }

export async function POST(request: Request, context: RouteContext): Promise<Response> {
  const { publicId } = await context.params;
  return withApiRequestLogging(request, { route: ROUTE, trustProxy: process.env.TRUST_PROXY }, (requestId) =>
    handleCopyProject(request, publicId, {
      projectService: getProjectService,
      copyService: getProjectCopyService,
      rateLimiter: projectCreateRateLimiter,
      ...readApplicationConfiguration(process.env),
      requestId: () => requestId,
    }),
  );
}
