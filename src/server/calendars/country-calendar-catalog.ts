import "server-only";

import { getDatabase } from "../db";
import { CountryCalendarCatalogService } from "./country-calendar-catalog-core";

export function getCountryCalendarCatalogService(): CountryCalendarCatalogService {
  return new CountryCalendarCatalogService(getDatabase());
}
