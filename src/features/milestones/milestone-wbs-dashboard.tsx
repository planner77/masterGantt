"use client";

import type { WbsViewReportDto } from "@/contracts/wbs-dashboard-views";
import type { ProjectTaskDto } from "@/contracts/projects";
import { IdentifierDetails } from "@/components/identifier-details";
import { ContextHelp } from "@/components/ui/context-help";
import { WbsViewDashboard, type WbsViewConsumer, type WbsViewDashboardProps } from "@/features/resources/wbs-view-dashboard";
import { plannedEffort } from "@/features/resources/resource-dashboard-model";
import styles from "@/features/resources/wbs-view.module.css";
import milestoneStyles from "./milestone-wbs-dashboard.module.css";
import { MILESTONE_WBS_DEFAULT_SPEC, MILESTONE_WBS_PRESETS, milestoneWbsPresentation, milestoneFullGateLabel, milestoneMetadataForReport } from "./milestone-wbs-dashboard-model";

export function MilestoneWbsDashboard({ tasks, revision, ...props }: Omit<WbsViewDashboardProps, "root" | "consumer"> & { tasks: readonly ProjectTaskDto[] }) {
  const consumer: WbsViewConsumer = {
    title: "Milestone 계층 조회", defaultSpec: MILESTONE_WBS_DEFAULT_SPEC,
    presets: MILESTONE_WBS_PRESETS, renderSummary: data => <MilestoneWbsSummary data={data} tasks={tasks} revision={revision}/>,
  };
  return <WbsViewDashboard {...props} revision={revision} root="milestone" consumer={consumer}/>;
}
function MilestoneWbsSummary({ data, tasks, revision }: { data: WbsViewReportDto; tasks: readonly ProjectTaskDto[]; revision: number }) {
  const view = milestoneWbsPresentation(data);
  return <section className={milestoneStyles.summary} data-testid="milestone-wbs-summary" aria-label="Milestone 선택 작업과 전체 Gate">
    <div className={styles.controls}><h4>선택 작업 범위</h4><ContextHelp label="Milestone 선택 작업과 전체 Gate 도움말"><p>작업 검색·상태·기간은 관련 일반 Task와 Assignment 지표에 적용됩니다. 전체 Gate는 전체 소속 작업과 직접 선행 Milestone 기준이며, 선택 범위의 완료나 진척으로 대체하지 않습니다. 겹치는 하위 경로의 소계를 합산하지 않습니다.</p><p>아래 전체 상태·관리의 Milestone 검색·표시·공수 조건은 별도 조회입니다. 새 Milestone 추가와 소속·관계 관리는 기존 원본 편집기를 사용합니다.</p></ContextHelp></div>
    <dl className={styles.summary} aria-label="Milestone 선택 작업 고유 총계">
      <div><dt>고유 Task</dt><dd>{view.tasks.taskCount}건</dd></div>
      <div><dt>완료 / 지연</dt><dd>{view.tasks.completed.count} / {view.tasks.delayed.count}건</dd></div>
      <div><dt>기간가중 진척</dt><dd>{view.tasks.progress.percent === null ? "미산정" : `${view.tasks.progress.percent.toFixed(1)}%`}</dd></div>
      <div><dt>Assignment</dt><dd>{view.assignments.assignmentCount}건</dd></div>
      <div><dt>계획 M/D</dt><dd>{plannedEffort(view.assignments.effort, "md")}</dd></div>
      <div><dt>계획 M/M</dt><dd>{data.mdPerMm === null ? "환산 기준 미설정" : plannedEffort(view.assignments.effort, "mm")}</dd></div>
      <div><dt>개인 미배정 Task</dt><dd>{view.diagnostics.personallyUnassigned.count}건</dd></div>
      <div><dt>물류 미연결 Task</dt><dd>{view.unlinkedLogisticsCount}건</dd></div>
      <div><dt>공수 미설정 Assignment</dt><dd>{view.assignments.effort.unsetCount}건</dd></div>
    </dl>
    {!view.tasks.taskCount ? <p className={styles.subtle}>현재 조건의 관련 일반 Task가 0건입니다. Milestone의 전체 소속 작업이 0건이라는 뜻은 아닙니다.</p> : null}
    <h4>Milestone 전체 Gate</h4>
    {data.projectRevision !== revision ? <p role="status" className={styles.subtle}>원본 변경으로 이전 조회 결과를 표시 중입니다. Milestone 일정·상태는 최신 조회 후 표시합니다.</p> : null}
    <p className={styles.subtle}>기준일 {data.asOfDate} · 전체 소속·직접 선행 기준. 완료 상태는 원본에서 명시적으로 저장합니다.</p>
    {view.fullMilestones.map(({ milestoneTaskId, stageGate: gate }) => {
      const metadata = milestoneMetadataForReport(data, revision, tasks, milestoneTaskId);
      return <details key={milestoneTaskId}>
        <summary>{metadata.name} · {milestoneFullGateLabel(gate)} · 완료 {gate.completedMemberCount}/{gate.memberCount} Task</summary>
        <p className={styles.subtle}>{metadata.stale ? "일정·상태 최신 조회 대기" : `적용 예정일 ${metadata.start ?? "날짜 미정"} · 상태 ${metadata.status === "completed" ? "완료 기록" : metadata.status === "in_progress" ? "진행 중" : metadata.status === "not_started" ? "시작 전" : "원본에서 확인"}`} · 미완료 선행 {gate.incompletePredecessorMilestoneTaskIds.length}개</p>
        {gate.memberCount === 0 ? <p>전체 소속 작업 0건 · 수동 이벤트입니다.</p> : null}
        <IdentifierDetails identifiers={[{ label: "Milestone ID", value: milestoneTaskId }]}/>
      </details>;
    })}
    {!view.fullMilestones.length ? <p>등록된 Milestone이 없습니다. 아래 전체 상태·관리에서 Milestone을 추가할 수 있습니다.</p> : null}
    <p className={styles.subtle}>전체 상태·관리의 검색·표시·공수 조건은 별도 유지됩니다.</p>
  </section>;
}
