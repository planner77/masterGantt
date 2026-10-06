"use client";
import { useId, useRef, useState } from "react";
import type { ProjectTaskDto } from "@/contracts/projects";
import { stageFilterCandidates } from "./project-search-filter";
import "./stage-filter-picker.css";

export function StageFilterPicker({ tasks, value, onChange }: { tasks: readonly ProjectTaskDto[]; value: string; onChange: (value: string) => void }) {
  const id = useId(), input = useRef<HTMLInputElement>(null), trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false), [query, setQuery] = useState(""), [active, setActive] = useState(0);
  const options = [{ id: "all", label: "전체", task: undefined }, { id: "unassigned", label: "미지정", task: undefined }, ...stageFilterCandidates(tasks, query).map((task) => ({ id: task.taskId, label: task.name, task }))];
  const chosen = tasks.find((task) => task.taskId === value);
  const label = value === "all" ? "전체" : value === "unassigned" ? "미지정" : chosen?.name ?? "단계 없음";
  function close() { setOpen(false); requestAnimationFrame(() => trigger.current?.focus({ preventScroll: true })); }
  function choose(index: number) { if (!options[index]) return; onChange(options[index].id); close(); }
  function move(index: number) { const next = Math.max(0, Math.min(options.length - 1, index)); setActive(next); requestAnimationFrame(() => document.getElementById(`${id}-option-${next}`)?.scrollIntoView({ block: "nearest", inline: "nearest" })); }
  return <div className="project-stage-filter" onKeyDown={(event) => { if (open && event.key === "Escape") { event.preventDefault(); event.stopPropagation(); close(); } }}>
    <button ref={trigger} type="button" className="secondary-button project-stage-filter-trigger" aria-label={`완료 단계: ${label}`} aria-haspopup="listbox" aria-expanded={open} aria-controls={open ? `${id}-list` : undefined} title={chosen ? `${chosen.name} · ${chosen.externalId} · ${chosen.taskId}` : label} onClick={() => { if (open) close(); else { setOpen(true); setQuery(""); setActive(0); requestAnimationFrame(() => input.current?.focus()); } }}><span>완료 단계: {label}</span><span aria-hidden="true">▾</span></button>
    {open ? <div className="project-stage-filter-popup" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null) && event.relatedTarget !== trigger.current) setOpen(false); }}>
      <label htmlFor={`${id}-input`}>단계 이름·외부 ID·작업 ID 검색</label>
      <input id={`${id}-input`} ref={input} role="combobox" aria-autocomplete="list" aria-expanded="true" aria-controls={`${id}-list`} aria-activedescendant={`${id}-option-${active}`} value={query} onChange={(event) => { setQuery(event.target.value); setActive(0); }} onKeyDown={(event) => { if (event.key === "ArrowDown" || event.key === "ArrowUp" || event.key === "Home" || event.key === "End") { event.preventDefault(); event.stopPropagation(); move(event.key === "Home" ? 0 : event.key === "End" ? options.length - 1 : active + (event.key === "ArrowDown" ? 1 : -1)); } else if (event.key === "Enter") { event.preventDefault(); event.stopPropagation(); choose(active); } else if (event.key === "Tab") setOpen(false); }} />
      <ul id={`${id}-list`} role="listbox" aria-label="완료 단계 조회 조건">{options.map((option, index) => <li id={`${id}-option-${index}`} role="option" aria-selected={value === option.id} data-active={active === index} key={option.id} onMouseDown={(event) => event.preventDefault()} onClick={() => choose(index)}><strong>{option.label}</strong>{option.task ? <small>외부 ID: {option.task.externalId} · 작업 ID: {option.task.taskId}<br />적용 예정일 {option.task.start ?? "미정"} · 요청일 {option.task.requestedStart ?? "미정"}</small> : null}</li>)}</ul>
    </div> : null}
    {value !== "all" ? <button className="secondary-button project-stage-clear" type="button" onClick={() => onChange("all")}>단계 조건 해제</button> : null}
  </div>;
}
