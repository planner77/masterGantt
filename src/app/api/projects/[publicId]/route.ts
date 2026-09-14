import { readApplicationConfiguration } from "@/server/security/origin-core";
import { getProjectService } from "@/server/projects/project-service";
import {
  handleDeleteProject,
  handleReadProject,
  handleUpdateProject,
} from "@/server/projects/project-handlers-core";

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

export async function PATCH(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  const { publicId } = await context.params;
  return handleUpdateProject(request, publicId, {
    service: getProjectService,
    ...readApplicationConfiguration(process.env),
  });
}

export async function DELETE(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  const { publicId } = await context.params;
  return handleDeleteProject(request, publicId, {
    service: getProjectService,
    ...readApplicationConfiguration(process.env),
  });
}
