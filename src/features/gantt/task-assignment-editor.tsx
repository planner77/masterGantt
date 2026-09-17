"use client";

import { useEffect, useMemo, useState } from "react";

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
}

type AllocationDraft = { start: string; end: string; percent: string };

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

export function TaskAssignmentEditor({ taskId, revision, editable, disabled, onApplied }: Props) {
  const [targets, setTargets] = useState<AssignmentTargetDto[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [allocations, setAllocations] = useState<Record<string, AllocationDraft>>({});
  const [catalogRevision, setCatalogRevision] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  function toggle(target: AssignmentTargetDto) {
    if (!editable || disabled || saving || !target.active) return;
    const key = targetKey(target);
    setSelected((current) => { const next = new Set(current); if (next.has(key)) next.delete(key); else next.add(key); return next; });
    if (target.kind === "resource") setAllocations((current) => ({ ...current, [key]: current[key] ?? { start: "", end: "", percent: "" } }));
    setError(null);
  }
  function changeAllocation(key: string, field: keyof AllocationDraft, value: string) {
    setAllocations((current) => ({ ...current, [key]: { ...(current[key] ?? { start: "", end: "", percent: "" }), [field]: value } }));
    setError(null);
  }

  async function save() {
    if (!editable || disabled || saving || catalogRevision === null) return;
    const publicId = projectIdFromPathname(window.location.pathname); if (!publicId) return;
    const requested = [] as Array<{ kind: "resource" | "group"; id: string; allocation?: { start: string | null; end: string | null; percent: number } }>;
    for (const key of selected) {
      const separator = key.indexOf(":"); const kind = key.slice(0, separator) as "resource" | "group"; const id = key.slice(separator + 1);
      if (kind === "group") { requested.push({ kind, id }); continue; }
      const allocation = allocations[key] ?? { start: "", end: "", percent: "" };
      const percent = Number(allocation.percent);
      if (!allocation.percent || !Number.isFinite(percent) || percent <= 0 || percent > 100) { setError("개별 리소스의 투입률은 0보다 크고 100 이하로 입력해 주세요."); return; }
      if (allocation.start && allocation.end && allocation.start > allocation.end) { setError("리소스 투입 시작일은 종료일보다 늦을 수 없습니다."); return; }
      requested.push({ kind, id, allocation: { start: allocation.start || null, end: allocation.end || null, percent } });
    }
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

  return <section className={styles.relations} aria-labelledby="task-assignment-title">
    <h3 id="task-assignment-title">담당 리소스 / 그룹</h3>
    {loading ? <p className={styles.caption} role="status">할당 정보를 불러오는 중…</p> : null}
    {error ? <p className={styles.relationError} role="alert">{error}</p> : null}
    {!loading && targets.length === 0 ? <p className={styles.emptyRelation}>등록된 할당 대상이 없습니다.</p> : null}
    {!loading && targets.length > 0 ? <div>{targets.map((target) => {
      const key = targetKey(target); const checked = selected.has(key); if (!editable && !checked) return null; const allocation = allocations[key] ?? { start: "", end: "", percent: "" };
      return <div key={key} style={{ margin: ".5rem 0", padding: ".5rem", border: "1px solid var(--border)" }}>
        <label style={{ display: "flex", gap: ".5rem", alignItems: "center" }}>
          <input type="checkbox" checked={checked} disabled={!editable || disabled || saving || (!target.active && !checked)} onChange={() => toggle(target)} />
          <span><strong>{target.name}</strong> · {target.kind === "resource" ? "리소스" : "그룹"}{target.code ? ` · ${target.code}` : ""}{!target.active ? " · 비활성" : ""}</span>
        </label>
        {checked && target.kind === "resource" ? <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: ".5rem", marginTop: ".5rem" }}>
          <label>투입 시작<input type="date" value={allocation.start} disabled={!editable || disabled || saving} onChange={(event) => changeAllocation(key, "start", event.target.value)} /></label>
          <label>투입 종료<input type="date" value={allocation.end} disabled={!editable || disabled || saving} onChange={(event) => changeAllocation(key, "end", event.target.value)} /></label>
          <label>투입률 (%)<input type="number" min="0.01" max="100" step="0.01" value={allocation.percent} disabled={!editable || disabled || saving} onChange={(event) => changeAllocation(key, "percent", event.target.value)} /></label>
        </div> : null}
      </div>;
    })}</div> : null}
    <p className={styles.caption}>투입 시작/종료를 비우면 작업의 확정 일정이 적용됩니다. 기존 투입률 미설정 할당은 공수 합계에서 제외됩니다. 그룹 할당은 담당 팀 참조이며 구성원을 개인 할당으로 자동 복제하지 않습니다.</p>
    {editable ? <div className={styles.actions}><button className="secondary-button" type="button" disabled={disabled || saving || loading} onClick={() => void save()}>{saving ? "할당 저장 중…" : `할당 저장 (${selectedTargets.length})`}</button>{disabled ? <span className={styles.caption}>작업 필드 변경을 먼저 저장하거나 취소한 뒤 할당을 변경하세요.</span> : null}</div> : null}
  </section>;
}
