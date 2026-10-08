"use client";
import { useEffect, useId, useRef, useState } from "react";
import type { ProjectTaskDto, ProjectLinkDto } from "../../contracts/projects";
import { matchesMembershipSearch, membershipDescription, membershipProjection } from "./milestone-membership-model";
import styles from "./project-task-editor.module.css";

export function MilestoneMembershipPicker({ task, tasks, links, value, disabled, pending = false, onChange, onOpen }: Readonly<{
  task: ProjectTaskDto; tasks: readonly ProjectTaskDto[]; links: readonly ProjectLinkDto[]; value: string | null;
  disabled: boolean; pending?: boolean; onChange: (value: string | null) => void; onOpen: (taskId: string) => void;
}>) {
  const id = useId(), [query, setQuery] = useState(""), [open, setOpen] = useState(false), [active, setActive] = useState(0);
  const optionsRef = useRef<HTMLUListElement>(null);
  useEffect(() => { if (open) optionsRef.current?.querySelector<HTMLElement>(`[id="${id}-option-${active}"]`)?.scrollIntoView({ block: "nearest" }); }, [id, active, open]);
  const options = tasks.filter((row) => row.type === "milestone" && matchesMembershipSearch(row, query));
  let resolved = task.membership;
  let description = membershipDescription(task, tasks), reason: string | null = null;
  try { resolved = membershipProjection(tasks, links, [{ taskId: task.taskId, milestoneTaskId: value }]).membership.get(task.taskId); description = membershipDescription(task, tasks, resolved); }
  catch { reason = "Milestone을 먼저 재개해야 합니다. 기존 Milestone의 소속 구조는 잠겨 있습니다."; }
  const source = resolved?.inheritedFromTaskId;
  const oldTarget = tasks.find((row) => row.taskId === task.membership?.effectiveMilestoneTaskId);
  const completedLock = oldTarget?.status === "completed";
  function choose(target: string | null) { if (disabled || completedLock) return; onChange(target); setOpen(false); setQuery(""); }
  return <div className={styles.membershipField}>
    <label className={styles.field} htmlFor={id}>{task.type === "summary" ? "하위 작업 기본 Milestone" : "Milestone"}
      <input id={id} role="combobox" aria-autocomplete="list" aria-expanded={open && !pending} aria-describedby={disabled || completedLock ? `${id}-lock-description` : undefined} aria-controls={`${id}-list`} aria-activedescendant={open && !pending && options[active] ? `${id}-option-${active}` : undefined}
        value={query} placeholder="Milestone 이름 / 외부 ID / 작업 ID 검색" disabled={pending}
        onFocus={() => setOpen(true)} onBlur={() => setOpen(false)} onChange={(event) => { setQuery(event.target.value); setActive(0); setOpen(true); }}
        onKeyDown={(event) => {
          if (event.key === "Escape" && open) { event.preventDefault(); event.stopPropagation(); setOpen(false); }
          else if (event.key === "Tab") setOpen(false);
          else if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); setOpen(true); setActive((index) => options.length ? (index + (event.key === "ArrowDown" ? 1 : options.length - 1)) % options.length : 0); }
          else if (event.key === "Enter" && open) { event.preventDefault(); const option = options[active]; if (option && option.status !== "completed") choose(option.taskId); }
        }} />
    </label>
    {open && !pending ? <ul ref={optionsRef} id={`${id}-list`} role="listbox" aria-label="Milestone 검색 결과" className={styles.membershipOptions}>
      {options.length ? options.map((option, index) => <li key={option.taskId} id={`${id}-option-${index}`} role="option" aria-selected={index === active} aria-disabled={disabled || completedLock || option.status === "completed"} onMouseDown={(event) => event.preventDefault()} onClick={() => { if (option.status !== "completed") choose(option.taskId); }}>
        <strong>{option.name}</strong><span>{option.start ?? "날짜 미정"} · {option.status === "completed" ? "완료 · 먼저 재개해야 합니다" : option.status === "in_progress" ? "진행 중" : "시작 전"}</span>
      </li>) : <li role="presentation">검색 결과가 없습니다.</li>}
    </ul> : null}
    <p className={styles.caption}>{description}</p>
    {disabled || completedLock ? <p id={`${id}-lock-description`} className={styles.caption}>검색·조회는 가능합니다. Milestone 소속 변경은 잠겨 있습니다.</p> : null}
    {completedLock || reason ? <p className={styles.caption}>{reason ?? "Milestone을 먼저 재개해야 합니다."}</p> : null}
    <div className={styles.membershipActions}>
      {value !== null ? <button type="button" className="secondary-button" disabled={disabled || completedLock} onClick={() => choose(null)}>직접 지정 해제 · 상속으로 복귀</button> : null}
      {source ? <button type="button" className="secondary-button" onClick={() => onOpen(source)}>상속 출처 열기</button> : null}
      {oldTarget ? <button type="button" className="secondary-button" onClick={() => onOpen(oldTarget.taskId)}>Milestone 열기</button> : null}
    </div>
  </div>;
}
