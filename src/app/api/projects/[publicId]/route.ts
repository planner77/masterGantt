import { getProjectService } from "@/server/projects/project-service";
import { handleReadProject } from "@/server/projects/project-handlers-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ publicId: string }>;
}

export async function GET(
  _request: Request,
  context: RouteContext,
): Promise<Response> {
  const { publicId } = await context.params;
  return handleReadProject(publicId, { service: getProjectService });
}
