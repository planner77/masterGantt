"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import type {
  AssignedTargetsResponse,
  AssignmentTargetDto,
  AssignmentTargetsResponse,
  ResourceRole,
} from "@/contracts/resources";
import styles from "./project-task-editor.module.css";

interface Props {
  readonly taskId: string;
  readonly revision: number;
  readonly editable: boolean;
  readonly disabled: boolean;
  readonly onApplied: () => Promise<void>;
  readonly onUnauthorized?: () => void;
  readonly onPendingChange?: (pending: boolean) => void;
  readonly onDirtyChange?: (dirty: boolean) => void;
  readonly discardGeneration?: number;
  readonly onSelectionCountChange?: (count: number) => void;
}

type AllocationDraft = { start: string; end: string; percent: string };
type AssignmentRoleDraft = ResourceRole | "";
type AllocationField = "role" | "end" | "percent";
type AllocationIssue = { key: string; field: AllocationField; label: string; message: string };

const RESOURCE_ROLES: readonly ResourceRole[] = ["PI", "DEVELOPER", "EQUIPMENT_OWNER"];
const ROLE_LABEL: Record<ResourceRole, string> = {
  PI: "PI",
  DEVELOPER: "개발자",
  EQUIPMENT_OWNER: "설비 담당",
};
function isResourceRole(value: unknown): value is ResourceRole {
  return typeof value === "string" && RESOURCE_ROLES.includes(value as ResourceRole);
}

function projectIdFromPathname(pathname: string): string | null {
  const match = /^\/projects\/([^/]+)\/?$/.exec(pathname);
  if (!match) return null;
  try { return decodeURIComponent(match[1]); } catch { return null; }
}
function isAssignedResponse(value: unknown): value is AssignedTargetsResponse {
  if (!value || typeof value !== "object" || !("data" in value)) return false;
  const data = value.data;
  return !!data && typeof data === "object" && "projectRevision" in data && typeof data.projectRevision === "number" &&
    "catalogRevision" in data && typeof data.catalogRevision === "number" && "assignments" in data && Array.isArray(data.assignments) && data.assignments.every((item) => item && typeof item.taskId === "string" && isTargetRef(item.target) && (!("role" in item) || item.role === null || isResourceRole(item.role)) && (!item.allocation || ((item.allocation.start === null || typeof item.allocation.start === "string") && (item.allocation.end === null || typeof item.allocation.end === "string") && (item.allocation.percent === null || typeof item.allocation.percent === "number")))) && "targets" in data && Array.isArray(data.targets) && data.targets.every(isTarget);
}
function isTargetsResponse(value: unknown): value is AssignmentTargetsResponse {
  if (!value || typeof value !== "object" || !("data" in value)) return false;
  const data = value.data;
  return !!data && typeof data === "object" && "catalogRevision" in data && typeof data.catalogRevision === "number" && "targets" in data && Array.isArray(data.targets) && data.targets.every(isTarget);
}
function isTargetRef(value: unknown): boolean {
  return !!value && typeof value === "object" && "id" in value && typeof value.id === "string" &&
    "kind" in value && (value.kind === "resource" || value.kind === "group");
}
function isTarget(value: unknown): value is AssignmentTargetDto {
  return !!value && typeof value === "object" && "id" in value && typeof value.id === "string" &&
    "kind" in value && (value.kind === "resource" || value.kind === "group") &&
    "name" in value && typeof value.name === "string" && "active" in value && typeof value.active === "boolean" &&
    (!("code" in value) || value.code === null || typeof value.code === "string") &&
    (!("roles" in value) || (Array.isArray(value.roles) && value.roles.every(isResourceRole)));
}
function targetKey(target: Pick<AssignmentTargetDto, "kind" | "id">): string { return `${target.kind}:${target.id}`; }

export function TaskAssignmentEditor({ taskId, revision, editable, disabled, onApplied, onSelectionCountChange, onDirtyChange, onPendingChange, onUnauthorized, discardGeneration = 0 }: Props) {
  const initialDraft = useRef<string | null>(null);
  const dirtyReference = useRef(false);
  const loadedDiscardGeneration = useRef(discardGeneration);
  const [targets, setTargets] = useState<AssignmentTargetDto[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [allocations, setAllocations] = useState<Record<string, AllocationDraft>>({});
  const [roleDrafts, setRoleDrafts] = useState<Record<string, AssignmentRoleDraft>>({});
  const [legacyUnspecified, setLegacyUnspecified] = useState<Set<string>>(new Set());
  const [catalogRevision, setCatalogRevision] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  useEffect(() => { onPendingChange?.(saving); }, [saving, onPendingChange]);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [kindFilter, setKindFilter] = useState<"all" | "resource" | "group">("all");
  const [roleFilter, setRoleFilter] = useState<"all" | ResourceRole>("all");
  const [roleCandidatesLoading, setRoleCandidatesLoading] = useState(false);
  const [assignedOnly, setAssignedOnly] = useState(false);
  const [allocationIssues, setAllocationIssues] = useState<AllocationIssue[]>([]);
  const issueSummary = useRef<HTMLDivElement>(null);

  const [retry, setRetry] = useState(0);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const snapshotKey = `${taskId}:${revision}:${editable}:${retry}:${discardGeneration}`;
  const ready = loadedKey === snapshotKey && !loading;

  useEffect(() => {
    let alive = true;
    const controller = new AbortController();
    void (async () => {
      await Promise.resolve(); if (!alive) return;
      const publicId = projectIdFromPathname(window.location.pathname);
      if (!publicId) { setLoading(false); setError("프로젝트 경로를 확인할 수 없습니다."); return; }
      if (dirtyReference.current && loadedDiscardGeneration.current === discardGeneration) { setLoading(false); setError("기준 정보 또는 권한이 변경되었습니다. 리소스 초안은 유지됩니다. 최신 정보 다시 불러오기에서 명시적으로 폐기하고 검토해 주세요."); return; }
      loadedDiscardGeneration.current = discardGeneration;
      setLoading(true); setLoadedKey(null); setError(null);
      try {
        const assignedResponse = await fetch(`/api/projects/${encodeURIComponent(publicId)}/assigned-targets`, { credentials: "same-origin", cache: "no-store", signal: controller.signal });
        const assignedBody: unknown = await assignedResponse.json().catch(() => null);
        if (!assignedResponse.ok || !isAssignedResponse(assignedBody) || assignedBody.data.projectRevision !== revision) throw new Error("assigned");
        if (!alive) return;
        const taskAssignments = assignedBody.data.assignments.filter((assignment) => assignment.taskId === taskId);
        setSelected(new Set(taskAssignments.map((assignment) => `${assignment.target.kind}:${assignment.target.id}`)));
        const nextAllocations: Record<string, AllocationDraft> = {};
        const nextRoleDrafts: Record<string, AssignmentRoleDraft> = {};
        const nextLegacyUnspecified = new Set<string>();
        for (const assignment of taskAssignments) {
          if (assignment.target.kind !== "resource") continue;
          const key = `${assignment.target.kind}:${assignment.target.id}`;
          nextAllocations[key] = {
            start: assignment.allocation?.start ?? "",
            end: assignment.allocation?.end ?? "",
            percent: assignment.allocation?.percent === null || assignment.allocation?.percent === undefined ? "" : String(assignment.allocation.percent),
          };
          nextRoleDrafts[key] = assignment.role ?? "";
          if (assignment.role === null || assignment.role === undefined) nextLegacyUnspecified.add(key);
        }
        initialDraft.current = JSON.stringify({ selected: taskAssignments.map((assignment) => `${assignment.target.kind}:${assignment.target.id}`).sort(), allocations: nextAllocations, roles: nextRoleDrafts });
        dirtyReference.current = false;
        onDirtyChange?.(false);
        setAllocations(nextAllocations);
        setRoleDrafts(nextRoleDrafts);
        setLegacyUnspecified(nextLegacyUnspecified);
        setTargets(assignedBody.data.targets);
        setCatalogRevision(assignedBody.data.catalogRevision);
        if (editable) {
          const candidatesResponse = await fetch(`/api/projects/${encodeURIComponent(publicId)}/assignment-targets`, { credentials: "same-origin", cache: "no-store", signal: controller.signal });
          const candidatesBody: unknown = await candidatesResponse.json().catch(() => null);
          if (!candidatesResponse.ok || !isTargetsResponse(candidatesBody)) throw new Error("candidates");
          if (!alive) return;
          const merged = new Map<string, AssignmentTargetDto>();
          for (const target of assignedBody.data.targets) merged.set(targetKey(target), target);
          for (const target of candidatesBody.data.targets) merged.set(targetKey(target), target);
          setTargets([...merged.values()].sort((left, right) => left.name.localeCompare(right.name, "ko")));
          if (candidatesBody.data.catalogRevision !== assignedBody.data.catalogRevision) throw new Error("catalog_changed");
          setCatalogRevision(candidatesBody.data.catalogRevision);
        }
        setLoadedKey(snapshotKey);
      } catch { if (alive) setError("할당 정보를 불러오지 못했습니다. 편집 권한과 네트워크 상태를 확인해 주세요."); }
      finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; controller.abort(); };
  }, [editable, taskId, revision, retry, snapshotKey, onDirtyChange, discardGeneration]);

  useEffect(() => {
    if (!editable || !ready || roleFilter === "all" || catalogRevision === null) return;
    let alive = true;
    const controller = new AbortController();
    const publicId = projectIdFromPathname(window.location.pathname);
    if (!publicId) return;
    void (async () => {
      await Promise.resolve();
      if (!alive) return;
      setRoleCandidatesLoading(true);
      try {
        const response = await fetch(
          `/api/projects/${encodeURIComponent(publicId)}/assignment-targets?kind=resource&role=${encodeURIComponent(roleFilter)}`,
          { credentials: "same-origin", cache: "no-store", signal: controller.signal },
        );
        const body: unknown = await response.json().catch(() => null);
        if (!response.ok || !isTargetsResponse(body) || body.data.catalogRevision !== catalogRevision) throw new Error("role_candidates");
        if (!alive) return;
        setTargets((current) => {
          const merged = new Map(current.map((target) => [targetKey(target), target]));
          for (const target of body.data.targets) merged.set(targetKey(target), target);
          return [...merged.values()].sort((left, right) => left.name.localeCompare(right.name, "ko"));
        });
      } catch {
        if (alive && !controller.signal.aborted) setError("수행 역할별 리소스 후보를 불러오지 못했습니다. 최신 리소스 역할을 다시 확인해 주세요.");
      } finally {
        if (alive) setRoleCandidatesLoading(false);
      }
    })();
    return () => { alive = false; controller.abort(); };
  }, [catalogRevision, editable, ready, roleFilter]);

  const selectedTargets = useMemo(() => targets.filter((target) => selected.has(targetKey(target))), [selected, targets]);
  const eligibleTargets = useMemo(
    () => targets.filter((target) => editable || selected.has(targetKey(target))),
    [editable, selected, targets],
  );
  const visibleTargets = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("ko");
    return eligibleTargets
      .filter((target) => kindFilter === "all" || target.kind === kindFilter)
      .filter((target) => roleFilter === "all" || (target.kind === "resource" && (target.roles ?? []).includes(roleFilter)))
      .filter((target) => !assignedOnly || selected.has(targetKey(target)))
      .filter((target) => {
        if (!normalizedQuery) return true;
        return target.name.toLocaleLowerCase("ko").includes(normalizedQuery) ||
          (target.code ?? "").toLocaleLowerCase("ko").includes(normalizedQuery);
      })
      .sort((left, right) => {
        const selectedDifference = Number(selected.has(targetKey(right))) - Number(selected.has(targetKey(left)));
        return selectedDifference || left.name.localeCompare(right.name, "ko");
      });
  }, [assignedOnly, eligibleTargets, kindFilter, query, roleFilter, selected]);
  const visibleResources = useMemo(() => visibleTargets.filter((target) => target.kind === "resource"), [visibleTargets]);
  const visibleGroups = useMemo(() => visibleTargets.filter((target) => target.kind === "group"), [visibleTargets]);
  const showResources = kindFilter !== "group";
  const showGroups = kindFilter !== "resource" && roleFilter === "all";

  useEffect(() => {
    if (ready && initialDraft.current !== null) {
      dirtyReference.current = JSON.stringify({ selected: [...selected].sort(), allocations, roles: roleDrafts }) !== initialDraft.current;
      onDirtyChange?.(dirtyReference.current);
    }
  }, [selected, allocations, roleDrafts, ready, onDirtyChange]);

  useEffect(() => {
    onSelectionCountChange?.(selected.size);
  }, [onSelectionCountChange, selected]);

  function toggle(target: AssignmentTargetDto) {
    if (!editable || disabled || saving || !ready || !target.active) return;
    const key = targetKey(target);
    setSelected((current) => { const next = new Set(current); if (next.has(key)) next.delete(key); else next.add(key); return next; });
    if (target.kind === "resource") {
      setAllocations((current) => ({ ...current, [key]: current[key] ?? { start: "", end: "", percent: "" } }));
      setRoleDrafts((current) => ({
        ...current,
        [key]: current[key] ?? (roleFilter !== "all" && (target.roles ?? []).includes(roleFilter) ? roleFilter : ""),
      }));
    }
    setAllocationIssues((current) => current.filter((issue) => issue.key !== key));
    setError(null);
  }
  function changeRole(key: string, role: AssignmentRoleDraft) {
    if (!editable || disabled || saving || !ready) return;
    setRoleDrafts((current) => ({ ...current, [key]: role }));
    setAllocationIssues((current) => current.filter((issue) => issue.key !== key || issue.field !== "role"));
    setError(null);
  }
  function changeAllocation(key: string, field: keyof AllocationDraft, value: string) {
    if (!editable || disabled || saving || !ready) return;
    setAllocations((current) => ({ ...current, [key]: { ...(current[key] ?? { start: "", end: "", percent: "" }), [field]: value } }));
    setAllocationIssues((current) => current.filter((issue) => issue.key !== key || (field === "start" ? issue.field !== "end" : issue.field !== field)));
    setError(null);
  }
  function focusAllocationIssue(issue: AllocationIssue) {
    setQuery("");
    setKindFilter("all");
    setRoleFilter("all");
    setAssignedOnly(false);
    requestAnimationFrame(() => document.getElementById(`allocation-${issue.key}-${issue.field}`)?.focus());
  }

  async function save() {
    if (!editable || disabled || saving || !ready || catalogRevision === null) return;
    const publicId = projectIdFromPathname(window.location.pathname); if (!publicId) return;
    const requested = [] as Array<{ kind: "resource" | "group"; id: string; role?: ResourceRole | null; allocation?: { start: string | null; end: string | null; percent: number } }>;
    const issues: AllocationIssue[] = [];
    for (const key of selected) {
      const separator = key.indexOf(":"); const kind = key.slice(0, separator) as "resource" | "group"; const id = key.slice(separator + 1);
      if (kind === "group") { requested.push({ kind, id }); continue; }
      const allocation = allocations[key] ?? { start: "", end: "", percent: "" };
      const percent = Number(allocation.percent);
      const target = targets.find((candidate) => targetKey(candidate) === key);
      const label = `${target?.name ?? "리소스"}${target?.code ? ` (${target.code})` : ""}`;
      const role = roleDrafts[key] || null;
      if (role === null && !legacyUnspecified.has(key)) {
        issues.push({ key, field: "role", label, message: "새 리소스 할당은 수행 역할을 선택해 주세요." });
      } else if (role !== null && !(target?.roles ?? []).includes(role)) {
        issues.push({ key, field: "role", label, message: "리소스가 현재 보유한 역할만 선택할 수 있습니다." });
      }
      if (!allocation.percent || !Number.isFinite(percent) || percent <= 0 || percent > 100) issues.push({ key, field: "percent", label, message: "투입률은 0보다 크고 100 이하로 입력해 주세요." });
      if (allocation.start && allocation.end && allocation.start > allocation.end) issues.push({ key, field: "end", label, message: "투입 종료일은 시작일보다 빠를 수 없습니다." });
      requested.push({ kind, id, role, allocation: { start: allocation.start || null, end: allocation.end || null, percent } });
    }
    if (issues.length > 0) {
      setAllocationIssues(issues);
      setError(null);
      requestAnimationFrame(() => issueSummary.current?.focus({ preventScroll: true }));
      return;
    }
    setAllocationIssues([]);
    setSaving(true); setError(null);
    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(publicId)}/tasks/${encodeURIComponent(taskId)}/assignments`, {
        method: "PUT", credentials: "same-origin", headers: { "Content-Type": "application/json", "If-Match": `"${revision}"` },
        body: JSON.stringify({ catalogRevision, targets: requested }),
      });
      if (response.status === 401) { onUnauthorized?.(); setError("편집 권한이 만료되었습니다. 리소스 초안은 유지됩니다."); return; }
      if (response.status === 412) { setError("프로젝트 또는 리소스 목록이 변경되었습니다. 최신 정보를 다시 불러와 주세요."); return; }
      if (response.status === 401) { setError("편집 권한이 만료되었습니다. 다시 잠금을 해제해 주세요."); return; }
      if (response.status === 409) { setError("수행 역할 또는 할당 대상이 변경되었습니다. 최신 리소스 역할을 다시 확인해 주세요."); return; }
      if (!response.ok) { setError("할당을 저장하지 못했습니다. 수행 역할·투입 기간·투입률과 대상 상태를 확인해 주세요."); return; }
      await onApplied();
    } catch { setError("할당 저장 결과를 확인할 수 없습니다. 최신 정보를 다시 확인해 주세요."); }
    finally { setSaving(false); }
  }

  return <section className={styles.assignmentPanel} aria-labelledby="task-assignment-title">
    <div className={styles.sectionHeading}>
      <div>
        <h3 id="task-assignment-title">담당 리소스 / 그룹</h3>
        <p className={styles.sectionDescription}>작업 저장과 리소스 할당 저장은 별도 계약입니다. 작업 필드 변경이 있으면 먼저 작업을 저장하거나 취소해 주세요.</p>
      </div>
      <span className={styles.sectionCount}>할당 {selectedTargets.length}개</span>
    </div>

    {loading ? <p className={styles.caption} role="status">할당 정보를 불러오는 중…</p> : null}
    {error ? <p className={styles.relationError} role="alert">{error}</p> : null}
    {!ready && error ? <button type="button" className="secondary-button" onClick={() => setRetry((value) => value + 1)}>할당 정보 다시 시도</button> : null}
    {allocationIssues.length > 0 ? <div className={styles.validationSummary} role="alert" tabIndex={-1} ref={issueSummary}>
      <strong>할당 입력 {allocationIssues.length}곳을 확인해 주세요.</strong>
      <ul>{allocationIssues.map((issue) => <li key={`${issue.key}-${issue.field}`}><button type="button" onClick={() => focusAllocationIssue(issue)}>{issue.label}: {issue.message}</button></li>)}</ul>
    </div> : null}
    {disabled && editable ? <p className={styles.assignmentNotice}>작업 필드 변경 또는 최신 정보 확인이 필요하여 할당 편집이 잠겨 있습니다.</p> : null}

    {!loading && eligibleTargets.length > 0 ? <div className={styles.assignmentFilters}>
      <label className={styles.searchField}>
        <span>검색</span>
        <input type="search" value={query} placeholder="이름 또는 코드" onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") event.preventDefault(); }} />
      </label>
      <label className={styles.filterField}>
        <span>유형</span>
        <select value={kindFilter} onChange={(event) => setKindFilter(event.target.value as "all" | "resource" | "group")}>
          <option value="all">전체</option>
          <option value="resource">리소스</option>
          <option value="group">그룹</option>
        </select>
      </label>
      <label className={styles.filterField}>
        <span>수행 역할</span>
        <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value as "all" | ResourceRole)}>
          <option value="all">전체 역할</option>
          {RESOURCE_ROLES.map((role) => <option value={role} key={role}>{ROLE_LABEL[role]}</option>)}
        </select>
      </label>
      <label className={styles.assignedOnly}>
        <input type="checkbox" checked={assignedOnly} onChange={(event) => setAssignedOnly(event.target.checked)} />
        <span>할당됨만</span>
      </label>
    </div> : null}

    {ready && eligibleTargets.length === 0 ? <p className={styles.emptyRelation}>{editable ? "등록된 할당 대상이 없습니다." : "이 작업에 할당된 리소스/그룹이 없습니다."}</p> : null}
    {roleFilter !== "all" && roleCandidatesLoading ? <p className={styles.caption} role="status">수행 역할별 리소스 후보를 불러오는 중…</p> : null}

    {!loading && (roleFilter === "all" || !roleCandidatesLoading) && eligibleTargets.length > 0 ? <div
      className={styles.assignmentSections}
      data-single-pane={kindFilter === "all" && roleFilter === "all" ? undefined : "true"}
    >
      {showResources ? <AssignmentSection
        title="담당 리소스"
        kindLabel="리소스"
        targets={visibleResources}
        allTargets={eligibleTargets.filter((target) => target.kind === "resource")}
        selected={selected}
        allocations={allocations}
        roleDrafts={roleDrafts}
        legacyUnspecified={legacyUnspecified}
        allocationIssues={allocationIssues}
        editable={editable}
        disabled={disabled}
        saving={saving}
        ready={ready}
        filtered={Boolean(query.trim()) || assignedOnly || roleFilter !== "all"}
        onToggle={toggle}
        onChangeRole={changeRole}
        onChangeAllocation={changeAllocation}
      /> : null}
      {showGroups ? <AssignmentSection
        title="리소스 그룹"
        kindLabel="그룹"
        targets={visibleGroups}
        allTargets={eligibleTargets.filter((target) => target.kind === "group")}
        selected={selected}
        allocations={allocations}
        roleDrafts={roleDrafts}
        legacyUnspecified={legacyUnspecified}
        allocationIssues={allocationIssues}
        editable={editable}
        disabled={disabled}
        saving={saving}
        ready={ready}
        filtered={Boolean(query.trim()) || assignedOnly}
        onToggle={toggle}
        onChangeRole={changeRole}
        onChangeAllocation={changeAllocation}
      /> : null}
    </div> : null}

    <p className={styles.caption}>개인 리소스는 수행 역할과 투입 정보를 함께 저장합니다. 기존 역할 미지정 할당은 그대로 유지하거나 역할을 보완할 수 있습니다. 투입 시작/종료를 비우면 작업의 확정 일정이 적용되며 그룹 할당은 담당 팀 참조로 유지됩니다.</p>
    {editable ? <div className={styles.assignmentFooter}>
      <span className={styles.assignmentScope}>이 버튼은 리소스/그룹 할당만 저장합니다.</span>
      <button className="secondary-button" type="button" disabled={disabled || saving || !ready} onClick={() => void save()}>{saving ? "할당 저장 중…" : "할당 저장 (" + selectedTargets.length + ")"}</button>
    </div> : null}
  </section>;
}


interface AssignmentSectionProps {
  readonly title: string;
  readonly kindLabel: "리소스" | "그룹";
  readonly targets: AssignmentTargetDto[];
  readonly allTargets: AssignmentTargetDto[];
  readonly selected: Set<string>;
  readonly allocations: Record<string, AllocationDraft>;
  readonly roleDrafts: Record<string, AssignmentRoleDraft>;
  readonly legacyUnspecified: Set<string>;
  readonly allocationIssues: AllocationIssue[];
  readonly editable: boolean;
  readonly disabled: boolean;
  readonly saving: boolean;
  readonly ready: boolean;
  readonly filtered: boolean;
  readonly onToggle: (target: AssignmentTargetDto) => void;
  readonly onChangeRole: (key: string, role: AssignmentRoleDraft) => void;
  readonly onChangeAllocation: (key: string, field: keyof AllocationDraft, value: string) => void;
}

function AssignmentSection({
  title, kindLabel, targets, allTargets, selected, allocations, roleDrafts, legacyUnspecified, allocationIssues,
  editable, disabled, saving, ready, filtered, onToggle, onChangeRole, onChangeAllocation,
}: AssignmentSectionProps) {
  return <section className={styles.assignmentSection} aria-label={title}>
    <div className={styles.assignmentSectionHeading}>
      <h4>{title}</h4>
      <span>{targets.length} / {allTargets.length}</span>
    </div>
    {targets.length === 0 ? <p className={styles.assignmentEmpty}>
      {allTargets.length === 0
        ? (kindLabel === "그룹" ? "등록된 그룹이 없습니다." : "등록된 리소스가 없습니다.")
        : filtered ? "현재 필터와 일치하는 결과가 없습니다." : `표시할 ${kindLabel}가 없습니다.`}
    </p> : <div className={styles.assignmentList}>
      {targets.map((target, index) => {
        const key = targetKey(target);
        const checked = selected.has(key);
        const allocation = allocations[key] ?? { start: "", end: "", percent: "" };
        const identity = `${kindLabel} ${index + 1} ${target.name}${target.code ? ` (${target.code})` : ""}`;
        const role = roleDrafts[key] ?? "";
        const roleIssue = allocationIssues.find((issue) => issue.key === key && issue.field === "role");
        const percentIssue = allocationIssues.find((issue) => issue.key === key && issue.field === "percent");
        const endIssue = allocationIssues.find((issue) => issue.key === key && issue.field === "end");
        return <article key={key} className={styles.assignmentRow} data-selected={checked || undefined}>
          <label className={styles.assignmentToggle}>
            <input
              type="checkbox"
              checked={checked}
              disabled={!editable || disabled || saving || !ready || (!target.active && !checked)}
              onChange={() => onToggle(target)}
            />
            <span className={styles.assignmentIdentity}>
              <strong>{target.name}</strong>
              {target.code ? <code>{target.code}</code> : null}
              {target.kind === "resource" ? (target.roles ?? []).map((item) => <span className={styles.roleBadge} key={item}>{ROLE_LABEL[item]}</span>) : null}
              {!target.active ? <span className={styles.inactiveBadge}>비활성</span> : null}
            </span>
          </label>
          {checked && target.kind === "resource" ? <fieldset className={styles.allocationFieldset}>
            <legend>{identity} 투입 정보</legend>
            <div className={styles.allocationGrid}>
              <label className={`${styles.field} ${styles.assignmentRoleField}`}>수행 역할
                <select id={`allocation-${key}-role`} aria-label={`${identity} 수행 역할`} aria-invalid={Boolean(roleIssue)} aria-describedby={roleIssue ? `allocation-${key}-role-error` : undefined} value={role} disabled={!editable || disabled || saving || !ready} onChange={(event) => onChangeRole(key, event.target.value as AssignmentRoleDraft)}>
                  <option value="">{legacyUnspecified.has(key) ? "역할 미지정 (기존)" : "역할 선택"}</option>
                  {(target.roles ?? []).map((item) => <option value={item} key={item}>{ROLE_LABEL[item]}</option>)}
                </select>
                {roleIssue ? <span className={styles.fieldError} id={`allocation-${key}-role-error`}>{roleIssue.message}</span> : null}
                {!roleIssue && legacyUnspecified.has(key) && !role ? <span className={styles.legacyRoleNote}>기존 역할 미지정 할당</span> : null}
              </label>
              <label className={styles.field}>투입 시작<input id={`allocation-${key}-start`} aria-label={`${identity} 투입 시작`} type="date" value={allocation.start} disabled={!editable || disabled || saving || !ready} onChange={(event) => onChangeAllocation(key, "start", event.target.value)} /></label>
              <label className={styles.field}>투입 종료<input id={`allocation-${key}-end`} aria-label={`${identity} 투입 종료`} aria-invalid={Boolean(endIssue)} aria-describedby={endIssue ? `allocation-${key}-end-error` : undefined} type="date" value={allocation.end} disabled={!editable || disabled || saving || !ready} onChange={(event) => onChangeAllocation(key, "end", event.target.value)} />{endIssue ? <span className={styles.fieldError} id={`allocation-${key}-end-error`}>{endIssue.message}</span> : null}</label>
              <label className={styles.field}>투입률 (%)<input id={`allocation-${key}-percent`} aria-label={`${identity} 투입률 (%)`} aria-invalid={Boolean(percentIssue)} aria-describedby={percentIssue ? `allocation-${key}-percent-error` : undefined} type="number" min="0.01" max="100" step="0.01" value={allocation.percent} disabled={!editable || disabled || saving || !ready} onChange={(event) => onChangeAllocation(key, "percent", event.target.value)} />{percentIssue ? <span className={styles.fieldError} id={`allocation-${key}-percent-error`}>{percentIssue.message}</span> : null}</label>
            </div>
          </fieldset> : null}
        </article>;
      })}
    </div>}
  </section>;
}
