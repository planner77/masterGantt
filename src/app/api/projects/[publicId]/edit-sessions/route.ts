import { withApiRequestLogging } from "@/server/http/request-context-core";
import { readApplicationConfiguration } from "@/server/security/origin-core";
import { getProjectService } from "@/server/projects/project-service";
import { handleUnlockProject } from "@/server/projects/edit-session-handlers-core";
import {
  unlockGlobalRateLimiter,
  unlockProjectRateLimiter,
} from "@/server/security/rate-limit-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ROUTE = "/api/projects/[publicId]/edit-sessions";

interface RouteContext {
  params: Promise<{ publicId: string }>;
}

export async function POST(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  const { publicId } = await context.params;
  return withApiRequestLogging(request, { route: ROUTE, trustProxy: process.env.TRUST_PROXY }, (requestId) =>
    handleUnlockProject(request, publicId, {
      service: getProjectService,
      ...readApplicationConfiguration(process.env),
      globalRateLimiter: unlockGlobalRateLimiter,
      projectRateLimiter: unlockProjectRateLimiter,
      requestId: () => requestId,
    }),
  );
}
