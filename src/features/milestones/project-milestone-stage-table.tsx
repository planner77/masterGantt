"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { MilestoneDashboardStageDto } from "../../contracts/milestone-dashboard";
import type { ProjectTaskDto } from "../../contracts/projects";
import { displayPercent } from "./milestone-dashboard-model";
import { WorkspaceDialog } from "../../components/workspace-dialog";
import { isVisibleFocusTarget, milestoneManagementDate, type MilestoneManagementHandler, type MilestoneManagementCommand } from "./milestone-management-model";
import styles from "./project-milestone-dashboard.module.css";

export interface MilestoneStageTableProps {
  rows: readonly MilestoneDashboardStageDto[];
  tasks: readonly ProjectTaskDto[];
  enabled: boolean;
  scheduleEnabled?: boolean;
  editable?: boolean;
  onManage?: MilestoneManagementHandler;
  onFocusUnavailable?: () => void;
  onOpenTask?: (taskId: string, tab?: "task" | "memberships") => void;
  onSchedule?: (taskIds: string[]) => void;
}

const statusLabel = (status: ProjectTaskDto["status"]) => status === "completed" ? "완료 기록" : status === "in_progress" ? "진행 중" : "시작 전";

export function ProjectMilestoneStageTable({ rows, tasks, enabled, scheduleEnabled = enabled, onOpenTask, onSchedule, editable = false, onManage, onFocusUnavailable }: MilestoneStageTableProps) {
  const id = useId(), [detailId, setDetailId] = useState<string | null>(null);
  const heading = useRef<HTMLHeadingElement>(null), trigger = useRef<HTMLButtonElement | null>(null);
  const [management, setManagement] = useState<{ taskId: string | null; restoreFocus: boolean }>({ taskId: null, restoreFocus: false });
  const managementId = management.taskId;
  const managementTrigger = useRef<HTMLElement | null>(null);
  const restoreAfterUnmount = useRef(false), focusUnavailable = useRef(onFocusUnavailable);
  useEffect(() => { focusUnavailable.current = onFocusUnavailable; }, [onFocusUnavailable]);
  const managementRow = rows.find(stage => stage.milestoneTaskId === managementId);
  const managementTask = tasks.find(task => task.taskId === managementId);
  // Invalidate the selection before children commit. A returning row must not
  // revive it while the separately owned focus frame is still pending.
  if (managementId !== null && (!managementRow || !managementTask)) {
    setManagement({ taskId: null, restoreFocus: true });
  }
  useEffect(() => {
    if (!management.restoreFocus) return;
    const frame = requestAnimationFrame(() => {
      restoreAfterUnmount.current = false;
      focusUnavailable.current?.();
    });
    return () => cancelAnimationFrame(frame);
  }, [management]);
  useEffect(() => () => {
    if (restoreAfterUnmount.current && !isVisibleFocusTarget(managementTrigger.current)) focusUnavailable.current?.();
  }, []);
  function closeManagement() { restoreAfterUnmount.current = false; setManagement({ taskId: null, restoreFocus: false }); }
  const row = rows.find((stage) => stage.milestoneTaskId === detailId);
  const taskById = new Map(tasks.map((task) => [task.taskId, task]));
  const openDetails = (taskId: string, button: HTMLButtonElement) => { trigger.current = button; setDetailId(taskId); requestAnimationFrame(() => heading.current?.focus({ preventScroll: true })); };
  const closeDetails = () => { setDetailId(null); requestAnimationFrame(() => trigger.current?.focus({ preventScroll: true })); };
  function causeList(title: string, ids: string[]) {
    return <section className={styles.causeGroup}><h4>{title} · {ids.length}개</h4>{ids.length ? <ul>{ids.map((taskId) => { const task = taskById.get(taskId); return <li key={taskId}><span>{task?.name ?? "현재 정보에 없는 작업"}<small>외부 ID: {task?.externalId ?? "—"} · 작업 ID: {taskId}</small></span><div className={styles.actions}><button type="button" disabled={!enabled || !task || !onOpenTask} onClick={() => { if (enabled && task) onOpenTask?.(taskId, "task"); }}>전체 프로젝트 정보</button><button type="button" disabled={!scheduleEnabled || !onSchedule} onClick={() => { if (scheduleEnabled) onSchedule?.([taskId]); }}>전체 일정에서 보기</button></div></li>; })}</ul> : <p>해당 원인 없음</p>}</section>;
  }
  return <>
    <div className={`${styles.tableOwner} ${styles.stageTableOwner}`} tabIndex={0} role="region" aria-label="Milestone 전체 상태 표 가로 스크롤">
      <table className={styles.stageTable}>
        <caption className="sr-only">전체 소속 작업과 직접 선행 Milestone 기준의 Milestone 상태</caption>
        <colgroup>{[260, 112, 96, 160, 104, 88, 88, 144].map((width, index) => <col key={index} style={index === 0 ? undefined : { width }} />)}</colgroup>
        <thead><tr><th scope="col">Milestone</th><th scope="col">적용 예정일</th><th scope="col">기록된 상태</th><th scope="col">소속 작업 진척</th><th scope="col">완료 / 전체 작업</th><th scope="col">선행 차단</th><th scope="col">계획 위험</th><th scope="col">조회</th></tr></thead>
        <tbody>{rows.map((stage) => <tr key={stage.milestoneTaskId} data-milestone-task-id={stage.milestoneTaskId}>
          <td><button type="button" className={styles.identity} disabled={!enabled || !onOpenTask} onClick={() => { if (enabled) onOpenTask?.(stage.milestoneTaskId, "task"); }} title={`${stage.name} · 외부 ID: ${stage.externalId} · 작업 ID: ${stage.milestoneTaskId}`}>{stage.name}</button><small>외부 ID: {stage.externalId}</small><div className={styles.badges}>{stage.stageGate.manualEvent ? <span>수동 이벤트 · Ready N/A</span> : stage.stageGate.ready ? <span>Ready</span> : null}{stage.overdue ? <span>지연</span> : null}{stage.upcoming ? <span>임박</span> : null}{stage.stageGate.completionInconsistent ? <span>완료 조건 불일치 진단</span> : null}</div></td>
          <td>{milestoneManagementDate(taskById.get(stage.milestoneTaskId)) || "미설정"}</td><td>{statusLabel(stage.status)}</td><td className={styles.numeric}>{stage.stageGate.manualEvent ? "N/A" : displayPercent(stage.stageGate.memberProgressPercent)}</td><td className={styles.numeric}>{stage.stageGate.completedMemberCount} / {stage.stageGate.memberCount}</td><td className={styles.numeric}>{stage.stageGate.incompletePredecessorMilestoneTaskIds.length}개</td><td className={styles.numeric}>{stage.riskTaskIds.length}개</td>
          <td><div className={styles.actions}><button type="button" aria-label={`${stage.name} 단계 상세`} disabled={!enabled || !onOpenTask} onClick={() => { if (enabled) onOpenTask?.(stage.milestoneTaskId, "task"); }}>상세</button><button type="button" aria-label={`${stage.name} 소속 작업 조회`} disabled={!enabled || !onOpenTask} onClick={() => { if (enabled) onOpenTask?.(stage.milestoneTaskId, "memberships"); }}>소속 작업</button><button type="button" aria-label={`${stage.name} 전체 원인 확인`} aria-expanded={detailId === stage.milestoneTaskId} aria-controls={`${id}-causes`} disabled={!enabled} onClick={(event) => { if (enabled) openDetails(stage.milestoneTaskId, event.currentTarget); }}>원인 확인</button>{onManage ? <button type="button" aria-label={`${stage.name} 관리`} disabled={!enabled} onClick={event => { managementTrigger.current = event.currentTarget; restoreAfterUnmount.current = true; setManagement({ taskId: stage.milestoneTaskId, restoreFocus: false }); }}>관리</button> : null}</div></td>
        </tr>)}</tbody>
      </table>
    </div>
    {managementRow && managementTask ? <WorkspaceDialog title={`${managementRow.name} 관리`} restoreFocusRef={managementTrigger} onClose={closeManagement}>
      <div className="project-form compact-form">
        <p>외부 ID: {managementTask.externalId} · 작업 ID: {managementTask.taskId}</p>
        <p>{editable ? "완료·재개는 상세 Editor에서 상태를 변경하고 저장합니다. Milestone의 구조 잠금과 서버 검증을 유지합니다." : "조회 모드입니다. 상세·소속·관계 조회와 작업 ID 복사를 사용할 수 있습니다."}</p>
        <div className={styles.managementActions}>{([
          ["detail", "단계 상세"], ["memberships", "소속 작업 관리"], ["relations", "관계 조회·관리"], ["copy-id", "작업 ID 복사"], ["date", "해당 날짜에서 보기"], ["members", "소속 작업 일정에서 보기"], ["copy", "Milestone 복사"], ["delete", "Milestone 삭제"],
        ] as const).map(([command, label]) => {
          const structural = command === "copy" || command === "delete";
          const noDate = command === "date" && !milestoneManagementDate(managementTask);
          const noMembers = command === "members" && managementRow.stageGate.memberTaskIds.length === 0;
          const locked = !enabled || (structural && !editable) || (command === "delete" && managementTask.status === "completed") || ((command === "date" || command === "members") && !scheduleEnabled) || noDate || noMembers;
          const reason = noDate ? "적용 예정일이 없어 날짜로 이동할 수 없습니다." : noMembers ? "유효 소속 작업이 없습니다." : command === "delete" && managementTask.status === "completed" ? "Milestone를 먼저 상세 Editor에서 재개하고 저장해 주세요." : structural && !editable ? "편집 활성화가 필요합니다." : (command === "date" || command === "members") && !scheduleEnabled ? "원본 조회 문맥을 확인한 뒤 이동할 수 있습니다." : "";
          return <div key={command}><button type="button" disabled={locked} title={reason} onClick={() => {
            const trigger = managementTrigger.current;
            if (!trigger || locked) return;
            closeManagement();
            requestAnimationFrame(() => onManage?.(managementTask.taskId, command as MilestoneManagementCommand, trigger));
          }}>{label}</button>{reason ? <small>{reason}</small> : null}</div>;
        })}</div>
      </div>
    </WorkspaceDialog> : null}
    {row ? <section id={`${id}-causes`} className={styles.causes} aria-labelledby={`${id}-cause-heading`} onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); closeDetails(); } }}>
      <div className={styles.sectionHeading}><h3 id={`${id}-cause-heading`} tabIndex={-1} ref={heading}>{row.name} · 전체 Milestone 원인</h3><button type="button" onClick={closeDetails}>원인 닫기</button></div>
      <p>프로젝트 전체의 소속 작업과 직접 선행 Milestone입니다. 현재 물류·리소스·공수 기간·Gantt WBS 범위 밖 원인도 포함합니다.</p>
      <p>본인 상태: {statusLabel(row.status)} · 본인 진행률: {row.progress}% · 소속 작업 진척: {row.stageGate.manualEvent ? "N/A" : displayPercent(row.stageGate.memberProgressPercent)}{row.stageGate.completionInconsistent ? " · 완료 기록은 유지되며 현재 조건 불일치 진단만 표시합니다." : ""}</p>
      {causeList("미완료 소속 작업", row.stageGate.incompleteMemberTaskIds)}
      {causeList("미완료 직접 선행 Milestone", row.stageGate.incompletePredecessorMilestoneTaskIds)}
      {causeList("적용 예정일을 넘는 미완료 작업", row.riskTaskIds)}
      {row.risks.length ? <ul>{row.risks.map((risk) => <li key={risk.taskId}>{risk.name}: 작업 종료 {risk.end} &gt; Milestone 예정 {risk.scheduledDate}</li>)}</ul> : null}
    </section> : null}
  </>;
}
