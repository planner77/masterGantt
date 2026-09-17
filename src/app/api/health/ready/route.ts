import { getReadiness } from "@/server/health/readiness";
import { handleReadiness } from "@/server/health/readiness-handler-core";
import { withApiRequestLogging } from "@/server/http/request-context-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  return withApiRequestLogging(
    request,
    { route: "/api/health/ready", trustProxy: process.env.TRUST_PROXY },
    () => handleReadiness(getReadiness),
  );
}
