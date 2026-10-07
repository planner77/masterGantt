import { withApiRequestLogging } from "@/server/http/request-context-core";
import { readApplicationConfiguration } from "@/server/security/origin-core";
import { getCountryCalendarAdminService } from "@/server/calendars/country-calendar-catalog";
import { handleCountryCalendarAdmin } from "@/server/calendars/country-calendar-admin-handlers-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const ROUTE = "/api/admin/work-calendars/countries/{countryCode}/years/{year}/dates/{date}";

export async function PATCH(request: Request, context: { params: Promise<{ countryCode: string; year: string; date: string }> }): Promise<Response> {
  const params = await context.params;
  return withApiRequestLogging(request, { route: ROUTE, trustProxy: process.env.TRUST_PROXY }, (requestId) =>
    handleCountryCalendarAdmin(request, "updateDate", params, { service: getCountryCalendarAdminService, ...readApplicationConfiguration(process.env), requestId: () => requestId }),
  );
}

export async function DELETE(request: Request, context: { params: Promise<{ countryCode: string; year: string; date: string }> }): Promise<Response> {
  const params = await context.params;
  return withApiRequestLogging(request, { route: ROUTE, trustProxy: process.env.TRUST_PROXY }, (requestId) =>
    handleCountryCalendarAdmin(request, "deleteDate", params, { service: getCountryCalendarAdminService, ...readApplicationConfiguration(process.env), requestId: () => requestId }),
  );
}
