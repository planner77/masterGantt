import { withApiRequestLogging } from "@/server/http/request-context-core";
import { readApplicationConfiguration } from "@/server/security/origin-core";
import { getDatabase } from "@/server/db";
import { TaskFieldProjectService } from "@/server/projects/task-field-project-service";
import { TaskTargetBindingService } from "@/server/logistics/task-target-bindings-service-core";
import { handleGetTaskTargetBindings, handleReplaceTaskTargetBindings } from "@/server/logistics/task-target-bindings-handlers-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const ROUTE = "/api/projects/[publicId]/tasks/[taskId]/target-bindings";
type Context = { params: Promise<{ publicId: string; taskId: string }> };
const dependencies = (requestId: string) => ({
  service: () => new TaskTargetBindingService(getDatabase()),
  projectService: () => new TaskFieldProjectService(getDatabase()),
  ...readApplicationConfiguration(process.env),
  requestId: () => requestId,
});

export async function GET(request: Request, context: Context) {
  const { publicId, taskId } = await context.params;
  return withApiRequestLogging(request, { route: ROUTE, trustProxy: process.env.TRUST_PROXY },
    (id) => handleGetTaskTargetBindings(request, publicId, taskId, dependencies(id)));
}

export async function PUT(request: Request, context: Context) {
  const { publicId, taskId } = await context.params;
  return withApiRequestLogging(request, { route: ROUTE, trustProxy: process.env.TRUST_PROXY },
    (id) => handleReplaceTaskTargetBindings(request, publicId, taskId, dependencies(id)));
}
