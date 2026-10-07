import { describe, expect, it } from "vitest";

import { WORK_CALENDAR_COUNTRY_CODES } from "../../../src/contracts/work-calendar";
import {
  getCountryCalendarDataset,
  listCountryCalendarDescriptors,
} from "../../../src/server/calendars/country-calendar-data";

describe("country calendar fixture", () => {
  it("publishes all Issue #57 countries with 2026 support", () => {
    const descriptors=listCountryCalendarDescriptors();
    expect(descriptors.map((entry)=>entry.code)).toEqual([...WORK_CALENDAR_COUNTRY_CODES]);
    for(const descriptor of descriptors) {
      expect(descriptor.supportedYears).toContain(2026);
      expect(descriptor.sourceVersion.length).toBeGreaterThan(0);
      expect(descriptor.sourceUrl).toMatch(/^https:\/\//);
      expect(getCountryCalendarDataset(descriptor.code,2026)?.dates.length).toBeGreaterThan(0);
    }
  });

  it("does not silently synthesize unsupported years", () => {
    for(const code of WORK_CALENDAR_COUNTRY_CODES) {
      if(code!=="US" && code!=="TH") expect(getCountryCalendarDataset(code,2027)).toBeUndefined();
      expect(getCountryCalendarDataset(code,2031)).toBeUndefined();
    }
  });

  it("preserves official weekend working-day overrides for China and Vietnam", () => {
    const china=getCountryCalendarDataset("CN",2026)!;
    const vietnam=getCountryCalendarDataset("VN",2026)!;

    expect(china.dates).toContainEqual(expect.objectContaining({
      date:"2026-02-14",
      dayType:"WORKING",
    }));
    expect(vietnam.dates).toContainEqual(expect.objectContaining({
      date:"2026-08-22",
      dayType:"WORKING",
    }));
    expect(vietnam.dates).toHaveLength(17);
    expect(vietnam.dates).toContainEqual(expect.objectContaining({date:"2026-01-02",dayType:"NON_WORKING"}));
    expect(vietnam.dates).toContainEqual(expect.objectContaining({date:"2026-01-10",dayType:"WORKING"}));
    expect(vietnam.dates).toContainEqual(expect.objectContaining({date:"2026-11-24",dayType:"NON_WORKING"}));
    expect(vietnam.dates.some((entry)=>entry.date==="2026-11-23" || entry.date==="2026-11-28")).toBe(false);
    expect(vietnam.descriptor.sourceVersion).toContain("12729");
  });

  it("uses published OPM dates and keeps cross-year observation provenance without leaking it into import DTOs", () => {
    const us2027=getCountryCalendarDataset("US",2027)!;
    expect(us2027.dates).toHaveLength(12);
    expect(us2027.dates).toContainEqual(expect.objectContaining({date:"2027-12-31",sourceScheduleYear:2028}));
    expect(getCountryCalendarDataset("US",2028)!.dates).toHaveLength(10);
    expect(getCountryCalendarDataset("US",2028)!.dates.every((entry)=>entry.date.startsWith("2028-"))).toBe(true);
    expect(getCountryCalendarDataset("US",2029)!.dates).toContainEqual(expect.objectContaining({date:"2029-11-12"}));
    expect(getCountryCalendarDataset("US",2029)!.dates.some((entry)=>entry.date==="2029-11-11")).toBe(false);
    expect(getCountryCalendarDataset("US",2030)!.dates).toHaveLength(11);
    expect(getCountryCalendarDataset("TH",2027)!.dates).toHaveLength(18);
    expect(getCountryCalendarDataset("TH",2027)!.descriptor.sourceUrl).toContain("ThaiPDF/25690175.pdf");
  });
});
