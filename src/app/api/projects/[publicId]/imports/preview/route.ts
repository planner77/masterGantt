import { withApiRequestLogging } from "@/server/http/request-context-core";
import { readApplicationConfiguration } from "@/server/security/origin-core";
import { getProjectImportService } from "@/server/imports/project-import-service";
import { handleProjectImport } from "@/server/imports/project-import-handlers-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ publicId: string }> }): Promise<Response> {
  const { publicId } = await context.params;
  return withApiRequestLogging(request, { route: "/api/projects/[publicId]/imports/preview", trustProxy: process.env.TRUST_PROXY }, (requestId) =>
    handleProjectImport(request, publicId, { service: getProjectImportService, ...readApplicationConfiguration(process.env), requestId: () => requestId }, true),
  );
}
