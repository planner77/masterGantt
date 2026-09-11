export type SchedulingErrorCode =
  | "INVALID_DATE"
  | "DATE_OUT_OF_RANGE"
  | "INVALID_DAY_OFFSET"
  | "INVALID_DATE_INTERVAL"
  | "INVALID_CALENDAR"
  | "UNSUPPORTED_TIMEZONE"
  | "UNSUPPORTED_WEEKEND"
  | "INVALID_HOLIDAY"
  | "DUPLICATE_HOLIDAY"
  | "HOLIDAY_LIMIT_EXCEEDED"
  | "NO_WORKING_DAY"
  | "NON_WORKING_START"
  | "NON_WORKING_MANUAL_START"
  | "INVALID_LEAF_INPUT"
  | "INVALID_TASK_TYPE"
  | "INVALID_SCHEDULE_MODE"
  | "INVALID_DURATION"
  | "END_DURATION_MISMATCH";

/** Safe structured context; never includes an entire caller payload. */
export interface SchedulingErrorContext {
  readonly field?: string;
  readonly date?: string;
  readonly expectedDate?: string;
  readonly index?: number;
}

export class SchedulingError extends Error {
  readonly code: SchedulingErrorCode;
  readonly context: Readonly<SchedulingErrorContext>;

  constructor(code: SchedulingErrorCode, context: SchedulingErrorContext = {}) {
    super(code);
    this.name = "SchedulingError";
    this.code = code;
    this.context = Object.freeze({ ...context });
  }
}
