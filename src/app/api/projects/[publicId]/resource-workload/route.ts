import { apiErrorResponse, PublicApiError } from "@/server/http/api-error-core";
import { withApiRequestLogging } from "@/server/http/request-context-core";
import { getDatabase } from "@/server/db";
import { ResourceWorkloadInvalidRangeError, ResourceWorkloadService } from "@/server/resources/resource-workload-service-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ROUTE = "/api/projects/[publicId]/resource-workload";
interface RouteContext { params: Promise<{ publicId: string }> }

export async function GET(request: Request, context: RouteContext): Promise<Response> {
  const { publicId } = await context.params;
  return withApiRequestLogging(request, { route: ROUTE, trustProxy: process.env.TRUST_PROXY }, async (requestId) => {
    try {
      const url = new URL(request.url);
      const service = new ResourceWorkloadService(getDatabase());
      const result = service.get(publicId, url.searchParams.get("from"), url.searchParams.get("to"), process.env.RESOURCE_MD_PER_MM);
      if (!result) throw new PublicApiError(404, "PROJECT_NOT_FOUND", "Project not found.");
      return Response.json(result, { status: 200, headers: { "Cache-Control": "private, no-store", "Content-Type": "application/json; charset=utf-8" } });
    } catch (error) {
      const mapped = error instanceof ResourceWorkloadInvalidRangeError
        ? new PublicApiError(400, "INVALID_WORKLOAD_RANGE", "Resource workload range is invalid.")
        : error;
      const response = apiErrorResponse(mapped, requestId);
      response.headers.set("Cache-Control", "private, no-store");
      return response;
    }
  });
}
