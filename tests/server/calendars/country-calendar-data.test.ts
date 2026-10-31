import { createHash } from "node:crypto";
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

  it("preserves six unchanged 2026 datasets and all original Vietnam rows", () => {
    // SHA256 of the public dataset at ce8ca4ec, including dates, names, day types and source metadata.
    const baseline = {
      KR: "3c61db88880499e7314de01ce980bc66b8a12571b7c397978de021288d6221ed",
      CN: "681ffc52b526870670b8104abc18293a95673d2cff9810d578929fc7ba49b8f2",
      VN: "9bcaa9915ccfef776ab42a872ed76636d2bf25181dab3c2664609b90c561ea2b",
      PH: "9b40dddb680bc55091216c8243c3ef47a9eaf4d307f91500ce875b5865bbe726",
      TH: "fb945ba4fae412329dba535534462409526f12cf6eb7081f2320b139d145e85d",
      MX: "aa6e414b7a88dc7e13a518ce4f70ca040787d13e769646182fc632b49a99d0d3",
      US: "63d1431ccc38d1aa79f36123fd1b898f946e2803d04c9380474be13131bfb3e6",
    };
    for(const code of WORK_CALENDAR_COUNTRY_CODES.filter((code)=>code!=="VN")) {
      expect(createHash("sha256").update(JSON.stringify(getCountryCalendarDataset(code,2026))).digest("hex")).toBe(baseline[code]);
    }
    const current=getCountryCalendarDataset("VN",2026)!;
    const added=new Set(["2026-01-02","2026-01-10","2026-11-24"]);
    const original={
      descriptor:{...current.descriptor,sourceVersion:"VN-2026-bnv",sourceUrl:"https://xaydungchinhsach.chinhphu.vn/de-xuat-phuong-an-nghi-tet-am-lich-nghi-le-quoc-khanh-nam-2026-119251002130522291.htm"},
      dates:current.dates.filter((entry)=>!added.has(entry.date)).map((entry)=>({date:entry.date,name:entry.name,sourceKey:entry.sourceKey,dayType:entry.dayType})),
    };
    expect(createHash("sha256").update(JSON.stringify(original)).digest("hex")).toBe(baseline.VN);
  });

  it("adds only the independently verified Vietnam 2026 rest and makeup dates", () => {
    const dataset=getCountryCalendarDataset("VN",2026)!;
    expect(dataset.dates).toHaveLength(17);
    expect(dataset.dates.filter((entry)=>entry.dayType==="WORKING")).toHaveLength(2);
    expect(dataset.dates).toContainEqual({date:"2026-01-02",name:"Nghỉ hoán đổi Tết Dương lịch",dayType:"NON_WORKING",sourceKey:"new-year-swap"});
    expect(dataset.dates).toContainEqual({date:"2026-01-10",name:"Làm bù Tết Dương lịch",dayType:"WORKING",sourceKey:"new-year-working"});
    expect(dataset.dates).toContainEqual({date:"2026-11-24",name:"Ngày Văn hóa Việt Nam",dayType:"NON_WORKING",sourceKey:"vietnam-culture-day"});
    expect(dataset.dates.some((entry)=>entry.date==="2026-11-23" || entry.date==="2026-11-28")).toBe(false);
    expect(dataset.descriptor.sourceVersion).toBe("VN-2026-public-employees-12729+BNV-2025-10+3383+QH16-28+10065-v3");
    expect(dataset.descriptor.sourceUrl).toBe("https://baochinhphu.vn/cong-chuc-vien-chuc-duoc-nghi-4-ngay-dip-tet-duong-lich-2026-102251225111845247.htm");
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
