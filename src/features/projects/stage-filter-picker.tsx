"use client";
import { IdentifierDetails } from "../../components/identifier-details";
import { useId, useLayoutEffect, useRef, useState } from "react";
import type { ProjectTaskDto } from "@/contracts/projects";
import { stageFilterCandidates } from "./project-search-filter";
import "./stage-filter-picker.css";

export function stageCandidateContext(task: ProjectTaskDto, tasks: readonly ProjectTaskDto[]): string {
  const byExternalId = new Map(tasks.map(item => [item.externalId, item]));
  const context = (item: ProjectTaskDto) => {
    const parents: string[] = [];
    const visited = new Set([item.externalId]);
    let parent = item.parentExternalId;
    while (parent && !visited.has(parent)) {
      visited.add(parent);
      const ancestor = byExternalId.get(parent);
      parents.unshift(ancestor?.name.trim() || "상위 작업 정보 없음");
      parent = ancestor?.parentExternalId ?? null;
    }
    const status = item.status === "completed" ? "완료" : item.status === "in_progress" ? "진행 중" : "미완료";
    return `${parents.join(" / ") || "프로젝트 최상위"} · 적용 예정일 ${item.start ?? "미정"} · 요청일 ${item.requestedStart ?? "미정"} · ${status}`;
  };
  const visible = context(task);
  const name = task.name.trim() || "이름 확인 필요";
  return tasks.some(other => other.type === "milestone" && other.taskId !== task.taskId && (other.name.trim() || "이름 확인 필요") === name && context(other) === visible)
    ? `${visible} · ${task.externalId}` : visible;
}

export function StageFilterPicker({ tasks, value, onChange, allowUnassigned = true }: { tasks: readonly ProjectTaskDto[]; value: string; onChange: (value: string) => void; allowUnassigned?: boolean }) {
  const id = useId(), input = useRef<HTMLInputElement>(null), trigger = useRef<HTMLButtonElement>(null), popup = useRef<HTMLDivElement>(null), list = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false), [query, setQuery] = useState(""), [active, setActive] = useState(0);
  const options = [{ id: "all", label: "전체", task: undefined }, ...(allowUnassigned ? [{ id: "unassigned", label: "미지정", task: undefined }] : []), ...stageFilterCandidates(tasks, query).map((task) => ({ id: task.taskId, label: task.name.trim() || "이름 확인 필요", task }))];
  const chosen = tasks.find((task) => task.taskId === value);
  const label = value === "all" ? "전체" : value === "unassigned" ? "미지정" : (chosen ? chosen.name.trim() || "이름 확인 필요" : "Milestone 없음");
  useLayoutEffect(() => {
    if (!open) return;
    const fit = () => {
      const anchor = trigger.current, panel = popup.current, optionsList = list.current;
      if (!anchor || !panel || !optionsList) return;
      optionsList.style.maxHeight = "";
      const a = anchor.getBoundingClientRect(), natural = panel.getBoundingClientRect();
      // Measure the actual search, border, padding and list margin budget.
      const chrome = natural.height - optionsList.getBoundingClientRect().height;
      const below = Math.max(0, innerHeight - a.bottom - 16), above = Math.max(0, a.top - 16);
      const upward = below < Math.min(160, natural.height) && above > below;
      optionsList.style.maxHeight = `${Math.max(0, Math.min(304, (upward ? above : below) - chrome))}px`;
      const fitted = panel.getBoundingClientRect();
      panel.style.position = "fixed";
      panel.style.left = `${Math.max(8, Math.min(a.left, innerWidth - fitted.width - 8))}px`;
      panel.style.top = `${upward ? Math.max(8, a.top - fitted.height - 8) : a.bottom + 8}px`;
    };
    const onScroll = (event: Event) => { if (!(event.target instanceof Node) || !popup.current?.contains(event.target)) fit(); };
    fit();
    window.addEventListener("resize", fit);
    window.addEventListener("scroll", onScroll, true);
    return () => { window.removeEventListener("resize", fit); window.removeEventListener("scroll", onScroll, true); };
  }, [open, query, options.length]);
  function close() { setOpen(false); requestAnimationFrame(() => trigger.current?.focus({ preventScroll: true })); }
  function choose(index: number) { if (!options[index]) return; onChange(options[index].id); close(); }
  function move(index: number) {
    const next = Math.max(0, Math.min(options.length - 1, index));
    setActive(next);
    // Keyboard navigation targets already exist in the open list. Scroll the
    // option synchronously so End/Home/Arrow key completion includes the
    // visibility contract instead of leaving it to a later animation frame.
    const option = document.getElementById(`${id}-option-${next}`), owner = list.current;
    option?.scrollIntoView({ block: "nearest", inline: "nearest" });
    if (!option || !owner || !owner.contains(option)) return;
    const optionBounds = option.getBoundingClientRect(), ownerBounds = owner.getBoundingClientRect();
    // native scroll의 정수 반올림으로 남은 소수점 잘림만 목록 내부에서 보정한다.
    // 큰 항목은 한 방향만 보정하여 위·아래 경계 사이를 왕복하지 않는다.
    if (optionBounds.top < ownerBounds.top) owner.scrollTop -= Math.ceil(ownerBounds.top - optionBounds.top);
    else if (optionBounds.bottom > ownerBounds.bottom) owner.scrollTop += Math.ceil(optionBounds.bottom - ownerBounds.bottom);
  }
  return <div className="project-stage-filter" onKeyDown={(event) => { if (open && event.key === "Escape") { event.preventDefault(); event.stopPropagation(); close(); } }}>
    <button ref={trigger} type="button" className="secondary-button project-stage-filter-trigger" aria-label={`Milestone: ${label}`} aria-haspopup="listbox" aria-expanded={open} aria-controls={open ? `${id}-list` : undefined} title={label} onClick={() => { if (open) close(); else { setOpen(true); setQuery(""); setActive(0); requestAnimationFrame(() => input.current?.focus()); } }}><span>Milestone: {label}</span><span aria-hidden="true">▾</span></button>
    {open ? <div ref={popup} className="project-stage-filter-popup" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null) && event.relatedTarget !== trigger.current) setOpen(false); }}>
      <label htmlFor={`${id}-input`}>Milestone 이름·외부 ID·작업 ID 검색</label>
      <input id={`${id}-input`} ref={input} role="combobox" aria-autocomplete="list" aria-expanded="true" aria-controls={`${id}-list`} aria-activedescendant={`${id}-option-${active}`} value={query} onChange={(event) => { setQuery(event.target.value); setActive(0); }} onKeyDown={(event) => { if (event.key === "ArrowDown" || event.key === "ArrowUp" || event.key === "Home" || event.key === "End") { event.preventDefault(); event.stopPropagation(); move(event.key === "Home" ? 0 : event.key === "End" ? options.length - 1 : active + (event.key === "ArrowDown" ? 1 : -1)); } else if (event.key === "Enter") { event.preventDefault(); event.stopPropagation(); choose(active); } else if (event.key === "Tab") setOpen(false); }} />
      <ul ref={list} id={`${id}-list`} role="listbox" aria-label="Milestone 조회 조건">{options.map((option, index) => <li id={`${id}-option-${index}`} role="option" aria-selected={value === option.id} data-active={active === index} key={option.id} onMouseDown={(event) => event.preventDefault()} onClick={() => choose(index)}><strong>{option.label}</strong>{option.task ? <small>{stageCandidateContext(option.task, tasks)}</small> : null}</li>)}</ul>
    </div> : null}
    {chosen ? <IdentifierDetails label={`${label} 식별 정보`} identifiers={[{label:"외부 ID",value:chosen.externalId},{label:"작업 ID",value:chosen.taskId}]}/> : null}
    {value !== "all" ? <button className="secondary-button project-stage-clear" type="button" onClick={() => onChange("all")}>Milestone 조건 해제</button> : null}
  </div>;
}
