import type { TaskHierarchyCommandRequest } from "../../contracts/projects";
export interface NativeTaskMoveEvent {
  id: string | number;
  mode: "before" | "after" | "child" | "up" | "down";
  target?: string | number;
  inProgress?: boolean;
  eventSource?: string;
}
/** Keep drag feedback local; only the released move becomes a protected command. */
export function createTaskMoveGateway(options: {
  canMutate: () => boolean;
  isCanonicalSync: () => boolean;
  hasTask: (id: string) => boolean;
  canApply?: (command: TaskHierarchyCommandRequest) => boolean;
  dispatch: (command: TaskHierarchyCommandRequest) => void;
}) {
  const finalEvents = new Set<string>();
  return (event: NativeTaskMoveEvent): false | undefined => {
    if (event.eventSource === "project-canonical-sync" && options.isCanonicalSync())
      return undefined;
    if (options.isCanonicalSync() || !options.canMutate() || typeof event.id !== "string" || !options.hasTask(event.id))
      return false;
    const direction = event.mode === "up" || event.mode === "down" ? event.mode : null;
    if (!direction && (typeof event.target !== "string" || !options.hasTask(event.target) || event.target === event.id))
      return false;
    const command: TaskHierarchyCommandRequest = direction
      ? { kind: "move", taskId: event.id, direction }
      : {
          kind: "reparent",
          taskId: event.id,
          anchorTaskId: event.target as string,
          placement: event.mode as "before" | "after" | "child",
        };
    // Scope/domain guards must run before Core is allowed to apply provisional
    // drag feedback. Otherwise an invalid move can remain rendered locally even
    // when the protected server command is suppressed.
    if (options.canApply && !options.canApply(command))
      return false;
    if (event.inProgress)
      return undefined;
    const fingerprint = JSON.stringify([event.id, event.mode, event.target]);
    if (!finalEvents.has(fingerprint)) {
      finalEvents.add(fingerprint);
      queueMicrotask(() => finalEvents.delete(fingerprint));
      options.dispatch(command);
    }
    // Core 2.7.3 release events only clear drag state; they do not move again.
    // Let that cleanup run while the server owns the authoritative structure.
    return event.inProgress === false ? undefined : false;
  };
}
