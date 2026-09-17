import { withApiRequestLogging } from "@/server/http/request-context-core";
import { readApplicationConfiguration } from "@/server/security/origin-core";
import { getProjectService } from "@/server/projects/project-service";
import {
  handleCreateProject,
  handleProjectCollectionGet,
} from "@/server/projects/project-handlers-core";
import { projectCreateRateLimiter } from "@/server/security/rate-limit-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ROUTE = "/api/projects";

export async function POST(request: Request): Promise<Response> {
  return withApiRequestLogging(request, { route: ROUTE, trustProxy: process.env.TRUST_PROXY }, (requestId) =>
    handleCreateProject(request, {
      service: getProjectService,
      rateLimiter: projectCreateRateLimiter,
      ...readApplicationConfiguration(process.env),
      requestId: () => requestId,
    }),
  );
}

export async function GET(request: Request): Promise<Response> {
  return withApiRequestLogging(request, { route: ROUTE, trustProxy: process.env.TRUST_PROXY }, (requestId) =>
    handleProjectCollectionGet({
      service: getProjectService,
      requestId: () => requestId,
    }),
  );
}
