import { readApplicationConfiguration } from "@/server/security/origin-core";
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
    ...readApplicationConfiguration(process.env),
  });
}

export async function DELETE(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  const { publicId, taskId } = await context.params;
  return handleDeleteTask(request, publicId, taskId, {
    service: getProjectService,
    ...readApplicationConfiguration(process.env),
  });
}
