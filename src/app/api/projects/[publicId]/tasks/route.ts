import { getProjectService } from "@/server/projects/project-service";
import { handleCreateTask } from "@/server/projects/task-handlers-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ publicId: string }>;
}

export async function POST(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  const { publicId } = await context.params;
  return handleCreateTask(request, publicId, {
    service: getProjectService,
    applicationBaseUrl: process.env.APP_BASE_URL,
    environment: process.env.NODE_ENV,
  });
}
