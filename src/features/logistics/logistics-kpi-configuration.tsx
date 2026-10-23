"use client";

import { useEffect, useRef, useState } from "react";
import type { LogisticsDashboardDto, LogisticsIntegratedKpiDto } from "@/contracts/logistics-dashboard";
import type { ProjectLogisticsDto } from "@/contracts/logistics";
import type { ProjectTaskDto } from "@/contracts/projects";
import { IdentifierDetails } from "@/components/identifier-details";
import { ContextHelp } from "@/components/ui/context-help";
import styles from "./project-logistics-dashboard.module.css";

export type KpiMasterKind = "process" | "equipment" | "system" | "target" | "workArea" | "resource";
type Kind = KpiMasterKind | "task" | "assignment";
interface Selection { label: string; kind: Kind; ids: string[]; snapshotId: string }
interface Props {
  data: LogisticsIntegratedKpiDto;
  dashboard: LogisticsDashboardDto;
  tasks: readonly ProjectTaskDto[];
  logistics?: ProjectLogisticsDto;
  enabled: boolean;
  onOpenTask?: (taskId: string, trigger?: HTMLElement) => void;
  onOpenAssignment?: (taskId: string, assignmentId: string, resourceId: string, trigger: HTMLElement) => void;
  onOpenMaster?: (kind: KpiMasterKind, id: string, trigger: HTMLElement, resource?: { name: string; code: string | null }) => void;
  onSchedule: (taskIds: string[]) => void;
}

/** Diagnostics stay bound to one canonical server snapshot, including after an editor round trip. */
export function LogisticsKpiConfiguration({ data, dashboard, tasks, logistics, enabled, onOpenTask, onOpenAssignment, onOpenMaster, onSchedule }: Props) {
  const [selection, setSelection] = useState<Selection | null>(null);
  const trigger = useRef<HTMLElement | null>(null);
  const summary = useRef<HTMLElement | null>(null);
  const heading = useRef<HTMLHeadingElement | null>(null);
  const current = selection?.snapshotId === data.snapshotId ? selection : null;
  useEffect(() => { if (current) heading.current?.focus({ preventScroll: true }); }, [current]);
  const close = () => {
    setSelection(null);
    requestAnimationFrame(() => {
      const candidate = trigger.current;
      (candidate?.isConnected && !candidate.closest("[hidden],[inert]") ? candidate : summary.current)?.focus({ preventScroll: true });
    });
  };
  const entry = (label: string, kind: Kind, ids: string[], suffix = "개") => <button type="button" className={styles.diagnosticButton} disabled={!enabled} onClick={event => {
    if (!enabled) return;
    trigger.current = event.currentTarget;
    setSelection({ label, kind, ids: [...ids], snapshotId: data.snapshotId });
  }}><span>{label}</span><strong>{ids.length}{suffix}</strong></button>;
  const configuration = data.configuration, diagnostics = data.diagnostics;
  const master = (kind: Kind, id: string) => {
    if (kind === "process") return logistics?.processes.find(row => row.id === id) ?? dashboard.breakdowns.processes.find(row => row.id === id);
    if (kind === "equipment") return logistics?.equipment.find(row => row.id === id) ?? dashboard.breakdowns.equipment.find(row => row.id === id);
    if (kind === "system") return logistics?.systems.find(row => row.id === id) ?? dashboard.breakdowns.systems.find(row => row.id === id);
    if (kind === "target") return configuration.targets.find(row => row.id === id);
    if (kind === "workArea") return configuration.workAreas.find(row => row.id === id);
    if (kind === "resource") return data.resourceRows.find(row => row.id === id);
    return undefined;
  };
  const exactTaskIds = (kind: Kind, ids: string[]) => {
    if (kind === "task") return ids;
    if (kind === "assignment") return [...new Set(data.assignmentRows.filter(row => ids.includes(row.id)).map(row => row.taskId))];
    if (kind === "resource") return [...new Set(data.assignmentRows.filter(row => row.targetKind === "resource" && ids.includes(row.targetId)).map(row => row.taskId))];
    if (kind === "workArea") return [...new Set(configuration.workAreas.filter(row => ids.includes(row.id)).flatMap(row => row.taskIds))];
    if (kind === "target") return [...new Set(configuration.targets.filter(row => ids.includes(row.id)).flatMap(row => row.taskIds))];
    const rows = kind === "process" ? dashboard.breakdowns.processes : kind === "equipment" ? dashboard.breakdowns.equipment : dashboard.breakdowns.systems;
    return [...new Set(rows.filter(row => ids.includes(row.id)).flatMap(row => row.taskIds))];
  };
  const selectedTaskIds = current ? exactTaskIds(current.kind, current.ids) : [];
  return <details className={styles.configuration} data-testid="logistics-kpi-configuration">
    <summary ref={summary}>구성·연결 진단</summary>
    <div className={styles.headingRow}><h3>등록 구성과 연결 상태</h3><ContextHelp label="구성·연결 진단 도움말">등록 구성은 관련 일반 Task·Assignment 집계와 별개입니다. 설비는 고유 인스턴스와 수량을 구별합니다. 미배정과 개인 투입률 미설정은 서로 다른 진단이며 설정된 0%는 미설정이 아닙니다. 진단은 전체 프로젝트의 일반 Task 기준이며 Owner·PI·주 제어기는 활성 마스터 기준입니다. 일정 이동은 서버가 반환한 정확한 Task ID로 제한합니다.</ContextHelp></div>
    <p className={styles.scopeNote}>전체 프로젝트 구성·진단 · 현재 KPI 선택 범위와 별도</p>
    <div className={styles.configurationGrid} aria-label="등록 구성">
      {entry("등록 공정", "process", configuration.processIds)}
      {entry("등록 WorkArea", "workArea", configuration.workAreaIds)}
      {entry("등록 설비", "equipment", configuration.equipmentIds)}
      <div className={styles.configurationValue}><span>등록 설비 총 수량</span><strong>{configuration.equipmentQuantity}대</strong></div>
      {entry("등록 시스템", "system", configuration.systemIds)}
      {entry("등록 Target", "target", configuration.targets.map(row => row.id))}
      {entry("등록 리소스", "resource", configuration.registeredResourceIds)}
      {entry("참여 리소스", "resource", configuration.participatingResourceIds)}
      {entry("개인 배정 리소스", "resource", configuration.assignedResourceIds)}
    </div>
    <h4>연결·배정 진단</h4>
    <div className={styles.configurationGrid} aria-label="연결·배정 진단">
      {entry("물류 미연결 일반 Task", "task", diagnostics.unlinkedTaskIds)}
      {entry("물류 미연결 leaf Task", "task", diagnostics.unlinkedLeafTaskIds)}
      {entry("배정 없음", "task", diagnostics.completelyUnassignedTaskIds)}
      {entry("개인 배정 없음", "task", diagnostics.personallyUnassignedTaskIds)}
      {entry("그룹 전용 배정", "task", diagnostics.groupOnlyTaskIds)}
      {entry("개인 투입률 미설정", "assignment", diagnostics.unsetAllocationAssignmentIds, "건")}
      {entry("주 제어기 미매핑 설비", "equipment", diagnostics.equipmentWithoutPrimaryControllerIds)}
      {entry("Owner 미지정 설비", "equipment", diagnostics.equipmentWithoutOwnerIds)}
      {entry("PI 미지정 시스템", "system", diagnostics.systemsWithoutPrimaryPIIds)}
      {entry("일반 Task 없는 공정", "process", diagnostics.processWithoutTaskIds)}
      {entry("일반 Task 없는 WorkArea", "workArea", diagnostics.workAreaWithoutTaskIds)}
      {entry("일반 Task 없는 설비", "equipment", diagnostics.equipmentWithoutTaskIds)}
      {entry("일반 Task 없는 시스템", "system", diagnostics.systemsWithoutTaskIds)}
      {entry("일반 Task 없는 Target", "target", diagnostics.targetWithoutTaskIds)}
      {entry("legacy 공정 문맥 Task", "task", diagnostics.legacyContextTaskIds)}
      {entry("공정 명시 미선택 Task", "task", diagnostics.explicitEmptyProcessTaskIds)}
    </div>
    {selection && !current ? <p role="status">조회 snapshot이 바뀌어 이전 진단 이동을 차단했습니다. 현재 목록에서 다시 선택하세요.</p> : null}
    {current ? <section className={styles.diagnosticDetail} aria-label={`${current.label} 상세`} onKeyDown={event => {
      if (event.key === "Escape" && !event.defaultPrevented && event.target instanceof HTMLElement && !event.target.closest('[role="dialog"]')) { event.preventDefault(); close(); }
    }}>
      <div className={styles.headingRow}><h4 ref={heading} tabIndex={-1}>{current.label} ({current.ids.length})</h4><button type="button" onClick={close}>진단 목록으로 돌아가기</button></div>
      <button type="button" disabled={!enabled || selectedTaskIds.length === 0} onClick={() => { if (enabled) onSchedule(selectedTaskIds); }}>일정에서 대상 Task 보기 ({selectedTaskIds.length})</button>
      {!current.ids.length ? <p>해당 항목이 없습니다.</p> : <ul className={styles.diagnosticList}>{current.ids.map(id => {
        const assignment = current.kind === "assignment" ? data.assignmentRows.find(row => row.id === id) : undefined;
        const task = tasks.find(row => row.taskId === (assignment?.taskId ?? id));
        const row = master(current.kind, id);
        const name = current.kind === "task" ? task?.name : assignment ? `${task?.name || "작업 이름 확인 필요"} · ${assignment.targetName}` : row?.name;
        return <li key={id}><div><strong>{name?.trim() || "이름 확인 필요"}</strong>
          <IdentifierDetails identifiers={[{ label: "원본 ID", value: id }, ...(row && "code" in row && row.code ? [{ label: "코드", value: row.code }] : [])]} />
          {task && (current.kind === "task" || assignment) ? <span className={styles.scopeNote}>{task.start ?? "시작 미설정"} ~ {task.end ?? "종료 미설정"}</span> : null}
          {current.kind === "workArea" ? <span className={styles.scopeNote}>관련 설비 {configuration.workAreas.find(area => area.id === id)?.equipmentIds.length ?? 0}개 · {configuration.workAreas.find(area => area.id === id)?.equipmentQuantity ?? 0}대 (그룹 간 공유 수량 비가산)</span> : null}
          {assignment ? <span className={styles.scopeNote}>개인 투입률 {assignment.allocationPercent === null ? "미설정" : `${assignment.allocationPercent}%`}</span> : null}
        </div><div className={styles.diagnosticActions}>
          {(current.kind === "task" || assignment) ? <button type="button" disabled={!enabled || !onOpenTask || !task} onClick={event => { if (enabled && task) onOpenTask?.(task.taskId, event.currentTarget); }}>Task 원본</button> : null}
          {assignment ? <button type="button" disabled={!enabled || !onOpenAssignment || assignment.targetKind !== "resource"} onClick={event => { if (enabled && assignment.targetKind === "resource") onOpenAssignment?.(assignment.taskId, assignment.id, assignment.targetId, event.currentTarget); }}>Assignment 원본</button> : null}
          {current.kind === "workArea" ? configuration.workAreas.find(area => area.id === id)?.processIds.map(processId => <button type="button" key={processId} data-process-id={processId} disabled={!enabled || !onOpenMaster} onClick={event => { if (enabled) onOpenMaster?.("workArea", id, event.currentTarget); }}>{logistics?.processes.find(process => process.id === processId)?.name || "공정 이름 확인 필요"} 원본 구성 보기</button>) : null}
          {!["task", "assignment", "workArea"].includes(current.kind) ? <button type="button" data-process-id={current.kind === "workArea" ? configuration.workAreas.find(area => area.id === id)?.processIds[0] : undefined} disabled={!enabled || !onOpenMaster || !row || (current.kind === "workArea" && !configuration.workAreas.find(area => area.id === id)?.processIds.length)} onClick={event => { if (enabled && row) onOpenMaster?.(current.kind as KpiMasterKind, id, event.currentTarget, current.kind === "resource" ? data.resourceRows.find(resource => resource.id === id) : undefined); }}>원본 구성 보기</button> : null}
        </div></li>;
      })}</ul>}
    </section> : null}
  </details>;
}
