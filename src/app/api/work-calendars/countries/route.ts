import { withApiRequestLogging } from "@/server/http/request-context-core";
import { handleListWorkCalendarCountries } from "@/server/calendars/work-calendar-handlers-core";
import { getWorkCalendarService } from "@/server/calendars/work-calendar-service";

export const runtime="nodejs";
export const dynamic="force-dynamic";
const ROUTE="/api/work-calendars/countries";

export async function GET(request:Request):Promise<Response> {
  return withApiRequestLogging(request,{route:ROUTE,trustProxy:process.env.TRUST_PROXY},(requestId)=>
    handleListWorkCalendarCountries({calendarService:getWorkCalendarService,requestId:()=>requestId}),
  );
}
