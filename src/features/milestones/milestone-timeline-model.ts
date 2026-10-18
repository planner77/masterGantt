import type { MilestoneStageGateDto, TaskMilestoneMembershipDto } from "../../contracts/milestones";
import type { ProjectLinkDto, ProjectTaskDto } from "../../contracts/projects";
import { stageSnapshotFromProject } from "../../domain/milestones/project-stage-model";
import { projectStageGates } from "../../domain/milestones/stage-gates";
import { parseDateOnly, type DateOnly } from "../../domain/scheduling/date-only";
import { resolveTaskSubtreeScope } from "../gantt/task-subtree-scope";
import type { TaskFilterState } from "../projects/project-search-filter";
import { stageFilterCandidates } from "../projects/project-search-filter";

export interface MilestoneTimelinePreference {
  readonly version: 1;
  readonly showMilestones: boolean;
}

/** The browser storage adapter owns parsing, project keys and persistence. */
export function normalizeMilestoneTimelinePreference(raw: unknown): MilestoneTimelinePreference {
  if (raw !== null && typeof raw === "object" && !Array.isArray(raw)) {
    const value = raw as Record<string, unknown>;
    if (value.version === 1 && typeof value.showMilestones === "boolean") {
      return { version: 1, showMilestones: value.showMilestones };
    }
  }
  return { version: 1, showMilestones: true };
}

export interface MilestoneTimelineDisplayState {
  readonly preference: MilestoneTimelinePreference;
  readonly temporaryOverride: boolean;
  readonly showMilestones: boolean;
}

export function milestoneTimelineDisplayState(preference: unknown, temporaryOverride = false): MilestoneTimelineDisplayState {
  const normalized = normalizeMilestoneTimelinePreference(preference);
  return { preference: normalized, temporaryOverride, showMilestones: normalized.showMilestones || temporaryOverride };
}

/** A date reveal can show the lane without turning that request into a saved preference. */
export function revealMilestoneTimelineDate(state: MilestoneTimelineDisplayState): MilestoneTimelineDisplayState {
  return milestoneTimelineDisplayState(state.preference, !state.preference.showMilestones);
}

export function returnFromMilestoneTimelineDate(state: MilestoneTimelineDisplayState): MilestoneTimelineDisplayState {
  return milestoneTimelineDisplayState(state.preference);
}

/** Only the caller's explicit toggle action should persist the returned preference. */
export function toggleMilestoneTimelineDisplay(showMilestones: boolean): MilestoneTimelineDisplayState {
  return milestoneTimelineDisplayState({ version: 1, showMilestones });
}

export interface MilestoneTimelineTypeCompatibility {
  readonly filter: TaskFilterState;
  readonly compatibility: "unchanged" | "milestone-removed" | "milestone-only";
  readonly suggestedActions: readonly ("open-milestone-dashboard" | "clear-type-filter")[];
}

/** Milestone-only remains an explicit condition until the user chooses a compatibility action. */
export function adaptMilestoneTimelineTypeFilter(filter: TaskFilterState): MilestoneTimelineTypeCompatibility {
  if (!filter.types.includes("milestone")) return { filter, compatibility: "unchanged", suggestedActions: [] };
  const types = filter.types.filter((type) => type !== "milestone");
  if (types.length === 0) {
    return { filter, compatibility: "milestone-only", suggestedActions: ["open-milestone-dashboard", "clear-type-filter"] };
  }
  return { filter: { ...filter, types }, compatibility: "milestone-removed", suggestedActions: [] };
}

export interface MilestoneTimelineRow {
  readonly task: ProjectTaskDto;
  readonly date: DateOnly | null;
  readonly dateState: "valid" | "missing" | "invalid";
  readonly gate: MilestoneStageGateDto;
}

export interface MilestoneTimelineInput {
  readonly tasks: readonly ProjectTaskDto[];
  readonly links: readonly ProjectLinkDto[];
  /** IDs from the existing full-context filter resolver, before ancestor expansion. */
  readonly matchedTaskIds?: readonly string[];
  /** null/omission is full project; an empty array is an empty scope. */
  readonly scopeTaskIds?: readonly string[] | null;
  /** Additional structural context supplied by the existing resolver, e.g. configured empty Summaries. */
  readonly ancestorContextTaskIds?: readonly string[];
  readonly activeMilestoneTaskId?: string | null;
  readonly preference?: unknown;
  readonly temporaryDisplayOverride?: boolean;
}

export interface MilestoneTimelineModel {
  readonly canonical: Readonly<{ tasks: readonly ProjectTaskDto[]; links: readonly ProjectLinkDto[] }>;
  readonly wbs: Readonly<{
    tasks: readonly ProjectTaskDto[];
    matchedTaskIds: readonly string[];
    ancestorContextTaskIds: readonly string[];
    matchCount: number;
    matchedSummaryCount: number;
    contextSummaryCount: number;
  }>;
  readonly timeline: Readonly<{
    milestones: readonly MilestoneTimelineRow[];
    datedMilestones: readonly MilestoneTimelineRow[];
    undatedMilestones: readonly MilestoneTimelineRow[];
  }>;
  readonly membership: ReadonlyMap<string, TaskMilestoneMembershipDto>;
  readonly gates: ReadonlyMap<string, MilestoneStageGateDto>;
  readonly preference: MilestoneTimelinePreference;
  readonly display: MilestoneTimelineDisplayState;
  readonly selection: Readonly<{ activeMilestoneTaskId: string | null; highlightedMemberTaskIds: readonly string[] }>;
}

function milestoneDate(task: ProjectTaskDto): Pick<MilestoneTimelineRow, "date" | "dateState"> {
  if (task.start === null) return { date: null, dateState: "missing" };
  try { return { date: parseDateOnly(task.start), dateState: "valid" }; }
  catch { return { date: null, dateState: "invalid" }; }
}

/** Display projection only. Full canonical hierarchy and links remain the Stage authority. */
export function buildMilestoneTimelineModel(input: MilestoneTimelineInput): MilestoneTimelineModel {
  const { tasks, links } = input;
  const projection = projectStageGates(stageSnapshotFromProject(tasks, links));
  const scope = input.scopeTaskIds == null ? null : new Set(input.scopeTaskIds);
  const inScope = (task: ProjectTaskDto) => scope === null || scope.has(task.taskId);
  const requestedMatches = input.matchedTaskIds === undefined ? null : new Set(input.matchedTaskIds);
  const matching = tasks.filter((task) => task.type !== "milestone" && inScope(task) && (requestedMatches === null || requestedMatches.has(task.taskId)));
  const matchedIds = new Set(matching.map((task) => task.taskId));
  const visibleIds = new Set(matchedIds);
  const byExternalId = new Map(tasks.map((task) => [task.externalId, task]));
  const suppliedContext = new Set(input.ancestorContextTaskIds ?? []);
  for (const task of tasks) {
    if (task.type === "summary" && inScope(task) && suppliedContext.has(task.taskId)) visibleIds.add(task.taskId);
  }
  for (const task of tasks.filter((candidate) => visibleIds.has(candidate.taskId))) {
    let parent = task.parentExternalId === null ? undefined : byExternalId.get(task.parentExternalId);
    while (parent && inScope(parent)) {
      visibleIds.add(parent.taskId);
      parent = parent.parentExternalId === null ? undefined : byExternalId.get(parent.parentExternalId);
    }
  }
  const wbsTasks = tasks.filter((task) => visibleIds.has(task.taskId));
  const contexts = wbsTasks.filter((task) => task.type === "summary" && !matchedIds.has(task.taskId));
  const rows = tasks.filter((task) => task.type === "milestone").map((task): MilestoneTimelineRow => ({ task, ...milestoneDate(task), gate: projection.gates.get(task.taskId)! }));
  const rowsById = new Map(rows.map((row) => [row.task.taskId, row]));
  // Reuse the current shared date/external-ID/task-ID candidate ordering for valid dates.
  const datedMilestones = stageFilterCandidates(rows.filter((row) => row.dateState === "valid").map((row) => row.task)).map((task) => rowsById.get(task.taskId)!);
  const undatedMilestones = rows.filter((row) => row.dateState !== "valid").sort((a, b) => a.task.externalId.localeCompare(b.task.externalId) || a.task.taskId.localeCompare(b.task.taskId));
  const activeMilestoneTaskId = rowsById.has(input.activeMilestoneTaskId ?? "") ? input.activeMilestoneTaskId! : null;
  const members = new Set(activeMilestoneTaskId === null ? [] : projection.gates.get(activeMilestoneTaskId)!.memberTaskIds);
  const display = milestoneTimelineDisplayState(input.preference, input.temporaryDisplayOverride);
  return {
    canonical: { tasks, links },
    wbs: { tasks: wbsTasks, matchedTaskIds: matching.map((task) => task.taskId), ancestorContextTaskIds: contexts.map((task) => task.taskId), matchCount: matching.filter((task) => task.type === "task").length, matchedSummaryCount: matching.filter((task) => task.type === "summary").length, contextSummaryCount: contexts.length },
    timeline: { milestones: [...datedMilestones, ...undatedMilestones], datedMilestones, undatedMilestones },
    ...projection,
    preference: display.preference,
    display,
    selection: { activeMilestoneTaskId, highlightedMemberTaskIds: wbsTasks.filter((task) => task.type === "task" && members.has(task.taskId)).map((task) => task.taskId) },
  };
}

export interface CanonicalSubtreeImpact {
  readonly taskIds: readonly string[];
  readonly milestoneTaskIds: readonly string[];
  readonly missingRootTaskIds: readonly string[];
}

/**
 * Display impact uses the canonical subtree, never the WBS display projection.
 * Existing server Copy exclusions, incident Link checks, locks and Assignment guards remain authoritative.
 */
export function canonicalSubtreeImpact(tasks: readonly ProjectTaskDto[], rootTaskIds: readonly string[]): CanonicalSubtreeImpact {
  const byId = new Map(tasks.map((task) => [task.taskId, task]));
  const included = new Set<string>();
  const missing = new Set<string>();
  for (const id of rootTaskIds) {
    const task = byId.get(id);
    if (!task) { missing.add(id); continue; }
    if (task.type === "summary") {
      const subtree = resolveTaskSubtreeScope(tasks, id);
      if (subtree.kind === "valid") for (const taskId of subtree.taskIds) included.add(taskId);
    } else included.add(id);
  }
  const affected = tasks.filter((task) => included.has(task.taskId));
  return { taskIds: affected.map((task) => task.taskId), milestoneTaskIds: affected.filter((task) => task.type === "milestone").map((task) => task.taskId), missingRootTaskIds: [...missing] };
}
