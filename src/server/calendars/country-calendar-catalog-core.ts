import type Database from "better-sqlite3";
import { COUNTRY_CALENDAR_MANAGED_YEARS, type CountryCalendarAdminResponse } from "../../contracts/country-calendar-admin";
import { WORK_CALENDAR_COUNTRY_CODES, type CountryCalendarListResponse, type WorkCalendarCountryCode } from "../../contracts/work-calendar";
import { CountryCalendarRepository } from "../repositories/country-calendar-repository-core";
import { getCountryCalendarDataset, listCountryCalendarDescriptors, type CountryCalendarDataset } from "./country-calendar-data";
import { calendarCountry, calendarYear } from "./country-calendar-validation-core";

/** Current catalog is read only when explicitly materializing a new calendar. */
export class CountryCalendarCatalog {
  readonly repository: CountryCalendarRepository;
  constructor(database: Database.Database) { this.repository = new CountryCalendarRepository(database); }

  snapshot(code: WorkCalendarCountryCode, year: number): CountryCalendarAdminResponse {
    calendarCountry(code); calendarYear(year);
    const name = listCountryCalendarDescriptors().find((entry) => entry.code === code)!.name;
    const row = this.repository.findDataset(code, year);
    if (row) {
      const dates = this.repository.listDates(row.id);
      return { data: { revision: this.repository.getRevision(), dataset: { countryCode: code, countryName: name, year, status: row.status, origin: "OVERRIDE", sourceVersion: row.sourceVersion, sourceUrl: row.sourceUrl, dateCount: dates.length, updatedAt: row.updatedAt }, dates } };
    }
    const builtin = getCountryCalendarDataset(code, year);
    const dates = builtin?.dates.map(({ date, name, dayType, sourceKey }) => ({ date, name, dayType, sourceKey })) ?? [];
    return { data: { revision: this.repository.getRevision(), dataset: { countryCode: code, countryName: name, year, status: builtin ? "OFFICIAL" : "UNAVAILABLE", origin: builtin ? "BUILT_IN" : "EMPTY", sourceVersion: builtin?.descriptor.sourceVersion ?? null, sourceUrl: builtin?.descriptor.sourceUrl ?? null, dateCount: dates.length, updatedAt: null }, dates } };
  }

  effectiveDataset(code: WorkCalendarCountryCode, year: number): CountryCalendarDataset | undefined {
    if (!(COUNTRY_CALENDAR_MANAGED_YEARS as readonly number[]).includes(year)) return undefined;
    const snapshot = this.snapshot(code, year).data;
    if (snapshot.dataset.status !== "OFFICIAL" || !snapshot.dataset.sourceVersion || !snapshot.dataset.sourceUrl || !snapshot.dates.length) return undefined;
    return { descriptor: { code, name: snapshot.dataset.countryName, supportedYears: [year], sourceVersion: snapshot.dataset.sourceVersion, sourceUrl: snapshot.dataset.sourceUrl }, dates: snapshot.dates };
  }

  listCountries(): CountryCalendarListResponse {
    return { data: { catalogRevision: this.repository.getRevision(), countries: WORK_CALENDAR_COUNTRY_CODES.map((code) => {
      const datasets = COUNTRY_CALENDAR_MANAGED_YEARS.map((year) => this.snapshot(code, year).data.dataset);
      const supported = datasets.filter((entry) => entry.status === "OFFICIAL" && entry.dateCount > 0 && entry.sourceVersion && entry.sourceUrl);
      const latest = supported.at(-1);
      return { code, name: datasets[0].countryName, supportedYears: supported.map((entry) => entry.year), sourceVersion: latest?.sourceVersion ?? null, sourceUrl: latest?.sourceUrl ?? null, datasets };
    }) } };
  }
}
