import type { ViewportPosition } from "./viewport-coordinator";

/** Admit only observed task geometry whose canonical start is on the actual
 * rendered axis. Core may clamp $x for dates outside that axis. */
export function taskRevealTarget(input: Readonly<{
  type?: string; start?: Date | null; x: number; y: number; width: number; height: number;
  axisStart?: Date; axisEnd?: Date; viewportWidth: number; viewportHeight: number;
  current: ViewportPosition; capacity: ViewportPosition;
}>): ViewportPosition | null {
  const rowOnly = input.type === "summary-container";
  if (!rowOnly) {
    const start = input.start?.getTime(), lower = input.axisStart?.getTime(), upper = input.axisEnd?.getTime();
    if (typeof start !== "number" || typeof lower !== "number" || typeof upper !== "number" ||
      ![start, lower, upper].every(Number.isFinite) || start < lower || start >= upper || lower >= upper) return null;
  }
  if (![input.y, input.width, input.height, input.viewportWidth, input.viewportHeight, input.current.left, input.current.top].every(Number.isFinite) ||
    (!rowOnly && !Number.isFinite(input.x)) || input.viewportWidth <= 0 || input.viewportHeight <= 0) return null;
  const left = rowOnly ? input.current.left : input.x < input.current.left || input.x >= input.current.left + input.viewportWidth ? Math.max(0, input.x) : input.current.left;
  const top = Math.max(0, input.y < input.current.top ? input.y : input.y + input.height > input.current.top + input.viewportHeight ? input.y + input.height - input.viewportHeight : input.current.top);
  return input.capacity.left < left - 1 || input.capacity.top < top - 1 ? null : { left, top };
}
