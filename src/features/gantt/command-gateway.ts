import type { ITask, TID } from "@svar-ui/react-gantt";

export interface LocalTaskUpdateCommand {
  kind: "update-task";
  taskId: TID;
  /** SVAR's final pointer event uses a signed calendar-day delta. */
  diff?: number;
  changes: Pick<ITask, "text" | "start" | "end" | "progress" | "parent">;
}

export interface TaskUpdateEvent {
  id: TID;
  task: Partial<ITask>;
  diff?: number;
  inProgress?: boolean;
}

/**
 * SVAR emits this before its local store creates a task.  Project Gantt
 * intercepts it so the only durable mutation remains the protected HTTP
 * command owned by the workspace.
 */
export interface LocalTaskAddCommand {
  kind: "add-task";
  targetTaskId: TID | undefined;
  mode: "before" | "after" | "child" | undefined;
}

export interface TaskAddEvent {
  target?: TID;
  mode?: "before" | "after" | "child";
  eventSource?: string;
}

export function createTaskAddGateway(
  dispatch: (command: LocalTaskAddCommand) => void,
) {
  return (event: TaskAddEvent): false => {
    dispatch({
      kind: "add-task",
      targetTaskId: event.target,
      mode: event.mode,
    });
    // Returning false from IApi.intercept cancels SVAR's temporary local task.
    return false;
  };
}

/**
 * The widget can emit transient drag updates before it emits its final update.
 * This small boundary emits only final logical commands and collapses duplicate
 * final events delivered in the same browser task. It intentionally has no API
 * client: W07 will supply the durable command handler.
 */
export function createTaskUpdateGateway(
  dispatch: (command: LocalTaskUpdateCommand) => void,
) {
  const dispatchedThisTurn = new Set<string>();
  let clearScheduled = false;

  return (event: TaskUpdateEvent) => {
    if (event.inProgress) return;
    const changes = {
      text: event.task.text,
      start: event.task.start,
      end: event.task.end,
      progress: event.task.progress,
      parent: event.task.parent,
    };
    const fingerprint = JSON.stringify([
      event.id,
      changes.text,
      changes.start?.getTime(),
      changes.end?.getTime(),
      changes.progress,
      changes.parent,
      event.diff,
    ]);
    if (dispatchedThisTurn.has(fingerprint)) return;

    dispatchedThisTurn.add(fingerprint);
    if (!clearScheduled) {
      clearScheduled = true;
      queueMicrotask(() => {
        dispatchedThisTurn.clear();
        clearScheduled = false;
      });
    }
    dispatch({
      kind: "update-task",
      taskId: event.id,
      ...(typeof event.diff === "number" ? { diff: event.diff } : {}),
      changes,
    });
  };
}


export interface LinkAddEvent {
  link: { source?: TID; target?: TID; type?: "e2s" | "s2s" | "e2e" | "s2e" };
}
export interface LinkDeleteEvent { id: TID }

export function createLinkAddGateway(dispatch: (command: { source: TID; target: TID; type: "e2s" }) => void) {
  const seen = new Set<string>();
  return (event: LinkAddEvent): false => {
    if (event.link.type !== "e2s" || event.link.source === undefined || event.link.target === undefined) return false;
    const fingerprint = JSON.stringify([event.link.source, event.link.target, event.link.type]);
    if (!seen.has(fingerprint)) {
      seen.add(fingerprint);
      queueMicrotask(() => seen.delete(fingerprint));
      dispatch({ source: event.link.source, target: event.link.target, type: "e2s" });
    }
    return false;
  };
}
export function createLinkDeleteGateway(dispatch: (id: TID) => void) {
  const seen = new Set<string>();
  return (event: LinkDeleteEvent): false => {
    const key = String(event.id);
    if (!seen.has(key)) {
      seen.add(key);
      queueMicrotask(() => seen.delete(key));
      dispatch(event.id);
    }
    return false;
  };
}
