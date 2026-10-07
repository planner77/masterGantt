import { withApiRequestLogging } from "@/server/http/request-context-core";
import { readApplicationConfiguration } from "@/server/security/origin-core";
import { getCountryCalendarAdminService } from "@/server/calendars/country-calendar-catalog";
import { handleCountryCalendarAdmin } from "@/server/calendars/country-calendar-admin-handlers-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const ROUTE = "/api/admin/work-calendars/import/apply";

export async function POST(request: Request): Promise<Response> {
  const params = {};
  return withApiRequestLogging(request, { route: ROUTE, trustProxy: process.env.TRUST_PROXY }, (requestId) =>
    handleCountryCalendarAdmin(request, "apply", params, { service: getCountryCalendarAdminService, ...readApplicationConfiguration(process.env), requestId: () => requestId }),
  );
}
