import { z } from "zod";

import {
  createWorkingCalendar,
  parseDateOnly,
  endFromStart,
  recalculateDependencies,
  recalculateHierarchy,
  scheduleLeaf,
  SchedulingError,
  type WorkingCalendar,
} from "../domain/scheduling";
import type { ApiErrorDetail, ProjectLinkDto, ProjectTaskDto } from "./projects";
import { taskStatusFromProgress, taskStatusProgressConsistent } from "../domain/task-status";
import { projectStageGates } from "../domain/milestones/stage-gates";

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

const description11 = z.string().refine(wellFormed).nullable().optional();
const common11 = {
  ...common,
  description: description11,
  url: z.string().refine(wellFormed).nullable().optional(),
  sourceTaskId: z.string().uuid().optional(),
};
const leaf11 = z.object({
  ...common11,
  type: z.enum(["task", "milestone"]),
  scheduleMode: z.enum(["auto", "manual"]).optional(),
  requestedStart: z.string(),
  duration: z.number().int(),
  progress: z.number().finite().min(0).max(100),
  status: z.enum(["not_started", "in_progress", "completed"]),
  baseline: z.object({ start: z.string(), duration: z.number().int() }).strict().nullable().optional(),
}).strict().superRefine((value, context) => {
  if (!taskStatusProgressConsistent(value.status, value.progress)) {
    context.addIssue({ code: "custom", path: ["status"], message: "Task status/progress is inconsistent." });
  }
});
const summary11 = z.object({
  ...common11,
  type: z.literal("summary"),
  scheduleMode: z.literal("auto").optional(),
  requestedStart: z.null().optional(),
  predecessors: z.array(z.never()),
}).strict();
const sourceDate = z.string().refine((value) => {
  try { parseDateOnly(value); return true; } catch { return false; }
});
const sourceCalendar11 = z.object({
  timezone: z.literal("Asia/Seoul"),
  weekendDays: z.tuple([z.literal(6), z.literal(0)]),
  holidays: z.array(z.object({ date: sourceDate, name: z.string().refine(wellFormed).nullable().optional() }).strict()).max(10000),
  exceptions: z.array(z.object({
    date: sourceDate,
    name: z.string().refine(wellFormed).nullable().optional(),
    dayType: z.enum(["WORKING", "NON_WORKING"]),
    names: z.array(z.string().refine(wellFormed)).max(100).optional(),
  }).strict()).max(10000).optional(),
}).strict();
const envelope11 = z.object({
  schemaVersion: z.literal("1.1"),
  project: envelope.shape.project,
  tasks: z.array(z.union([leaf11, summary11])).max(5000),
  memberships: z.array(z.object({ taskExternalId: identifier, milestoneExternalId: identifier.nullable() }).strict()).max(5000).optional(),
  source: z.object({
    projectPublicId: z.string().uuid(),
    projectRevision: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    exportedAt: z.string().datetime({ offset: true }),
    calendar: sourceCalendar11,
    contentScope: z.literal("schedule-stage"),
  }).strict().optional(),
}).strict();

export type ImportPayload11 = z.infer<typeof envelope11>;
export type ProjectImportPayload = ImportPayload | ImportPayload11;
export type ProjectImportValidationResult =
  | { success: true; data: ProjectImportPayload; tasks: readonly ProjectTaskDto[]; links: ProjectLinkDto[]; memberships: { taskExternalId: string; milestoneExternalId: string | null }[] }
  | { success: false; details: ApiErrorDetail[] };

/** Version dispatch preserves the published 1.0 pure validator result and semantics. */
export function validateProjectImportPayload(input: unknown, calendar: WorkingCalendar): ProjectImportValidationResult {
  if (!input || typeof input !== "object" || (input as { schemaVersion?: unknown }).schemaVersion !== "1.1") {
    const legacy = validateImportPayload(input, calendar);
    return legacy.success ? { ...legacy, memberships: [] } : legacy;
  }
  const parsed = envelope11.safeParse(input);
  if (!parsed.success) return {
    success: false,
    details: parsed.error.issues.map((issue) => ({ path: issue.path.join(".") || "$", code: issue.code === "unrecognized_keys" ? "UNKNOWN_FIELD" : "INVALID_FIELD", message: "Invalid import field." })),
  };
  try {
    if (parsed.data.source) {
      const source = parsed.data.source.calendar;
      // Canonical calendars project exceptions into holidays too; avoid applying them twice.
      createWorkingCalendar({ ...source, holidays: source.exceptions === undefined ? source.holidays : [] });
    }
    const orders = new Map<string | null, number>();
    const links: ProjectLinkDto[] = [];
    const tasks = parsed.data.tasks.map((task, index): ProjectTaskDto => {
      const siblingOrder = orders.get(task.parentExternalId) ?? 0;
      orders.set(task.parentExternalId, siblingOrder + 1);
      for (const predecessor of task.predecessors) links.push({
        id: `import-${index}-${links.length}`, predecessorExternalId: predecessor.externalId,
        successorExternalId: task.externalId, type: predecessor.type ?? "FS", lag: predecessor.lag ?? 0,
      });
      const base = { taskId: task.externalId, externalId: task.externalId, name: task.name, parentExternalId: task.parentExternalId, siblingOrder,
        description: task.description ?? null, url: task.url ?? null };
      if (task.type === "summary") return { ...base, type: "summary", scheduleMode: "auto", requestedStart: null, start: null, end: null, duration: null, progress: null };
      const scheduled = scheduleLeaf({ type: task.type, requestedStart: task.requestedStart, duration: task.duration, scheduleMode: task.scheduleMode }, calendar);
      let baselineStart: string | null = null, baselineDuration: number | null = null, baselineEnd: string | null = null;
      if (task.baseline) {
        parseDateOnly(task.baseline.start, "baseline.start");
        if (task.type === "milestone" && task.baseline.duration !== 0) throw new SchedulingError("INVALID_DURATION", { field: "baseline.duration", index });
        baselineStart = task.baseline.start;
        baselineDuration = task.baseline.duration;
        baselineEnd = task.type === "milestone" ? baselineStart : endFromStart(baselineStart, baselineDuration, calendar);
      }
      return { ...base, type: task.type, scheduleMode: scheduled.scheduleMode, requestedStart: scheduled.requestedStart,
        start: scheduled.start, end: scheduled.end, duration: scheduled.duration, progress: task.progress, status: task.status,
        baselineStart, baselineDuration, baselineEnd };
    });
    if (links.length > 20000) return { success: false, details: [{ path: "tasks", code: "IMPORT_TOO_LARGE", message: "Import dependency budget exceeded." }] };
    const scheduled = recalculateDependencies(recalculateHierarchy(tasks, calendar), links, calendar);
    if (scheduled.manualConflicts.length) return { success: false, details: [{ path: "tasks", code: "MANUAL_DEPENDENCY_CONFLICT", message: "Manual dependency schedule conflict." }] };
    const derived = recalculateHierarchy(scheduled.tasks, calendar);
    const byExternalId = new Map(derived.map((task) => [task.externalId, task]));
    const memberships = parsed.data.memberships ?? [];
    const seen = new Set<string>();
    for (const row of memberships) {
      if (seen.has(row.taskExternalId)) return { success: false, details: [{ path: "memberships", code: "DUPLICATE_MILESTONE_MEMBERSHIP", message: "Duplicate membership source." }] };
      seen.add(row.taskExternalId);
      const source = byExternalId.get(row.taskExternalId), target = row.milestoneExternalId === null ? null : byExternalId.get(row.milestoneExternalId);
      if (!source || source.type === "milestone" || (row.milestoneExternalId !== null && (!target || target.type !== "milestone"))) {
        return { success: false, details: [{ path: "memberships", code: "INVALID_MILESTONE_MEMBERSHIP", message: "Invalid batch membership reference." }] };
      }
    }
    projectStageGates({ tasks: derived.map((task) => ({ taskId: task.taskId, type: task.type, parentTaskId: task.parentExternalId, duration: task.duration, progress: task.progress, status: task.status ?? taskStatusFromProgress(task.progress) })),
      memberships: memberships.filter((row) => row.milestoneExternalId !== null).map((row) => ({ taskId: row.taskExternalId, milestoneTaskId: row.milestoneExternalId! })),
      links: links.map((link) => ({ id: link.id, predecessorTaskId: link.predecessorExternalId, successorTaskId: link.successorExternalId, type: link.type, lag: link.lag })) });
    return { success: true, data: parsed.data, tasks: derived, links, memberships };
  } catch (error) {
    if (!(error instanceof SchedulingError)) throw error;
    return { success: false, details: [{ path: error.context.index === undefined ? "tasks" : `tasks.${error.context.index}`, code: error.code, message: "Invalid import schedule or hierarchy." }] };
  }
}
