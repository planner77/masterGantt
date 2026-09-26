"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useSyncExternalStore, type FormEvent, type KeyboardEvent } from "react";
import { EmptyProjects } from "@/components/empty-projects";
import { ProjectRowActions } from "@/components/project-row-actions";
import { WorkspaceDialog } from "@/components/workspace-dialog";
import { useWorkspaceNotifications } from "@/components/workspace-notifications";
import type { ProjectListItemDto, ProjectStatus } from "@/contracts/projects";
import { PROJECT_STATUS_OPTIONS, projectStatusLabel } from "@/features/projects/project-status";
import {
  hasCurrentProjectEditSession,
  patchProjectStatus,
  readProjectStatusTarget,
  unlockProjectEditSession,
} from "@/features/projects/project-status-mutation";
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
type StatusTarget = { publicId: string; name: string; revision: number; nextStatus: ProjectStatus };

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
    <div className={styles.filterConditionRow}>
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
    </div>
    {error ? <p className={styles.filterError} role="alert">{error}</p> : null}
  </fieldset>;
}

function infoFilterSummary(filter: ProjectFilterState): string {
  const parts: string[] = [];
  if (filter.nameQuery.trim()) parts.push(`프로젝트명 “${filter.nameQuery.trim()}”`);
  if (filter.ownerQuery.trim()) parts.push(`소유자 “${filter.ownerQuery.trim()}”`);
  if (filter.descriptionQuery.trim()) parts.push(`설명 “${filter.descriptionQuery.trim()}”`);
  if (filter.ownerState !== "all") parts.push(`소유자 ${filter.ownerState === "assigned" ? "지정됨" : "미지정"}`);
  return parts.length ? parts.join(" · ") : "조건 없음";
}

function dateConditionSummary(label: string, operator: ProjectDateOperator, from: string, to: string): string | null {
  if (operator === "any") return null;
  if (operator === "range") return `${label} ${from || "미입력"} ~ ${to || "미입력"}`;
  const suffix = operator === "equals" ? "같음" : operator === "before" ? "이전" : "이후";
  return `${label} ${from || "미입력"} ${suffix}`;
}

function dateFilterSummary(filter: ProjectFilterState): string {
  return [
    dateConditionSummary("생성일", filter.createdOperator, filter.createdFrom, filter.createdTo),
    dateConditionSummary("최근 변경일", filter.updatedOperator, filter.updatedFrom, filter.updatedTo),
  ].filter((value): value is string => Boolean(value)).join(" · ") || "조건 없음";
}

export function ProjectList({ projects, projectUrls = {} }: Readonly<{
  projects: readonly ProjectListItemDto[]; projectUrls?: Readonly<Record<string, string | null>>;
}>) {
  const router = useRouter();
  const { notify, clearToast } = useWorkspaceNotifications();
  const [deletedIds, setDeletedIds] = useState<ReadonlySet<string>>(() => new Set());
  const [statusOverrides, setStatusOverrides] = useState<Readonly<Record<string, ProjectStatus>>>({});
  const [statusBusyId, setStatusBusyId] = useState<string>();
  const [statusTarget, setStatusTarget] = useState<StatusTarget | null>(null);
  const [statusPassword, setStatusPassword] = useState("");
  const [statusError, setStatusError] = useState<string | null>(null);
  const [filter, setFilter] = useState<ProjectFilterState>(EMPTY_PROJECT_FILTER);
  const [filterOpen, setFilterOpen] = useState(false);
  const [infoFilterOpen, setInfoFilterOpen] = useState(false);
  const [dateFilterOpen, setDateFilterOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string>();
  const [target, setTarget] = useState<DeleteTarget | null>(null);
  const [password, setPassword] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const mutation = useRef(false);
  const deleteTrigger = useRef<HTMLElement | null>(null);
  const filterTrigger = useRef<HTMLButtonElement | null>(null);
  const searchInput = useRef<HTMLInputElement | null>(null);
  const locales = useSyncExternalStore<DisplayLocales>(subscribeToLocaleChanges, browserLocales, () => SSR_DATE_LOCALE);
  const timeZone = useSyncExternalStore(subscribeToLocaleChanges, browserTimeZone, () => SSR_TIME_ZONE);
  const displayProjects = useMemo(
    () => projects.map((project) => statusOverrides[project.publicId] && statusOverrides[project.publicId] !== project.status
      ? { ...project, status: statusOverrides[project.publicId] }
      : project),
    [projects, statusOverrides],
  );
  const availableProjects = useMemo(() => displayProjects.filter(({ publicId }) => !deletedIds.has(publicId)), [deletedIds, displayProjects]);
  const validation = useMemo(() => validateProjectFilter(filter), [filter]);
  const hasValidationError = Boolean(validation.created || validation.updated);
  const effectiveFilter = useMemo(() => sanitizeInvalidProjectDateFilters(filter), [filter]);
  const visibleProjects = useMemo(
    () => filterProjectList(displayProjects, effectiveFilter, timeZone, deletedIds),
    [deletedIds, displayProjects, effectiveFilter, timeZone],
  );
  const activeFilters = activeProjectFilterCount(filter);
  const filterApplied = activeFilters > 0;
  const infoFilters = Number(Boolean(filter.nameQuery.trim())) + Number(Boolean(filter.ownerQuery.trim())) + Number(Boolean(filter.descriptionQuery.trim())) + Number(filter.ownerState !== "all");
  const dateFilters = Number(filter.createdOperator !== "any") + Number(filter.updatedOperator !== "any");

  function updateFilter(patch: Partial<ProjectFilterState>) {
    setFilter((current) => ({ ...current, ...patch }));
  }
  function toggleStatus(status: ProjectStatus, checked: boolean) {
    setFilter((current) => ({
      ...current,
      statuses: checked
        ? [...current.statuses, status]
        : current.statuses.filter((value) => value !== status),
    }));
  }
  function resetFilter() {
    setFilter(EMPTY_PROJECT_FILTER);
    requestAnimationFrame(() => searchInput.current?.focus({ preventScroll: true }));
  }
  function toggleFilterPanel() {
    if (filterOpen) {
      setFilterOpen(false);
      return;
    }
    setInfoFilterOpen(infoFilters > 0);
    setDateFilterOpen(dateFilters > 0 || hasValidationError);
    setFilterOpen(true);
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
  async function applyStatusChange(target: StatusTarget) {
    if (mutation.current) return;
    mutation.current = true;
    setStatusBusyId(target.publicId);
    setStatusError(null);
    clearToast();
    try {
      const { response, body, mutation: result } = await patchProjectStatus(target.publicId, target.revision, target.nextStatus);
      if (response.ok && result) {
        setStatusOverrides((current) => ({ ...current, [target.publicId]: result.data.project.status }));
        setStatusTarget(null);
        setStatusPassword("");
        notify("success", `${target.name} 상태를 ${projectStatusLabel(result.data.project.status)}(으)로 변경했습니다.`, "프로젝트 상태 변경");
        return;
      }
      if (response.status === 412) {
        const latest = await readProjectStatusTarget(target.publicId);
        if (latest) setStatusOverrides((current) => ({ ...current, [target.publicId]: latest.status }));
        setStatusTarget(null);
        setStatusPassword("");
        notify("error", "프로젝트가 다른 곳에서 변경되었습니다. 최신 상태를 반영했습니다. 확인 후 다시 변경해 주세요.", "프로젝트 상태 변경", body);
        return;
      }
      if (response.status === 401 || response.status === 403) {
        setStatusTarget(null);
        setStatusPassword("");
        notify("error", "편집 권한이 만료되었거나 현재 접속 주소에서 변경할 수 없습니다. 다시 상태 변경을 시작해 주세요.", "프로젝트 상태 변경", body);
        return;
      }
      notify("error", "프로젝트 상태를 변경할 수 없습니다. 현재 상태를 확인한 뒤 다시 시도해 주세요.", "프로젝트 상태 변경", body);
    } catch {
      notify("error", "서버 응답을 확인하지 못했습니다. 프로젝트 상태를 다시 확인한 뒤 재시도해 주세요.", "프로젝트 상태 변경");
    } finally {
      mutation.current = false;
      setStatusBusyId(undefined);
    }
  }
  async function prepareStatusChange(project: ProjectListItemDto, nextStatus: ProjectStatus) {
    if (mutation.current || statusBusyId || nextStatus === project.status) return;
    mutation.current = true;
    setStatusBusyId(project.publicId);
    setStatusError(null);
    clearToast();
    try {
      const latest = await readProjectStatusTarget(project.publicId);
      if (!latest) {
        notify("error", "프로젝트의 최신 상태를 읽지 못했습니다. 잠시 후 다시 시도해 주세요.", "프로젝트 상태 변경");
        return;
      }
      setStatusOverrides((current) => ({ ...current, [project.publicId]: latest.status }));
      if (latest.status === nextStatus) return;
      const target = { publicId: project.publicId, name: project.name, revision: latest.revision, nextStatus };
      if (await hasCurrentProjectEditSession(project.publicId)) {
        mutation.current = false;
        setStatusBusyId(undefined);
        await applyStatusChange(target);
        return;
      }
      setStatusTarget(target);
    } catch {
      notify("error", "편집 권한을 확인하지 못했습니다. 네트워크 연결을 확인해 주세요.", "프로젝트 상태 변경");
    } finally {
      if (mutation.current) {
        mutation.current = false;
        setStatusBusyId(undefined);
      }
    }
  }
  async function authorizeStatusChange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!statusTarget || mutation.current) return;
    const password = statusPassword;
    setStatusPassword("");
    if (Array.from(password).length < 1 || new TextEncoder().encode(password).byteLength > 1024) {
      setStatusError("편집 비밀번호를 입력해 주세요.");
      return;
    }
    mutation.current = true;
    setStatusBusyId(statusTarget.publicId);
    setStatusError(null);
    clearToast();
    try {
      const response = await unlockProjectEditSession(statusTarget.publicId, password);
      if (response.status !== 204) {
        const body: unknown = await response.json().catch(() => null);
        const message = response.status === 401 ? "편집 비밀번호가 올바르지 않습니다. 다시 확인해 주세요."
          : response.status === 429 ? "시도가 너무 많습니다. 잠시 후 다시 시도해 주세요."
            : "편집 권한을 확인할 수 없습니다. 잠시 후 다시 시도해 주세요.";
        setStatusError(message);
        notify("error", message, "프로젝트 상태 변경", body);
        return;
      }
      const target = statusTarget;
      mutation.current = false;
      setStatusBusyId(undefined);
      await applyStatusChange(target);
    } catch {
      setStatusError("네트워크 연결을 확인한 뒤 다시 시도해 주세요.");
      notify("error", "편집 권한을 확인하지 못했습니다. 네트워크 연결을 확인해 주세요.", "프로젝트 상태 변경");
    } finally {
      if (mutation.current) {
        mutation.current = false;
        setStatusBusyId(undefined);
      }
    }
  }
  function closeStatusChange() {
    if (mutation.current) return;
    setStatusTarget(null);
    setStatusPassword("");
    setStatusError(null);
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
      <div className={`project-filter-toolbar ${styles.filterToolbar}`} role="search" aria-label="프로젝트 검색과 필터">
        <label className="project-filter-search">
          <span className="sr-only">프로젝트 검색</span>
          <input ref={searchInput} aria-label="프로젝트명, 소유자 또는 설명 검색" placeholder="프로젝트 검색" type="search"
            value={filter.query} onChange={(event) => updateFilter({ query: event.target.value })} />
        </label>
        <button ref={filterTrigger} className={`secondary-button ${styles.filterTrigger}`} type="button" aria-expanded={filterOpen}
          aria-controls="project-list-advanced-filter" onClick={toggleFilterPanel}>
          필터{activeFilters ? ` ${activeFilters}` : ""}
        </button>
        {filterApplied ? <button className={`secondary-button ${styles.filterReset}`} type="button" onClick={resetFilter}>초기화</button> : null}
        <span className={`project-filter-result ${styles.filterResult}`} role="status">
          {`${visibleProjects.length} / ${availableProjects.length}개 프로젝트`}
        </span>
      </div>

      {filterOpen ? <div id="project-list-advanced-filter" className={`project-filter-panel ${styles.advancedFilterPanel}`} aria-label="프로젝트 고급 필터" onKeyDown={onFilterKeyDown}>
        <fieldset className={styles.statusFilter}>
          <legend>프로젝트 상태</legend>
          <div className={styles.statusOptions}>
            {PROJECT_STATUS_OPTIONS.map(({ value, label }) => <label key={value}>
              <input type="checkbox" checked={filter.statuses.includes(value)} onChange={(event) => toggleStatus(value, event.target.checked)} />
              {label}
            </label>)}
          </div>
          <p>처음에는 예정과 진행 중 프로젝트만 표시합니다. 완료 프로젝트는 선택하면 목록에 표시됩니다.</p>
        </fieldset>

        <details className={styles.filterDisclosure} open={infoFilterOpen} onToggle={(event) => setInfoFilterOpen(event.currentTarget.open)}>
          <summary>
            <span>프로젝트 정보</span>
            <span className={styles.filterSummary}>{infoFilters ? `${infoFilters}개 · ${infoFilterSummary(filter)}` : "조건 없음"}</span>
          </summary>
          <div className={styles.infoFilterGrid}>
            <div className={styles.filterConditionRow}>
              <label>프로젝트명 조건
                <select value={filter.nameOperator} onChange={(event) => updateFilter({ nameOperator: event.target.value as ProjectFilterState["nameOperator"] })}>
                  <option value="contains">포함</option><option value="not-contains">포함하지 않음</option><option value="equals">같음</option>
                </select>
              </label>
              <label>프로젝트명
                <input type="text" value={filter.nameQuery} onChange={(event) => updateFilter({ nameQuery: event.target.value })} />
              </label>
              {filter.nameQuery.trim() ? <button className="secondary-button" type="button" onClick={() => updateFilter({ nameQuery: "", nameOperator: "contains" })}>프로젝트명 조건 삭제</button> : null}
            </div>
            <div className={styles.filterConditionRow}>
              <label>소유자 조건
                <select value={filter.ownerOperator} onChange={(event) => updateFilter({ ownerOperator: event.target.value as ProjectFilterState["ownerOperator"] })}>
                  <option value="contains">포함</option><option value="not-contains">포함하지 않음</option><option value="equals">같음</option>
                </select>
              </label>
              <label>소유자
                <input type="text" value={filter.ownerQuery} onChange={(event) => updateFilter({ ownerQuery: event.target.value })} />
              </label>
              {filter.ownerQuery.trim() ? <button className="secondary-button" type="button" onClick={() => updateFilter({ ownerQuery: "", ownerOperator: "contains" })}>소유자 조건 삭제</button> : null}
            </div>
            <div className={styles.filterConditionRow}>
              <label>설명 조건
                <select value={filter.descriptionOperator} onChange={(event) => updateFilter({ descriptionOperator: event.target.value as ProjectFilterState["descriptionOperator"] })}>
                  <option value="contains">포함</option><option value="not-contains">포함하지 않음</option>
                </select>
              </label>
              <label>설명
                <input type="text" value={filter.descriptionQuery} onChange={(event) => updateFilter({ descriptionQuery: event.target.value })} />
              </label>
              {filter.descriptionQuery.trim() ? <button className="secondary-button" type="button" onClick={() => updateFilter({ descriptionQuery: "", descriptionOperator: "contains" })}>설명 조건 삭제</button> : null}
            </div>
            <div className={styles.filterConditionRow}>
              <label>소유자 지정 여부
                <select value={filter.ownerState} onChange={(event) => updateFilter({ ownerState: event.target.value as ProjectFilterState["ownerState"] })}>
                  <option value="all">전체</option><option value="assigned">지정됨</option><option value="unassigned">미지정</option>
                </select>
              </label>
              {filter.ownerState !== "all" ? <button className="secondary-button" type="button" onClick={() => updateFilter({ ownerState: "all" })}>소유자 지정 조건 삭제</button> : null}
            </div>
          </div>
        </details>

        <details className={styles.filterDisclosure} open={dateFilterOpen} onToggle={(event) => setDateFilterOpen(event.currentTarget.open)}>
          <summary>
            <span>날짜</span>
            <span className={styles.filterSummary}>{dateFilters ? `${dateFilters}개 · ${dateFilterSummary(filter)}` : "조건 없음"}</span>
          </summary>
          <div className={styles.dateFilterGrid}>
            <DateFilterFields prefix="created" label="생성일" operator={filter.createdOperator} from={filter.createdFrom} to={filter.createdTo}
              onChange={updateFilter} onClear={() => updateFilter({ createdOperator: "any", createdFrom: "", createdTo: "" })} error={validation.created} />
            <DateFilterFields prefix="updated" label="최근 변경일" operator={filter.updatedOperator} from={filter.updatedFrom} to={filter.updatedTo}
              onChange={updateFilter} onClear={() => updateFilter({ updatedOperator: "any", updatedFrom: "", updatedTo: "" })} error={validation.updated} />
          </div>
        </details>

        <div className={styles.filterFooter}>
          <span>{activeFilters}개 조건 적용 중{hasValidationError ? " · 날짜 조건을 확인해 주세요." : ""}</span>
          <button className="secondary-button" type="button" onClick={closeFilterWithFocus}>필터 닫기</button>
        </div>
      </div> : null}

      {visibleProjects.length === 0 ? <div className={styles.noResults} role="status">
        <h2>조건에 맞는 프로젝트가 없습니다.</h2>
        <p>{filter.statuses.length === 0
          ? "선택한 상태가 없습니다. 프로젝트 상태를 선택하거나 초기화해 주세요."
          : "검색어나 필터 조건을 변경하거나 초기화해 주세요. 완료 프로젝트는 상태 필터에서 선택할 수 있습니다."}</p>
        <button className="secondary-button" type="button" onClick={resetFilter}>검색/필터 초기화</button>
      </div> : <div className={styles.tableWrap}>
        <table aria-label="프로젝트 목록" className={styles.table}>
          <thead><tr><th scope="col">프로젝트</th><th scope="col">상태</th><th scope="col">소유자</th><th scope="col">설명</th><th scope="col">생성</th><th scope="col">최근 변경</th><th scope="col">작업</th></tr></thead>
          <tbody>{visibleProjects.map((project) => <tr key={project.publicId} data-project-id={project.publicId}>
            <td className={styles.nameCell}><Link className={styles.nameLink} href={projectPath(project.publicId)} onNavigate={() => { setFilter(EMPTY_PROJECT_FILTER); setFilterOpen(false); }}>{project.name}</Link></td>
            <td className={styles.statusCell}>
              <select
                aria-label={`${project.name} 프로젝트 상태`}
                className={`${styles.statusBadge} ${styles.statusSelect}`}
                data-status={project.status}
                disabled={statusBusyId === project.publicId || submitting}
                value={project.status}
                onChange={(event) => void prepareStatusChange(project, event.target.value as ProjectStatus)}
              >
                {PROJECT_STATUS_OPTIONS.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
              </select>
            </td>
            <td>{project.ownerName ?? "미지정"}</td>
            <td className={styles.descriptionCell}><span className={styles.description}>{project.description || "설명이 없습니다."}</span></td>
            <td className={styles.dateCell}>{formatLocaleDateTime(project.createdAt, locales, timeZone)}</td>
            <td className={styles.dateCell}>{formatLocaleDateTime(project.updatedAt, locales, timeZone)}</td>
            <td className={styles.actions}>
              <ProjectRowActions project={project} projectUrl={projectUrls[project.publicId] ?? null}
                disabled={deletingId !== undefined || statusBusyId !== undefined || submitting}
                onDelete={(selected, restoreTarget) => void prepareDelete(selected, restoreTarget)} />
            </td>
          </tr>)}</tbody>
        </table>
      </div>}
    </div>}
    {statusTarget ? <WorkspaceDialog title="프로젝트 상태 변경" onClose={closeStatusChange} busy={statusBusyId === statusTarget.publicId}>
      <p>“{statusTarget.name}” 프로젝트 상태를 <strong>{projectStatusLabel(statusTarget.nextStatus)}</strong>(으)로 변경하려면 편집 비밀번호를 입력해 주세요.</p>
      {statusError ? <p role="alert">{statusError}</p> : null}
      <form className="project-form compact-form" noValidate onSubmit={authorizeStatusChange}>
        <div className="form-field"><label htmlFor="status-project-password">편집 비밀번호</label>
          <input id="status-project-password" type="password" autoComplete="current-password"
            disabled={statusBusyId === statusTarget.publicId} value={statusPassword}
            onChange={(event) => setStatusPassword(event.target.value)} /></div>
        <button className="primary-button" type="submit" disabled={statusBusyId === statusTarget.publicId}>
          {statusBusyId === statusTarget.publicId ? "변경 중…" : "비밀번호 확인 후 상태 변경"}
        </button>
      </form>
    </WorkspaceDialog> : null}
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
