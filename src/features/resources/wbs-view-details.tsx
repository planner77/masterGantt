"use client";
import { useI18n } from "../../lib/i18n/provider";

import { IdentifierDetails } from "@/components/identifier-details";
import { PhysicalConnectionSources } from "./physical-connection-sources";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { WbsViewDetailsDto, WbsViewNode, WbsViewReportDto } from "@/contracts/wbs-dashboard-views";
import type { WbsViewScheduleRequest } from "./resource-drill-context";
import { fetchWbsView, wbsViewErrorMessage } from "./wbs-view-transport";
import { wbsViewNodeLabel } from "./wbs-view-model";
import styles from "./wbs-view.module.css";
let nextWbsDetailConfirmation = 0;
export function WbsViewDetails({ data, node, locked, onStale, onClose, onIntent, onOpenTask, onOpenAssignment, onSchedule }: { data: WbsViewReportDto; node: WbsViewNode; locked: boolean; onStale: () => void; onClose: () => void; onIntent: () => AbortSignal; onOpenTask?: (id: string, trigger: HTMLElement) => void; onOpenAssignment?: (taskId: string, assignmentId: string, resourceId: string, trigger: HTMLElement) => void; onSchedule?: (request: WbsViewScheduleRequest) => void }) {
  const {t, locale, formatNumber } = useI18n();
  const [view, setView] = useState<"tasks" | "assignments">("tasks");
  const [offset, setOffset] = useState(0);
  const [result, setResult] = useState<{key:string;data:WbsViewDetailsDto;owner:WbsViewReportDto;confirmationId:number}|null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [actionPending, setActionPending] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const generation = useRef(0);
  const actionGeneration = useRef(0);
  const actionController = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => {mounted.current=false;actionController.current?.abort();};}, []);
  const key = JSON.stringify([data.snapshotId, node.path, view, offset]);
  useLayoutEffect(() => { actionGeneration.current++; actionController.current?.abort(); }, [key,locked,data]);
  useEffect(() => { heading.current?.focus({preventScroll:true}); }, []);
  useEffect(() => {
    const controller = new AbortController(); const current = ++generation.current;
    queueMicrotask(()=>{if(!controller.signal.aborted){setPending(true); setError(null);}});
    fetchWbsView({projectPublicId:data.projectPublicId, projectRevision:data.projectRevision, input:{spec:data.spec, filters:data.filters, scope:data.sourceContext.scope, projection:{kind:"details",snapshotId:data.snapshotId,path:node.path,view,offset,limit:50}},signal:controller.signal})
      .then(response => { if (!controller.signal.aborted && current === generation.current && response.projection === "details") setResult({key,data:response,owner:data,confirmationId:++nextWbsDetailConfirmation}); })
      .catch(cause => { if (!controller.signal.aborted && current === generation.current) { setError(wbsViewErrorMessage(cause, "상세 조회에 실패했습니다.")); onStale(); } })
      .finally(() => { if (!controller.signal.aborted && current === generation.current) setPending(false); });
    return () => controller.abort();
  }, [key, data, node.path, view, offset, onStale]);
  const detail = result?.key === key && result.owner === data ? result.data : null;
  const actionLocked = locked || pending || actionPending || !detail;
  function beginIntent() {
    const intentSignal=onIntent();
    actionGeneration.current++;
    actionController.current?.abort();
    return intentSignal;
  }
  async function revalidate(action: (intentSignal: AbortSignal) => void) {
    if (actionLocked) return;
    const intentSignal=beginIntent();
    const controller = new AbortController(); actionController.current?.abort(); actionController.current=controller; const current=++actionGeneration.current;
    const abort=() => controller.abort();
    intentSignal.addEventListener("abort",abort,{once:true});
    if(intentSignal.aborted) controller.abort();
    setActionPending(true);
    try {
      await fetchWbsView({projectPublicId:data.projectPublicId,projectRevision:data.projectRevision,input:{spec:data.spec,filters:data.filters,scope:data.sourceContext.scope,projection:{kind:"scope",snapshotId:data.snapshotId,path:node.path}},signal:controller.signal});
      if (mounted.current && !controller.signal.aborted && !intentSignal.aborted && current === actionGeneration.current) action(intentSignal);
    } catch { if(mounted.current && !controller.signal.aborted) {onStale(); setError("원본이 변경되었습니다. 새로고침 후 다시 선택하세요.");} } finally { intentSignal.removeEventListener("abort",abort); if(mounted.current && actionController.current===controller)setActionPending(false); }
  }
  return <section data-projection-detail-key={key} data-wbs-detail-identity={JSON.stringify([node.path,view,offset])} data-detail-state={actionLocked ? "loading" : "ready"} data-detail-confirmation-id={detail ? result?.confirmationId : 0} className={styles.detail} aria-label={t("계층 원본 상세")} onKeyDown={event => { if (event.key === "Escape") {event.stopPropagation(); onClose();} }}>
    <div className={styles.controls}><h3 ref={heading} tabIndex={-1}>{wbsViewNodeLabel(node, locale)}</h3><button type="button" onClick={onClose}>{t("상세 닫기")}</button></div>
    <div className={styles.controls}><button type="button" aria-pressed={view === "tasks"} onClick={() => {beginIntent();setView("tasks");setOffset(0);}}>{t("Task 보기")}</button><button type="button" aria-pressed={view === "assignments"} onClick={() => {beginIntent();setView("assignments");setOffset(0);}}>{t("Assignment 보기")}</button>
      {onSchedule ? <button data-resource-action="scope-schedule" type="button" disabled={actionLocked} onClick={event => {const trigger=event.currentTarget; void revalidate(intentSignal => onSchedule({intentSignal,data,path:node.path,label:wbsViewNodeLabel(node, locale),trigger}));}}>{t("이 범위 일정 보기")}</button> : null}</div>
    {pending ? <p role="status">{t("상세 확인 중…")}</p> : null}{error ? <p role="alert">{t(error ?? "")}</p> : null}
    {detail ? <><p>{formatNumber(detail.totalCount)}{t("건 중")}{" "}{detail.offset + (detail.rows.length ? 1 : 0)}–{detail.offset + detail.rows.length}{t("건")}</p><ul>{detail.rows.map(row => <li key={`${row.taskId}:${row.assignment?.assignmentId ?? "task"}`} data-canonical-task-id={row.taskId} data-canonical-assignment-id={row.assignment?.assignmentId}>
      <strong>{row.taskName}</strong> · {row.status} · {row.assignment ? `${row.assignment.resourceName} · ${row.assignment.plannedMd === null ? t("미설정") : formatNumber(row.assignment.plannedMd)} M/D` : "Task"}
      <div className={styles.controls}>{onOpenTask ? <button data-resource-action="task-original" type="button" disabled={actionLocked} onClick={event => {const trigger=event.currentTarget; void revalidate(() => onOpenTask(row.taskId,trigger));}} aria-label={t("{value0} Task 원본", {value0: row.taskName})}>{t("Task 원본")}</button> : null}
      {row.assignment && onOpenAssignment ? <button data-resource-assignment-edit type="button" disabled={actionLocked || !row.assignment.active} onClick={event => {const trigger=event.currentTarget; const a=row.assignment!; void revalidate(() => onOpenAssignment(row.taskId,a.assignmentId,a.resourceId,trigger));}} aria-label={t("{value0} Assignment 원본", {value0: row.assignment.resourceName})}>{t("Assignment 원본")}</button> : null}
      {onSchedule ? <button data-resource-action="task-schedule" type="button" disabled={actionLocked} onClick={event => {const trigger=event.currentTarget; void revalidate(intentSignal => onSchedule({intentSignal,data,path:node.path,label:row.taskName,trigger,taskId:row.taskId,...(row.assignment ? {assignmentId:row.assignment.assignmentId} : {})}));}}>{t("이 작업 일정 보기")}</button> : null}</div>
      {row.assignment && !row.assignment.active ? <p className={styles.subtle}>{t("비활성 리소스의 기존 배정은 조회 전용입니다.")}</p> : null}
      <details><summary>{t("원본 경로·출처")}</summary><p>{row.wbsPath.map(part => part.name).join(" → ")}</p>
        <IdentifierDetails label={t("작업·배정 원본 식별 정보")} identifiers={[{label:"작업 ID",value:row.taskId},...(row.assignment ? [{label:"Assignment ID",value:row.assignment.assignmentId}] : [])]} />
        <ul>{row.selectedSources.filter(source => source.dimension !== "target").map((source,index) => <li key={`${source.sourceTaskId ?? row.taskId}:${source.entityId}:${index}`}>
          {source.relationKind === "assignment" ? t("개인 배정") : source.relationKind === "controls" ? t("제어 관계") : source.relationKind === "coordinates" ? t("조율 관계") : source.relationKind === "membership" ? t("기준정보 소속") : t("작업 연결")} · {source.inherited ? t("상속") : t("직접")}
          <IdentifierDetails label={t("연결 출처 식별 정보")} identifiers={[{label:"원본 ID",value:source.entityId},...(source.sourceTaskId ? [{label:"원본 작업 ID",value:source.sourceTaskId}] : []),...(source.relatedEntityId ? [{label:"연결 원본 ID",value:source.relatedEntityId}] : [])]} />
        </li>)}</ul>
        <PhysicalConnectionSources sources={row.taskSources.targetSources} />
      </details>

    </li>)}</ul><div className={styles.controls}><button type="button" disabled={offset === 0 || actionLocked} onClick={() => {beginIntent();setOffset(Math.max(0,offset-50));}}>{t("이전 페이지")}</button><button type="button" disabled={detail.nextOffset === null || actionLocked} onClick={() => {beginIntent();setOffset(detail.nextOffset ?? offset);}}>{t("다음 페이지")}</button></div></> : null}
  </section>;
}
