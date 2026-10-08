"use client";
import { useMemo, useState } from "react";
import type { ProjectTaskDto, ProjectLinkDto, ProjectCalendarDto } from "../../contracts/projects";
import type { MilestoneMembershipCommand } from "../../contracts/milestones";
import { matchesMembershipSearch, membershipDescription, membershipImpact, membershipProjection } from "./milestone-membership-model";
import { recalculateHierarchy } from "../../domain/scheduling/hierarchy";
import { workingCalendarFromProjectCalendar } from "./project-task-adapter";
import styles from "./project-task-editor.module.css";

export function MilestoneMembershipPanel({ task, tasks, links, calendar, changes, disabled, pending, onChange, onOpen, onLocate }: Readonly<{
  task: ProjectTaskDto; tasks: readonly ProjectTaskDto[]; links: readonly ProjectLinkDto[]; calendar: ProjectCalendarDto;
  changes: MilestoneMembershipCommand["changes"]; disabled: boolean; pending: boolean;
  onChange: (taskId: string, target: string | null) => void; onOpen: (taskId: string) => void; onLocate: (taskId: string) => void;
}>) {
  const [query, setQuery] = useState(""), [type, setType] = useState("all"), [scope, setScope] = useState("current");
  const wbs = useMemo(() => new Map(recalculateHierarchy(tasks, workingCalendarFromProjectCalendar(calendar)).map((row) => [row.taskId, row.wbs])), [tasks, calendar]);
  const canonical = membershipProjection(tasks, links);
  let preview = canonical, issue: string | null = null, impact = 0;
  try { preview = membershipProjection(tasks, links, changes); impact = membershipImpact(tasks, links, changes); }
  catch { issue = "Milestone를 먼저 재개해야 합니다. 변경할 이전/새 Milestone의 소속 구조가 잠겨 있습니다."; }
  const rows = tasks.filter((row) => row.type !== "milestone" && (type === "all" || row.type === type) && matchesMembershipSearch(row, query)).filter((row) => {
    const membership = canonical.membership.get(row.taskId);
    if (scope === "all") return true;
    if (scope === "direct") return membership?.explicitMilestoneTaskId === task.taskId;
    if (scope === "inherited") return membership?.effectiveMilestoneTaskId === task.taskId && membership.inheritedFromTaskId !== null;
    if (scope === "other") return !!membership?.effectiveMilestoneTaskId && membership.effectiveMilestoneTaskId !== task.taskId;
    if (scope === "unassigned") return !membership?.effectiveMilestoneTaskId;
    return membership?.effectiveMilestoneTaskId === task.taskId || changes.some((change) => change.taskId === row.taskId);
  });
  const roots = tasks.filter((row) => row.membership?.explicitMilestoneTaskId === task.taskId).length;
  return <div className={styles.membershipPanel}>
    <div className={styles.membershipFilters}>
      <label className={styles.searchField}>작업명 / 외부 ID / 작업 ID 검색<input value={query} disabled={pending} onKeyDown={(event) => { if (event.key === "Enter") event.preventDefault(); }} onChange={(event) => setQuery(event.target.value)} /></label>
      <label className={styles.filterField}>유형<select value={type} disabled={pending} onChange={(event) => setType(event.target.value)}><option value="all">Task / Summary</option><option value="task">일반 작업</option><option value="summary">요약 작업</option></select></label>
      <label className={styles.filterField}>소속 상태<select value={scope} disabled={pending} onChange={(event) => setScope(event.target.value)}><option value="current">현재 Milestone</option><option value="all">전체 후보</option><option value="direct">직접 지정</option><option value="inherited">상속</option><option value="other">다른 Milestone</option><option value="unassigned">미지정</option></select></label>
    </div>
    <p className={styles.caption}>직접 지정 항목 {roots}개 · 유효 일반 작업 {canonical.gates.get(task.taskId)?.memberCount ?? 0}개 · 검색 결과 {rows.length}행</p>
    {disabled ? <p className={styles.note}>소속 변경은 편집 권한과 최신 정보가 필요합니다. 다른 저장 단위의 초안을 먼저 저장하거나 명시적으로 폐기해 주세요. 완료된 Milestone는 작업 정보에서 상태를 재개하고 별도로 저장한 뒤 변경할 수 있습니다.</p> : null}
    <div className={styles.membershipTableScroll} tabIndex={0} aria-label="소속 작업 표 가로 스크롤">
      <table className={styles.membershipTable}><colgroup><col style={{ width: 300 }} /><col style={{ width: 88 }} /><col style={{ width: 180 }} /><col style={{ width: 180 }} /><col style={{ width: 100 }} /><col style={{ width: 112 }} /></colgroup>
        <thead><tr><th>작업명 / WBS</th><th>유형</th><th>현재 → 변경 Milestone</th><th>방식 / 출처</th><th>상태</th><th>명령</th></tr></thead>
        <tbody>{rows.map((row) => {
          const before = canonical.membership.get(row.taskId), after = preview.membership.get(row.taskId), change = changes.find((entry) => entry.taskId === row.taskId);
          const oldTarget = tasks.find((entry) => entry.taskId === before?.effectiveMilestoneTaskId);
          const oldLock = oldTarget?.status === "completed";
          const inherited = !!before?.inheritedFromTaskId;
          return <tr key={row.taskId} data-changed={!!change}>
            <td><button type="button" className={styles.membershipTaskLink} disabled={pending} onClick={() => onOpen(row.taskId)}>{row.name}</button><span>WBS {wbs.get(row.taskId)} · 계층: {row.parentExternalId ? tasks.find((entry) => entry.externalId === row.parentExternalId)?.name ?? row.parentExternalId : "프로젝트 최상위"}</span><span>외부 ID: {row.externalId}</span><span>작업 ID: {row.taskId}</span></td>
            <td>{row.type === "summary" ? "요약 작업" : "일반 작업"}</td>
            <td>{oldTarget?.name ?? "미지정"}{change ? <strong> → {tasks.find((entry) => entry.taskId === after?.effectiveMilestoneTaskId)?.name ?? "미지정"}</strong> : null}</td>
            <td>{membershipDescription(row, tasks, before)}{row.type === "summary" ? <span>하위 기본값 · 기존 직접 지정 유지</span> : inherited ? <span>상속 차단은 지원하지 않습니다.</span> : null}{before?.inheritedFromTaskId ? <button type="button" className="secondary-button" disabled={pending} onClick={() => onOpen(before.inheritedFromTaskId!)}>상속 출처 열기</button> : null}</td>
            <td>{row.status === "completed" ? "완료" : row.status === "in_progress" ? "진행 중" : "시작 전"}{oldLock ? <span>Milestone 잠금</span> : null}</td>
            <td><div className={styles.membershipRowActions}>
              <button type="button" className="secondary-button" disabled={disabled || oldLock || after?.explicitMilestoneTaskId === task.taskId} onClick={() => onChange(row.taskId, task.taskId)}>{before?.effectiveMilestoneTaskId && before.effectiveMilestoneTaskId !== task.taskId ? "이 Milestone로 이동" : "직접 지정"}</button>
              {after?.explicitMilestoneTaskId ? <button type="button" className="secondary-button" disabled={disabled || oldLock} onClick={() => onChange(row.taskId, null)}>직접 지정 해제</button> : null}
              {change ? <button type="button" className="secondary-button" disabled={pending} onClick={() => onChange(row.taskId, before?.explicitMilestoneTaskId ?? null)}>변경 취소</button> : null}
              <button type="button" className="secondary-button" disabled={pending} onClick={() => onLocate(row.taskId)}>일정에서 보기</button>
            </div></td>
          </tr>;
        })}</tbody>
      </table>
      {!rows.length ? <p className={styles.assignmentEmpty}>검색 결과가 없습니다. 전체 후보에서 Task/Summary를 찾아 지정할 수 있습니다.</p> : null}
    </div>
    <p className={styles.caption} role="status">변경 예정: 직접 지정 {changes.filter((row) => row.milestoneTaskId !== null).length} / 해제 {changes.filter((row) => row.milestoneTaskId === null).length} · 유효 일반 작업 영향 {impact}개</p>
    {issue ? <p className={styles.error} role="alert">{issue}</p> : null}
    <div className={styles.membershipActions}><button type="button" className="secondary-button" disabled={pending || !changes.length} onClick={() => changes.forEach((change) => onChange(change.taskId, tasks.find((row) => row.taskId === change.taskId)?.membership?.explicitMilestoneTaskId ?? null))}>소속 초안 취소</button></div>
  </div>;
}
