import { normalizeInlineTaskName } from "./project-task-adapter";

export type InlineNameSubmitCause = "enter" | "tab" | "blur";
export type InlineNameConfirmation = Readonly<{ taskId: string; revision: number; name: string }>;
type Session = Readonly<{
  sessionId: number; taskId: string; baseRevision: number; rawDraft: string;
  originalName: string; composing: boolean;
}>;
type Request = Session & Readonly<{ requestId: number; normalizedName: string; cause: InlineNameSubmitCause }>;
export type InlineNameState =
  | Readonly<{ phase: "IDLE" }>
  | (Session & Readonly<{ phase: "EDITING" }>)
  | (Request & Readonly<{ phase: "COMMITTING" }>)
  | (Request & Readonly<{ phase: "AWAITING_CONFIRMATION" | "CONFIRMED"; confirmed: InlineNameConfirmation }>)
  | (Session & Readonly<{ phase: "REJECTED"; error: string; conflict: boolean; requestId?: number }>);
export type InlineNameSubmission = Readonly<{
  sessionId: number; requestId: number; taskId: string; baseRevision: number;
  name: string; cause: InlineNameSubmitCause;
}>;

/** Owns edit/request identity only. Confirming a response does not prove a
 * native Grid render; the integration must observe Core and DOM before ack. */
export function createInlineNameSession() {
  let state: InlineNameState = Object.freeze({ phase: "IDLE" });
  let sessionSequence = 0, requestSequence = 0;
  let latest: InlineNameConfirmation | null = null;
  const put = (next: InlineNameState) => { state = Object.freeze(next); };
  const rejectCurrent = (message: string, conflict = false) => {
    if (state.phase === "IDLE") return;
    put({ phase: "REJECTED", sessionId: state.sessionId, taskId: state.taskId, baseRevision: state.baseRevision,
      rawDraft: state.rawDraft, originalName: state.originalName, composing: false,
      ...("requestId" in state ? { requestId: state.requestId } : {}), error: message, conflict });
  };
  const requestMatches = (requestId: number) => state.phase === "COMMITTING" && state.requestId === requestId;
  const staleConfirmation = (confirmed: InlineNameConfirmation) => latest !== null &&
    (latest.revision > confirmed.revision || (latest.revision === confirmed.revision && latest.name !== confirmed.name));

  return {
    getState: (): InlineNameState => state,
    begin(input: Readonly<{ taskId: string; baseRevision: number; rawDraft: string }>): number {
      const sessionId = ++sessionSequence;
      latest = null;
      put({ ...input, sessionId, originalName: input.rawDraft, composing: false, phase: "EDITING" });
      return sessionId;
    },
    updateDraft(sessionId: number, rawDraft: string): boolean {
      if ((state.phase !== "EDITING" && state.phase !== "REJECTED") || state.sessionId !== sessionId) return false;
      put({ ...state, rawDraft });
      return true;
    },
    setComposing(sessionId: number, composing: boolean): boolean {
      if ((state.phase !== "EDITING" && state.phase !== "REJECTED") || state.sessionId !== sessionId) return false;
      put({ ...state, composing });
      return true;
    },
    submit(sessionId: number, cause: InlineNameSubmitCause): InlineNameSubmission | null {
      if (state.phase !== "EDITING" || state.sessionId !== sessionId || state.composing) return null;
      const normalized = normalizeInlineTaskName(state.rawDraft);
      if (normalized.name === null || normalized.error) {
        rejectCurrent(normalized.error ?? "작업명을 확인해 주세요.");
        return null;
      }
      if (normalized.name === state.originalName) { put({ phase: "IDLE" }); return null; }
      const requestId = ++requestSequence, name = normalized.name;
      const submission = Object.freeze({ sessionId, requestId, taskId: state.taskId, baseRevision: state.baseRevision, name, cause });
      put({ ...state, phase: "COMMITTING", requestId, normalizedName: name, cause });
      return submission;
    },
    confirm(requestId: number, confirmed: InlineNameConfirmation): boolean {
      if (!requestMatches(requestId) || state.phase !== "COMMITTING") return false;
      if (confirmed.taskId !== state.taskId || confirmed.name !== state.normalizedName ||
        !Number.isSafeInteger(confirmed.revision) || confirmed.revision <= state.baseRevision || staleConfirmation(confirmed)) {
        rejectCurrent("확인된 저장 결과가 현재 편집 기준과 다릅니다. 최신 정보를 확인해 주세요.", true);
        return false;
      }
      put({ ...state, phase: "AWAITING_CONFIRMATION", confirmed: Object.freeze({ ...confirmed }) });
      return true;
    },
    reject(requestId: number, error: Readonly<{ message: string; conflict?: boolean }>): boolean {
      if (!requestMatches(requestId)) return false;
      rejectCurrent(error.message, error.conflict ?? false);
      return true;
    },
    observeCanonical(confirmed: InlineNameConfirmation): void {
      if (state.phase === "IDLE" || confirmed.taskId !== state.taskId ||
        !Number.isSafeInteger(confirmed.revision) || confirmed.revision < state.baseRevision ||
        (latest !== null && confirmed.revision < latest.revision)) return;
      latest = Object.freeze({ ...confirmed });
      if (state.phase === "EDITING" && confirmed.revision > state.baseRevision) {
        rejectCurrent("기준 Revision이 변경되었습니다. 최신 정보를 확인한 뒤 다시 저장해 주세요.", true);
      } else if (state.phase === "AWAITING_CONFIRMATION" && staleConfirmation(state.confirmed)) {
        rejectCurrent("다른 편집 내용이 먼저 반영되었습니다. 최신 정보를 확인해 주세요.", true);
      }
      // During COMMITTING, React can receive this request's canonical revision
      // before its Promise callback. Retain identity until confirm compares it.
    },
    projectionConfirmed(requestId: number, projected: InlineNameConfirmation): boolean {
      if (state.phase !== "AWAITING_CONFIRMATION" || state.requestId !== requestId || staleConfirmation(state.confirmed) ||
        projected.taskId !== state.confirmed.taskId || projected.revision !== state.confirmed.revision || projected.name !== state.confirmed.name) return false;
      put({ ...state, phase: "CONFIRMED" });
      return true;
    },
    cancel(sessionId: number): boolean {
      if ((state.phase !== "EDITING" && state.phase !== "REJECTED") || state.sessionId !== sessionId || state.composing) return false;
      put({ phase: "IDLE" }); latest = null;
      return true;
    },
    retry(sessionId: number, baseRevision?: number): boolean {
      if (state.phase !== "REJECTED" || state.sessionId !== sessionId) return false;
      const revision = baseRevision ?? state.baseRevision;
      if (!Number.isSafeInteger(revision) || revision < state.baseRevision || (latest !== null && revision < latest.revision)) return false;
      const originalName = latest?.revision === revision ? latest.name : state.originalName;
      put({ phase: "EDITING", sessionId, taskId: state.taskId, baseRevision: revision,
        rawDraft: state.rawDraft, originalName, composing: false });
      return true;
    },
  };
}
export type InlineNameSession = ReturnType<typeof createInlineNameSession>;
