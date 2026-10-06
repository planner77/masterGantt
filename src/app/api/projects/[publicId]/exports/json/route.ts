import { getDatabase } from "@/server/db";
import { withApiRequestLogging } from "@/server/http/request-context-core";
import { readApplicationConfiguration } from "@/server/security/origin-core";
import { ProjectJsonExportService } from "@/server/exports/project-json-export-core";
import { handleProjectJsonExport } from "@/server/exports/project-json-export-handler-core";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request, context: { params: Promise<{ publicId: string }> }): Promise<Response> {
  const { publicId } = await context.params;
  return withApiRequestLogging(request, { route: "/api/projects/[publicId]/exports/json", trustProxy: process.env.TRUST_PROXY }, (requestId) =>
    handleProjectJsonExport(request, publicId, { service: () => new ProjectJsonExportService(getDatabase()), ...readApplicationConfiguration(process.env), requestId: () => requestId }),
  );
}
