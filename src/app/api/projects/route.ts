import { getProjectService } from "@/server/projects/project-service";
import {
  handleCreateProject,
  handleProjectCollectionGet,
} from "@/server/projects/project-handlers-core";
import { projectCreateRateLimiter } from "@/server/security/rate-limit-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  return handleCreateProject(request, {
    service: getProjectService,
    rateLimiter: projectCreateRateLimiter,
    applicationBaseUrl: process.env.APP_BASE_URL,
    environment: process.env.NODE_ENV,
  });
}

export function GET(): Response {
  return handleProjectCollectionGet();
}
