import { getCountryCalendarCatalogService } from "@/server/calendars/country-calendar-catalog";
import {
  handleDeleteCountryCalendarDate,
  handleUpdateCountryCalendarDate,
} from "@/server/calendars/country-calendar-admin-handlers-core";
import { withApiRequestLogging } from "@/server/http/request-context-core";
import { getProjectMasterService } from "@/server/project-master/project-master-service";
import { readApplicationConfiguration } from "@/server/security/origin-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const ROUTE = "/api/admin/work-calendars/countries/[countryCode]/years/[year]/dates/[date]";
interface RouteContext { params: Promise<{ countryCode: string; year: string; date: string }> }
const deps = (requestId: string) => ({
  catalogService: getCountryCalendarCatalogService,
  projectMasterService: getProjectMasterService,
  ...readApplicationConfiguration(process.env),
  requestId: () => requestId,
});

export async function PATCH(request: Request, context: RouteContext): Promise<Response> {
  const { countryCode, year, date } = await context.params;
  return withApiRequestLogging(request, { route: ROUTE, trustProxy: process.env.TRUST_PROXY }, (requestId) =>
    handleUpdateCountryCalendarDate(request, countryCode, year, date, deps(requestId)),
  );
}

export async function DELETE(request: Request, context: RouteContext): Promise<Response> {
  const { countryCode, year, date } = await context.params;
  return withApiRequestLogging(request, { route: ROUTE, trustProxy: process.env.TRUST_PROXY }, (requestId) =>
    handleDeleteCountryCalendarDate(request, countryCode, year, date, deps(requestId)),
  );
}
