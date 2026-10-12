import { describe, expect, it } from "vitest";
import { createInlineNameSession, type InlineNameSubmitCause } from "../../../src/features/gantt/inline-name-session";

function editing() {
  const controller = createInlineNameSession();
  const sessionId = controller.begin({ taskId: "task-1", baseRevision: 7, rawDraft: "Stable leaf" });
  controller.updateDraft(sessionId, "  Blur saved  ");
  return { controller, sessionId };
}
const confirmed = { taskId: "task-1", revision: 8, name: "Blur saved" };

describe("inline name request and canonical confirmation identity", () => {
  it.each(["enter", "tab", "blur"] as const)("submits %s through one normalized request and refuses duplicate native events", cause => {
    const { controller, sessionId } = editing();
    const request = controller.submit(sessionId, cause)!;
    expect(request).toEqual({ sessionId, requestId: 1, taskId: "task-1", baseRevision: 7, name: "Blur saved", cause });
    for (const duplicate of ["enter", "tab", "blur"] as InlineNameSubmitCause[]) expect(controller.submit(sessionId, duplicate)).toBeNull();
    expect(controller.getState()).toMatchObject({ phase: "COMMITTING", rawDraft: "  Blur saved  ", requestId: 1 });
  });

  it("keeps its committing identity when its own canonical revision arrives before the response callback", () => {
    const { controller, sessionId } = editing(), request = controller.submit(sessionId, "blur")!;
    controller.observeCanonical(confirmed);
    expect(controller.getState()).toMatchObject({ phase: "COMMITTING", requestId: request.requestId });
    expect(controller.confirm(request.requestId, confirmed)).toBe(true);
    expect(controller.getState()).toMatchObject({ phase: "AWAITING_CONFIRMATION", confirmed });
    expect(controller.projectionConfirmed(request.requestId, confirmed)).toBe(true);
    expect(controller.getState().phase).toBe("CONFIRMED");
  });

  it("does not turn a saved response into proof of Core or native Grid rendering", () => {
    const { controller, sessionId } = editing(), request = controller.submit(sessionId, "tab")!;
    expect(controller.confirm(request.requestId, confirmed)).toBe(true);
    for (const patch of [{ taskId: "other" }, { revision: 7 }, { revision: 9 }, { name: "old native name" }])
      expect(controller.projectionConfirmed(request.requestId, { ...confirmed, ...patch })).toBe(false);
    expect(controller.getState().phase).toBe("AWAITING_CONFIRMATION");
    expect(controller.projectionConfirmed(request.requestId, confirmed)).toBe(true);
  });

  it("refuses late success and failure from an older editor after a new session starts", () => {
    const { controller, sessionId } = editing(), old = controller.submit(sessionId, "enter")!;
    const newer = controller.begin({ taskId: "task-2", baseRevision: 8, rawDraft: "New task" });
    controller.updateDraft(newer, "Current draft");
    expect(controller.confirm(old.requestId, confirmed)).toBe(false);
    expect(controller.reject(old.requestId, { message: "Old failure" })).toBe(false);
    expect(controller.updateDraft(sessionId, "Old input" )).toBe(false);
    expect(controller.cancel(sessionId)).toBe(false);
    expect(controller.getState()).toMatchObject({ phase: "EDITING", taskId: "task-2", rawDraft: "Current draft" });
  });

  it.each([{ taskId: "other" }, { revision: 7 }, { revision: 6 }, { revision: NaN }, { name: "Unrequested name" }])("rejects an incompatible server confirmation %j while retaining its draft", patch => {
    const { controller, sessionId } = editing(), request = controller.submit(sessionId, "enter")!;
    expect(controller.confirm(request.requestId, { ...confirmed, ...patch })).toBe(false);
    expect(controller.getState()).toMatchObject({ phase: "REJECTED", conflict: true, rawDraft: "  Blur saved  " });
  });

  it.each(["newer revision", "same revision different name"] as const)("refuses response overwrite after observing %s", kind => {
    const { controller, sessionId } = editing(), request = controller.submit(sessionId, "blur")!;
    controller.observeCanonical({ ...confirmed, revision: kind === "newer revision" ? 9 : 8, name: "Another editor" });
    expect(controller.confirm(request.requestId, confirmed)).toBe(false);
    expect(controller.getState()).toMatchObject({ phase: "REJECTED", conflict: true });
  });

  it("invalidates awaiting projection proof after a newer canonical edit and ignores delayed older observations", () => {
    const { controller, sessionId } = editing(), request = controller.submit(sessionId, "enter")!;
    controller.confirm(request.requestId, confirmed);
    controller.observeCanonical({ ...confirmed, revision: 9, name: "New canonical name" });
    controller.observeCanonical(confirmed);
    expect(controller.projectionConfirmed(request.requestId, confirmed)).toBe(false);
    expect(controller.getState()).toMatchObject({ phase: "REJECTED", rawDraft: "  Blur saved  ", conflict: true });
    expect(controller.retry(sessionId, 8)).toBe(false);
    expect(controller.retry(sessionId, 9)).toBe(true);
    expect(controller.submit(sessionId, "enter")).toMatchObject({ baseRevision: 9, name: "Blur saved", requestId: 2 });
  });

  it.each(["401", "409", "412", "network"])("retains rejected draft after %s and requires explicit retry", message => {
    const { controller, sessionId } = editing(), request = controller.submit(sessionId, "tab")!;
    expect(controller.reject(request.requestId, { message, conflict: message === "412" })).toBe(true);
    expect(controller.getState()).toMatchObject({ phase: "REJECTED", error: message, rawDraft: "  Blur saved  " });
    expect(controller.submit(sessionId, "blur")).toBeNull();
    expect(controller.retry(sessionId)).toBe(true);
    const retry = controller.submit(sessionId, "enter")!;
    expect(retry.requestId).toBeGreaterThan(request.requestId);
    expect(controller.confirm(request.requestId, confirmed)).toBe(false);
    expect(controller.getState()).toMatchObject({ phase: "COMMITTING", requestId: retry.requestId });
  });

  it("keeps a stale editing draft for explicit review and rebase instead of sending an outdated revision", () => {
    const { controller, sessionId } = editing();
    controller.observeCanonical({ taskId: "unrelated", revision: 20, name: "Other task" });
    expect(controller.getState().phase).toBe("EDITING");
    controller.observeCanonical({ ...confirmed, name: "Other canonical edit" });
    expect(controller.getState()).toMatchObject({ phase: "REJECTED", conflict: true, rawDraft: "  Blur saved  " });
    expect(controller.submit(sessionId, "enter")).toBeNull();
    expect(controller.retry(sessionId)).toBe(false);
    expect(controller.retry(sessionId, 8)).toBe(true);
    expect(controller.submit(sessionId, "enter")).toMatchObject({ baseRevision: 8 });
  });

  it.each(["", " ", "a".repeat(201), "\ud800"])("does not submit invalid raw draft %j", rawDraft => {
    const { controller, sessionId } = editing(); controller.updateDraft(sessionId, rawDraft);
    expect(controller.submit(sessionId, "enter")).toBeNull();
    expect(controller.getState()).toMatchObject({ phase: "REJECTED", rawDraft });
  });

  it("preserves numeric-looking strings and valid supplementary Unicode", () => {
    for (const name of ["001", "😀"]) {
      const { controller, sessionId } = editing(); controller.updateDraft(sessionId, ` ${name} `);
      expect(controller.submit(sessionId, "enter")).toMatchObject({ name });
    }
  });

  it("never submits composition keys and resumes only after composition ends", () => {
    const { controller, sessionId } = editing(); controller.setComposing(sessionId, true);
    for (const cause of ["enter", "tab", "blur"] as const) expect(controller.submit(sessionId, cause)).toBeNull();
    expect(controller.cancel(sessionId)).toBe(false);
    expect(controller.getState().phase).toBe("EDITING");
    controller.setComposing(sessionId, false);
    expect(controller.submit(sessionId, "enter")).not.toBeNull();
  });

  it("cancels an editing or rejected draft without a request but cannot undo an already submitted mutation", () => {
    const f = editing(); expect(f.controller.cancel(f.sessionId)).toBe(true);
    expect(f.controller.getState().phase).toBe("IDLE");
    expect(f.controller.submit(f.sessionId, "enter")).toBeNull();
    const rejected = editing(); rejected.controller.updateDraft(rejected.sessionId, ""); rejected.controller.submit(rejected.sessionId, "enter");
    expect(rejected.controller.cancel(rejected.sessionId)).toBe(true);
    const pending = editing(); pending.controller.submit(pending.sessionId, "enter");
    expect(pending.controller.cancel(pending.sessionId)).toBe(false);
  });

  it("closes unchanged normalized drafts without consuming a mutation request", () => {
    const { controller, sessionId } = editing(); controller.updateDraft(sessionId, " Stable leaf ");
    expect(controller.submit(sessionId, "blur")).toBeNull();
    expect(controller.getState().phase).toBe("IDLE");
  });
});
