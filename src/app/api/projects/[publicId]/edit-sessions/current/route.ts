import { getProjectService } from "@/server/projects/project-service";
import {
  handleCurrentEditSession,
  handleLogoutProject,
} from "@/server/projects/edit-session-handlers-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ publicId: string }>;
}

export async function GET(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  const { publicId } = await context.params;
  return handleCurrentEditSession(request, publicId, {
    service: getProjectService,
    environment: process.env.NODE_ENV,
  });
}

export async function DELETE(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  const { publicId } = await context.params;
  return handleLogoutProject(request, publicId, {
    service: getProjectService,
    applicationBaseUrl: process.env.APP_BASE_URL,
    environment: process.env.NODE_ENV,
  });
}
