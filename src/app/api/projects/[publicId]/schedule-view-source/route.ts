import { getDatabase } from "@/server/db";
import { withApiRequestLogging } from "@/server/http/request-context-core";
import { handleGetScheduleViewSource } from "@/server/projects/schedule-view-source-handler-core";
import { ScheduleViewSourceService } from "@/server/projects/schedule-view-source-service-core";
import { readApplicationConfiguration } from "@/server/security/origin-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
interface RouteContext { params: Promise<{ publicId: string }> }

export async function GET(request: Request, context: RouteContext): Promise<Response> {
  const { publicId } = await context.params;
  return withApiRequestLogging(request, { route: "/api/projects/[publicId]/schedule-view-source", trustProxy: process.env.TRUST_PROXY }, requestId =>
    handleGetScheduleViewSource(request, publicId, {
      service: () => new ScheduleViewSourceService(getDatabase()),
      ...readApplicationConfiguration(process.env),
      requestId: () => requestId,
    }));
}
