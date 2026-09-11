import {
  createWorkingCalendar,
  scheduleLeaf,
  workingDaysBetween,
} from "@/domain/scheduling";

/**
 * A date-only fixture deliberately chosen to cross a weekend and a holiday.
 * It is evaluated by both the Server Component and the hydrated Client Component
 * so the UI can detect an accidental runtime-dependent scheduling implementation.
 */
export interface SchedulingRuntimeFixtureResult {
  readonly requestedStart: string;
  readonly start: string;
  readonly end: string;
  readonly duration: number;
  readonly inclusiveWorkingDays: number;
  readonly warningCode: "NON_WORKING_START_SHIFTED" | "NONE";
}

export function getSchedulingRuntimeFixture(): SchedulingRuntimeFixtureResult {
  const calendar = createWorkingCalendar({
    timezone: "Asia/Seoul",
    weekendDays: [6, 0],
    holidays: [{ date: "2026-09-14", name: "Fixture holiday" }],
  });
  const scheduled = scheduleLeaf({
    type: "task",
    requestedStart: "2026-09-12",
    duration: 3,
    scheduleMode: "auto",
  }, calendar);

  return Object.freeze({
    requestedStart: scheduled.requestedStart,
    start: scheduled.start,
    end: scheduled.end,
    duration: scheduled.duration,
    inclusiveWorkingDays: workingDaysBetween(scheduled.start, scheduled.end, calendar),
    warningCode: scheduled.warnings[0]?.code ?? "NONE",
  });
}

export function serializeSchedulingRuntimeFixture(result: SchedulingRuntimeFixtureResult): string {
  return JSON.stringify(result);
}
