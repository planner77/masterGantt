/** App-owned navigation state only; server scope resolution and authorization stay authoritative. */
export const RESOURCE_DRILL_RETURN_LIMIT = 8;

export interface ResourceDrillFrame<State> {
  readonly source: State;
  readonly destinationBefore: State;
  readonly destination: State;
}

export type ResourceDrillPush<State> =
  | {
      readonly kind: "accepted";
      readonly frames: readonly ResourceDrillFrame<State>[];
    }
  | {
      readonly kind: "limit";
      readonly frames: readonly ResourceDrillFrame<State>[];
    };

/** Callers supply immutable snapshots, including their view, conditions and restoration handles. */
export function pushResourceDrillFrame<State>(
  frames: readonly ResourceDrillFrame<State>[],
  frame: ResourceDrillFrame<State>,
): ResourceDrillPush<State> {
  if (frames.length >= RESOURCE_DRILL_RETURN_LIMIT)
    return { kind: "limit", frames };
  return { kind: "accepted", frames: [...frames, frame] };
}

export function returnFromResourceDrill<State>(
  frames: readonly ResourceDrillFrame<State>[],
) {
  const frame = frames.at(-1);
  return frame
    ? {
        kind: "restore" as const,
        state: frame.source,
        frames: frames.slice(0, -1),
      }
    : { kind: "none" as const, frames };
}

/** Clear all temporary scopes, restoring this destination's earliest pre-chain baseline. */
export function clearResourceDrill<State>(
  frames: readonly ResourceDrillFrame<State>[],
  viewKey: (state: State) => string,
  current?: State,
) {
  const latest = frames.at(-1);
  if (!latest) return { kind: "none" as const, frames };
  const key = viewKey(current ?? latest.destination);
  const first = frames.find((frame) => viewKey(frame.destination) === key);
  const origin = frames.find((frame) => viewKey(frame.source) === key);
  const baseline = first?.destinationBefore ?? origin?.source ?? current;
  if (!baseline) return { kind: "none" as const, frames };
  return {
    kind: "restore" as const,
    state: baseline,
    frames: [] as readonly ResourceDrillFrame<State>[],
  };
}

export interface ResourceDrillGuards {
  readonly ready: boolean;
  readonly readAllowed: boolean;
  readonly busy: boolean;
  readonly dirty: boolean;
  readonly editorOpening: boolean;
  readonly editorOpen: boolean;
  readonly relationOpen: boolean;
  readonly settingsOpen: boolean;
  readonly deletePending: boolean;
  readonly copyPending: boolean;
  readonly importPending: boolean;
}

/** Re-evaluate before lookup and immediately before committing its asynchronous result. */
export function resourceDrillGuardReason(
  guards: ResourceDrillGuards,
  sourceIdentity: string,
  currentIdentity: string,
):
  | "not-ready"
  | "read-denied"
  | "stale"
  | "dirty"
  | "interaction-pending"
  | null {
  if (!guards.ready) return "not-ready";
  if (!guards.readAllowed) return "read-denied";
  if (!sourceIdentity || sourceIdentity !== currentIdentity) return "stale";
  if (guards.dirty) return "dirty";
  if (
    guards.busy ||
    guards.editorOpening ||
    guards.editorOpen ||
    guards.relationOpen ||
    guards.settingsOpen ||
    guards.deletePending ||
    guards.copyPending ||
    guards.importPending
  )
    return "interaction-pending";
  return null;
}

/** IDs are already resolved ordinary Tasks. Ancestors are display context, never numerator members. */
export function resourceDrillConflict(
  exactTaskIds: readonly string[],
  destinationMatchingIds: readonly string[] | null,
  ancestorIds: readonly string[],
) {
  const taskIds = [...new Set(exactTaskIds)],
    target = new Set(taskIds),
    contextIds = [...new Set(ancestorIds)].filter((id) => !target.has(id)),
    matching =
      destinationMatchingIds === null ? null : new Set(destinationMatchingIds),
    hiddenTaskIds = matching ? taskIds.filter((id) => !matching.has(id)) : [];
  return {
    kind: !taskIds.length
      ? ("empty" as const)
      : hiddenTaskIds.length
        ? ("confirm" as const)
        : ("compatible" as const),
    taskIds,
    contextIds,
    hiddenTaskIds,
    taskCount: taskIds.length,
    ancestorCount: contextIds.length,
    visibleTaskCount: taskIds.length - hiddenTaskIds.length,
    hiddenTaskCount: hiddenTaskIds.length,
  };
}

/** Retain only visits needed by live return frames and the current destination. */
export function resourceDrillLiveVisits<State>(
  frames: readonly ResourceDrillFrame<State>[],
  current: State,
  visit: (state: State) => number,
): number[] {
  return [
    ...new Set([
      visit(current),
      ...frames.flatMap((frame) => [
        visit(frame.source),
        visit(frame.destinationBefore),
        visit(frame.destination),
      ]),
    ]),
  ];
}

/** Display adapter only: the caller must separately retain and revalidate the WBS request. */
export function wbsScheduleDisplayScope(
  scope: Pick<import("@/contracts/wbs-dashboard-views").WbsViewScopeDto, "taskIds" | "assignmentIds" | "ancestorSummaryIds" | "sourceContext" | "snapshotId">,
  selected: { taskId?: string; assignmentId?: string },
  assignments: readonly { id: string; taskId: string }[],
): import("@/contracts/resource-drill").ResourceDrillScopeDto {
  if (selected.taskId && !scope.taskIds.includes(selected.taskId)) throw Error("REPORT_STALE");
  if (selected.assignmentId && (!selected.taskId || !scope.assignmentIds.includes(selected.assignmentId) || !assignments.some(row => row.id === selected.assignmentId && row.taskId === selected.taskId))) throw Error("REPORT_STALE");
  const taskIds = selected.taskId ? [selected.taskId] : scope.taskIds;
  const assignmentIds = scope.assignmentIds.filter(id => (!selected.assignmentId || id === selected.assignmentId) && (!selected.taskId || assignments.some(row => row.id === id && row.taskId === selected.taskId)));
  const source = scope.sourceContext;
  return {
    schema: "resource-dashboard/1", snapshotId: scope.snapshotId,
    sourceContext: {
      projectPublicId: source.projectPublicId, projectRevision: source.projectRevision,
      catalogRevision: source.catalogRevision, calendarRevision: source.calendarRevision, dataSnapshotId: source.dataSnapshotId,
      range: source.range, asOfDate: source.asOfDate, mdPerMm: source.mdPerMm,
      mdPerMmSource: source.mdPerMmSource, mdPerMmProvided: source.mdPerMmProvided,
      sourceProjection: { kind: "schedule" },
    },
    taskIds, assignmentIds, taskCount: taskIds.length, assignmentCount: assignmentIds.length,
    ancestorSummaryIds: scope.ancestorSummaryIds,
  };
}
