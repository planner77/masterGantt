import { withApiRequestLogging } from "@/server/http/request-context-core";
import { readApplicationConfiguration } from "@/server/security/origin-core";
import { getProjectService } from "@/server/projects/project-service";
import {
  handleCurrentEditSession,
  handleLogoutProject,
} from "@/server/projects/edit-session-handlers-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ROUTE = "/api/projects/[publicId]/edit-sessions/current";

interface RouteContext {
  params: Promise<{ publicId: string }>;
}

export async function GET(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  const { publicId } = await context.params;
  return withApiRequestLogging(request, { route: ROUTE, trustProxy: process.env.TRUST_PROXY }, (requestId) =>
    handleCurrentEditSession(request, publicId, {
      service: getProjectService,
      ...readApplicationConfiguration(process.env),
      requestId: () => requestId,
    }),
  );
}

export async function DELETE(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  const { publicId } = await context.params;
  return withApiRequestLogging(request, { route: ROUTE, trustProxy: process.env.TRUST_PROXY }, (requestId) =>
    handleLogoutProject(request, publicId, {
      service: getProjectService,
      ...readApplicationConfiguration(process.env),
      requestId: () => requestId,
    }),
  );
}
