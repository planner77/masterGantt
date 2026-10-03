export type GanttScaleMode = "day" | "week";

export const GANTT_CELL_WIDTH: Readonly<Record<GanttScaleMode, number>> = {
  day: 36,
  week: 68,
};

const MS_PER_DAY = 86_400_000;
const UNIT_DAYS: Readonly<Record<GanttScaleMode, number>> = {
  day: 1,
  week: 7,
};
const MIN_EXTENSION_CELLS: Readonly<Record<GanttScaleMode, number>> = {
  day: 14,
  week: 4,
};
const MIN_THRESHOLD_CELLS: Readonly<Record<GanttScaleMode, number>> = {
  day: 3,
  week: 1,
};

function localCalendarDayDistance(start: Date, end: Date): number {
  const startUtc = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
  const endUtc = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
  return Math.max(0, Math.trunc((endUtc - startUtc) / MS_PER_DAY));
}

export function nextTimelineScaleWidth({
  scaleWidth,
  scrollLeft,
  viewportWidth,
  scaleMode,
}: Readonly<{
  scaleWidth?: number;
  scrollLeft?: number;
  viewportWidth?: number;
  scaleMode: GanttScaleMode;
}>): number | null {
  if (
    !Number.isFinite(scaleWidth) ||
    !Number.isFinite(scrollLeft) ||
    !Number.isFinite(viewportWidth) ||
    !scaleWidth || !viewportWidth ||
    scaleWidth <= 0 ||
    scrollLeft! < 0 ||
    viewportWidth <= 0
  ) {
    return null;
  }

  const cellWidth = GANTT_CELL_WIDTH[scaleMode];
  const remainingPixels = Math.max(0, scaleWidth - scrollLeft! - viewportWidth);
  const thresholdPixels = Math.max(
    MIN_THRESHOLD_CELLS[scaleMode] * cellWidth,
    Math.ceil(viewportWidth / 4),
  );
  if (remainingPixels > thresholdPixels) return null;

  const extensionPixels = Math.max(
    MIN_EXTENSION_CELLS[scaleMode] * cellWidth,
    viewportWidth,
  );
  return Math.ceil((scaleWidth + extensionPixels) / cellWidth) * cellWidth;
}

export function minimumTimelineScaleWidthForEnd({
  start,
  end,
  scaleMode,
}: Readonly<{
  start: Date;
  end: Date;
  scaleMode: GanttScaleMode;
}>): number {
  if (
    !Number.isFinite(start.getTime()) ||
    !Number.isFinite(end.getTime()) ||
    end.getTime() <= start.getTime()
  ) {
    return 0;
  }
  const cells = Math.ceil(localCalendarDayDistance(start, end) / UNIT_DAYS[scaleMode]) + 1;
  return cells * GANTT_CELL_WIDTH[scaleMode];
}
