import { withApiRequestLogging } from "@/server/http/request-context-core";
import { getProjectService } from "@/server/projects/project-service";
import { handleProjectSvgExport } from "@/server/exports/project-svg-export-handler-core";
import { readApplicationConfiguration } from "@/server/security/origin-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ROUTE = "/api/projects/[publicId]/exports/gantt-svg";

interface RouteContext {
  params: Promise<{ publicId: string }>;
}

export async function POST(request: Request, context: RouteContext): Promise<Response> {
  const { publicId } = await context.params;
  return withApiRequestLogging(request, { route: ROUTE, trustProxy: process.env.TRUST_PROXY }, (requestId) =>
    handleProjectSvgExport(request, publicId, {
      service: getProjectService,
      ...readApplicationConfiguration(process.env),
      requestId: () => requestId,
    }),
  );
}
