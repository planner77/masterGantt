"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import type {
  AssignedTargetsResponse,
  AssignmentTargetDto,
  AssignmentTargetsResponse,
} from "@/contracts/resources";
import styles from "./project-task-editor.module.css";

interface Props {
  readonly taskId: string;
  readonly revision: number;
  readonly editable: boolean;
  readonly disabled: boolean;
  readonly onApplied: () => Promise<void>;
  readonly onSelectionCountChange?: (count: number) => void;
}

type AllocationDraft = { start: string; end: string; percent: string };
type AllocationField = "end" | "percent";
type AllocationIssue = { key: string; field: AllocationField; label: string; message: string };

function projectIdFromPathname(pathname: string): string | null {
  const match = /^\/projects\/([^/]+)\/?$/.exec(pathname);
  if (!match) return null;
  try { return decodeURIComponent(match[1]); } catch { return null; }
}
function isAssignedResponse(value: unknown): value is AssignedTargetsResponse {
  if (!value || typeof value !== "object" || !("data" in value)) return false;
  const data = value.data;
  return !!data && typeof data === "object" && "projectRevision" in data && typeof data.projectRevision === "number" &&
    "catalogRevision" in data && typeof data.catalogRevision === "number" && "assignments" in data && Array.isArray(data.assignments) && "targets" in data && Array.isArray(data.targets);
}
function isTargetsResponse(value: unknown): value is AssignmentTargetsResponse {
  if (!value || typeof value !== "object" || !("data" in value)) return false;
  const data = value.data;
  return !!data && typeof data === "object" && "catalogRevision" in data && typeof data.catalogRevision === "number" && "targets" in data && Array.isArray(data.targets);
}
function targetKey(target: Pick<AssignmentTargetDto, "kind" | "id">): string { return `${target.kind}:${target.id}`; }

export function TaskAssignmentEditor({ taskId, revision, editable, disabled, onApplied, onSelectionCountChange }: Props) {
  const [targets, setTargets] = useState<AssignmentTargetDto[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [allocations, setAllocations] = useState<Record<string, AllocationDraft>>({});
  const [catalogRevision, setCatalogRevision] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [kindFilter, setKindFilter] = useState<"all" | "resource" | "group">("all");
  const [assignedOnly, setAssignedOnly] = useState(false);
  const [allocationIssues, setAllocationIssues] = useState<AllocationIssue[]>([]);
  const issueSummary = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      await Promise.resolve(); if (!alive) return;
      const publicId = projectIdFromPathname(window.location.pathname);
      if (!publicId) { setLoading(false); setError("프로젝트 경로를 확인할 수 없습니다."); return; }
      try {
        const assignedResponse = await fetch(`/api/projects/${encodeURIComponent(publicId)}/assigned-targets`, { credentials: "same-origin", cache: "no-store" });
        const assignedBody: unknown = await assignedResponse.json().catch(() => null);
        if (!assignedResponse.ok || !isAssignedResponse(assignedBody)) throw new Error("assigned");
        if (!alive) return;
        const taskAssignments = assignedBody.data.assignments.filter((assignment) => assignment.taskId === taskId);
        setSelected(new Set(taskAssignments.map((assignment) => `${assignment.target.kind}:${assignment.target.id}`)));
        const nextAllocations: Record<string, AllocationDraft> = {};
        for (const assignment of taskAssignments) {
          if (assignment.target.kind !== "resource") continue;
          nextAllocations[`${assignment.target.kind}:${assignment.target.id}`] = {
            start: assignment.allocation?.start ?? "",
            end: assignment.allocation?.end ?? "",
            percent: assignment.allocation?.percent === null || assignment.allocation?.percent === undefined ? "" : String(assignment.allocation.percent),
          };
        }
        setAllocations(nextAllocations); setTargets(assignedBody.data.targets); setCatalogRevision(assignedBody.data.catalogRevision);
        if (editable) {
          const candidatesResponse = await fetch(`/api/projects/${encodeURIComponent(publicId)}/assignment-targets`, { credentials: "same-origin", cache: "no-store" });
          const candidatesBody: unknown = await candidatesResponse.json().catch(() => null);
          if (!candidatesResponse.ok || !isTargetsResponse(candidatesBody)) throw new Error("candidates");
          if (!alive) return;
          const merged = new Map<string, AssignmentTargetDto>();
          for (const target of assignedBody.data.targets) merged.set(targetKey(target), target);
          for (const target of candidatesBody.data.targets) merged.set(targetKey(target), target);
          setTargets([...merged.values()].sort((left, right) => left.name.localeCompare(right.name, "ko")));
          setCatalogRevision(candidatesBody.data.catalogRevision);
        }
      } catch { if (alive) setError("할당 정보를 불러오지 못했습니다. 편집 권한과 네트워크 상태를 확인해 주세요."); }
      finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, [editable, taskId, revision]);

  const selectedTargets = useMemo(() => targets.filter((target) => selected.has(targetKey(target))), [selected, targets]);
  const visibleTargets = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("ko");
    return targets
      .filter((target) => editable || selected.has(targetKey(target)))
      .filter((target) => kindFilter === "all" || target.kind === kindFilter)
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
  }, [assignedOnly, editable, kindFilter, query, selected, targets]);

  useEffect(() => {
    onSelectionCountChange?.(selected.size);
  }, [onSelectionCountChange, selected]);

  function toggle(target: AssignmentTargetDto) {
    if (!editable || disabled || saving || !target.active) return;
    const key = targetKey(target);
    setSelected((current) => { const next = new Set(current); if (next.has(key)) next.delete(key); else next.add(key); return next; });
    if (target.kind === "resource") setAllocations((current) => ({ ...current, [key]: current[key] ?? { start: "", end: "", percent: "" } }));
    setAllocationIssues((current) => current.filter((issue) => issue.key !== key));
    setError(null);
  }
  function changeAllocation(key: string, field: keyof AllocationDraft, value: string) {
    setAllocations((current) => ({ ...current, [key]: { ...(current[key] ?? { start: "", end: "", percent: "" }), [field]: value } }));
    setAllocationIssues((current) => current.filter((issue) => issue.key !== key || (field === "start" ? issue.field !== "end" : issue.field !== field)));
    setError(null);
  }
  function focusAllocationIssue(issue: AllocationIssue) {
    setQuery("");
    setKindFilter("all");
    setAssignedOnly(false);
    requestAnimationFrame(() => document.getElementById(`allocation-${issue.key}-${issue.field}`)?.focus());
  }

  async function save() {
    if (!editable || disabled || saving || catalogRevision === null) return;
    const publicId = projectIdFromPathname(window.location.pathname); if (!publicId) return;
    const requested = [] as Array<{ kind: "resource" | "group"; id: string; allocation?: { start: string | null; end: string | null; percent: number } }>;
    const issues: AllocationIssue[] = [];
    for (const key of selected) {
      const separator = key.indexOf(":"); const kind = key.slice(0, separator) as "resource" | "group"; const id = key.slice(separator + 1);
      if (kind === "group") { requested.push({ kind, id }); continue; }
      const allocation = allocations[key] ?? { start: "", end: "", percent: "" };
      const percent = Number(allocation.percent);
      const target = targets.find((candidate) => targetKey(candidate) === key);
      const label = `${target?.name ?? "리소스"}${target?.code ? ` (${target.code})` : ""}`;
      if (!allocation.percent || !Number.isFinite(percent) || percent <= 0 || percent > 100) issues.push({ key, field: "percent", label, message: "투입률은 0보다 크고 100 이하로 입력해 주세요." });
      if (allocation.start && allocation.end && allocation.start > allocation.end) issues.push({ key, field: "end", label, message: "투입 종료일은 시작일보다 빠를 수 없습니다." });
      requested.push({ kind, id, allocation: { start: allocation.start || null, end: allocation.end || null, percent } });
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
      if (response.status === 412) { setError("프로젝트 또는 리소스 목록이 변경되었습니다. 최신 정보를 다시 불러와 주세요."); return; }
      if (response.status === 401) { setError("편집 권한이 만료되었습니다. 다시 잠금을 해제해 주세요."); return; }
      if (!response.ok) { setError("할당을 저장하지 못했습니다. 투입 기간·투입률과 대상 상태를 확인해 주세요."); return; }
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
    {allocationIssues.length > 0 ? <div className={styles.validationSummary} role="alert" tabIndex={-1} ref={issueSummary}>
      <strong>할당 입력 {allocationIssues.length}곳을 확인해 주세요.</strong>
      <ul>{allocationIssues.map((issue) => <li key={`${issue.key}-${issue.field}`}><button type="button" onClick={() => focusAllocationIssue(issue)}>{issue.label}: {issue.message}</button></li>)}</ul>
    </div> : null}
    {disabled && editable ? <p className={styles.assignmentNotice}>작업 필드 변경 또는 최신 정보 확인이 필요하여 할당 편집이 잠겨 있습니다.</p> : null}

    {!loading && targets.length > 0 ? <div className={styles.assignmentFilters}>
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
      <label className={styles.assignedOnly}>
        <input type="checkbox" checked={assignedOnly} onChange={(event) => setAssignedOnly(event.target.checked)} />
        <span>할당됨만</span>
      </label>
    </div> : null}

    {!loading && targets.length === 0 ? <p className={styles.emptyRelation}>등록된 할당 대상이 없습니다.</p> : null}
    {!loading && targets.length > 0 && visibleTargets.length === 0 ? <p className={styles.emptyRelation}>현재 필터 조건에 맞는 대상이 없습니다.</p> : null}

    {!loading && visibleTargets.length > 0 ? <div className={styles.assignmentList}>
      {visibleTargets.map((target, index) => {
        const key = targetKey(target);
        const checked = selected.has(key);
        const allocation = allocations[key] ?? { start: "", end: "", percent: "" };
        const identity = `${target.kind === "resource" ? "리소스" : "그룹"} ${index + 1} ${target.name}${target.code ? ` (${target.code})` : ""}`;
        const percentIssue = allocationIssues.find((issue) => issue.key === key && issue.field === "percent");
        const endIssue = allocationIssues.find((issue) => issue.key === key && issue.field === "end");
        return <article key={key} className={styles.assignmentRow} data-selected={checked || undefined}>
          <div className={styles.assignmentHeader}>
            <label className={styles.assignmentToggle}>
              <input type="checkbox" checked={checked} disabled={!editable || disabled || saving || (!target.active && !checked)} onChange={() => toggle(target)} />
              <span className={styles.assignmentIdentity}>
                <strong>{target.name}</strong>
                <span className={styles.assignmentBadges}>
                  <span className={target.kind === "resource" ? styles.resourceBadge : styles.groupBadge}>{target.kind === "resource" ? "Resource" : "Group"}</span>
                  {target.code ? <code>{target.code}</code> : null}
                  {!target.active ? <span className={styles.inactiveBadge}>비활성</span> : null}
                </span>
              </span>
            </label>
          </div>
          {checked && target.kind === "resource" ? <fieldset className={styles.allocationFieldset}>
            <legend>{identity} 투입 정보</legend>
            <div className={styles.allocationGrid}>
              <label className={styles.field}>투입 시작<input id={`allocation-${key}-start`} aria-label={`${identity} 투입 시작`} type="date" value={allocation.start} disabled={!editable || disabled || saving} onChange={(event) => changeAllocation(key, "start", event.target.value)} /></label>
              <label className={styles.field}>투입 종료<input id={`allocation-${key}-end`} aria-label={`${identity} 투입 종료`} aria-invalid={Boolean(endIssue)} aria-describedby={endIssue ? `allocation-${key}-end-error` : undefined} type="date" value={allocation.end} disabled={!editable || disabled || saving} onChange={(event) => changeAllocation(key, "end", event.target.value)} />{endIssue ? <span className={styles.fieldError} id={`allocation-${key}-end-error`}>{endIssue.message}</span> : null}</label>
              <label className={styles.field}>투입률 (%)<input id={`allocation-${key}-percent`} aria-label={`${identity} 투입률 (%)`} aria-invalid={Boolean(percentIssue)} aria-describedby={percentIssue ? `allocation-${key}-percent-error` : undefined} type="number" min="0.01" max="100" step="0.01" value={allocation.percent} disabled={!editable || disabled || saving} onChange={(event) => changeAllocation(key, "percent", event.target.value)} />{percentIssue ? <span className={styles.fieldError} id={`allocation-${key}-percent-error`}>{percentIssue.message}</span> : null}</label>
            </div>
          </fieldset> : null}
        </article>;
      })}
    </div> : null}

    <p className={styles.caption}>투입 시작/종료를 비우면 작업의 확정 일정이 적용됩니다. 기존 투입률 미설정 할당은 공수 합계에서 제외됩니다. 그룹 할당은 담당 팀 참조이며 구성원을 개인 할당으로 자동 복제하지 않습니다.</p>
    {editable ? <div className={styles.assignmentFooter}>
      <span className={styles.assignmentScope}>이 버튼은 리소스/그룹 할당만 저장합니다.</span>
      <button className="secondary-button" type="button" disabled={disabled || saving || loading} onClick={() => void save()}>{saving ? "할당 저장 중…" : "할당 저장 (" + selectedTargets.length + ")"}</button>
    </div> : null}
  </section>;
}
