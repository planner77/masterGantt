import { getCountryCalendarCatalogService } from "@/server/calendars/country-calendar-catalog";
import { handlePreviewCountryCalendarImport } from "@/server/calendars/country-calendar-admin-handlers-core";
import { withApiRequestLogging } from "@/server/http/request-context-core";
import { getProjectMasterService } from "@/server/project-master/project-master-service";
import { readApplicationConfiguration } from "@/server/security/origin-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const ROUTE = "/api/admin/work-calendars/import/preview";
const deps = (requestId: string) => ({
  catalogService: getCountryCalendarCatalogService,
  projectMasterService: getProjectMasterService,
  ...readApplicationConfiguration(process.env),
  requestId: () => requestId,
});

export async function POST(request: Request): Promise<Response> {
  return withApiRequestLogging(request, { route: ROUTE, trustProxy: process.env.TRUST_PROXY }, (requestId) =>
    handlePreviewCountryCalendarImport(request, deps(requestId)),
  );
}
