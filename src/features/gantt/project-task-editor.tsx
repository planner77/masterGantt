"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import type { ProjectSnapshotResponse, ProjectTaskDto } from "../../contracts/projects";
import type { ProjectTaskUpdateCommand } from "./project-task-adapter";
import { TaskAssignmentEditor } from "./task-assignment-editor";
import { buildTaskRelations, formatTaskRelationType, type TaskRelationView, type TaskRelationsView } from "./task-relations";
import {
  createTaskEditorDraft,
  prepareTaskEditorCommand,
  taskEditorIsDirty,
  taskEditorReadOnlyReason,
  type TaskEditorDraft,
  type TaskEditorSaveResult,
  type TaskEditorSession,
} from "./task-editor-model";
import styles from "./project-task-editor.module.css";

interface Props {
  readonly session: TaskEditorSession;
  readonly latestTask: ProjectTaskDto | undefined;
  readonly revision: number;
  readonly editable: boolean;
  readonly hasLinks: boolean;
  readonly busy: boolean;
  readonly onSave: (command: ProjectTaskUpdateCommand, revision: number) => Promise<TaskEditorSaveResult>;
  readonly onReload: (taskId: string) => Promise<TaskEditorSession | null>;
  readonly onClose: () => void;
}

type RelationState =
  | { readonly status: "loading" }
  | { readonly status: "ready"; readonly revision: number; readonly relations: TaskRelationsView }
  | { readonly status: "failed"; readonly message: string };

type RelationLoadResult =
  | { readonly status: "ready"; readonly revision: number; readonly relations: TaskRelationsView }
  | { readonly status: "failed"; readonly message: string; readonly conflict: boolean };

function isSnapshot(value: unknown): value is ProjectSnapshotResponse {
  if (typeof value !== "object" || value === null || !("data" in value)) return false;
  const data = value.data;
  return typeof data === "object" && data !== null && "project" in data && typeof data.project === "object" && data.project !== null &&
    "revision" in data.project && typeof data.project.revision === "number" && "tasks" in data && Array.isArray(data.tasks) && "links" in data && Array.isArray(data.links);
}

function projectPublicIdFromPathname(pathname: string): string | null {
  const match = /^\/projects\/([^/]+)\/?$/.exec(pathname);
  if (!match) return null;
  try { return decodeURIComponent(match[1]); }
  catch { return null; }
}

async function fetchTaskRelations(expected: TaskEditorSession): Promise<RelationLoadResult> {
  const publicId = projectPublicIdFromPathname(window.location.pathname);
  if (!publicId) return { status: "failed", conflict: false, message: "프로젝트 경로를 확인할 수 없어 작업 관계를 불러오지 못했습니다." };
  try {
    const response = await fetch(`/api/projects/${encodeURIComponent(publicId)}`, { credentials: "same-origin" });
    const body: unknown = await response.json().catch(() => null);
    if (!response.ok || !isSnapshot(body)) return { status: "failed", conflict: false, message: "작업 관계를 불러올 수 없습니다. 최신 정보 다시 불러오기를 시도해 주세요." };
    if (body.data.project.revision !== expected.revision) return { status: "failed", conflict: true, message: "관계 조회 중 프로젝트 Revision이 변경되었습니다. 최신 정보를 다시 불러와 주세요." };
    const task = body.data.tasks.find((entry) => entry.taskId === expected.task.taskId);
    if (!task || task.externalId !== expected.task.externalId) return { status: "failed", conflict: true, message: "기준 작업이 변경되었거나 삭제되었습니다. 최신 정보를 다시 불러와 주세요." };
    return { status: "ready", revision: expected.revision, relations: buildTaskRelations(task, body.data.tasks, body.data.links) };
  } catch {
    return { status: "failed", conflict: false, message: "네트워크 오류로 작업 관계를 불러오지 못했습니다." };
  }
}

function RelationList({ title, relations }: Readonly<{ title: string; relations: readonly TaskRelationView[] }>) {
  return <section className={styles.relationGroup} aria-label={title}>
    <h4>{title} ({relations.length})</h4>
    {relations.length === 0 ? <p className={styles.emptyRelation}>없음</p> : <ul className={styles.relationList}>
      {relations.map((relation) => <li key={`${relation.direction}:${relation.id}`} className={styles.relationItem}>
        <div className={styles.relationTask}><strong>{relation.relatedTaskName}</strong> <code>{relation.relatedTaskExternalId}</code></div>
        <div className={styles.relationMeta}>
          <span>{formatTaskRelationType(relation.type)}</span><span>Lag {relation.lag}일</span>
          {!relation.resolved ? <span className={styles.relationWarning}>참조 작업을 찾을 수 없음</span> : null}
        </div>
      </li>)}
    </ul>}
  </section>;
}

export function ProjectTaskEditor({ session, latestTask, revision, editable, hasLinks, busy, onSave, onReload, onClose }: Props) {
  const [base, setBase] = useState(session);
  const [draft, setDraft] = useState(() => createTaskEditorDraft(session.task));
  const [error, setError] = useState<string | null>(null);
  const [conflicted, setConflicted] = useState(false);
  const [operation, setOperation] = useState<"save" | "reload" | null>(null);
  const [confirmation, setConfirmation] = useState<"close" | "reload" | null>(null);
  const [relationState, setRelationState] = useState<RelationState>({ status: "loading" });
  const dialogReference = useRef<HTMLDialogElement>(null);
  const actionReference = useRef(false);
  const mountedReference = useRef(false);
  const dirty = taskEditorIsDirty(base.task, draft);
  const stale = conflicted || revision !== base.revision;
  const restriction = taskEditorReadOnlyReason(latestTask, editable, hasLinks) ??
    (latestTask?.type !== base.task.type ? "작업 유형이 변경되었습니다. 최신 정보를 다시 불러와 주세요." : null);
  const locked = busy || operation !== null;
  const readOnly = !!restriction || stale;

  useEffect(() => {
    mountedReference.current = true;
    const dialog = dialogReference.current;
    if (dialog && !dialog.open) dialog.showModal();
    void fetchTaskRelations(session).then((result) => {
      if (!mountedReference.current) return;
      if (result.status === "failed") {
        if (result.conflict) setConflicted(true);
        setRelationState({ status: "failed", message: result.message });
      } else setRelationState(result);
    });
    return () => { mountedReference.current = false; dialog?.close(); };
  }, [session]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function change(field: keyof TaskEditorDraft, value: string) {
    if (locked || restriction || stale) return;
    setDraft((current) => ({ ...current, [field]: value }));
    setError(null);
  }
  function close() {
    if (locked || actionReference.current) return;
    if (dirty) setConfirmation("close"); else onClose();
  }
  async function reload() {
    if (locked || actionReference.current) return;
    actionReference.current = true; setOperation("reload"); setConfirmation(null); setRelationState({ status: "loading" });
    try {
      const next = await onReload(base.task.taskId);
      if (!mountedReference.current) return;
      if (!next) { setError("최신 정보를 불러올 수 없습니다. 작업이 존재하는지와 네트워크 연결을 확인해 주세요."); return; }
      const relationResult = await fetchTaskRelations(next);
      if (!mountedReference.current) return;
      setBase(next); setDraft(createTaskEditorDraft(next.task)); setConflicted(relationResult.status === "failed" && relationResult.conflict); setError(null);
      setRelationState(relationResult.status === "failed" ? { status: "failed", message: relationResult.message } : relationResult);
    } catch { if (mountedReference.current) setError("최신 정보를 불러올 수 없습니다. 입력 내용은 유지됩니다."); }
    finally { actionReference.current = false; if (mountedReference.current) setOperation(null); }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (locked || actionReference.current || restriction || stale) return;
    const prepared = prepareTaskEditorCommand(base.task, draft);
    if (prepared.error) { setError(prepared.error); return; }
    if (!prepared.command) { onClose(); return; }
    actionReference.current = true; setOperation("save"); setError(null);
    try {
      const result = await onSave(prepared.command, base.revision);
      if (!mountedReference.current) return;
      if (result.status === "saved") onClose();
      else { setError(result.message); if (result.conflict) setConflicted(true); }
    } catch { if (mountedReference.current) setError("저장 결과를 확인할 수 없습니다. 입력 내용은 유지됩니다. 최신 정보를 확인해 주세요."); }
    finally { actionReference.current = false; if (mountedReference.current) setOperation(null); }
  }

  return <dialog className={styles.dialog} ref={dialogReference} aria-labelledby="task-editor-title" aria-describedby="task-editor-description" aria-busy={locked || undefined} onCancel={(event) => { event.preventDefault(); close(); }}>
    <div className={styles.header}><h2 id="task-editor-title">작업 정보</h2><button className="secondary-button" type="button" disabled={locked} onClick={close} aria-label="작업 편집기 닫기">닫기</button></div>
    <p className={styles.caption} id="task-editor-description">{base.task.type === "summary" ? "요약 작업" : base.task.type === "milestone" ? "마일스톤" : "일반 작업"} · 기준 Revision {base.revision} · {base.task.externalId}</p>
    {restriction ? <p className={styles.note}>{restriction}</p> : null}
    {stale ? <p className={styles.error} role="alert">다른 편집 내용이 먼저 저장되었거나 기준 Revision이 변경되었습니다. 입력 내용은 보존됩니다. 최신 정보를 다시 불러온 뒤 검토해 주세요.</p> : null}
    {error ? <p className={styles.error} role="alert">{error}</p> : null}
    <form className={styles.form} noValidate onSubmit={(event) => void submit(event)}>
      <label className={styles.field}>작업명<input autoFocus name="task-name" value={draft.name} readOnly={readOnly} disabled={locked} onChange={(event) => change("name", event.target.value)} /></label>
      <label className={styles.field}>시작일<input name="task-start" type="date" min="1900-01-01" max="2199-12-31" value={draft.start} readOnly={readOnly} disabled={locked} onChange={(event) => change("start", event.target.value)} /></label>
      <label className={styles.field}>기간 (근무일)<input name="task-duration" type="number" min={base.task.type === "milestone" ? 0 : 1} max="10000" step="1" value={draft.duration} readOnly={readOnly || base.task.type === "milestone"} disabled={locked} onChange={(event) => change("duration", event.target.value)} /></label>
      <div className={styles.field}>
        <label htmlFor="task-progress">진행률 (%)</label>
        <span className={styles.sliderRow}>
          <input id="task-progress" aria-valuetext={`${draft.progress}%`} name="task-progress" type="range" min="0" max="100" step="1" value={draft.progress} disabled={locked || readOnly} onChange={(event) => change("progress", event.target.value)} />
          <span className={styles.progressValue} aria-live="polite">{draft.progress}%</span>
        </span>
      </div>
      <label className={styles.field}>Description<textarea name="task-description" rows={5} value={draft.description} readOnly={readOnly} disabled={locked} onChange={(event) => change("description", event.target.value)} /></label>
      <label className={styles.field}>URL<input name="task-url" type="url" inputMode="url" placeholder="https://... 또는 http://..." value={draft.url} readOnly={readOnly} disabled={locked} onChange={(event) => change("url", event.target.value)} /></label>
      <dl className={styles.confirmed}><dt>서버 확정 종료일</dt><dd><output>{base.task.end}</output></dd><dt>요청 시작일</dt><dd>{base.task.requestedStart ?? "하위 작업 기준"}</dd></dl>
      <p className={styles.caption}>종료일은 저장 전 확정된 값입니다. 변경한 시작일과 근무일 기간의 계산은 저장 시 서버가 수행합니다. URL은 http/https만 허용되며 링크는 일정 화면에서 새 탭으로 열립니다.</p>
      <TaskAssignmentEditor
        taskId={base.task.taskId}
        revision={base.revision}
        editable={editable}
        disabled={locked || readOnly || dirty}
        onApplied={reload}
      />
      <section className={styles.relations} aria-labelledby="task-relations-title">
        <h3 id="task-relations-title">작업 관계</h3>
        {relationState.status === "loading" ? <p className={styles.caption} role="status">관계 정보를 불러오는 중…</p> : null}
        {relationState.status === "failed" ? <p className={styles.relationError} role="alert">{relationState.message}</p> : null}
        {relationState.status === "ready" ? <><RelationList title="선행 작업" relations={relationState.relations.predecessors} /><RelationList title="후행 작업" relations={relationState.relations.successors} /></> : null}
      </section>
      <div className={styles.actions}>
        <button className="secondary-button" type="button" disabled={locked} onClick={() => dirty ? setConfirmation("reload") : void reload()}>최신 정보 다시 불러오기</button>
        <button className="secondary-button" type="button" disabled={locked} onClick={close}>취소</button>
        {!restriction ? <button className="primary-button" type="submit" disabled={locked || stale || confirmation !== null}>{operation === "save" ? "저장 중…" : "저장"}</button> : null}
      </div>
    </form>
    {confirmation ? <div className={styles.discard} role="alert"><p>{confirmation === "close" ? "저장하지 않은 변경사항을 버리고 닫을까요?" : "저장하지 않은 변경사항을 버리고 최신 정보를 불러올까요?"}</p><div className={styles.actions}><button className="secondary-button" type="button" onClick={() => setConfirmation(null)}>계속 편집</button><button className="secondary-button" type="button" onClick={() => confirmation === "close" ? onClose() : void reload()}>{confirmation === "close" ? "변경사항 버리고 닫기" : "변경사항 버리고 다시 불러오기"}</button></div></div> : null}
  </dialog>;
}
