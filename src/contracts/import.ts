import { z } from "zod";

import {
  parseDateOnly,
  recalculateDependencies,
  recalculateHierarchy,
  scheduleLeaf,
  SchedulingError,
  type WorkingCalendar,
} from "../domain/scheduling";
import type { ApiErrorDetail, ProjectLinkDto, ProjectTaskDto } from "./projects";

function wellFormed(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const unit = value.charCodeAt(index);
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const next = value.charCodeAt(++index);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return false;
    } else if (unit >= 0xdc00 && unit <= 0xdfff) {
      return false;
    }
  }
  return true;
}

const identifier = z.string().refine((value) => {
  const length = Array.from(value).length;
  return length >= 1 && length <= 128 && value === value.trim() &&
    !/^\p{White_Space}|\p{White_Space}$/u.test(value) &&
    !/[\p{Cc}\p{Cf}]/u.test(value) && wellFormed(value);
});
const name = z.string().refine((value) => {
  const length = Array.from(value).length;
  return length >= 1 && length <= 200 && value.trim().length > 0 && wellFormed(value);
});
const predecessors = z.array(z.object({
  externalId: identifier,
  type: z.enum(["FS", "SS", "FF", "SF"]).optional(),
  lag: z.number().int().min(-10000).max(10000).optional(),
}).strict()).max(100);
const common = { externalId: identifier, name, parentExternalId: identifier.nullable(), predecessors };
const leaf = z.object({
  ...common,
  type: z.enum(["task", "milestone"]),
  scheduleMode: z.enum(["auto", "manual"]).optional(),
  start: z.string(),
  end: z.string().optional(),
  duration: z.number().int(),
  progress: z.number().finite().min(0).max(100),
}).strict();
const summary = z.object({
  ...common,
  type: z.literal("summary"),
  scheduleMode: z.literal("auto").optional(),
  requestedStart: z.null().optional(),
  start: z.string().nullable().optional(),
  end: z.string().nullable().optional(),
  duration: z.number().int().min(0).max(10000).nullable().optional(),
  progress: z.number().finite().min(0).max(100).nullable().optional(),
}).strict();
const envelope = z.object({
  schemaVersion: z.literal("1.0"),
  project: z.object({
    name,
    description: z.string().refine((value) => Array.from(value).length <= 4000 && wellFormed(value)),
  }).strict(),
  tasks: z.array(z.union([leaf, summary])).min(1).max(5000),
}).strict();

export type ImportPayload = z.infer<typeof envelope>;
export type ImportValidationResult =
  | { success: true; data: ImportPayload; tasks: readonly ProjectTaskDto[]; links: ProjectLinkDto[] }
  | { success: false; details: ApiErrorDetail[] };

/**
 * Pure payload validation only. HTTP preview/commit, target DB collision checks,
 * encoding and CSV parsing remain separate work.
 */
export function validateImportPayload(input: unknown, calendar: WorkingCalendar): ImportValidationResult {
  const parsed = envelope.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      details: parsed.error.issues.map((issue) => ({
        path: issue.path.join(".") || "$",
        code: issue.code === "unrecognized_keys" ? "UNKNOWN_FIELD" : "INVALID_FIELD",
        message: "Invalid import field.",
      })),
    };
  }
  try {
    const siblingOrders = new Map<string | null, number>();
    const links: ProjectLinkDto[] = [];
    const tasks = parsed.data.tasks.map((task, index): ProjectTaskDto => {
      const siblingOrder = siblingOrders.get(task.parentExternalId) ?? 0;
      siblingOrders.set(task.parentExternalId, siblingOrder + 1);
      for (const predecessor of task.predecessors) {
        links.push({
          id: `import-${index}-${links.length}`,
          predecessorExternalId: predecessor.externalId,
          successorExternalId: task.externalId,
          type: predecessor.type ?? "FS",
          lag: predecessor.lag ?? 0,
        });
      }
      const base = {
        taskId: task.externalId,
        externalId: task.externalId,
        name: task.name,
        parentExternalId: task.parentExternalId,
        siblingOrder,
      };
      if (task.type === "summary") {
        // Validate legacy source dates, never retain them as substitute summary dates.
        for (const value of [task.start, task.end]) {
          if (value !== undefined && value !== null) parseDateOnly(value, "summarySnapshot");
        }
        return {
          ...base, type: "summary", scheduleMode: "auto",
          requestedStart: null, start: null, end: null, duration: null, progress: null,
        };
      }
      const scheduled = scheduleLeaf({
        type: task.type,
        requestedStart: task.start,
        end: task.end,
        duration: task.duration,
        scheduleMode: task.scheduleMode,
      }, calendar);
      return {
        ...base,
        type: scheduled.type,
        scheduleMode: scheduled.scheduleMode,
        requestedStart: scheduled.requestedStart,
        start: scheduled.start,
        end: scheduled.end,
        duration: scheduled.duration,
        progress: task.progress,
      };
    });
    if (links.length > 20000) {
      return {
        success: false,
        details: [{ path: "tasks", code: "IMPORT_TOO_LARGE", message: "Import dependency budget exceeded." }],
      };
    }
    const derived = recalculateHierarchy(tasks, calendar);
    const dependencies = recalculateDependencies(derived, links, calendar);
    if (dependencies.manualConflicts.length > 0) {
      return {
        success: false,
        details: [{ path: "tasks", code: "MANUAL_DEPENDENCY_CONFLICT", message: "Manual dependency schedule conflict." }],
      };
    }
    return {
      success: true,
      data: parsed.data,
      tasks: recalculateHierarchy(dependencies.tasks, calendar),
      links,
    };
  } catch (error) {
    if (!(error instanceof SchedulingError)) throw error;
    return {
      success: false,
      details: [{
        path: error.context.index === undefined ? "tasks" : `tasks.${error.context.index}`,
        code: error.code,
        message: "Invalid import schedule or hierarchy.",
      }],
    };
  }
}
