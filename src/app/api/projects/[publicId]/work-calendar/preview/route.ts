import { getWorkCalendarService } from "@/server/calendars/work-calendar-service";
import { handlePreviewProjectWorkCalendar } from "@/server/calendars/work-calendar-handlers-core";
import { withApiRequestLogging } from "@/server/http/request-context-core";
import { getProjectService } from "@/server/projects/project-service";
import { readApplicationConfiguration } from "@/server/security/origin-core";

export const runtime="nodejs";
export const dynamic="force-dynamic";
const ROUTE="/api/projects/[publicId]/work-calendar/preview";
interface RouteContext { params:Promise<{publicId:string}> }

export async function POST(request:Request,context:RouteContext):Promise<Response> {
  const {publicId}=await context.params;
  return withApiRequestLogging(request,{route:ROUTE,trustProxy:process.env.TRUST_PROXY},(requestId)=>
    handlePreviewProjectWorkCalendar(request,publicId,{
      calendarService:getWorkCalendarService,projectService:getProjectService,
      ...readApplicationConfiguration(process.env),requestId:()=>requestId,
    }),
  );
}
