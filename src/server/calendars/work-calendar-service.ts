import "server-only";

import { getDatabase } from "../db";
import { WorkCalendarService } from "./work-calendar-service-core";

export function getWorkCalendarService():WorkCalendarService {
  return new WorkCalendarService(getDatabase());
}
