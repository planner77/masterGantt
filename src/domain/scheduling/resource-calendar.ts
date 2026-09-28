import {
  createWorkingCalendar,
  isWorkingDay,
  type CalendarDayExceptionInput,
  type CalendarDayType,
  type WorkingCalendar,
} from "./calendar";
import { parseDateOnly } from "./date-only";
import { SchedulingError } from "./errors";

export type ResourceCalendarLayer = "RESOURCE_GROUP" | "RESOURCE";

/** Materialized explicit exceptions; weekly/project decisions are supplied separately. */
export interface ResourceCalendarException extends CalendarDayExceptionInput {
  readonly ruleId: string;
  readonly ruleName: string;
  readonly targetType: ResourceCalendarLayer;
  readonly targetId: string;
}

export interface ResourceCalendarConflictContext {
  readonly date: string;
  readonly layer: ResourceCalendarLayer;
  readonly resourceId: string;
  readonly groupIds: readonly string[];
  readonly ruleIds: readonly string[];
  readonly sources: readonly ResourceCalendarException[];
}

export class ResourceCalendarExceptionConflictError extends Error {
  readonly code = "RESOURCE_CALENDAR_EXCEPTION_CONFLICT";
  constructor(readonly context: ResourceCalendarConflictContext) {
    super("Conflicting resource calendar exceptions exist at the same layer.");
    this.name = "ResourceCalendarExceptionConflictError";
  }
}

export interface ResourceCalendarEffect {
  readonly date: string;
  readonly layer: ResourceCalendarLayer;
  readonly beforeDayType: CalendarDayType;
  readonly dayType: CalendarDayType;
  /** Compared with the parent layer, independently of a more specific override. */
  readonly effect: "CHANGED" | "NO_EFFECT";
  readonly sources: readonly ResourceCalendarException[];
  readonly finalDayType: CalendarDayType;
  readonly winningLayer: ResourceCalendarLayer;
  readonly winningSources: readonly ResourceCalendarException[];
}

export interface ResourceCalendarResolutionInput {
  readonly projectCalendar: WorkingCalendar;
  readonly resourceId: string;
  readonly groupIds: readonly string[];
  readonly exceptions: readonly ResourceCalendarException[];
}

const compare = (a: string, b: string): number => a < b ? -1 : a > b ? 1 : 0;

/**
 * Project < Group < Resource, with validation before each override.
 * Does not schedule tasks or read repositories. The same function accepts saved
 * rules, a calendar candidate, or candidate membership, without mutating inputs.
 */
export function resolveResourceCalendar(input: ResourceCalendarResolutionInput): {
  readonly calendar: WorkingCalendar;
  readonly effects: readonly ResourceCalendarEffect[];
} {
  const groups = new Set(input.groupIds);
  const effective = new Map<string, CalendarDayExceptionInput>(
    input.projectCalendar.exceptions.map((entry) => [entry.date, entry]),
  );
  const effects: Omit<ResourceCalendarEffect, "finalDayType" | "winningLayer" | "winningSources">[] = [];
  const winners = new Map<string, { layer: ResourceCalendarLayer; sources: readonly ResourceCalendarException[] }>();

  for (const layer of ["RESOURCE_GROUP", "RESOURCE"] as const) {
    const byDate = new Map<string, ResourceCalendarException[]>();
    for (const exception of input.exceptions) {
      if (exception.targetType !== layer) continue;
      if (layer === "RESOURCE_GROUP" ? !groups.has(exception.targetId) : exception.targetId !== input.resourceId) continue;
      const date = parseDateOnly(exception.date);
      if (exception.dayType !== "WORKING" && exception.dayType !== "NON_WORKING") {
        throw new SchedulingError("INVALID_CALENDAR_EXCEPTION", { date });
      }
      const entries = byDate.get(date) ?? [];
      entries.push(Object.freeze({ ...exception, date }));
      byDate.set(date, entries);
    }

    for (const date of [...byDate.keys()].sort(compare)) {
      const sources = Object.freeze(byDate.get(date)!.sort((a, b) =>
        compare(a.targetId, b.targetId) || compare(a.ruleId, b.ruleId) ||
        compare(a.dayType, b.dayType) || compare(a.ruleName, b.ruleName) || compare(a.name ?? "", b.name ?? ""),
      ));
      const dayType = sources[0].dayType;
      if (sources.some((source) => source.dayType !== dayType)) {
        throw new ResourceCalendarExceptionConflictError(Object.freeze({
          date, layer, resourceId: input.resourceId,
          groupIds: Object.freeze(layer === "RESOURCE_GROUP" ? [...new Set(sources.map((source) => source.targetId))].sort(compare) : []),
          ruleIds: Object.freeze([...new Set(sources.map((source) => source.ruleId))].sort(compare)),
          sources,
        }));
      }
      const beforeDayType = effective.get(date)?.dayType ??
        (isWorkingDay(date, input.projectCalendar) ? "WORKING" : "NON_WORKING");
      effects.push({ date, layer, beforeDayType, dayType,
        effect: beforeDayType === dayType ? "NO_EFFECT" : "CHANGED", sources });
      effective.set(date, { date, dayType, name: sources[0].name ?? null });
      winners.set(date, { layer, sources });
    }
  }

  return Object.freeze({
    calendar: createWorkingCalendar({
      timezone: input.projectCalendar.timezone,
      weekendDays: input.projectCalendar.weekendDays,
      exceptions: [...effective.values()],
    }),
    effects: Object.freeze(effects.map((effect) => {
      const winner = winners.get(effect.date)!;
      return Object.freeze({ ...effect, finalDayType: effective.get(effect.date)!.dayType,
        winningLayer: winner.layer, winningSources: winner.sources });
    })),
  });
}
