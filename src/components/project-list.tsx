"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useSyncExternalStore, type FormEvent, type KeyboardEvent } from "react";
import { EmptyProjects } from "@/components/empty-projects";
import { ProjectRowActions } from "@/components/project-row-actions";
import { WorkspaceDialog } from "@/components/workspace-dialog";
import { useWorkspaceNotifications } from "@/components/workspace-notifications";
import type { ProjectListItemDto } from "@/contracts/projects";
import {
  EMPTY_PROJECT_FILTER,
  activeProjectFilterCount,
  filterProjectList,
  sanitizeInvalidProjectDateFilters,
  validateProjectFilter,
  type ProjectDateOperator,
  type ProjectFilterState,
} from "@/features/projects/project-list-filter";
import { browserLocales, browserTimeZone, formatLocaleDateTime, SSR_DATE_LOCALE, SSR_TIME_ZONE, type DisplayLocales } from "@/lib/date-display";
import styles from "./project-list.module.css";

function subscribeToLocaleChanges(): () => void { return () => {}; }
function projectPath(publicId: string): string { return `/projects/${encodeURIComponent(publicId)}`; }
type DeleteTarget = { publicId: string; name: string; revision: number };

async function readCurrentProject(publicId: string): Promise<DeleteTarget | null> {
  const response = await fetch(`/api${projectPath(publicId)}`, { cache: "no-store", credentials: "same-origin" });
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok || typeof body !== "object" || body === null || !("data" in body)) return null;
  const data = body.data;
  if (typeof data !== "object" || data === null || !("project" in data)) return null;
  const project = data.project;
  if (typeof project !== "object" || project === null || !("name" in project) || typeof project.name !== "string" ||
    !("revision" in project) || typeof project.revision !== "number" || !Number.isSafeInteger(project.revision)) return null;
  return { publicId, name: project.name, revision: project.revision };
}

function DateFilterFields({ prefix, label, operator, from, to, onChange, onClear, error }: Readonly<{
  prefix: "created" | "updated";
  label: string;
  operator: ProjectDateOperator;
  from: string;
  to: string;
  onChange: (patch: Partial<ProjectFilterState>) => void;
  onClear: () => void;
  error: string | null;
}>) {
  const operatorKey = `${prefix}Operator` as const;
  const fromKey = `${prefix}From` as const;
  const toKey = `${prefix}To` as const;
  return <fieldset className={styles.filterGroup}>
    <legend>{label}</legend>
    <label>{label} 조건
      <select value={operator} onChange={(event) => onChange({ [operatorKey]: event.target.value as ProjectDateOperator })}>
        <option value="any">전체</option>
        <option value="equals">날짜가 같음</option>
        <option value="before">이전</option>
        <option value="after">이후</option>
        <option value="range">범위</option>
      </select>
    </label>
    {operator !== "any" ? <label>{operator === "range" ? "From" : "날짜"}
      <input type="date" value={from} onChange={(event) => onChange({ [fromKey]: event.target.value })} />
    </label> : null}
    {operator === "range" ? <label>To
      <input type="date" value={to} onChange={(event) => onChange({ [toKey]: event.target.value })} />
    </label> : null}
    {operator !== "any" ? <button className="secondary-button" type="button" onClick={onClear}>{label} 조건 삭제</button> : null}
    {error ? <p className={styles.filterError} role="alert">{error}</p> : null}
  </fieldset>;
}

export function ProjectList({ projects, projectUrls = {} }: Readonly<{
  projects: readonly ProjectListItemDto[]; projectUrls?: Readonly<Record<string, string | null>>;
}>) {
  const router = useRouter();
  const { notify, clearToast } = useWorkspaceNotifications();
  const [deletedIds, setDeletedIds] = useState<ReadonlySet<string>>(() => new Set());
  const [filter, setFilter] = useState<ProjectFilterState>(EMPTY_PROJECT_FILTER);
  const [filterOpen, setFilterOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string>();
  const [target, setTarget] = useState<DeleteTarget | null>(null);
  const [password, setPassword] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const mutation = useRef(false);
  const deleteTrigger = useRef<HTMLElement | null>(null);
  const filterTrigger = useRef<HTMLButtonElement | null>(null);
  const locales = useSyncExternalStore<DisplayLocales>(subscribeToLocaleChanges, browserLocales, () => SSR_DATE_LOCALE);
  const timeZone = useSyncExternalStore(subscribeToLocaleChanges, browserTimeZone, () => SSR_TIME_ZONE);
  const availableProjects = useMemo(() => projects.filter(({ publicId }) => !deletedIds.has(publicId)), [deletedIds, projects]);
  const validation = useMemo(() => validateProjectFilter(filter), [filter]);
  const hasValidationError = Boolean(validation.created || validation.updated);
  const effectiveFilter = useMemo(() => sanitizeInvalidProjectDateFilters(filter), [filter]);
  const visibleProjects = useMemo(
    () => filterProjectList(projects, effectiveFilter, timeZone, deletedIds),
    [deletedIds, effectiveFilter, projects, timeZone],
  );
  const activeFilters = activeProjectFilterCount(filter);
  const filterApplied = activeFilters > 0;

  function updateFilter(patch: Partial<ProjectFilterState>) {
    setFilter((current) => ({ ...current, ...patch }));
  }
  function resetFilter() {
    setFilter(EMPTY_PROJECT_FILTER);
  }
  function closeFilterWithFocus() {
    setFilterOpen(false);
    queueMicrotask(() => filterTrigger.current?.focus());
  }
  function onFilterKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      closeFilterWithFocus();
    }
  }
  function reportError(message: string, body?: unknown) {
    setDeleteError(message);
    notify("error", message, "프로젝트 삭제", body);
  }
  function closeDelete() {
    if (mutation.current) return;
    setTarget(null); setPassword(""); setDeleteError(null);
  }
  async function prepareDelete(project: ProjectListItemDto, trigger: HTMLElement) {
    if (mutation.current) return;
    deleteTrigger.current = trigger;
    mutation.current = true;
    setDeletingId(project.publicId); clearToast(); setDeleteError(null); setPassword("");
    try {
      const current = await readCurrentProject(project.publicId);
      if (!current) {
        reportError("프로젝트 정보를 다시 읽지 못했습니다. 목록을 새로고침해 주세요.");
        return;
      }
      setTarget(current);
    } catch {
      reportError("네트워크 연결을 확인한 뒤 다시 시도해 주세요.");
    } finally {
      mutation.current = false; setDeletingId(undefined);
    }
  }
  async function deleteProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!target || mutation.current) return;
    if (Array.from(password).length < 1 || new TextEncoder().encode(password).byteLength > 1024) {
      setPassword(""); reportError("삭제 확인 비밀번호를 입력해 주세요."); return;
    }
    const currentTarget = target;
    const submittedPassword = password;
    setPassword(""); setDeleteError(null); clearToast();
    mutation.current = true; setSubmitting(true);
    try {
      const authorization = await fetch(`/api${projectPath(currentTarget.publicId)}/edit-sessions`, {
        method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ editPassword: submittedPassword }),
      });
      if (authorization.status !== 204) {
        const body: unknown = await authorization.json().catch(() => null);
        reportError(authorization.status === 401 ? "편집 비밀번호가 올바르지 않습니다. 다시 확인해 주세요."
          : authorization.status === 429 ? "시도가 너무 많습니다. 잠시 후 다시 시도해 주세요."
            : "삭제 권한을 확인할 수 없습니다. 잠시 후 다시 시도해 주세요.", body);
        return;
      }
      const response = await fetch(`/api${projectPath(currentTarget.publicId)}`, {
        method: "DELETE", cache: "no-store", credentials: "same-origin",
        headers: { "If-Match": `"${currentTarget.revision}"` },
      });
      if (response.status === 204) {
        setTarget(null);
        setDeletedIds((current) => new Set(current).add(currentTarget.publicId));
        notify("success", "프로젝트를 삭제했습니다.", "프로젝트 삭제");
        router.refresh();
        return;
      }
      const body: unknown = await response.json().catch(() => null);
      if (response.status === 412) {
        setTarget(null);
        reportError("프로젝트가 변경되었습니다. 삭제 버튼을 다시 눌러 최신 정보를 확인해 주세요.", body);
      } else if (response.status === 401 || response.status === 403) {
        reportError("삭제 권한을 확인할 수 없습니다. 비밀번호와 접속 주소를 확인해 주세요.", body);
      } else {
        reportError("프로젝트를 삭제하지 못했습니다. 목록에서 삭제 여부를 확인한 뒤 다시 시도해 주세요.", body);
      }
    } catch {
      reportError("서버 응답을 확인하지 못했습니다. 목록에서 삭제 여부와 네트워크 연결을 확인해 주세요.");
    } finally {
      mutation.current = false; setSubmitting(false); setPassword("");
    }
  }

  return <>
    {availableProjects.length === 0 ? <EmptyProjects /> : <div className={styles.list} aria-label="프로젝트 목록">
      <div className="project-filter-toolbar" role="search" aria-label="프로젝트 검색과 필터">
        <label className="project-filter-search">
          <span className="sr-only">프로젝트 검색</span>
          <input aria-label="프로젝트명, 소유자 또는 설명 검색" placeholder="프로젝트 검색" type="search"
            value={filter.query} onChange={(event) => updateFilter({ query: event.target.value })} />
        </label>
        <button ref={filterTrigger} className="secondary-button" type="button" aria-expanded={filterOpen}
          aria-controls="project-list-advanced-filter" onClick={() => setFilterOpen((open) => !open)}>
          필터{activeFilters ? ` ${activeFilters}` : ""}
        </button>
        <button className="secondary-button" type="button" disabled={!filterApplied} onClick={resetFilter}>초기화</button>
        <span className="project-filter-result" role="status">
          {filterApplied ? `${visibleProjects.length} / ${availableProjects.length}개 프로젝트` : `${availableProjects.length}개의 프로젝트`}
        </span>
      </div>

      {filterOpen ? <div id="project-list-advanced-filter" className="project-filter-panel" aria-label="프로젝트 고급 필터" onKeyDown={onFilterKeyDown}>
        <div className="project-filter-grid">
          <label>프로젝트명 조건
            <select value={filter.nameOperator} onChange={(event) => updateFilter({ nameOperator: event.target.value as ProjectFilterState["nameOperator"] })}>
              <option value="contains">포함</option><option value="not-contains">포함하지 않음</option><option value="equals">같음</option>
            </select>
          </label>
          <label>프로젝트명
            <input type="text" value={filter.nameQuery} onChange={(event) => updateFilter({ nameQuery: event.target.value })} />
          </label>
          {filter.nameQuery.trim() ? <button className="secondary-button" type="button" onClick={() => updateFilter({ nameQuery: "", nameOperator: "contains" })}>프로젝트명 조건 삭제</button> : null}
          <label>소유자 조건
            <select value={filter.ownerOperator} onChange={(event) => updateFilter({ ownerOperator: event.target.value as ProjectFilterState["ownerOperator"] })}>
              <option value="contains">포함</option><option value="not-contains">포함하지 않음</option><option value="equals">같음</option>
            </select>
          </label>
          <label>소유자
            <input type="text" value={filter.ownerQuery} onChange={(event) => updateFilter({ ownerQuery: event.target.value })} />
          </label>
          {filter.ownerQuery.trim() ? <button className="secondary-button" type="button" onClick={() => updateFilter({ ownerQuery: "", ownerOperator: "contains" })}>소유자 조건 삭제</button> : null}
          <label>설명 조건
            <select value={filter.descriptionOperator} onChange={(event) => updateFilter({ descriptionOperator: event.target.value as ProjectFilterState["descriptionOperator"] })}>
              <option value="contains">포함</option><option value="not-contains">포함하지 않음</option>
            </select>
          </label>
          <label>설명
            <input type="text" value={filter.descriptionQuery} onChange={(event) => updateFilter({ descriptionQuery: event.target.value })} />
          </label>
          {filter.descriptionQuery.trim() ? <button className="secondary-button" type="button" onClick={() => updateFilter({ descriptionQuery: "", descriptionOperator: "contains" })}>설명 조건 삭제</button> : null}
          <label>소유자 지정 여부
            <select value={filter.ownerState} onChange={(event) => updateFilter({ ownerState: event.target.value as ProjectFilterState["ownerState"] })}>
              <option value="all">전체</option><option value="assigned">지정됨</option><option value="unassigned">미지정</option>
            </select>
          </label>
          {filter.ownerState !== "all" ? <button className="secondary-button" type="button" onClick={() => updateFilter({ ownerState: "all" })}>소유자 지정 조건 삭제</button> : null}
        </div>
        <DateFilterFields prefix="created" label="생성일" operator={filter.createdOperator} from={filter.createdFrom} to={filter.createdTo}
          onChange={updateFilter} onClear={() => updateFilter({ createdOperator: "any", createdFrom: "", createdTo: "" })} error={validation.created} />
        <DateFilterFields prefix="updated" label="최근 변경일" operator={filter.updatedOperator} from={filter.updatedFrom} to={filter.updatedTo}
          onChange={updateFilter} onClear={() => updateFilter({ updatedOperator: "any", updatedFrom: "", updatedTo: "" })} error={validation.updated} />
        <div className={styles.filterFooter}>
          <span>{activeFilters}개 조건 적용 중{hasValidationError ? " · 날짜 조건을 확인해 주세요." : ""}</span>
          <button className="secondary-button" type="button" onClick={closeFilterWithFocus}>필터 닫기</button>
        </div>
      </div> : null}

      {visibleProjects.length === 0 ? <div className={styles.noResults} role="status">
        <h2>조건에 맞는 프로젝트가 없습니다.</h2>
        <p>검색어나 필터 조건을 변경하거나 전체 조건을 초기화해 주세요.</p>
        <button className="secondary-button" type="button" onClick={resetFilter}>검색/필터 초기화</button>
      </div> : <div className={styles.tableWrap}>
        <table aria-label="프로젝트 목록" className={styles.table}>
          <thead><tr><th scope="col">프로젝트</th><th scope="col">소유자</th><th scope="col">설명</th><th scope="col">생성</th><th scope="col">최근 변경</th><th scope="col">작업</th></tr></thead>
          <tbody>{visibleProjects.map((project) => <tr key={project.publicId} data-project-id={project.publicId}>
            <td className={styles.nameCell}><Link className={styles.nameLink} href={projectPath(project.publicId)}>{project.name}</Link></td>
            <td>{project.ownerName ?? "미지정"}</td>
            <td className={styles.descriptionCell}><span className={styles.description}>{project.description || "설명이 없습니다."}</span></td>
            <td className={styles.dateCell}>{formatLocaleDateTime(project.createdAt, locales, timeZone)}</td>
            <td className={styles.dateCell}>{formatLocaleDateTime(project.updatedAt, locales, timeZone)}</td>
            <td className={styles.actions}>
              <ProjectRowActions project={project} projectUrl={projectUrls[project.publicId] ?? null}
                disabled={deletingId !== undefined || submitting}
                onDelete={(selected, restoreTarget) => void prepareDelete(selected, restoreTarget)} />
            </td>
          </tr>)}</tbody>
        </table>
      </div>}
    </div>}
    {target ? <WorkspaceDialog title="프로젝트 삭제" onClose={closeDelete} busy={submitting} restoreFocusRef={deleteTrigger}>
      <p>“{target.name}” 프로젝트와 포함된 모든 일정이 삭제됩니다. 이 작업은 복구할 수 없습니다.</p>
      <p>삭제하려면 이 프로젝트의 편집 비밀번호를 입력해 주세요.</p>
      {deleteError ? <p role="alert">{deleteError}</p> : null}
      <form className="project-form compact-form" noValidate onSubmit={deleteProject}>
        <div className="form-field"><label htmlFor="delete-project-password">삭제 확인 비밀번호</label>
          <input id="delete-project-password" type="password" autoComplete="current-password" disabled={submitting}
            value={password} onChange={(event) => setPassword(event.target.value)} /></div>
        <button className="primary-button" type="submit" disabled={submitting}>{submitting ? "삭제 중…" : "비밀번호 확인 후 삭제"}</button>
      </form>
    </WorkspaceDialog> : null}
  </>;
}
