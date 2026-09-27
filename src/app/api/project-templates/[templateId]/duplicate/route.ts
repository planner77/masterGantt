import { withApiRequestLogging } from "@/server/http/request-context-core";
import { readApplicationConfiguration } from "@/server/security/origin-core";
import { handleDuplicateTemplate } from "@/server/templates/project-template-handlers-core";
import { getProjectTemplateService } from "@/server/templates/project-template-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ROUTE = "/api/project-templates/[templateId]/duplicate";
interface RouteContext {
  params: Promise<{ templateId: string }>;
}

export async function POST(request: Request, context: RouteContext): Promise<Response> {
  const { templateId } = await context.params;
  return withApiRequestLogging(request, { route: ROUTE, trustProxy: process.env.TRUST_PROXY }, (requestId) =>
    handleDuplicateTemplate(request, templateId, {
      templateService: getProjectTemplateService,
      ...readApplicationConfiguration(process.env),
      requestId: () => requestId,
    }),
  );
}
