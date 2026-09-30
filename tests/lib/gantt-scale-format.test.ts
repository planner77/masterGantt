import { describe, expect, it } from "vitest";

import { formatGanttDayOfMonth } from "../../src/lib/gantt-scale-format";

describe("Gantt day scale formatter", () => {
  it.each([
    [new Date(2026, 8, 1), "1"],
    [new Date(2026, 8, 9), "9"],
    [new Date(2026, 8, 10), "10"],
    [new Date(2026, 8, 22), "22"],
    [new Date(2026, 9, 31), "31"],
  ])("formats %s as day-of-month digits only", (date, expected) => {
    const value = formatGanttDayOfMonth(date);
    expect(value).toBe(expected);
    expect(value).toMatch(/^\d{1,2}$/);
    expect(value).not.toMatch(/[()일월화수목금토]/);
  });
});
