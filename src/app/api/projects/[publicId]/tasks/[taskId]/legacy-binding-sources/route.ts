import { withApiRequestLogging } from "@/server/http/request-context-core";
import { readApplicationConfiguration } from "@/server/security/origin-core";
import { getDatabase } from "@/server/db";
import { TaskFieldProjectService } from "@/server/projects/task-field-project-service";
import { LegacyBindingScopeService } from "@/server/logistics/legacy-binding-scope-service-core";
import { handleGetLegacyBindingSources, handleLegacyBindingScopeMutation } from "@/server/logistics/legacy-binding-scope-handlers-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const ROUTE = "/api/projects/[publicId]/tasks/[taskId]/legacy-binding-sources";
type Context = { params: Promise<{publicId: string; taskId: string}> };
async function handle(request: Request, context: Context, method: "GET" | "POST" | "PATCH") {
  const { publicId, taskId } = await context.params;
  return withApiRequestLogging(request, {route: ROUTE, trustProxy: process.env.TRUST_PROXY}, (requestId) => {
    const db = getDatabase();
    const dependencies = {
      projectService: new TaskFieldProjectService(db),
      service: new LegacyBindingScopeService(db),
      ...readApplicationConfiguration(process.env),
      requestId: () => requestId,
    };
    return method === "GET"
      ? handleGetLegacyBindingSources(request, publicId, taskId, dependencies)
      : handleLegacyBindingScopeMutation(request, publicId, taskId, dependencies,
        method === "POST" ? "preview" : "apply");
  });
}
export const GET = (request: Request, context: Context) => handle(request, context, "GET");
export const POST = (request: Request, context: Context) => handle(request, context, "POST");
export const PATCH = (request: Request, context: Context) => handle(request, context, "PATCH");
