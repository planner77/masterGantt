import { describe, expect, it } from "vitest";

import { excelIsoWeekHeader } from "../../../src/server/exports/project-excel-export-core";

describe("Excel Gantt ISO week header", () => {
  it("주차 표시에는 연도와 W 접두어 없이 주차 번호만 사용한다", () => {
    expect(excelIsoWeekHeader("2026-09-21")).toEqual({
      key: "2026-W39",
      label: "39",
    });
  });

  it("연말/연초에서도 기존 ISO week 계산 key를 유지하고 표시만 숫자로 만든다", () => {
    expect(excelIsoWeekHeader("2026-12-31")).toEqual({
      key: "2026-W53",
      label: "53",
    });
    expect(excelIsoWeekHeader("2027-01-01")).toEqual({
      key: "2026-W53",
      label: "53",
    });
    expect(excelIsoWeekHeader("2027-01-04")).toEqual({
      key: "2027-W01",
      label: "1",
    });
  });
});
