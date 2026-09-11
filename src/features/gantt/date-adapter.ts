export type DateOnly = `${number}-${number}-${number}`;

export interface DomainTaskDates {
  start: DateOnly;
  /** The project domain treats an end date as an included calendar date. */
  end: DateOnly;
}

export interface SvarTaskDates {
  start: Date;
  /**
   * SVAR's Core examples and REST guide imply an exclusive `end` date. This
   * adapter is the only place where the project's inclusive end becomes that
   * endpoint; it must be confirmed against the installed widget by W03 E2E.
   */
  end: Date;
}

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

function parts(value: DateOnly): [number, number, number] {
  const match = DATE_ONLY.exec(value);
  if (!match) throw new Error(`Expected a YYYY-MM-DD date, received ${value}`);

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    throw new Error(`Expected a valid Gregorian date, received ${value}`);
  }
  return [year, month, day];
}

/** Creates a local calendar date without parsing a UTC timestamp. */
export function localDateFromDateOnly(value: DateOnly): Date {
  const [year, month, day] = parts(value);
  return new Date(year, month - 1, day);
}

/** Reads the local calendar fields and deliberately never uses toISOString(). */
export function dateOnlyFromLocalDate(value: Date): DateOnly {
  if (Number.isNaN(value.getTime())) throw new Error("Expected a valid Date");
  return `${value.getFullYear().toString().padStart(4, "0")}-${(value.getMonth() + 1)
    .toString()
    .padStart(2, "0")}-${value.getDate().toString().padStart(2, "0")}` as DateOnly;
}

function nextLocalCalendarDate(value: DateOnly): Date {
  const date = localDateFromDateOnly(value);
  date.setDate(date.getDate() + 1);
  return date;
}

export function domainDatesToSvarDates(dates: DomainTaskDates): SvarTaskDates {
  if (dates.end < dates.start) {
    throw new Error("Task end date must not precede its start date");
  }
  const start = localDateFromDateOnly(dates.start);
  const end = nextLocalCalendarDate(dates.end);
  if (end <= start) throw new Error("Task end date must not precede its start date");
  return { start, end };
}

export function svarDatesToDomainDates(dates: SvarTaskDates): DomainTaskDates {
  const start = dateOnlyFromLocalDate(dates.start);
  const end = new Date(dates.end.getFullYear(), dates.end.getMonth(), dates.end.getDate());
  end.setDate(end.getDate() - 1);
  const domainEnd = dateOnlyFromLocalDate(end);
  if (domainEnd < start) throw new Error("SVAR end date must follow its start date");
  return { start, end: domainEnd };
}
