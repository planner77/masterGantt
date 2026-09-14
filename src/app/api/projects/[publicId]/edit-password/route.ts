import { readApplicationConfiguration } from "@/server/security/origin-core";
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
    ...readApplicationConfiguration(process.env),
  });
}
