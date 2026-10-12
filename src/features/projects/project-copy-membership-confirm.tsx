"use client";
import { useEffect, useRef, useSyncExternalStore, type RefObject } from "react";
import { createPortal } from "react-dom";
import type { ProjectTaskDto } from "@/contracts/projects";
import { WorkspaceDialog } from "@/components/workspace-dialog";
import { COPY_REASON_LABELS, copyInheritanceLabel, copyMilestoneLabel, taskIdentity, type CopyReview } from "./project-copy-confirm-model";
import styles from "./project-copy-membership-confirm.module.css";

const subscribeFullscreen=(onChange:()=>void)=>{document.addEventListener("fullscreenchange",onChange);return()=>document.removeEventListener("fullscreenchange",onChange);};
const fullscreenHost=()=>document.querySelector<HTMLElement>(".project-gantt-frame:fullscreen");
const serverHost=()=>null;

export function ProjectCopyMembershipConfirm({ review, tasks, current, pending, error, restoreFocusRef, onClose, onConfirm }: Readonly<{ review: CopyReview; tasks: readonly ProjectTaskDto[]; current: boolean; pending: boolean; error: string | null; restoreFocusRef: RefObject<HTMLElement | null>; onClose: () => void; onConfirm: () => void }>) {
  const cancel = useRef<HTMLButtonElement>(null);
  const host=useSyncExternalStore(subscribeFullscreen,fullscreenHost,serverHost);
  useEffect(() => { cancel.current?.focus({ preventScroll: true }); }, []);
  const dialog = <WorkspaceDialog title="복사 시 Milestone 소속 변경" size="wide" busy={pending} restoreFocusRef={restoreFocusRef} onClose={onClose}>
    <div className={styles.content}><div className={styles.body}>
      <p>검토 revision {review.revision} · 복사 root {review.plan.rootTaskIds.length}개 · 하위 포함 {review.plan.copiedTaskIds.length}개</p>
      <p>외부 명시 연결 제외 {review.plan.excludedExplicitMemberships.length}개 · 소속 또는 상속 출처가 달라지는 Task/Summary {review.plan.impacts.length}개</p>
      <p>내부 Milestone 연결은 복사본에 보존합니다. 복제될 Milestone의 원본 ID는 아직 생성되지 않은 복사본 UUID가 아닙니다.</p>
      <div className={styles.tableOwner} role="region" aria-label="복사 소속 영향 표 가로 스크롤" tabIndex={0}>
        <table><colgroup><col /><col style={{ width:180 }} /><col style={{ width:180 }} /><col style={{ width:160 }} /></colgroup><thead><tr><th scope="col">복사할 작업</th><th scope="col">현재 소속 · 출처</th><th scope="col">복사 후 소속 · 출처</th><th scope="col">변경 이유</th></tr></thead><tbody>
          {review.plan.impacts.map((impact) => <tr key={impact.sourceTaskId}><td>{taskIdentity(tasks, impact.sourceTaskId)}</td><td>{impact.beforeEffectiveMilestoneTaskId ? `기존 Milestone · ${taskIdentity(tasks, impact.beforeEffectiveMilestoneTaskId)}` : "미지정"}<small>{impact.beforeInheritedFromTaskId ? `기존 Summary 상속 · ${taskIdentity(tasks, impact.beforeInheritedFromTaskId)}` : "직접 지정 또는 미지정"}</small></td><td>{copyMilestoneLabel(impact.afterEffective, tasks)}<small>{copyInheritanceLabel(impact.afterInheritedFrom, tasks)}</small></td><td>{impact.reasons.map((reason) => <p key={reason}>{COPY_REASON_LABELS[reason]}</p>)}</td></tr>)}
        </tbody></table>
      </div>
      {!current ? <p role="alert">프로젝트 또는 복사 조건이 변경되어 이 확인은 만료되었습니다. 취소 후 최신 일정에서 다시 복사해 주세요.</p> : null}
      {error ? <p role="alert">{error}</p> : null}
      </div><div className={styles.actions}><button ref={cancel} type="button" className="secondary-button" disabled={pending} onClick={onClose}>취소</button><button type="button" className="primary-button" disabled={!current || pending} onClick={onConfirm}>{pending ? "복사 중…" : "변경 내용을 확인하고 복사"}</button></div>
    </div>
  </WorkspaceDialog>;
  return host ? createPortal(dialog,host) : dialog;
}
