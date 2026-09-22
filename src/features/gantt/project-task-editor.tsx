"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import type { ProjectLinkDto, ProjectTaskDto } from "../../contracts/projects";
import type { ProjectTaskUpdateCommand } from "./project-task-adapter";
import { TaskAssignmentEditor } from "./task-assignment-editor";
import { TASK_EDITOR_TABS, taskEditorTabForKey, type TaskEditorTab } from "./task-editor-view-model";
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
  readonly tasks: readonly ProjectTaskDto[];
  readonly links: readonly ProjectLinkDto[];
  readonly revision: number;
  readonly editable: boolean;
  readonly hasLinks: boolean;
  readonly busy: boolean;
  readonly onSave: (command: ProjectTaskUpdateCommand, revision: number) => Promise<TaskEditorSaveResult>;
  readonly onReload: (taskId: string) => Promise<TaskEditorSession | null>;
  readonly onClose: () => void;
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

export function ProjectTaskEditor({ session, latestTask, tasks, links, revision, editable, hasLinks, busy, onSave, onReload, onClose }: Props) {
  const [base, setBase] = useState(session);
  const [draft, setDraft] = useState(() => createTaskEditorDraft(session.task));
  const [error, setError] = useState<string | null>(null);
  const [conflicted, setConflicted] = useState(false);
  const [operation, setOperation] = useState<"save" | "reload" | null>(null);
  const [confirmation, setConfirmation] = useState<"close" | "reload" | null>(null);
  const [activeTab, setActiveTab] = useState<TaskEditorTab>("task");
  const [assignmentCount, setAssignmentCount] = useState(0);
  const dialogReference = useRef<HTMLDialogElement>(null);
  const tabReferences = useRef<Array<HTMLButtonElement | null>>([]);
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
    actionReference.current = true; setOperation("reload"); setConfirmation(null);
    try {
      const next = await onReload(base.task.taskId);
      if (!mountedReference.current) return;
      if (!next) { setError("최신 정보를 불러올 수 없습니다. 작업이 존재하는지와 네트워크 연결을 확인해 주세요."); return; }
      setBase(next); setDraft(createTaskEditorDraft(next.task)); setConflicted(false); setError(null);
    } catch { if (mountedReference.current) setError("최신 정보를 불러올 수 없습니다. 입력 내용은 유지됩니다."); }
    finally { actionReference.current = false; if (mountedReference.current) setOperation(null); }
  }
  function navigateTab(event: KeyboardEvent<HTMLButtonElement>, current: TaskEditorTab) {
    const next = taskEditorTabForKey(current, event.key);
    if (!next) return;
    event.preventDefault();
    setActiveTab(next);
    tabReferences.current[TASK_EDITOR_TABS.indexOf(next)]?.focus();
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

  const relationSnapshotMatches = revision === base.revision && latestTask?.externalId === base.task.externalId;
  const relations = relationSnapshotMatches ? buildTaskRelations(base.task, tasks, links) : null;
  const relationCount = relations ? relations.predecessors.length + relations.successors.length : 0;

  return <dialog className={styles.dialog} ref={dialogReference} aria-labelledby="task-editor-title" aria-describedby="task-editor-description" aria-busy={locked || undefined} onCancel={(event) => { event.preventDefault(); close(); }}>
    <header className={styles.header}>
      <div className={styles.headerText}>
        <h2 id="task-editor-title">작업 정보</h2>
        <p className={styles.headerMeta} id="task-editor-description">{base.task.type === "summary" ? "요약 작업" : base.task.type === "milestone" ? "마일스톤" : "일반 작업"} · {base.task.externalId} · Revision {base.revision}</p>
      </div>
      <button className="secondary-button" type="button" disabled={locked} onClick={close} aria-label="작업 편집기 닫기">닫기</button>
    </header>

    <div className={styles.noticeStack}>
      {restriction ? <p className={styles.note}>{restriction}</p> : null}
      {stale ? <p className={styles.error} role="alert">다른 편집 내용이 먼저 저장되었거나 기준 Revision이 변경되었습니다. 입력 내용은 보존됩니다. 최신 정보를 다시 불러온 뒤 검토해 주세요.</p> : null}
      {error ? <p className={styles.error} role="alert">{error}</p> : null}
      {confirmation ? <div className={styles.discard} role="alert">
        <p>{confirmation === "close" ? "저장하지 않은 변경사항을 버리고 닫을까요?" : "저장하지 않은 변경사항을 버리고 최신 정보를 불러올까요?"}</p>
        <div className={styles.confirmationActions}>
          <button className="secondary-button" type="button" onClick={() => setConfirmation(null)}>계속 편집</button>
          <button className="secondary-button" type="button" onClick={() => confirmation === "close" ? onClose() : void reload()}>{confirmation === "close" ? "변경사항 버리고 닫기" : "변경사항 버리고 다시 불러오기"}</button>
        </div>
      </div> : null}
    </div>

    <div className={styles.tabs} role="tablist" aria-label="작업 편집 정보">
      {TASK_EDITOR_TABS.map((tab, index) => {
        const selected = activeTab === tab;
        const label = tab === "task" ? "작업 정보" : tab === "resources" ? "리소스" : "관계";
        const count = tab === "resources" ? assignmentCount : tab === "relations" ? relationCount : null;
        return <button
          key={tab}
          ref={(element) => { tabReferences.current[index] = element; }}
          className={styles.tab}
          id={"task-editor-tab-" + tab}
          role="tab"
          type="button"
          aria-selected={selected}
          aria-controls={"task-editor-panel-" + tab}
          tabIndex={selected ? 0 : -1}
          onClick={() => setActiveTab(tab)}
          onKeyDown={(event) => navigateTab(event, tab)}
        >
          <span>{label}</span>
          {count !== null ? <span className={styles.tabBadge} aria-label={label + " " + count + "건"}>{count}</span> : null}
        </button>;
      })}
    </div>

    <form className={styles.form} noValidate onSubmit={(event) => void submit(event)}>
      <div className={styles.body}>
        <section
          className={styles.tabPanel}
          id="task-editor-panel-task"
          role="tabpanel"
          aria-labelledby="task-editor-tab-task"
          hidden={activeTab !== "task"}
          tabIndex={0}
        >
          <div className={styles.taskFields}>
            <label className={styles.field}>작업명<input autoFocus name="task-name" value={draft.name} readOnly={readOnly} disabled={locked} onChange={(event) => change("name", event.target.value)} /></label>
            <div className={styles.field}>
              <label htmlFor="task-progress">진행률 (%)</label>
              <span className={styles.sliderRow}>
                <input id="task-progress" aria-valuetext={draft.progress + "%"} name="task-progress" type="range" min="0" max="100" step="1" value={draft.progress} disabled={locked || readOnly} onChange={(event) => change("progress", event.target.value)} />
                <span className={styles.progressValue} aria-live="polite">{draft.progress}%</span>
              </span>
            </div>
            <div className={styles.scheduleFields}>
              <label className={styles.field}>시작일<input name="task-start" type="date" min="1900-01-01" max="2199-12-31" value={draft.start} readOnly={readOnly} disabled={locked} onChange={(event) => change("start", event.target.value)} /></label>
              <label className={styles.field}>기간 (근무일)<input name="task-duration" type="number" min={base.task.type === "milestone" ? 0 : 1} max="10000" step="1" value={draft.duration} readOnly={readOnly || base.task.type === "milestone"} disabled={locked} onChange={(event) => change("duration", event.target.value)} /></label>
              <div className={styles.field}>
                <span className={styles.fieldLabel}>서버 확정 종료일</span>
                <output className={styles.outputField}>{base.task.end}</output>
              </div>
            </div>
            <label className={styles.field}>Description<textarea name="task-description" rows={5} value={draft.description} readOnly={readOnly} disabled={locked} onChange={(event) => change("description", event.target.value)} /></label>
            <label className={styles.field}>URL<input name="task-url" type="url" inputMode="url" placeholder="https://... 또는 http://..." value={draft.url} readOnly={readOnly} disabled={locked} onChange={(event) => change("url", event.target.value)} /></label>
          </div>
          <details className={styles.metadata} open>
            <summary>서버 확정 정보</summary>
            <dl className={styles.confirmed}>
              <dt>요청 시작일</dt><dd>{base.task.requestedStart ?? "하위 작업 기준"}</dd>
              <dt>확정 종료일</dt><dd>{base.task.end}</dd>
              <dt>기준 Revision</dt><dd>{base.revision}</dd>
            </dl>
          </details>
          <p className={styles.caption}>종료일은 저장 전 확정된 값입니다. 변경한 시작일과 근무일 기간의 계산은 저장 시 서버가 수행합니다. URL은 http/https만 허용되며 링크는 일정 화면에서 새 탭으로 열립니다.</p>
        </section>

        <section
          className={styles.tabPanel}
          id="task-editor-panel-resources"
          role="tabpanel"
          aria-labelledby="task-editor-tab-resources"
          hidden={activeTab !== "resources"}
          tabIndex={0}
        >
          <TaskAssignmentEditor
            taskId={base.task.taskId}
            revision={base.revision}
            editable={editable}
            disabled={locked || readOnly || dirty}
            onApplied={reload}
            onSelectionCountChange={setAssignmentCount}
          />
        </section>

        <section
          className={styles.tabPanel}
          id="task-editor-panel-relations"
          role="tabpanel"
          aria-labelledby="task-editor-tab-relations"
          hidden={activeTab !== "relations"}
          tabIndex={0}
        >
          <section className={styles.relations} aria-labelledby="task-relations-title">
            <div className={styles.sectionHeading}>
              <div>
                <h3 id="task-relations-title">작업 관계</h3>
                <p className={styles.sectionDescription}>관계는 현재 조회 전용입니다. 편집 기능은 기존 범위대로 제공하지 않습니다.</p>
              </div>
              <span className={styles.sectionCount}>{relationCount}건</span>
            </div>
            {!relationSnapshotMatches ? <p className={styles.relationError} role="alert">관계 정보의 기준 Revision이 변경되었습니다. 최신 정보를 다시 불러와 주세요.</p> : null}
            {relations ? <div className={styles.relationColumns}><RelationList title="선행 작업" relations={relations.predecessors} /><RelationList title="후행 작업" relations={relations.successors} /></div> : null}
          </section>
        </section>
      </div>

      <footer className={styles.footer}>
        <button className={"secondary-button " + styles.reloadButton} type="button" disabled={locked} onClick={() => dirty ? setConfirmation("reload") : void reload()}>
          <span aria-hidden="true">↻</span><span>최신 정보 다시 불러오기</span>
        </button>
        <div className={styles.footerActions}>
          <button className="secondary-button" type="button" disabled={locked} onClick={close}>{"취소"}</button>
          {!restriction ? <button className="primary-button" type="submit" disabled={locked || stale || confirmation !== null}>{operation === "save" ? "저장 중…" : "저장"}</button> : null}
        </div>
      </footer>
    </form>
  </dialog>;
}
