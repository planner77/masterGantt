import { getProjectService } from "@/server/projects/project-service";
import { handleProjectExcelExport } from "@/server/exports/project-excel-export-handler-core";
import { readApplicationConfiguration } from "@/server/security/origin-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ publicId: string }>;
}

export async function POST(request: Request, context: RouteContext): Promise<Response> {
  const { publicId } = await context.params;
  return handleProjectExcelExport(request, publicId, {
    service: getProjectService,
    ...readApplicationConfiguration(process.env),
  });
}
