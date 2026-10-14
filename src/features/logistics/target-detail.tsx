"use client";
import { useEffect, useState } from "react";
import type { LogisticsTargetDto, LogisticsTargetUsageDto } from "@/contracts/logistics-targets";
import styles from "./target-ui.module.css";

export function TargetDetail({ publicId, target, revision, onOpenTask, onOpenInstance, disabled = false, taskNames = {} }: { publicId: string; revision: number; target: LogisticsTargetDto; onOpenTask?: (id: string) => void; onOpenInstance?: (kind:"equipment"|"system",id:string)=>void; disabled?: boolean; taskNames?: Record<string,string> }) {
  const [usage, setUsage] = useState<(LogisticsTargetUsageDto & { relatedTasks?: Array<{taskId:string;type:string}> }) | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    void Promise.resolve().then(() => {
      if (controller.signal.aborted) return;
      setUsage(null); setError(false);
      return fetch(`/api/projects/${encodeURIComponent(publicId)}/logistics/targets/${encodeURIComponent(target.id)}/usage`, {signal:controller.signal,cache:"no-store",credentials:"same-origin"}).then(async res => {
      if (!res.ok) throw new Error();
      const body = await res.json();
      if (body.data.projectRevision !== revision || body.data.targetId !== target.id || !Array.isArray(body.data.relatedTasks)) throw new Error();
      if (!controller.signal.aborted) setUsage(body.data);
    }).catch(() => { if (!controller.signal.aborted) setError(true); });
    });
    return () => controller.abort();
  }, [publicId, target.id, revision]);
  const currentUsage = usage?.projectRevision === revision && usage.targetId === target.id ? usage : null;
  return <div className={styles.panel}>
    <p>{target.code} · {target.scope === "project_common" ? "프로젝트 공통" : "공정 대상"} · {target.active ? "활성" : "비활성"}</p>
    <p>{target.description}</p>
    {target.warnings.map(w => <p key={w} role="status">{w}</p>)}
    <ul className={styles.list}>{target.members.map(member => <li key={member.id}>{member.label} ({member.code}) · {member.kind === "equipment" ? `설비 원본 수량 ${member.quantity}` : "System 인스턴스"}{!member.active ? " · 비활성" : ""} · ID {member.entityId}{onOpenInstance?<button type="button" className="secondary-button" disabled={disabled} onClick={()=>onOpenInstance(member.kind,member.entityId)}>원본 인스턴스 수정: {member.label}</button>:null}</li>)}</ul>
    {error ? <p role="alert">공유 사용 현황을 불러오지 못했습니다. 다시 상세를 열어 주세요.</p> : !currentUsage ? <p role="status">사용 현황 조회 중…</p> : <>
      <p>연결 일반 작업 {currentUsage.referencedByTaskCount ?? "미산정"} · 요약 작업 {currentUsage.referencedBySummaryCount ?? "미산정"}</p>
      <ul className={styles.list}>{currentUsage.members.map(m => <li key={m.id}>{m.label}: Target {m.targetCount}개에서 공유 · 기존 직접 작업 연결 {m.directTaskCount}개</li>)}</ul>
      <div className={styles.panel}><h3>관련 작업</h3><ul className={styles.list}>{currentUsage.relatedTasks.map(({taskId:id,type}) => <li key={id}>{taskNames[id] ?? id} · {type} · 작업 ID {id}{onOpenTask ? <button type="button" className="secondary-button" data-target-task-id={id} disabled={disabled} onClick={() => onOpenTask(id)}>원본 작업 편집: {taskNames[id] ?? id}</button> : null}</li>)}</ul>{!currentUsage.relatedTasks.length?<p>관련 작업이 없습니다.</p>:null}</div>
    </>}
    <p className={styles.note}>구성원 연결은 제어·조율 관계나 Resource 배정을 생성하지 않습니다. 작업 범위 수량은 실물 합계나 공수 배분율이 아닙니다.</p>
  </div>;
}
