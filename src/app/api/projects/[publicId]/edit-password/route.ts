import { getProjectService } from "@/server/projects/project-service";
import { handleChangeEditPassword } from "@/server/projects/edit-session-handlers-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ publicId: string }>;
}

export async function PUT(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  const { publicId } = await context.params;
  return handleChangeEditPassword(request, publicId, {
    service: getProjectService,
    applicationBaseUrl: process.env.APP_BASE_URL,
    environment: process.env.NODE_ENV,
  });
}
