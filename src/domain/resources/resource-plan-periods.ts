import { dateToOrdinal, ordinalToDate } from "../scheduling/date-only";

export type ResourcePlanGranularity = "week" | "month";
export interface ResourcePlanPeriod {
  key: string;
  label: string;
  from: string;
  to: string;
  year: number;
  week?: number;
  month?: number;
  partial: boolean;
}
const beforeYear = (year: number) => 365 * (year - 1) + Math.floor((year - 1) / 4) - Math.floor((year - 1) / 100) + Math.floor((year - 1) / 400);
/** ISO metadata may name 2200; only clipped dates enter the supported date parser. */
export function buildResourcePlanPeriods(from: string, to: string, granularity: ResourcePlanGranularity): ResourcePlanPeriod[] {
  const first = dateToOrdinal(from), last = dateToOrdinal(to);
  if (first > last || last - first + 1 > 366) throw new Error("Invalid Resource Plan date range");
  if (granularity !== "week" && granularity !== "month") throw new Error("Invalid Resource Plan granularity");
  const result: ResourcePlanPeriod[] = [];
  for (let current = first; current <= last;) {
    const date = ordinalToDate(current);
    let start: number, end: number, key: string, year = Number(date.slice(0, 4));
    let week: number | undefined, month: number | undefined;
    if (granularity === "week") {
      start = current - current % 7; end = start + 6;
      const thursday = start + 3;
      if (thursday >= beforeYear(year + 1)) year += 1;
      else if (thursday < beforeYear(year)) year -= 1;
      const jan4 = beforeYear(year) + 3, week1 = jan4 - jan4 % 7;
      week = Math.floor((start - week1) / 7) + 1;
      key = `${year}-W${String(week).padStart(2, "0")}`;
    } else {
      month = Number(date.slice(5, 7)); start = current - Number(date.slice(8, 10)) + 1;
      const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
      const days = month === 2 ? (leap ? 29 : 28) : [4, 6, 9, 11].includes(month) ? 30 : 31;
      end = start + days - 1; key = `${year}-${String(month).padStart(2, "0")}`;
    }
    result.push({ key, label: key, year, ...(week === undefined ? {} : { week }), ...(month === undefined ? {} : { month }), from: ordinalToDate(Math.max(first, start)), to: ordinalToDate(Math.min(last, end)), partial: start < first || end > last });
    current = end + 1;
  }
  return result;
}
