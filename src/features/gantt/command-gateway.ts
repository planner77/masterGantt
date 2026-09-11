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
