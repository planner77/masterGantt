import { describe, expect, it, vi } from "vitest";
import type { IApi } from "@svar-ui/react-gantt";
import { localDateFromDateOnly } from "../../../src/features/gantt/date-adapter";
import { filterMilestoneWbsRows, milestoneDateCoordinate, revealMilestoneDate } from "../../../src/features/gantt/milestone-timeline-adapter";

function core(unit: "day" | "week" = "day") {
  const state = { _scales: { start: localDateFromDateOnly("2024-02-26"), end: localDateFromDateOnly("2024-03-20"), minUnit: unit, lengthUnit: "day" },
    scales: [{ unit, step: 1 }], cellWidth: 70, scrollLeft: 0, _chartWidth: 200 };
  return { state, getState: () => state as unknown as ReturnType<IApi["getState"]>, exec: vi.fn().mockResolvedValue(undefined) };
}

describe("Milestone Timeline version-bound Core adapter", () => {
  it("loads the installed package-root calendar helper and matches leap-day positions", () => {
    expect(milestoneDateCoordinate(core(), "2024-02-29")?.contentX).toBe(210);
    expect(milestoneDateCoordinate(core("week"), "2024-03-04")?.contentX).toBe(70);
  });
  it("fails closed for invalid dates, unsupported scales, and zero geometry", () => {
    const api = core();
    expect(milestoneDateCoordinate(api, "2024-02-30")).toBeNull();
    api.state._chartWidth = 0;
    expect(milestoneDateCoordinate(api, "2024-02-29")).toBeNull();
    api.state._chartWidth = 200;
    api.state.scales[0].step = 2;
    expect(milestoneDateCoordinate(api, "2024-02-29")).toBeNull();
  });
  it("does not move an already-visible date and refuses dates outside the axis", async () => {
    const api = core();
    expect(await revealMilestoneDate(api, "2024-02-27")).toBe(true);
    expect(await revealMilestoneDate(api, "2025-02-27")).toBe(false);
    expect(api.exec).not.toHaveBeenCalled();
  });
  it("reveals by public left command without selecting a hidden row", async () => {
    const api = core();
    expect(await revealMilestoneDate(api, "2024-03-01")).toBe(true);
    expect(api.exec).toHaveBeenCalledExactlyOnceWith("scroll-chart", { left: 280 });
  });
  it("filters display IDs with context and resets without modifying inputs", async () => {
    const api = core(), ids = ["summary", "task"];
    await filterMilestoneWbsRows(api, ids);
    const config = api.exec.mock.calls[0][1];
    expect(config.open).toBe(false);
    expect(config.filter({ id: "task" })).toBe(true);
    expect(config.filter({ id: "milestone" })).toBe(false);
    expect(ids).toEqual(["summary", "task"]);
    await filterMilestoneWbsRows(api, null);
    expect(api.exec.mock.calls[1]).toEqual(["filter-tasks", { open: false, filter: undefined }]);
  });
});
