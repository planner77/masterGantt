import { getCountryCalendarCatalogService } from "@/server/calendars/country-calendar-catalog";
import { handleCreateCountryCalendarDate } from "@/server/calendars/country-calendar-admin-handlers-core";
import { withApiRequestLogging } from "@/server/http/request-context-core";
import { getProjectMasterService } from "@/server/project-master/project-master-service";
import { readApplicationConfiguration } from "@/server/security/origin-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const ROUTE = "/api/admin/work-calendars/countries/[countryCode]/years/[year]/dates";
interface RouteContext { params: Promise<{ countryCode: string; year: string }> }
const deps = (requestId: string) => ({
  catalogService: getCountryCalendarCatalogService,
  projectMasterService: getProjectMasterService,
  ...readApplicationConfiguration(process.env),
  requestId: () => requestId,
});

export async function POST(request: Request, context: RouteContext): Promise<Response> {
  const { countryCode, year } = await context.params;
  return withApiRequestLogging(request, { route: ROUTE, trustProxy: process.env.TRUST_PROXY }, (requestId) =>
    handleCreateCountryCalendarDate(request, countryCode, year, deps(requestId)),
  );
}
