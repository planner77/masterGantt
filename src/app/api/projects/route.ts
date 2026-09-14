import { readApplicationConfiguration } from "@/server/security/origin-core";
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
    ...readApplicationConfiguration(process.env),
  });
}

export function GET(): Response {
  return handleProjectCollectionGet({ service: getProjectService });
}
