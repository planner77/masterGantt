import { withApiRequestLogging } from "@/server/http/request-context-core";
import { readApplicationConfiguration } from "@/server/security/origin-core";
import {
  handleDeleteTemplate,
  handleGetTemplate,
  handleUpdateTemplate,
} from "@/server/templates/project-template-handlers-core";
import { getProjectTemplateService } from "@/server/templates/project-template-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ROUTE = "/api/project-templates/[templateId]";
interface RouteContext {
  params: Promise<{ templateId: string }>;
}

export async function GET(request: Request, context: RouteContext): Promise<Response> {
  const { templateId } = await context.params;
  return withApiRequestLogging(request, { route: ROUTE, trustProxy: process.env.TRUST_PROXY }, (requestId) =>
    handleGetTemplate(request, templateId, {
      templateService: getProjectTemplateService,
      requestId: () => requestId,
    }),
  );
}

export async function PATCH(request: Request, context: RouteContext): Promise<Response> {
  const { templateId } = await context.params;
  return withApiRequestLogging(request, { route: ROUTE, trustProxy: process.env.TRUST_PROXY }, (requestId) =>
    handleUpdateTemplate(request, templateId, {
      templateService: getProjectTemplateService,
      ...readApplicationConfiguration(process.env),
      requestId: () => requestId,
    }),
  );
}

export async function DELETE(request: Request, context: RouteContext): Promise<Response> {
  const { templateId } = await context.params;
  return withApiRequestLogging(request, { route: ROUTE, trustProxy: process.env.TRUST_PROXY }, (requestId) =>
    handleDeleteTemplate(request, templateId, {
      templateService: getProjectTemplateService,
      ...readApplicationConfiguration(process.env),
      requestId: () => requestId,
    }),
  );
}
