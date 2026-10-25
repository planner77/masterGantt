import { describe, expect, it } from "vitest";
import type { ProjectTaskDto, ProjectCalendarDto } from "../../../src/contracts/projects";
import { membershipWbsLabels } from "../../../src/features/gantt/milestone-membership-model";

const calendar: ProjectCalendarDto = { timezone: "Asia/Seoul", weekendDays: [6, 0], holidays: [] };
const milestone: ProjectTaskDto = { taskId: "M", externalId: "M", name: "Legacy undated Milestone", parentExternalId: null, siblingOrder: 0, type: "milestone", requestedStart: null, start: null, end: null, duration: 0, progress: 0, scheduleMode: "auto" };
describe("membership WBS presentation for legacy missing dates", () => {
  it("keeps an undated record inspectable without changing canonical dates or identity", () => {
    const input = [milestone], before = JSON.stringify(input);
    expect([...membershipWbsLabels(input, calendar)]).toEqual([["M", "미산정"]]);
    expect(JSON.stringify(input)).toBe(before);
  });
  it("uses the existing canonical hierarchy WBS when dates are valid", () => {
    expect([...membershipWbsLabels([{ ...milestone, requestedStart: "2026-10-05", start: "2026-10-05", end: "2026-10-05" }], calendar)]).toEqual([["M", "1"]]);
  });
  it("does not downgrade a different hierarchy error into a missing-date label", () => {
    const valid = { ...milestone, requestedStart: "2026-10-05", start: "2026-10-05", end: "2026-10-05" };
    expect(() => membershipWbsLabels([valid, { ...valid }], calendar)).toThrow("DUPLICATE_TASK_ID");
  });
});
