import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";

import { COUNTRY_CALENDAR_MANAGED_YEARS } from "../../../src/contracts/country-calendar-admin";
import {
  CountryCalendarCatalogConflictError,
  CountryCalendarCatalogInvalidInputError,
  CountryCalendarCatalogRevisionMismatchError,
  CountryCalendarCatalogService,
  parseCountryCalendarImport,
} from "../../../src/server/calendars/country-calendar-catalog-core";

const databases: Database.Database[] = [];

function database(): Database.Database {
  const db = new Database(":memory:");
  databases.push(db);
  db.pragma("foreign_keys = ON");
  db.exec(`
    CREATE TABLE country_calendar_catalog_state (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      revision INTEGER NOT NULL CHECK (revision >= 1),
      updated_at TEXT NOT NULL
    ) STRICT;
    INSERT INTO country_calendar_catalog_state VALUES (1, 1, '2026-09-30T00:00:00.000Z');
    CREATE TABLE country_calendar_datasets (
      id INTEGER PRIMARY KEY,
      country_code TEXT NOT NULL CHECK (country_code IN ('KR','CN','VN','PH','TH','MX','US')),
      calendar_year INTEGER NOT NULL CHECK (calendar_year BETWEEN 2026 AND 2037),
      status TEXT NOT NULL CHECK (status IN ('OFFICIAL','UNAVAILABLE','SUPERSEDED')),
      source_version TEXT,
      source_url TEXT,
      updated_at TEXT NOT NULL,
      UNIQUE (country_code, calendar_year)
    ) STRICT;
    CREATE TABLE country_calendar_dates (
      id INTEGER PRIMARY KEY,
      dataset_id INTEGER NOT NULL REFERENCES country_calendar_datasets(id) ON DELETE CASCADE,
      holiday_date TEXT NOT NULL,
      name TEXT NOT NULL,
      day_type TEXT NOT NULL CHECK (day_type IN ('NON_WORKING','WORKING')),
      source_key TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE (dataset_id, holiday_date)
    ) STRICT;
  `);
  return db;
}

afterEach(() => {
  for (const db of databases.splice(0)) db.close();
});

describe("Issue #342 country calendar catalog", () => {
  it("defines all 2026..2037 management slots without synthesizing unavailable future data", () => {
    expect(COUNTRY_CALENDAR_MANAGED_YEARS).toEqual([
      2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033, 2034, 2035, 2036, 2037,
    ]);
    const service = new CountryCalendarCatalogService(database());
    expect(service.getAdminDataset("KR", 2026).data.dataset).toMatchObject({
      status: "OFFICIAL", origin: "BUILT_IN",
    });
    expect(service.getAdminDataset("KR", 2037).data).toMatchObject({
      dataset: { status: "UNAVAILABLE", origin: "EMPTY", dateCount: 0 },
      dates: [],
    });
    expect(service.getEffectiveDataset("KR", 2037)).toBeUndefined();
  });

  it("parses canonical JSON and operator-friendly CSV while rejecting duplicate dates", () => {
    const json = parseCountryCalendarImport({
      format: "json",
      content: JSON.stringify({
        countryCode: "KR", year: 2030, sourceVersion: "KR-2030-official-1",
        sourceUrl: "https://example.go.kr/2030",
        dates: [{ date: "2030-01-01", name: "신정", dayType: "NON_WORKING", sourceKey: "new-year" }],
      }),
    });
    expect(json.dates).toHaveLength(1);

    const csv = parseCountryCalendarImport({
      format: "csv",
      content: [
        "countryCode,year,date,name,dayType,sourceKey,sourceVersion,sourceUrl",
        "CN,2030,2030-01-01,元旦,NON_WORKING,new-year,CN-2030-official-1,https://www.gov.cn/2030",
        "CN,2030,2030-01-05,调休上班,WORKING,new-year-working,CN-2030-official-1,https://www.gov.cn/2030",
      ].join("\n"),
    });
    expect(csv.dates.map((entry) => entry.dayType)).toEqual(["NON_WORKING", "WORKING"]);

    expect(() => parseCountryCalendarImport({
      format: "json",
      content: JSON.stringify({
        countryCode: "US", year: 2030, sourceVersion: "US-2030", sourceUrl: "https://www.opm.gov/",
        dates: [
          { date: "2030-01-01", name: "A", dayType: "NON_WORKING", sourceKey: "a" },
          { date: "2030-01-01", name: "B", dayType: "WORKING", sourceKey: "b" },
        ],
      }),
    })).toThrow(CountryCalendarCatalogInvalidInputError);
  });

  it("previews and atomically replaces a dataset, then exposes it to Scheduling resolution", () => {
    const db = database();
    const service = new CountryCalendarCatalogService(db, () => new Date("2026-09-30T01:00:00.000Z"));
    const envelope = {
      format: "json" as const,
      content: JSON.stringify({
        countryCode: "KR", year: 2030, sourceVersion: "KR-2030-official-1",
        sourceUrl: "https://example.go.kr/2030",
        dates: [
          { date: "2030-01-01", name: "신정", dayType: "NON_WORKING", sourceKey: "new-year" },
          { date: "2030-01-06", name: "보충 근무", dayType: "WORKING", sourceKey: "working-swap" },
        ],
      }),
    };
    expect(service.previewImport(envelope).data.summary).toEqual({
      additions: 2, changes: 0, deletions: 0, unchanged: 0,
    });

    const applied = service.applyImport(1, envelope);
    expect(applied.data.revision).toBe(2);
    expect(applied.data.dataset).toMatchObject({
      countryCode: "KR", year: 2030, status: "OFFICIAL", origin: "OVERRIDE",
      sourceVersion: "KR-2030-official-1", dateCount: 2,
    });
    expect(service.getEffectiveDataset("KR", 2030)?.dates).toContainEqual(expect.objectContaining({
      date: "2030-01-06", dayType: "WORKING",
    }));
    expect(service.listEffectiveDescriptors().find((entry) => entry.code === "KR")?.supportedYears)
      .toEqual([2026, 2030]);
    expect(() => service.applyImport(1, envelope)).toThrow(CountryCalendarCatalogRevisionMismatchError);
    expect(db.prepare("SELECT count(*) AS count FROM country_calendar_dates").get()).toEqual({ count: 2 });
  });

  it("clones built-in data on first CRUD edit and preserves source metadata round-trip", () => {
    const service = new CountryCalendarCatalogService(database(), () => new Date("2026-09-30T02:00:00.000Z"));
    const initial = service.getAdminDataset("CN", 2026);
    expect(initial.data.dates).toContainEqual(expect.objectContaining({
      date: "2026-02-14", dayType: "WORKING",
    }));

    const added = service.addDate("CN", 2026, initial.data.revision, {
      date: "2026-12-20", name: "추가 검증일", dayType: "WORKING", sourceKey: "operator-test",
    });
    expect(added.data.dataset).toMatchObject({
      origin: "OVERRIDE", status: "UNAVAILABLE", sourceVersion: null, sourceUrl: null,
    });
    expect(service.getEffectiveDataset("CN", 2026)).toBeUndefined();

    const updated = service.updateMetadata("CN", 2026, added.data.revision, {
      status: "OFFICIAL",
      sourceVersion: "CN-2026-operator-2",
      sourceUrl: "https://www.gov.cn/official-2026",
    });
    expect(updated.data.dataset).toMatchObject({
      status: "OFFICIAL", sourceVersion: "CN-2026-operator-2", sourceUrl: "https://www.gov.cn/official-2026",
    });

    const edited = service.updateDate("CN", 2026, "2026-12-20", updated.data.revision, {
      name: "수정 검증일",
    });
    expect(edited.data.dataset).toMatchObject({
      status: "UNAVAILABLE", sourceVersion: null, sourceUrl: null,
    });
    expect(service.getEffectiveDataset("CN", 2026)).toBeUndefined();
  });

  it("requires complete source metadata and at least one date before an empty slot becomes OFFICIAL", () => {
    const service = new CountryCalendarCatalogService(database());
    const unavailable = service.getAdminDataset("US", 2037);
    expect(() => service.updateMetadata("US", 2037, unavailable.data.revision, {
      status: "OFFICIAL", sourceVersion: "US-2037", sourceUrl: "https://www.opm.gov/",
    })).toThrow(CountryCalendarCatalogConflictError);

    const added = service.addDate("US", 2037, unavailable.data.revision, {
      date: "2037-01-01", name: "New Year's Day", dayType: "NON_WORKING", sourceKey: "new-year",
    });
    expect(service.getEffectiveDataset("US", 2037)).toBeUndefined();
    const official = service.updateMetadata("US", 2037, added.data.revision, {
      status: "OFFICIAL", sourceVersion: "US-2037-opm", sourceUrl: "https://www.opm.gov/",
    });
    expect(official.data.dataset.status).toBe("OFFICIAL");
    expect(service.getEffectiveDataset("US", 2037)?.dates).toHaveLength(1);
  });
});
