import { describe, expect, it } from "vitest";
import { createWorkingCalendar, isWorkingDay, workingDaysBetween } from "../../../src/domain/scheduling/calendar";
import {
  resolveResourceCalendar,
  ResourceCalendarExceptionConflictError,
  type ResourceCalendarException,
} from "../../../src/domain/scheduling/resource-calendar";

const date = "2026-10-09";
const project = (dayType: "WORKING" | "NON_WORKING" = "WORKING") => createWorkingCalendar({
  timezone: "Asia/Seoul", weekendDays: [6, 0], exceptions: [{ date, dayType }],
});
const exception = (targetType: "RESOURCE_GROUP" | "RESOURCE", targetId: string,
  dayType: "WORKING" | "NON_WORKING", ruleId = targetId): ResourceCalendarException => ({
  date, targetType, targetId, dayType, ruleId, ruleName: ruleId,
});
const resolve = (exceptions: readonly ResourceCalendarException[], projectDay: "WORKING" | "NON_WORKING" = "WORKING") =>
  resolveResourceCalendar({ projectCalendar: project(projectDay), resourceId: "person", groupIds: ["a", "b"], exceptions });

describe("resource calendar specificity", () => {
  it.each([
    ["WORKING", "NON_WORKING", "NON_WORKING"],
    ["NON_WORKING", "WORKING", "WORKING"],
  ] as const)("Project %s → Group %s → %s", (projectDay, groupDay, final) => {
    const result = resolve([exception("RESOURCE_GROUP", "a", groupDay)], projectDay);
    expect(isWorkingDay(date, result.calendar)).toBe(final === "WORKING");
    expect(result.effects[0]).toMatchObject({ beforeDayType: projectDay, dayType: groupDay, effect: "CHANGED", finalDayType: final });
  });

  it.each([
    ["NON_WORKING", "WORKING"], ["WORKING", "NON_WORKING"],
  ] as const)("Group %s → Resource %s", (groupDay, resourceDay) => {
    const result = resolve([exception("RESOURCE", "person", resourceDay), exception("RESOURCE_GROUP", "a", groupDay)]);
    expect(result.effects[1]).toMatchObject({ layer: "RESOURCE", beforeDayType: groupDay, dayType: resourceDay, effect: "CHANGED" });
    expect(result.effects[0]).toMatchObject({ finalDayType: resourceDay, winningLayer: "RESOURCE" });
    expect(isWorkingDay(date, result.calendar)).toBe(resourceDay === "WORKING");
  });

  it.each(["WORKING", "NON_WORKING"] as const)("allows explicit %s intent with NO_EFFECT", (dayType) => {
    const result = resolve([exception("RESOURCE_GROUP", "a", dayType), exception("RESOURCE", "person", dayType)], dayType);
    expect(result.effects.map((effect) => effect.effect)).toEqual(["NO_EFFECT", "NO_EFFECT"]);
    expect(result.calendar.exceptions).toHaveLength(1);
    expect(workingDaysBetween(date, date, result.calendar)).toBe(dayType === "WORKING" ? 1 : 0);
  });

  it.each(["WORKING", "NON_WORKING"] as const)("deduplicates multiple Group %s days while retaining sources", (dayType) => {
    const result = resolve([exception("RESOURCE_GROUP", "b", dayType), exception("RESOURCE_GROUP", "a", dayType)]);
    expect(result.calendar.exceptions).toHaveLength(1);
    expect(result.effects).toHaveLength(1);
    expect(result.effects[0].sources.map((source) => source.ruleId)).toEqual(["a", "b"]);
    expect(workingDaysBetween(date, date, result.calendar)).toBe(dayType === "WORKING" ? 1 : 0);
  });

  it("reports Group conflicts before applying a Resource override, independent of order", () => {
    const entries = [exception("RESOURCE_GROUP", "b", "NON_WORKING"),
      exception("RESOURCE", "person", "WORKING"), exception("RESOURCE_GROUP", "a", "WORKING")];
    const contexts = [entries, [...entries].reverse()].map((exceptions) => {
      try { resolve(exceptions); throw new Error("Expected conflict"); }
      catch (error) {
        expect(error).toBeInstanceOf(ResourceCalendarExceptionConflictError);
        return (error as ResourceCalendarExceptionConflictError).context;
      }
    });
    expect(contexts[0]).toEqual(contexts[1]);
    expect(contexts[0]).toMatchObject({ date, layer: "RESOURCE_GROUP", resourceId: "person", groupIds: ["a", "b"], ruleIds: ["a", "b"] });
  });

  it("rejects opposite rules on one Resource target", () => {
    expect(() => resolve([exception("RESOURCE", "person", "WORKING", "one"),
      exception("RESOURCE", "person", "NON_WORKING", "two")])).toThrow(ResourceCalendarExceptionConflictError);
  });

  it("ignores non-member and other Resource exceptions", () => {
    const result = resolve([exception("RESOURCE_GROUP", "unrelated", "NON_WORKING"), exception("RESOURCE", "other", "NON_WORKING")]);
    expect(result.effects).toEqual([]);
    expect(isWorkingDay(date, result.calendar)).toBe(true);
  });

  it("reopens a weekend and leap day and preserves Project scheduling input", () => {
    const original = createWorkingCalendar({ timezone: "Asia/Seoul", weekendDays: [6, 0] });
    const result = resolveResourceCalendar({ projectCalendar: original, resourceId: "person", groupIds: [],
      exceptions: ["2026-10-10", "2028-02-29"].map((date) => ({ ...exception("RESOURCE", "person", "WORKING"), date })) });
    expect(isWorkingDay("2026-10-10", original)).toBe(false);
    expect(isWorkingDay("2026-10-10", result.calendar)).toBe(true);
    expect(result.effects.map((effect) => effect.effect)).toEqual(["CHANGED", "NO_EFFECT"]);
    expect(original.exceptions).toEqual([]);
  });

  it("copies/freezes sources and produces identical results for permuted input and group order", () => {
    const entries = [exception("RESOURCE_GROUP", "b", "WORKING"), exception("RESOURCE_GROUP", "a", "WORKING"),
      exception("RESOURCE", "person", "NON_WORKING")];
    const original = JSON.stringify(entries);
    const first = resolve(entries);
    const second = resolveResourceCalendar({ projectCalendar: project(), resourceId: "person", groupIds: ["b", "a"], exceptions: [...entries].reverse() });
    expect(first).toEqual(second);
    expect(JSON.stringify(entries)).toBe(original);
    expect(first.effects[0].sources[0]).not.toBe(entries[1]);
    expect(Object.isFrozen(first.effects[0].sources[0])).toBe(true);
    expect(Object.isFrozen(first.effects)).toBe(true);
  });

  it("uses proposed membership to detect conflicts before persistence", () => {
    const exceptions = [exception("RESOURCE_GROUP", "a", "WORKING"), exception("RESOURCE_GROUP", "b", "NON_WORKING")];
    expect(() => resolveResourceCalendar({ projectCalendar: project(), resourceId: "person", groupIds: ["a"], exceptions })).not.toThrow();
    expect(() => resolveResourceCalendar({ projectCalendar: project(), resourceId: "person", groupIds: ["a", "b"], exceptions })).toThrow(ResourceCalendarExceptionConflictError);
  });
});
