import {
  COUNTRY_CALENDAR_IMPORT_LIMIT_BYTES, COUNTRY_CALENDAR_MANAGED_YEARS, COUNTRY_CALENDAR_MAX_DATES,
  type CountryCalendarAdminDateDto, type CountryCalendarImportDataset, type CountryCalendarImportEnvelope,
} from "../../contracts/country-calendar-admin";
import { WORK_CALENDAR_COUNTRY_CODES, type WorkCalendarCountryCode } from "../../contracts/work-calendar";
import { parseDateOnly } from "../../domain/scheduling";
import { PublicApiError } from "../http/api-error-core";
import { parseStrictJsonBytes } from "../http/strict-json-core";

export function invalidCountryCalendar(path: string, message: string): never {
  throw new PublicApiError(400, "INVALID_COUNTRY_CALENDAR_INPUT", "Country calendar input is invalid.", [{ path, code: "INVALID_COUNTRY_CALENDAR_INPUT", message }]);
}

export function calendarObject(value: unknown, keys: readonly string[], path: string, nonempty = false): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) invalidCountryCalendar(path, "An object is required.");
  const object = value as Record<string, unknown>;
  if (Object.keys(object).some((key) => !keys.includes(key)) || (nonempty && !Object.keys(object).length)) invalidCountryCalendar(path, "Unknown fields or an empty update are not allowed.");
  return object;
}

export function calendarCountry(value: unknown): WorkCalendarCountryCode {
  if (typeof value !== "string" || !(WORK_CALENDAR_COUNTRY_CODES as readonly string[]).includes(value)) invalidCountryCalendar("countryCode", "Unsupported country.");
  return value as WorkCalendarCountryCode;
}

export function calendarYear(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || !(COUNTRY_CALENDAR_MANAGED_YEARS as readonly number[]).includes(value)) invalidCountryCalendar("year", "Year must be an integer from 2026 to 2037.");
  return value;
}

export function calendarText(value: unknown, max: number, path: string): string {
  if (typeof value !== "string" || !value.isWellFormed() || value.trim() !== value || /[\u0000-\u001f\u007f]/u.test(value) || Array.from(value).length < 1 || Array.from(value).length > max) invalidCountryCalendar(path, `A trimmed text value of 1..${max} characters is required.`);
  return value;
}

export function calendarSourceVersion(value: unknown): string {
  const version = calendarText(value, 200, "sourceVersion");
  if (!/^[A-Za-z0-9][A-Za-z0-9._:+-]*$/.test(version)) invalidCountryCalendar("sourceVersion", "Use a stable ASCII version identifier.");
  return version;
}

export function calendarSourceUrl(value: unknown): string {
  const text = calendarText(value, 2048, "sourceUrl");
  try {
    const url = new URL(text);
    if ((url.protocol === "http:" || url.protocol === "https:") && !url.username && !url.password && url.hostname) return text;
  } catch { /* Invalid URL is reported below. */ }
  return invalidCountryCalendar("sourceUrl", "An absolute HTTP(S) source URL without credentials is required.");
}

export function calendarDate(value: unknown, year: number, path = "date"): string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value) || Number(value.slice(0, 4)) !== year) invalidCountryCalendar(path, "ISO date must belong to the selected year.");
  try { return parseDateOnly(value, path); } catch { return invalidCountryCalendar(path, "The Gregorian date is invalid."); }
}

export function calendarDateEntry(value: unknown, year: number, path = "date"): CountryCalendarAdminDateDto {
  const object = calendarObject(value, ["date", "name", "dayType", "sourceKey"], path);
  const date = calendarDate(object.date, year, `${path}.date`);
  if (object.dayType !== "WORKING" && object.dayType !== "NON_WORKING") invalidCountryCalendar(`${path}.dayType`, "Use WORKING or NON_WORKING.");
  return { date, dayType: object.dayType, name: calendarText(object.name, 200, `${path}.name`), sourceKey: calendarText(object.sourceKey, 120, `${path}.sourceKey`) };
}

export function parseCountryCalendarEnvelope(value: unknown): CountryCalendarImportEnvelope {
  const object = calendarObject(value, ["countryCode", "year", "format", "content"], "envelope");
  const countryCode = calendarCountry(object.countryCode), year = calendarYear(object.year);
  if (object.format !== "json" && object.format !== "csv") invalidCountryCalendar("format", "Use json or csv.");
  if (typeof object.content !== "string" || !object.content.isWellFormed()) invalidCountryCalendar("content", "Valid Unicode content is required.");
  const bom = object.content.indexOf("\uFEFF");
  if (bom > 0 || (bom === 0 && object.content.slice(1).includes("\uFEFF"))) invalidCountryCalendar("content", "Only one leading UTF-8 BOM is allowed.");
  if (Buffer.byteLength(object.content, "utf8") > COUNTRY_CALENDAR_IMPORT_LIMIT_BYTES) throw new PublicApiError(413, "IMPORT_TOO_LARGE", "Country calendar files must not exceed 1 MiB.");
  return { countryCode, year, format: object.format, content: object.content };
}

function csvRows(content: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", state: "start" | "plain" | "quoted" | "closed" = "start";
  for (let index = 0; index < content.length; index++) {
    const char = content[index];
    if (state === "quoted") {
      if (char === '"') {
        if (content[index + 1] === '"') { cell += '"'; index++; } else state = "closed";
      } else cell += char;
      continue;
    }
    if (char === "," || char === "\n" || char === "\r") {
      if (char === "\r" && content[index + 1] !== "\n") invalidCountryCalendar("content", "CSV line endings must be LF or CRLF.");
      row.push(cell); cell = ""; state = "start";
      if (char !== ",") { if (char === "\r") index++; rows.push(row); row = []; }
    } else if (char === '"' && state === "start") state = "quoted";
    else {
      if (char === '"' || state === "closed") invalidCountryCalendar("content", "CSV quoted field syntax is invalid.");
      cell += char; state = "plain";
    }
  }
  if (state === "quoted") invalidCountryCalendar("content", "CSV quoted field is not closed.");
  if (row.length || cell.length || state !== "start") { row.push(cell); rows.push(row); }
  if (rows.length > COUNTRY_CALENDAR_MAX_DATES + 1) invalidCountryCalendar("dates", "Too many dates.");
  return rows;
}

const CSV_HEADER = ["countryCode", "year", "date", "name", "dayType", "sourceKey", "sourceVersion", "sourceUrl"];
function csvDataset(content: string): unknown {
  const rows = csvRows(content.startsWith("\uFEFF") ? content.slice(1) : content);
  if (rows.length < 2 || rows[0].length !== CSV_HEADER.length || rows[0].some((value, index) => value !== CSV_HEADER[index])) invalidCountryCalendar("content", "CSV header must match the documented eight columns.");
  const first = rows[1];
  if (!/^\d{4}$/.test(first[1] ?? "")) invalidCountryCalendar("year", "CSV year must contain four digits.");
  const dates = rows.slice(1).map((cells, index) => {
    if (cells.length !== 8 || [0, 1, 6, 7].some((column) => cells[column] !== first[column])) invalidCountryCalendar(`rows.${index + 2}`, "Column count and dataset metadata must be consistent.");
    return { date: cells[2], name: cells[3], dayType: cells[4], sourceKey: cells[5] };
  });
  return { countryCode: first[0], year: Number(first[1]), status: "OFFICIAL", sourceVersion: first[6], sourceUrl: first[7], dates };
}

export function parseCountryCalendarImport(envelope: CountryCalendarImportEnvelope): CountryCalendarImportDataset {
  const checked = parseCountryCalendarEnvelope(envelope);
  const parsed = checked.format === "json" ? parseStrictJsonBytes(Buffer.from(checked.content, "utf8"), { maximumBytes: COUNTRY_CALENDAR_IMPORT_LIMIT_BYTES, maximumDepth: 32, error: (kind) => new PublicApiError(kind === "depth" || kind === "tooLarge" ? 413 : 400, kind === "depth" || kind === "tooLarge" ? "IMPORT_TOO_LARGE" : "INVALID_COUNTRY_CALENDAR_INPUT", `Country calendar JSON is invalid (${kind}).`) }) : csvDataset(checked.content);
  const object = calendarObject(parsed, ["countryCode", "year", "status", "sourceVersion", "sourceUrl", "dates"], "dataset");
  const countryCode = calendarCountry(object.countryCode), year = calendarYear(object.year);
  if (countryCode !== checked.countryCode || year !== checked.year) invalidCountryCalendar("countryCode/year", "The file must match the selected country and year.");
  if (object.status !== "OFFICIAL") invalidCountryCalendar("status", "A complete official dataset is required.");
  if (!Array.isArray(object.dates) || !object.dates.length || object.dates.length > COUNTRY_CALENDAR_MAX_DATES) invalidCountryCalendar("dates", "Provide 1..366 dates.");
  const seen = new Set<string>();
  const dates = object.dates.map((entry, index) => {
    const date = calendarDateEntry(entry, year, `dates.${index}`);
    if (seen.has(date.date)) invalidCountryCalendar(`dates.${index}.date`, "Duplicate dates, including conflicting day types, are not allowed.");
    seen.add(date.date); return date;
  }).sort((a, b) => a.date.localeCompare(b.date));
  return { countryCode, year, status: "OFFICIAL", sourceVersion: calendarSourceVersion(object.sourceVersion), sourceUrl: calendarSourceUrl(object.sourceUrl), dates };
}
