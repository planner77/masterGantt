import { withApiRequestLogging } from "@/server/http/request-context-core";
import { getProjectService } from "@/server/projects/project-service";
import { readApplicationConfiguration } from "@/server/security/origin-core";
import {
  handleCreateTemplateFromProject,
  handleListTemplates,
} from "@/server/templates/project-template-handlers-core";
import { getProjectTemplateService } from "@/server/templates/project-template-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ROUTE = "/api/project-templates";

export async function GET(request: Request): Promise<Response> {
  return withApiRequestLogging(request, { route: ROUTE, trustProxy: process.env.TRUST_PROXY }, (requestId) =>
    handleListTemplates(request, {
      templateService: getProjectTemplateService,
      requestId: () => requestId,
    }),
  );
}

export async function POST(request: Request): Promise<Response> {
  return withApiRequestLogging(request, { route: ROUTE, trustProxy: process.env.TRUST_PROXY }, (requestId) =>
    handleCreateTemplateFromProject(request, {
      templateService: getProjectTemplateService,
      projectService: getProjectService,
      ...readApplicationConfiguration(process.env),
      requestId: () => requestId,
    }),
  );
}
