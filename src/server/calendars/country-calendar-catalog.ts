import "server-only";
import { getDatabase } from "../db";
import { CountryCalendarAdminService } from "./country-calendar-admin-service-core";

export function getCountryCalendarAdminService(): CountryCalendarAdminService {
  return new CountryCalendarAdminService(getDatabase());
}
