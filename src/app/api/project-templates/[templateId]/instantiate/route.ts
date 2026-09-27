import { withApiRequestLogging } from "@/server/http/request-context-core";
import { readApplicationConfiguration } from "@/server/security/origin-core";
import { projectCreateRateLimiter } from "@/server/security/rate-limit-core";
import { handleInstantiateTemplate } from "@/server/templates/project-template-handlers-core";
import { getProjectTemplateService } from "@/server/templates/project-template-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ROUTE = "/api/project-templates/[templateId]/instantiate";
interface RouteContext {
  params: Promise<{ templateId: string }>;
}

export async function POST(request: Request, context: RouteContext): Promise<Response> {
  const { templateId } = await context.params;
  return withApiRequestLogging(request, { route: ROUTE, trustProxy: process.env.TRUST_PROXY }, (requestId) =>
    handleInstantiateTemplate(request, templateId, {
      templateService: getProjectTemplateService,
      rateLimiter: projectCreateRateLimiter,
      ...readApplicationConfiguration(process.env),
      requestId: () => requestId,
    }),
  );
}
