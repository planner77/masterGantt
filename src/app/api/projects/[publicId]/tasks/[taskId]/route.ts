import { withApiRequestLogging } from "@/server/http/request-context-core";
import { readApplicationConfiguration } from "@/server/security/origin-core";
import {
  getProjectService,
  getTaskSubtreeDeleteService,
} from "@/server/projects/project-service";
import {
  handleDeleteTask,
  handleUpdateTask,
} from "@/server/projects/task-handlers-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ROUTE = "/api/projects/[publicId]/tasks/[taskId]";

interface RouteContext {
  params: Promise<{ publicId: string; taskId: string }>;
}

export async function PATCH(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  const { publicId, taskId } = await context.params;
  return withApiRequestLogging(request, { route: ROUTE, trustProxy: process.env.TRUST_PROXY }, (requestId) =>
    handleUpdateTask(request, publicId, taskId, {
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
  const { publicId, taskId } = await context.params;
  return withApiRequestLogging(request, { route: ROUTE, trustProxy: process.env.TRUST_PROXY }, (requestId) => {
    const includeDescendants = new URL(request.url).searchParams.get("includeDescendants") === "true";
    if (!includeDescendants) {
      return handleDeleteTask(request, publicId, taskId, {
        service: getProjectService,
        ...readApplicationConfiguration(process.env),
        requestId: () => requestId,
      });
    }

    const projectService = getProjectService();
    const subtreeService = getTaskSubtreeDeleteService();
    return handleDeleteTask(request, publicId, taskId, {
      service: {
        authorize: projectService.authorize.bind(projectService),
        createTask: projectService.createTask.bind(projectService),
        updateTask: projectService.updateTask.bind(projectService),
        deleteTask: subtreeService.deleteTaskSubtree.bind(subtreeService),
      },
      ...readApplicationConfiguration(process.env),
      requestId: () => requestId,
    });
  });
}
