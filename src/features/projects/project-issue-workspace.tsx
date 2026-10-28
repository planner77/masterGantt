"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import type { ProjectTaskDto } from "@/contracts/projects";
import type {
  IssuePageSize, IssueStatusFilter, ProjectIssueDto, ProjectIssueInput,
  ProjectIssueListResponse, ProjectIssueMutationResponse,
} from "@/contracts/project-issues";
import styles from "./project-issue-workspace.module.css";

type ResourceOption = { id: string; name: string; code: string | null };
type PersonKind = "reporter" | "assignee";
type Props = Readonly<{
  publicId: string;
  revision: number;
  tasks: readonly ProjectTaskDto[];
  active: boolean;
  editable: boolean;
  busy: boolean;
  onChanged: () => void;
  onUnauthorized: () => void;
}>;

function todayInProjectTimezone(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(date);
  const value = (type: string) => parts.find(part => part.type === type)?.value ?? "";
  return value("year") + "-" + value("month") + "-" + value("day");
}

function blankIssue(): ProjectIssueInput {
  return {
    title: "", description: "", reporterName: "", reporterResourceId: null,
    assigneeName: "", assigneeResourceId: null, occurredOn: todayInProjectTimezone(),
    completed: false, completedOn: null, relatedTaskId: null, relatedTaskText: "",
  };
}

function projectIssueError(value: unknown, fallback: string): string {
  if (value && typeof value === "object" && "error" in value) {
    const error = value.error as { message?: unknown; code?: unknown };
    if (typeof error?.message === "string" && error.message.length > 0) return error.message;
  }
  return fallback;
}

export function ProjectIssueWorkspace({
  publicId, revision, tasks, active, editable, busy, onChanged, onUnauthorized,
}: Props) {
  const [filterDraft, setFilterDraft] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<IssueStatusFilter>("all");
  const [limit, setLimit] = useState<IssuePageSize>(20);
  const [page, setPage] = useState(1);
  const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(false);
  const [list, setList] = useState<ProjectIssueListResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingIssue, setEditingIssue] = useState<ProjectIssueDto | null>(null);
  const [form, setForm] = useState<ProjectIssueInput>(blankIssue);
  const [saving, setSaving] = useState(false);
  const [issuePassword, setIssuePassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [projectPassword, setProjectPassword] = useState("");
  const [newIssuePassword, setNewIssuePassword] = useState("");
  const [newIssuePasswordConfirmation, setNewIssuePasswordConfirmation] = useState("");
  const [showRecovery, setShowRecovery] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [personPicker, setPersonPicker] = useState<PersonKind | null>(null);
  const [resources, setResources] = useState<ResourceOption[]>([]);
  const [resourceError, setResourceError] = useState<string | null>(null);
  const [taskPicker, setTaskPicker] = useState(false);
  const titleInput = useRef<HTMLInputElement>(null);
  const createTrigger = useRef<HTMLButtonElement>(null);
  const lastIssueTrigger = useRef<HTMLElement | null>(null);
  const rootPath = "/api/projects/" + encodeURIComponent(publicId) + "/issues";
  const locked = busy || saving || (editingIssue ? editingIssue.credentialState === "unconfigured" : !editable);
  const createLocked = !editable || busy || saving;
  const expectedRevision = () => Math.max(revision, list?.data.projectRevision ?? 0);
  const passwordValid = (password: string) => Array.from(password).length >= 8 &&
    Array.from(password).length <= 128 && !/[\\u0000-\\u001f\\u007f]/.test(password);

  useEffect(() => {
    if (!active) return;
    const controller = new AbortController();
    let mounted = true;
    const params = new URLSearchParams({
      q: query, status, page: String(page), limit: String(limit),
    });
    // Reflect the pending network operation from an asynchronous callback,
    // not synchronously inside the React effect body.
    void Promise.resolve().then(() => {
      if (!mounted) return;
      setLoading(true);
      setLoadError(null);
    });
    fetch(rootPath + "?" + params.toString(), { cache: "no-store", signal: controller.signal })
      .then(async response => {
        const body: unknown = await response.json();
        if (!response.ok) throw new Error(projectIssueError(body, "Issue 목록을 조회하지 못했습니다."));
        const result = body as ProjectIssueListResponse;
        if (!result.data || !Array.isArray(result.data.issues) ||
          !Number.isSafeInteger(result.data.total) || !result.data.summary ||
          !Number.isSafeInteger(result.data.summary.total)) throw new Error("Issue 응답을 확인할 수 없습니다.");
        return result;
      })
      .then(result => {
        if (!mounted) return;
        const maxPage = Math.max(1, Math.ceil(result.data.total / limit));
        if (page > maxPage) { setPage(maxPage); return; }
        setList(result);
      })
      .catch(error => {
        if (!mounted || controller.signal.aborted) return;
        setLoadError(error instanceof Error ? error.message : "Issue 목록을 조회하지 못했습니다.");
      })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; controller.abort(); };
  }, [active, rootPath, query, status, page, limit, refresh, revision]);

  useEffect(() => {
    if (!active || !editorOpen || personPicker === null) return;
    const controller = new AbortController();
    let mounted = true;
    const name = personPicker === "reporter" ? form.reporterName : form.assigneeName;
    const params = new URLSearchParams({ scope: "project", q: name, limit: "100" });
    fetch("/api/projects/" + encodeURIComponent(publicId) + "/resource-memberships?" + params.toString(),
      { cache: "no-store", signal: controller.signal })
      .then(async response => {
        const value: unknown = await response.json();
        if (!response.ok) throw new Error(projectIssueError(value, "리소스를 조회하지 못했습니다."));
        const data = value as { data?: { resources?: ResourceOption[] } };
        const resources = data.data?.resources;
        if (!Array.isArray(resources)) throw new Error("리소스 응답이 올바르지 않습니다.");
        return resources;
      })
      .then(value => { if (mounted) setResources(value); })
      .catch(error => {
        if (!mounted || controller.signal.aborted) return;
        setResourceError(error instanceof Error ? error.message : "리소스를 조회하지 못했습니다.");
        setResources([]);
      });
    return () => { mounted = false; controller.abort(); };
  }, [active, publicId, editorOpen, personPicker, form.reporterName, form.assigneeName]);

  function updateForm(patch: Partial<ProjectIssueInput>) {
    setForm(current => ({ ...current, ...patch }));
    setFormError(null);
  }

  function openEditor(issue: ProjectIssueDto | null, trigger?: HTMLElement) {
    if (issue === null && createLocked) return;
    setEditingIssue(issue);
    setForm(issue ? {
      title: issue.title, description: issue.description,
      reporterName: issue.reporterName, reporterResourceId: issue.reporterResourceId,
      assigneeName: issue.assigneeName, assigneeResourceId: issue.assigneeResourceId,
      occurredOn: issue.occurredOn, completed: issue.completed, completedOn: issue.completedOn,
      relatedTaskId: issue.relatedTaskId, relatedTaskText: issue.relatedTaskText,
    } : blankIssue());
    setPersonPicker(null);
    setTaskPicker(false);
    setFormError(null);
    setIssuePassword(""); setPasswordConfirmation("");
    setProjectPassword(""); setNewIssuePassword(""); setNewIssuePasswordConfirmation("");
    setShowRecovery(false); setConfirmDelete(false);
    setEditorOpen(true);
    lastIssueTrigger.current = trigger ?? createTrigger.current;
    requestAnimationFrame(() => titleInput.current?.focus({ preventScroll: true }));
  }

  function closeEditor() {
    if (saving) return;
    setEditorOpen(false);
    setIssuePassword(""); setPasswordConfirmation(""); setProjectPassword("");
    setNewIssuePassword(""); setNewIssuePasswordConfirmation("");
    setShowRecovery(false); setConfirmDelete(false);
    setPersonPicker(null);
    setTaskPicker(false);
    requestAnimationFrame(() => lastIssueTrigger.current?.isConnected
      ? lastIssueTrigger.current.focus({ preventScroll: true })
      : createTrigger.current?.focus({ preventScroll: true }));
  }

  function editorKeys(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape" && !saving) { event.stopPropagation(); closeEditor(); return; }
    if (event.key !== "Tab") return;
    const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(
      'input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled])'
    )).filter(element => element.getClientRects().length > 0);
    const first = controls[0], last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first && last) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last && first) {
      event.preventDefault(); first.focus();
    }
  }

  function failed(response: Response, body: unknown): Error {
    const code = body && typeof body === "object" && "error" in body
      ? (body.error as { code?: string })?.code : undefined;
    if (response.status === 401 && (code === "EDIT_SESSION_REQUIRED" || code === "PROJECT_LOCKED"))
      onUnauthorized();
    if (response.status === 412) onChanged();
    return new Error(projectIssueError(body, "Issue 요청에 실패했습니다."));
  }

  function finishMutation() {
    setIssuePassword(""); setPasswordConfirmation(""); setProjectPassword("");
    setNewIssuePassword(""); setNewIssuePasswordConfirmation("");
    setShowRecovery(false); setConfirmDelete(false);
    setEditorOpen(false); setPersonPicker(null); setTaskPicker(false);
    setRefresh(value => value + 1); onChanged();
    requestAnimationFrame(() => lastIssueTrigger.current?.isConnected
      ? lastIssueTrigger.current.focus({ preventScroll: true })
      : createTrigger.current?.focus({ preventScroll: true }));
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (locked || !form.title.trim() || !passwordValid(issuePassword)) {
      setFormError("Issue 비밀번호는 제어문자 없이 8~128자로 입력해 주세요."); return;
    }
    if (!editingIssue && issuePassword !== passwordConfirmation) {
      setFormError("Issue 비밀번호 확인이 일치하지 않습니다."); return;
    }
    setSaving(true); setFormError(null);
    try {
      const response = await fetch(rootPath + (editingIssue ? "/" + encodeURIComponent(editingIssue.issueId) : ""), {
        method: editingIssue ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json", "If-Match": '"' + expectedRevision() + '"' },
        credentials: "same-origin",
        body: JSON.stringify({ ...form, issuePassword,
          ...(!editingIssue ? { confirmIssuePassword: passwordConfirmation } : {}) }),
      });
      const body: unknown = await response.json();
      if (!response.ok) throw failed(response, body);
      const result = body as ProjectIssueMutationResponse;
      if (!result.data?.issue || !Number.isSafeInteger(result.data.projectRevision))
        throw new Error("저장 결과를 확인할 수 없습니다. 목록을 다시 조회해 주세요.");
      setList(current => current && { data: { ...current.data, projectRevision: result.data.projectRevision } });
      finishMutation();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Issue 저장에 실패했습니다.");
      setRefresh(value => value + 1);
    } finally { setSaving(false); }
  }

  async function deleteIssue() {
    if (!editingIssue || saving || !confirmDelete || !passwordValid(issuePassword)) {
      setFormError("삭제하려면 해당 Issue 비밀번호를 입력해 주세요."); return;
    }
    setSaving(true); setFormError(null);
    try {
      const response = await fetch(rootPath + "/" + encodeURIComponent(editingIssue.issueId), {
        method: "DELETE",
        headers: { "Content-Type": "application/json", "If-Match": '"' + expectedRevision() + '"' },
        credentials: "same-origin", body: JSON.stringify({ issuePassword }),
      });
      const body: unknown = await response.json();
      if (!response.ok) throw failed(response, body);
      if (!(body as { data?: { deleted?: boolean } }).data?.deleted)
        throw new Error("삭제 결과를 확인하지 못했습니다. 다시 조회해 주세요.");
      finishMutation();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Issue 삭제에 실패했습니다.");
      setRefresh(value => value + 1);
    } finally { setSaving(false); }
  }

  async function recoverCredential() {
    if (!editingIssue || !editable || saving || !showRecovery ||
      !passwordValid(newIssuePassword) || newIssuePassword !== newIssuePasswordConfirmation || !projectPassword) {
      setFormError("프로젝트 비밀번호와 새 Issue 비밀번호·확인을 입력해 주세요."); return;
    }
    setSaving(true); setFormError(null);
    try {
      const response = await fetch(rootPath + "/" + encodeURIComponent(editingIssue.issueId) + "/credential", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "If-Match": '"' + expectedRevision() + '"' },
        credentials: "same-origin",
        body: JSON.stringify({ operation: editingIssue.credentialState === "unconfigured" ? "initialize" : "reset",
          projectPassword, newPassword: newIssuePassword, confirmPassword: newIssuePasswordConfirmation }),
      });
      const body: unknown = await response.json();
      if (!response.ok) throw failed(response, body);
      const result = body as ProjectIssueMutationResponse;
      if (!result.data?.issue) throw new Error("비밀번호 설정 결과를 확인할 수 없습니다.");
      setEditingIssue(result.data.issue);
      setList(current => current && { data: { ...current.data, projectRevision: result.data.projectRevision } });
      setShowRecovery(false); setProjectPassword(""); setNewIssuePassword(""); setNewIssuePasswordConfirmation("");
      setIssuePassword(""); setRefresh(value => value + 1); onChanged();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "비밀번호 설정에 실패했습니다.");
      setRefresh(value => value + 1);
    } finally { setSaving(false); }
  }

  function personField(kind: PersonKind, label: string) {
    const nameKey = kind === "reporter" ? "reporterName" : "assigneeName";
    const idKey = kind === "reporter" ? "reporterResourceId" : "assigneeResourceId";
    const selected = personPicker === kind;
    return <div className={styles.field}>
      <label htmlFor={"project-issue-" + nameKey}>{label}</label>
      <div className={styles.inline}>
        <input id={"project-issue-" + nameKey} type="text" maxLength={120}
          value={form[nameKey]} disabled={locked}
          onChange={event => { updateForm({ [nameKey]: event.target.value, [idKey]: null }); setResourceError(null); }} />
        <button className="secondary-button" type="button" disabled={locked}
          aria-expanded={selected} aria-controls={"project-issue-picker-" + kind}
          onClick={() => { setPersonPicker(selected ? null : kind); setResources([]); setResourceError(null); }}>
          리소스 검색
        </button>
      </div>
      {form[idKey] ? <span className={styles.hint}>선택한 리소스: {form[nameKey]}</span> : null}
      {selected ? <div id={"project-issue-picker-" + kind} className={styles.picker} aria-label={label + " 리소스 검색 결과"}>
        {resourceError ? <p role="alert">{resourceError}</p> : resources.length === 0 ? <p>검색 결과가 없습니다. 직접 입력할 수도 있습니다.</p> :
          <ul>{resources.map(person => <li key={person.id}><button type="button"
            onClick={() => { updateForm({ [nameKey]: person.name, [idKey]: person.id }); setPersonPicker(null); }}>
            {person.name}{person.code ? " · " + person.code : ""}
          </button></li>)}</ul>}
      </div> : null}
    </div>;
  }

  const data = list?.data;
  const summary = data?.summary;
  const maxPage = data ? Math.max(1, Math.ceil(data.total / limit)) : 1;
  const relatedTasks = tasks.filter(task =>
    (task.name + " " + task.externalId).toLocaleLowerCase().includes(form.relatedTaskText.trim().toLocaleLowerCase()))
    .slice(0, 100);

  return <div className={styles.workspace} data-testid="project-issue-workspace">
    <div className={styles.toolbar}>
      <div className={styles.progress} role="status" aria-live="polite">
        {summary ? <><strong>완료 {summary.completed} / 전체 {summary.total}</strong>
          <span>({summary.total ? (100 * summary.completed / summary.total).toFixed(1) : "0.0"}%)</span></>
          : <span>전체 Issue 집계 조회 중</span>}
      </div>
      <button ref={createTrigger} className="primary-button" type="button" disabled={createLocked}
        onClick={event => openEditor(null, event.currentTarget)}>Issue 등록</button>
    </div>
    <form className={styles.filters} onSubmit={event => {
      event.preventDefault(); setQuery(filterDraft.trim()); setPage(1);
    }} role="search" aria-label="Issue 검색">
      <label htmlFor="project-issue-query">검색</label>
      <input id="project-issue-query" type="search" maxLength={160}
        placeholder="제목·내용·등록자·담당자·관련 Task" value={filterDraft}
        onChange={event => setFilterDraft(event.target.value)} />
      <label htmlFor="project-issue-status">완료 상태</label>
      <select id="project-issue-status" value={status} onChange={event => {
        setStatus(event.target.value as IssueStatusFilter); setPage(1);
      }}>
        <option value="all">전체</option><option value="open">미완료</option><option value="completed">완료</option>
      </select>
      <button className="secondary-button" type="submit">검색</button>
      {(query || status !== "all") ? <button className="secondary-button" type="button"
        onClick={() => { setFilterDraft(""); setQuery(""); setStatus("all"); setPage(1); }}>초기화</button> : null}
    </form>
    <div className={styles.listMeta}>
      <span role="status">{loadError ? "목록 조회 실패" : loading ? "목록 조회 중…" :
        data ? "검색 결과 " + data.total + "건" : "목록 준비 중"}</span>
    </div>
    {loadError ? <div className={styles.error} role="alert">{loadError}
      <button type="button" className="secondary-button" onClick={() => setRefresh(value => value + 1)}>다시 조회</button>
    </div> : null}
    <div className={styles.tableScroller} role="region" aria-label="Issue 목록 가로 스크롤" tabIndex={0}>
      <table className={styles.table}>
        <thead><tr><th scope="col">Issue명</th><th scope="col">완료 여부</th><th scope="col">담당자</th><th scope="col">발생일</th><th scope="col">완료일</th></tr></thead>
        <tbody>
          {data?.issues.map(issue => <tr key={issue.issueId}>
            <td><button className={styles.titleButton} type="button" onClick={event => openEditor(issue, event.currentTarget)}>{issue.title}</button></td>
            <td>{issue.completed ? "완료" : "미완료"}</td>
            <td>{issue.assigneeName || "미지정"}</td>
            <td>{issue.occurredOn}</td>
            <td>{issue.completedOn ?? "—"}</td>
          </tr>)}
          {data?.issues.length === 0 ? <tr><td colSpan={5} className={styles.empty}>
            {query || status !== "all" ? "검색 조건에 맞는 Issue가 없습니다." : "등록된 Issue가 없습니다."}
          </td></tr> : null}
          {!data ? <tr><td colSpan={5} className={styles.empty}>Issue 목록을 불러오는 중입니다.</td></tr> : null}
        </tbody>
      </table>
    </div>
    <div className={styles.footer}>
      <label htmlFor="project-issue-page-size">페이지당</label>
      <select id="project-issue-page-size" value={limit} onChange={event => {
        setLimit(Number(event.target.value) as IssuePageSize); setPage(1);
      }}>{([10, 20, 50, 100] as const).map(size => <option key={size} value={size}>{size}건</option>)}</select>
      <span>{page} / {maxPage} 페이지</span>
      <button type="button" className="secondary-button" disabled={loading || page <= 1} onClick={() => setPage(value => value - 1)}>이전</button>
      <button type="button" className="secondary-button" disabled={loading || page >= maxPage} onClick={() => setPage(value => value + 1)}>다음</button>
    </div>

    {editorOpen ? <div className={styles.editor} role="dialog" aria-modal="true"
      aria-label={editingIssue ? "Issue 상세 및 수정" : "Issue 등록"} onKeyDown={editorKeys}>
      <div className={styles.editorHeader}>
        <h2>{editingIssue ? "Issue 상세 및 수정" : "Issue 등록"}</h2>
        <button type="button" className="secondary-button" disabled={saving}
          onClick={closeEditor} aria-label="Issue 편집 닫기">닫기</button>
      </div>
      <form onSubmit={event => void save(event)} className={styles.editorForm}>
        <div className={styles.field}>
          <label htmlFor="project-issue-title">Issue 명 *</label>
          <input ref={titleInput} id="project-issue-title" required type="text" maxLength={160}
            value={form.title} onChange={event => updateForm({ title: event.target.value })} disabled={locked} />
        </div>
        <div className={styles.twoColumns}>
          <div className={styles.field}><label htmlFor="project-issue-created">등록일</label>
            <input id="project-issue-created" type="date" readOnly
              value={editingIssue ? todayInProjectTimezone(new Date(editingIssue.createdAt)) : todayInProjectTimezone()} /></div>
          <div className={styles.field}><label htmlFor="project-issue-occurred">발생일</label>
            <input id="project-issue-occurred" type="date" required value={form.occurredOn}
              onChange={event => updateForm({ occurredOn: event.target.value })} disabled={locked} /></div>
        </div>
        <div className={styles.twoColumns}>
          {personField("reporter", "등록자")}
          {personField("assignee", "담당자")}
        </div>
        <div className={styles.completion}>
          <label className={styles.checkLabel} htmlFor="project-issue-completed">
            <input id="project-issue-completed" type="checkbox" checked={form.completed} disabled={locked}
              onChange={event => updateForm({
                completed: event.target.checked,
                completedOn: event.target.checked ? todayInProjectTimezone() : null,
              })} />
            완료
          </label>
          <label htmlFor="project-issue-completed-on">완료일</label>
          <input id="project-issue-completed-on" type="date" disabled={locked || !form.completed}
            value={form.completedOn ?? ""} onChange={event => updateForm({ completedOn: event.target.value || null })} />
        </div>
        <div className={styles.field}><label htmlFor="project-issue-task">관련 Task</label>
          <div className={styles.inline}>
            <input id="project-issue-task" type="text" maxLength={200} disabled={locked}
              value={form.relatedTaskText} onChange={event => updateForm({
                relatedTaskText: event.target.value, relatedTaskId: null,
              })} />
            <button className="secondary-button" type="button" disabled={locked}
              aria-expanded={taskPicker} aria-controls="project-issue-task-picker"
              onClick={() => setTaskPicker(current => !current)}>Task 검색</button>
          </div>
          {form.relatedTaskId ? <span className={styles.hint}>연결된 Task: {form.relatedTaskText}</span> : null}
          {taskPicker ? <div className={styles.picker} id="project-issue-task-picker" aria-label="관련 Task 검색 결과">
            {relatedTasks.length ? <ul>{relatedTasks.map(task => <li key={task.taskId}><button type="button"
              onClick={() => { updateForm({ relatedTaskText: task.name, relatedTaskId: task.taskId }); setTaskPicker(false); }}>
              {task.name} · {task.type === "milestone" ? "Milestone" : task.type === "summary" ? "Summary" : "Task"}
            </button></li>)}</ul> : <p>일치하는 Task가 없습니다. 직접 입력할 수도 있습니다.</p>}
          </div> : null}
        </div>
        <div className={styles.field}><label htmlFor="project-issue-description">Issue 내용</label>
          <textarea id="project-issue-description" rows={4} maxLength={4000}
            value={form.description} disabled={locked}
            onChange={event => updateForm({ description: event.target.value })} />
        </div>
        <div className={styles.field}>
          <label htmlFor="project-issue-password">
            {editingIssue ? "Issue 비밀번호 (수정·삭제 시 필요)" : "Issue 비밀번호 *"}
          </label>
          <input id="project-issue-password" type="password" minLength={8} maxLength={128}
            autoComplete="off" value={issuePassword} required={editingIssue?.credentialState !== "unconfigured"}
            disabled={busy || saving || editingIssue?.credentialState === "unconfigured"}
            onChange={event => { setIssuePassword(event.target.value); setFormError(null); }} />
          <span className={styles.hint}>프로젝트 비밀번호와 별개로 Issue별 8~128자를 사용합니다.</span>
        </div>
        {!editingIssue ? <div className={styles.field}>
          <label htmlFor="project-issue-password-confirmation">Issue 비밀번호 확인 *</label>
          <input id="project-issue-password-confirmation" type="password" minLength={8} maxLength={128}
            autoComplete="new-password" required value={passwordConfirmation} disabled={busy || saving}
            onChange={event => { setPasswordConfirmation(event.target.value); setFormError(null); }} />
        </div> : null}
        {editingIssue?.credentialState === "unconfigured" ? <p className={styles.hint} role="status">
          기존 Issue의 비밀번호가 아직 설정되지 않았습니다. 프로젝트 편집 권한자가 먼저 설정해야 수정·삭제할 수 있습니다.
        </p> : null}
        {editingIssue && editable ? <div className={styles.field}>
          <button type="button" className="secondary-button" aria-expanded={showRecovery}
            disabled={busy || saving} onClick={() => { setShowRecovery(value => !value); setFormError(null); }}>
            {editingIssue.credentialState === "unconfigured" ? "Issue 비밀번호 최초 설정" : "Issue 비밀번호 재설정"}
          </button>
          {showRecovery ? <div className={styles.securityPanel}>
            <span className={styles.hint}>현재 프로젝트 편집 세션과 프로젝트 비밀번호를 함께 확인합니다.</span>
            <label htmlFor="project-issue-project-password">프로젝트 비밀번호</label>
            <input id="project-issue-project-password" type="password" autoComplete="off" value={projectPassword}
              disabled={saving} onChange={event => setProjectPassword(event.target.value)} />
            <label htmlFor="project-issue-new-password">새 Issue 비밀번호</label>
            <input id="project-issue-new-password" type="password" autoComplete="new-password"
              minLength={8} maxLength={128} value={newIssuePassword}
              disabled={saving} onChange={event => setNewIssuePassword(event.target.value)} />
            <label htmlFor="project-issue-new-password-confirmation">새 Issue 비밀번호 확인</label>
            <input id="project-issue-new-password-confirmation" type="password" autoComplete="new-password"
              minLength={8} maxLength={128} value={newIssuePasswordConfirmation}
              disabled={saving} onChange={event => setNewIssuePasswordConfirmation(event.target.value)} />
            <button type="button" className="secondary-button" disabled={busy || saving || !projectPassword}
              onClick={() => void recoverCredential()}>{saving ? "설정 중…" : "비밀번호 설정/재설정"}</button>
          </div> : null}
        </div> : null}
        {editingIssue?.credentialState === "protected" ? <div className={styles.securityPanel}>
          {!confirmDelete ? <button type="button" className="secondary-button" disabled={busy || saving}
            onClick={() => { setConfirmDelete(true); setFormError(null); }}>Issue 삭제…</button> :
            <div className={styles.deletePanel} role="group" aria-label="Issue 삭제 확인">
              <p>Issue를 목록에서 숨기며 데이터는 보존됩니다. 이 화면에서 복구할 수 없습니다.</p>
              <div className={styles.editorActions}>
                <button type="button" className="secondary-button" disabled={saving}
                  onClick={() => setConfirmDelete(false)}>삭제 취소</button>
                <button type="button" className="secondary-button" disabled={saving || !passwordValid(issuePassword)}
                  onClick={() => void deleteIssue()}>{saving ? "삭제 중…" : "삭제 확인"}</button>
              </div>
            </div>}
        </div> : null}
        {formError ? <p className={styles.error} role="alert">{formError}</p> : null}
        <div className={styles.editorActions}>
          <button type="button" className="secondary-button" disabled={saving} onClick={closeEditor}>취소</button>
          <button type="submit" className="primary-button" disabled={locked || !form.title.trim() || !passwordValid(issuePassword) ||
              (!editingIssue && passwordConfirmation !== issuePassword)}>
            {saving ? "저장 중…" : editingIssue ? "수정 저장" : "등록"}
          </button>
        </div>
      </form>
    </div> : null}
  </div>;
}
