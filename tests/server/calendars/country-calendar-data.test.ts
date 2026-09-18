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
      expect(getCountryCalendarDataset(code,2027)).toBeUndefined();
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
  });
});
