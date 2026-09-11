import { getProjectService } from "@/server/projects/project-service";
import { handleUnlockProject } from "@/server/projects/edit-session-handlers-core";
import {
  unlockGlobalRateLimiter,
  unlockProjectRateLimiter,
} from "@/server/security/rate-limit-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ publicId: string }>;
}

export async function POST(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  const { publicId } = await context.params;
  return handleUnlockProject(request, publicId, {
    service: getProjectService,
    applicationBaseUrl: process.env.APP_BASE_URL,
    environment: process.env.NODE_ENV,
    globalRateLimiter: unlockGlobalRateLimiter,
    projectRateLimiter: unlockProjectRateLimiter,
  });
}
