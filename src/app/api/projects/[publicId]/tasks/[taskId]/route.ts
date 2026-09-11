import { getProjectService } from "@/server/projects/project-service";
import {
  handleDeleteTask,
  handleUpdateTask,
} from "@/server/projects/task-handlers-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ publicId: string; taskId: string }>;
}

export async function PATCH(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  const { publicId, taskId } = await context.params;
  return handleUpdateTask(request, publicId, taskId, {
    service: getProjectService,
    applicationBaseUrl: process.env.APP_BASE_URL,
    environment: process.env.NODE_ENV,
  });
}

export async function DELETE(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  const { publicId, taskId } = await context.params;
  return handleDeleteTask(request, publicId, taskId, {
    service: getProjectService,
    applicationBaseUrl: process.env.APP_BASE_URL,
    environment: process.env.NODE_ENV,
  });
}
