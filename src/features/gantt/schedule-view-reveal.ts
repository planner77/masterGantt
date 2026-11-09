/** A projected View owns only its own horizontal scroll position.
 * A visible Task start is left-aligned with the sticky Grid/Chart divider
 * when its date is measurable and the current range has enough scroll room. */
export type ProjectedTaskRevealStatus = "ALIGNED" | "NO_DATE" | "NO_SCROLL_CAPACITY" | "NOT_MEASURABLE";
export type ProjectedTaskReveal = Readonly<{ status: ProjectedTaskRevealStatus; left: number }>;

type ProjectedRevealInput = Readonly<{
  start: string | null;
  axisStart: number;
  pixelsPerDay: number;
  scrollWidth: number;
  clientWidth: number;
}>;

export function projectedTaskReveal(input: ProjectedRevealInput): ProjectedTaskReveal {
  if (!input.start) return { status: "NO_DATE", left: 0 };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.start)) return { status: "NOT_MEASURABLE", left: 0 };
  const start = Date.parse(`${input.start}T00:00:00Z`) / 86_400_000;
  if (![start, input.axisStart, input.pixelsPerDay, input.scrollWidth, input.clientWidth].every(Number.isFinite) ||
      input.pixelsPerDay <= 0 || input.scrollWidth <= 0 || input.clientWidth <= 0)
    return { status: "NOT_MEASURABLE", left: 0 };
  const target = (start - input.axisStart) * input.pixelsPerDay;
  if (!Number.isFinite(target)) return { status: "NOT_MEASURABLE", left: 0 };
  const capacity = Math.max(0, input.scrollWidth - input.clientWidth);
  const left = Math.max(0, Math.min(capacity, target));
  return { status: Math.abs(target - left) <= 1 ? "ALIGNED" : "NO_SCROLL_CAPACITY", left };
}
