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
