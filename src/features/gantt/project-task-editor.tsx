"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import type { ProjectLinkDto, ProjectTaskDto } from "../../contracts/projects";
import type { ProjectTaskUpdateCommand } from "./project-task-adapter";
import { TaskAssignmentEditor } from "./task-assignment-editor";
import { TaskLogisticsLinkEditor } from "./task-logistics-link-editor";
import { TASK_EDITOR_TABS, taskEditorTabForKey, type TaskEditorTab } from "./task-editor-view-model";
import { buildTaskRelations, formatTaskRelationType, getTaskRelationMutationBlockReason, type TaskRelationView } from "./task-relations";
import {
  clearBaseline,
  copyScheduleToBaseline,
  createTaskEditorDraft,
  prepareTaskEditorCommand,
  synchronizeTaskEditorScheduleDraft,
  taskEditorIsDirty,
  taskEditorReadOnlyReason,
  updateTaskEditorDraft,
  validateTaskEditorSchedule,
  type TaskEditorDraft,
  type TaskEditorSaveResult,
  type TaskEditorScheduleBasis,
  type TaskEditorScheduleField,
  type TaskEditorSession,
} from "./task-editor-model";
import styles from "./project-task-editor.module.css";

export type TaskRelationEditorRequest =
  | { readonly kind: "link"; readonly linkId: string }
  | { readonly kind: "task"; readonly taskId: string };

export interface ProjectTaskEditorHandle {
  applyCanonicalSession: (session: TaskEditorSession) => void;
}

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
  readonly onRelationEditorOpen: (request: TaskRelationEditorRequest, trigger: HTMLElement) => void;
  readonly onRelationDelete: (linkId: string) => Promise<boolean>;
  readonly onClose: () => void;
}

function RelationList({
  title,
  relations,
  showActions,
  actionsDisabled,
  onEdit,
  onDelete,
}: Readonly<{
  title: string;
  relations: readonly TaskRelationView[];
  showActions: boolean;
  actionsDisabled: boolean;
  onEdit: (relation: TaskRelationView, trigger: HTMLElement) => void;
  onDelete: (relation: TaskRelationView, trigger: HTMLElement) => void;
}>) {
  return <section className={styles.relationGroup} aria-label={title}>
    <h4>{title} ({relations.length})</h4>
    {relations.length === 0 ? <p className={styles.emptyRelation}>없음</p> : <ul className={styles.relationList}>
      {relations.map((relation) => <li key={`${relation.direction}:${relation.id}`} className={styles.relationItem}>
        <div className={styles.relationItemHeader}>
          <div className={styles.relationTask}><strong>{relation.relatedTaskName}</strong> <code>{relation.relatedTaskExternalId}</code></div>
          {showActions && relation.resolved ? <div className={styles.relationActions}>
            <button
              aria-label={`${relation.relatedTaskName} 관계 편집`}
              className="secondary-button"
              disabled={actionsDisabled}
              onClick={(event) => onEdit(relation, event.currentTarget)}
              type="button"
            >편집</button>
            <button
              aria-label={`${relation.relatedTaskName} 관계 삭제`}
              className="danger-button"
              disabled={actionsDisabled}
              onClick={(event) => onDelete(relation, event.currentTarget)}
              type="button"
            >삭제</button>
          </div> : null}
        </div>
        <div className={styles.relationMeta}>
          <span>{formatTaskRelationType(relation.type)}</span><span>Lag {relation.lag}일</span>
          {!relation.resolved ? <span className={styles.relationWarning}>참조 작업을 찾을 수 없음</span> : null}
        </div>
      </li>)}
    </ul>}
  </section>;
}

export const ProjectTaskEditor = forwardRef<ProjectTaskEditorHandle, Props>(function ProjectTaskEditor({
  session,
  latestTask,
  tasks,
  links,
  revision,
  editable,
  hasLinks,
  busy,
  onSave,
  onReload,
  onRelationEditorOpen,
  onRelationDelete,
  onClose,
}, ref) {
  const [base, setBase] = useState(session);
  const [draft, setDraft] = useState(() => createTaskEditorDraft(session.task, session.calendar));
  const [scheduleBasis, setScheduleBasis] = useState<TaskEditorScheduleBasis>("duration");
  const [error, setError] = useState<string | null>(null);
  const [conflicted, setConflicted] = useState(false);
  const [operation, setOperation] = useState<"save" | "reload" | "relation-delete" | null>(null);
  const [confirmation, setConfirmation] = useState<"close" | "reload" | null>(null);
  const [relationDeleteTarget, setRelationDeleteTarget] = useState<TaskRelationView | null>(null);
  const [activeTab, setActiveTab] = useState<TaskEditorTab>("task");
  const [assignmentCount, setAssignmentCount] = useState(0);
  const [logisticsCount, setLogisticsCount] = useState(0);
  const dialogReference = useRef<HTMLDialogElement>(null);
  const tabReferences = useRef<Array<HTMLButtonElement | null>>([]);
  const actionReference = useRef(false);
  const mountedReference = useRef(false);
  const relationDeleteTriggerReference = useRef<HTMLElement | null>(null);
  const relationDeleteCancelReference = useRef<HTMLButtonElement>(null);
  const relationAddReference = useRef<HTMLButtonElement>(null);
  const dirty = taskEditorIsDirty(base.task, draft);
  const stale = conflicted || revision !== base.revision;
  const restriction = taskEditorReadOnlyReason(latestTask, editable, false) ??
    (latestTask?.type !== base.task.type ? "작업 유형이 변경되었습니다. 최신 정보를 다시 불러와 주세요." : null);
  const locked = busy || operation !== null;
  const readOnly = !!restriction || stale;
  const scheduleReadOnly = readOnly;
  const scheduleDirty = draft.start !== (base.task.requestedStart ?? base.task.start ?? "") || draft.duration !== (base.task.duration === null ? "" : String(base.task.duration)) || draft.scheduleMode !== base.task.scheduleMode;

  useEffect(() => {
    mountedReference.current = true;
    const dialog = dialogReference.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => { mountedReference.current = false; dialog?.close(); };
  }, []);

  useImperativeHandle(ref, () => ({
    applyCanonicalSession(next) {
      if (next.task.taskId !== session.task.taskId) return;
      setBase(next);
      setDraft(createTaskEditorDraft(next.task, next.calendar));
      setScheduleBasis("duration");
      setConflicted(false);
      setError(null);
      setRelationDeleteTarget(null);
    },
  }), [session.task.taskId]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function change(field: keyof TaskEditorDraft, value: string) {
    if (locked || restriction || stale) return;
    setDraft((current) => updateTaskEditorDraft(current, field, value));
    setError(null);
  }
  function changeSchedule(field: TaskEditorScheduleField, value: string) {
    if (locked || restriction || stale || base.task.type !== "task") return;
    const nextBasis: TaskEditorScheduleBasis = field === "requestedEnd" ? "end" : field === "duration" ? "duration" : scheduleBasis;
    setScheduleBasis(nextBasis);
    setDraft((current) => synchronizeTaskEditorScheduleDraft(
      base.task,
      { ...current, [field]: value },
      base.calendar,
      nextBasis,
    ));
    setError(null);
  }
  function changeScheduleMode(value: "auto" | "manual") {
    if (locked || restriction || stale) return;
    setDraft((current) => synchronizeTaskEditorScheduleDraft(
      base.task,
      { ...current, scheduleMode: value },
      base.calendar,
      scheduleBasis,
    ));
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
      setBase(next); setDraft(createTaskEditorDraft(next.task, next.calendar)); setScheduleBasis("duration"); setConflicted(false); setError(null);
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

  function requestRelationDelete(relation: TaskRelationView, trigger: HTMLElement) {
    if (relationMutationDisabled || relationDeleteTarget) return;
    relationDeleteTriggerReference.current = trigger;
    setRelationDeleteTarget(relation);
    requestAnimationFrame(() => relationDeleteCancelReference.current?.focus());
  }
  function cancelRelationDelete() {
    const trigger = relationDeleteTriggerReference.current;
    relationDeleteTriggerReference.current = null;
    setRelationDeleteTarget(null);
    requestAnimationFrame(() => {
      if (trigger?.isConnected) trigger.focus({ preventScroll: true });
      else relationAddReference.current?.focus({ preventScroll: true });
    });
  }
  async function confirmRelationDelete() {
    const target = relationDeleteTarget;
    if (!target || locked || actionReference.current || dirty || stale || !editable) return;
    actionReference.current = true;
    setOperation("relation-delete");
    setError(null);
    try {
      const deleted = await onRelationDelete(target.id);
      if (!mountedReference.current) return;
      if (deleted) {
        relationDeleteTriggerReference.current = null;
        setRelationDeleteTarget(null);
        requestAnimationFrame(() => relationAddReference.current?.focus({ preventScroll: true }));
      } else {
        setError("관계를 삭제할 수 없습니다. 최신 정보를 확인한 뒤 다시 시도해 주세요.");
      }
    } catch {
      if (mountedReference.current) setError("관계를 삭제할 수 없습니다. 최신 정보를 확인한 뒤 다시 시도해 주세요.");
    } finally {
      actionReference.current = false;
      if (mountedReference.current) setOperation(null);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (locked || actionReference.current || restriction || stale) return;
    const scheduleIssue = validateTaskEditorSchedule(base.task, draft, base.calendar, scheduleBasis);
    if (scheduleIssue) { setError("일정 입력을 확인해 주세요."); return; }
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
  const relationMutationBlockReason = getTaskRelationMutationBlockReason({
    editable,
    taskType: base.task.type,
    stale: stale || !relationSnapshotMatches,
    dirty,
    busy: locked,
  });
  const relationMutationDisabled = relationMutationBlockReason !== null;
  const taskTypeLabel = base.task.type === "summary" ? "요약 작업" : base.task.type === "milestone" ? "마일스톤" : "일반 작업";
  const scheduleIssue = validateTaskEditorSchedule(base.task, draft, base.calendar, scheduleBasis);

  return <dialog className={styles.dialog} ref={dialogReference} aria-labelledby="task-editor-title" aria-describedby="task-editor-description" aria-busy={locked || undefined} onCancel={(event) => { event.preventDefault(); close(); }}>
    <header className={styles.header}>
      <div className={styles.headerText}>
        <h2 id="task-editor-title">작업 정보</h2>
        <p className={styles.headerMeta} id="task-editor-description">
          <span className={styles.typeBadge}>{taskTypeLabel}</span>
          <span>External ID <code>{base.task.externalId}</code></span>
          <span>Revision {base.revision}</span>
        </p>
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
        const label = tab === "task" ? "작업 정보" : tab === "resources" ? "리소스" : tab === "relations" ? "관계" : "물류 연결";
        const count = tab === "resources" ? assignmentCount : tab === "relations" ? relationCount : tab === "logistics" ? logisticsCount : null;
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
            <label className={styles.field}>작업명<input autoFocus name="task-name" value={draft.name} readOnly={scheduleReadOnly} disabled={locked} onChange={(event) => change("name", event.target.value)} /></label>
            <div className={styles.statusProgressFields}>
              <label className={styles.field}>
                상태
                <select name="task-status" aria-label="상태" value={draft.status} disabled={locked || scheduleReadOnly || base.task.progress === null} onChange={(event) => change("status", event.target.value)}>
                  <option value="not_started">시작 전</option>
                  <option value="in_progress">진행 중</option>
                  <option value="completed">완료</option>
                </select>
              </label>
              <div className={styles.field}>
                <label htmlFor="task-progress">진행률 (%)</label>
                <span className={styles.sliderRow}>
                  {base.task.progress === null ? <output id="task-progress" aria-label="진행률 미산정">—</output> : <input id="task-progress" aria-valuetext={draft.progress + "%"} name="task-progress" type="range" min="0" max="100" step="1" value={draft.progress} disabled={locked || scheduleReadOnly} onChange={(event) => change("progress", event.target.value)} />}
                  <span className={styles.progressValue} aria-live="polite">{base.task.progress === null ? "미산정" : `${draft.progress}%`}</span>
                </span>
              </div>
            </div>
            <div className={styles.scheduleFields}>
              <div className={styles.field}>
                <label htmlFor="task-start">요청 시작일</label>
                <input
                  id="task-start"
                  name="task-start"
                  type="date"
                  min="1900-01-01"
                  max="2199-12-31"
                  value={draft.start}
                  readOnly={scheduleReadOnly}
                  disabled={locked}
                  aria-invalid={scheduleIssue?.field === "start" || undefined}
                  aria-describedby={scheduleIssue?.field === "start" ? "task-start-error" : undefined}
                  onChange={(event) => base.task.type === "task" ? changeSchedule("start", event.target.value) : change("start", event.target.value)}
                />
                {scheduleIssue?.field === "start" ? <span id="task-start-error" className={styles.fieldError}>{scheduleIssue.message}</span> : null}
              </div>
              <div className={styles.field}>
                <label htmlFor="task-duration">기간 (근무일)</label>
                {base.task.duration === null ? <output className={styles.outputField} aria-label="기간 미산정">—</output> : <input
                  id="task-duration"
                  name="task-duration"
                  type="number"
                  min={base.task.type === "milestone" ? 0 : 1}
                  max="10000"
                  step="1"
                  value={draft.duration}
                  readOnly={scheduleReadOnly || base.task.type === "milestone"}
                  disabled={locked}
                  aria-invalid={scheduleIssue?.field === "duration" || undefined}
                  aria-describedby={scheduleIssue?.field === "duration" ? "task-duration-error" : undefined}
                  onChange={(event) => base.task.type === "task" ? changeSchedule("duration", event.target.value) : change("duration", event.target.value)}
                />}
                {scheduleIssue?.field === "duration" ? <span id="task-duration-error" className={styles.fieldError}>{scheduleIssue.message}</span> : null}
              </div>
              {base.task.type === "task" ? <div className={styles.field}>
                <label htmlFor="task-requested-end">요청 종료일</label>
                <input
                  id="task-requested-end"
                  name="task-requested-end"
                  type="date"
                  min="1900-01-01"
                  max="2199-12-31"
                  value={draft.requestedEnd}
                  readOnly={scheduleReadOnly}
                  disabled={locked}
                  aria-invalid={scheduleIssue?.field === "requestedEnd" || undefined}
                  aria-describedby={scheduleIssue?.field === "requestedEnd" ? "task-requested-end-error" : undefined}
                  onChange={(event) => changeSchedule("requestedEnd", event.target.value)}
                />
                {scheduleIssue?.field === "requestedEnd" ? <span id="task-requested-end-error" className={styles.fieldError}>{scheduleIssue.message}</span> : null}
              </div> : null}
            </div>
            <label className={styles.field}>일정 모드<select name="task-schedule-mode" value={draft.scheduleMode} disabled={locked || readOnly} onChange={(event) => changeScheduleMode(event.target.value as "auto" | "manual")}><option value="auto">자동 (Auto)</option><option value="manual">수동 (Manual)</option></select></label>
            <label className={styles.field}>Description<textarea name="task-description" rows={5} value={draft.description} readOnly={scheduleReadOnly} disabled={locked} onChange={(event) => change("description", event.target.value)} /></label>
            <label className={styles.field}>URL<input name="task-url" type="url" inputMode="url" placeholder="https://... 또는 http://..." value={draft.url} readOnly={scheduleReadOnly} disabled={locked} onChange={(event) => change("url", event.target.value)} /></label>
          </div>

          <div className={styles.baselineSection}>
            <div className={styles.baselineHeader}>
              <h3 className={styles.baselineTitle}>기준 일정 (Baseline)</h3>
              {base.task.type !== "summary" && !readOnly ? (
                <div className={styles.baselineActions}>
                  <button
                    type="button"
                    className="secondary-button"
                    disabled={locked || scheduleDirty}
                    aria-describedby={scheduleDirty ? "baseline-copy-reason" : undefined}
                    onClick={() => {
                      setDraft((current) => copyScheduleToBaseline(current, base.task));
                      setError(null);
                    }}
                  >
                    현재 일정으로 설정
                  </button>
                  <button
                    type="button"
                    className="secondary-button"
                    disabled={locked || (!draft.baselineStart && !base.task.baselineStart)}
                    onClick={() => {
                      setDraft((current) => clearBaseline(current));
                      setError(null);
                    }}
                  >
                    기준 일정 삭제
                  </button>
                </div>
              ) : null}
            </div>

            {scheduleDirty ? <p id="baseline-copy-reason" className={styles.caption}>변경한 일정을 먼저 저장한 뒤 현재 적용 일정으로 기준 일정을 설정해 주세요.</p> : null}
            {base.task.type === "summary" ? (
              <div className={styles.scheduleFields}>
                <div className={styles.field}>
                  <span className={styles.fieldLabel}>파생 기준 시작일</span>
                  <output className={styles.outputField}>{base.task.baselineStart ?? "미설정"}</output>
                </div>
                <div className={styles.field}>
                  <span className={styles.fieldLabel}>파생 기준 기간</span>
                  <output className={styles.outputField}>{base.task.baselineDuration !== null && base.task.baselineDuration !== undefined ? `${base.task.baselineDuration}일` : "미설정"}</output>
                </div>
                <div className={styles.field}>
                  <span className={styles.fieldLabel}>파생 기준 종료일</span>
                  <output className={styles.outputField}>{base.task.baselineEnd ?? "미설정"}</output>
                </div>
              </div>
            ) : (
              <div className={styles.scheduleFields}>
                <label className={styles.field}>
                  기준 시작일
                  <input
                    name="task-baseline-start"
                    type="date"
                    min="1900-01-01"
                    max="2199-12-31"
                    value={draft.baselineStart}
                    readOnly={readOnly}
                    disabled={locked}
                    onChange={(event) => change("baselineStart", event.target.value)}
                  />
                </label>
                <label className={styles.field}>
                  기준 기간 (근무일)
                  <input
                    name="task-baseline-duration"
                    type="number"
                    min={base.task.type === "milestone" ? 0 : 1}
                    max="10000"
                    step="1"
                    value={draft.baselineDuration}
                    readOnly={readOnly || base.task.type === "milestone"}
                    disabled={locked}
                    onChange={(event) => change("baselineDuration", event.target.value)}
                  />
                </label>
                <div className={styles.field}>
                  <span className={styles.fieldLabel}>기준 종료일</span>
                  <output className={styles.outputField}>{draft.baselineEnd || base.task.baselineEnd || "미설정"}</output>
                </div>
              </div>
            )}
          </div>
          <details className={styles.metadata} open>
            <summary>서버 확정 정보</summary>
            <dl className={styles.confirmed}>
              <dt>저장된 요청 시작일</dt><dd>{base.task.requestedStart ?? "하위 작업 기준"}</dd>
              <dt>적용 시작일</dt><dd><output aria-label="적용 시작일">{base.task.start ?? "—"}</output></dd>
              <dt>확정 종료일</dt><dd><output aria-label="적용 종료일">{base.task.end ?? "—"}</output></dd>
              <dt>기준 Revision</dt><dd>{base.revision}</dd>
            </dl>
          </details>
          {hasLinks && !readOnly ? <p className={styles.caption}>관계에 따라 현재 적용 일정과 후행 작업 일정이 함께 조정됩니다.</p> : null}
          <p className={styles.caption}>요청 종료일은 요청 시작일과 기간을 현재 프로젝트 작업 캘린더로 계산한 편집 값입니다. 저장 시에는 요청 시작일과 기간만 전송하며, 서버가 최신 캘린더와 관계를 적용해 확정 시작일·종료일을 다시 계산합니다. URL은 http/https만 허용되며 링크는 일정 화면에서 새 탭으로 열립니다.</p>
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
                <p className={styles.sectionDescription}>현재 작업의 선행·후행 관계를 확인하고 기존 Relation Editor에서 추가·편집·삭제할 수 있습니다.</p>
              </div>
              <div className={styles.relationSectionActions}>
                <span className={styles.sectionCount}>{relationCount}건</span>
                {editable && base.task.type !== "summary" ? <button
                  ref={relationAddReference}
                  className="secondary-button"
                  disabled={relationMutationDisabled}
                  onClick={(event) => onRelationEditorOpen({ kind: "task", taskId: base.task.taskId }, event.currentTarget)}
                  type="button"
                >관계 추가</button> : null}
              </div>
            </div>
            {relationMutationBlockReason === "dirty" ? <p className={styles.relationMutationNotice} role="status">작업 정보에 저장하지 않은 변경사항이 있습니다. 관계를 변경하려면 작업 변경사항을 먼저 저장하거나 취소해 주세요.</p> : null}
            {!relationSnapshotMatches ? <p className={styles.relationError} role="alert">관계 정보의 기준 Revision이 변경되었습니다. 최신 정보를 다시 불러와 주세요.</p> : null}
            {relationDeleteTarget ? <div className={styles.relationDeleteConfirmation} role="alert">
              <p><strong>{relationDeleteTarget.direction === "predecessor" ? relationDeleteTarget.relatedTaskName : base.task.name} → {relationDeleteTarget.direction === "predecessor" ? base.task.name : relationDeleteTarget.relatedTaskName}</strong> ({relationDeleteTarget.type}, Lag {relationDeleteTarget.lag}) 관계를 삭제할까요?</p>
              <div className={styles.confirmationActions}>
                <button ref={relationDeleteCancelReference} className="secondary-button" disabled={locked} onClick={cancelRelationDelete} type="button">삭제 취소</button>
                <button className="danger-button" disabled={locked || relationMutationDisabled} onClick={() => void confirmRelationDelete()} type="button">{operation === "relation-delete" ? "삭제 중…" : "관계 삭제"}</button>
              </div>
            </div> : null}
            {relations ? <div className={styles.relationColumns}>
              <RelationList
                title="선행 작업"
                relations={relations.predecessors}
                showActions={editable}
                actionsDisabled={relationMutationDisabled}
                onEdit={(relation, trigger) => onRelationEditorOpen({ kind: "link", linkId: relation.id }, trigger)}
                onDelete={requestRelationDelete}
              />
              <RelationList
                title="후행 작업"
                relations={relations.successors}
                showActions={editable}
                actionsDisabled={relationMutationDisabled}
                onEdit={(relation, trigger) => onRelationEditorOpen({ kind: "link", linkId: relation.id }, trigger)}
                onDelete={requestRelationDelete}
              />
            </div> : null}
          </section>
        </section>

        <section
          className={styles.tabPanel}
          id="task-editor-panel-logistics"
          role="tabpanel"
          aria-labelledby="task-editor-tab-logistics"
          hidden={activeTab !== "logistics"}
          tabIndex={0}
        >
          <TaskLogisticsLinkEditor
            taskId={base.task.taskId}
            taskType={base.task.type}
            revision={base.revision}
            editable={editable}
            disabled={locked || readOnly || dirty}
            onApplied={reload}
            onSelectionCountChange={setLogisticsCount}
          />
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
});
