import { withApiRequestLogging } from "@/server/http/request-context-core";
import { getProjectService, getTaskHierarchyService } from "@/server/projects/project-service";
import { handleTaskHierarchyCommand } from "@/server/projects/task-hierarchy-handlers-core";
import { readApplicationConfiguration } from "@/server/security/origin-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ROUTE = "/api/projects/[publicId]/task-commands";

interface RouteContext {
  params: Promise<{ publicId: string }>;
}

export async function POST(request: Request, context: RouteContext): Promise<Response> {
  const { publicId } = await context.params;
  return withApiRequestLogging(request, { route: ROUTE, trustProxy: process.env.TRUST_PROXY }, (requestId) =>
    handleTaskHierarchyCommand(request, publicId, {
      authorizationService: getProjectService,
      hierarchyService: getTaskHierarchyService,
      ...readApplicationConfiguration(process.env),
      requestId: () => requestId,
    }),
  );
}
