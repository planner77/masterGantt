"use client";
import { useRef, useState } from "react";
import { WBS_VIEW_DIMENSIONS, type WbsViewLevel, type WbsViewSpec } from "@/contracts/wbs-dashboard-views";
import { WBS_VIEW_LABELS, validateWbsViewSpec } from "./wbs-view-model";
import styles from "./wbs-view.module.css";
const levelValue = (level: WbsViewLevel) => typeof level === "string" ? level : "siblings";
export function WbsViewComposer({ spec, onApply, onReset, presets }: { presets?: Array<{label:string;levels:WbsViewLevel[]}>; spec: WbsViewSpec; onApply: (spec: WbsViewSpec) => void; onReset: () => void }) {
  const composer=useRef<HTMLDetailsElement>(null);
  const focusAxis=(index:number) => requestAnimationFrame(()=>{const controls=composer.current?.querySelectorAll<HTMLSelectElement>("ol select");(controls?.[Math.max(0,index)]??composer.current?.querySelector<HTMLButtonElement>("[data-add-axis]"))?.focus();});
  const [draft, setDraft] = useState(spec);
  const [previous, setPrevious] = useState(spec);
  if (previous !== spec) { setPrevious(spec); setDraft(spec); }
  const validation = validateWbsViewSpec(draft);
  const levels = draft.levels ?? [];
  const update = (next: WbsViewLevel[]) => setDraft({ ...draft, levels: next });
  function move(index: number, delta: number) { const next = [...levels]; [next[index], next[index + delta]] = [next[index + delta], next[index]]; update(next); focusAxis(index+delta); }
  return <details ref={composer} className={styles.composer}><summary>조회 구성</summary>
    <p>최상위 관점: <strong>{WBS_VIEW_LABELS[spec.root]}</strong> · 하위 축 없이 단독으로 조회할 수 있습니다.</p>
    <ol>{levels.map((level, index) => <li key={index} className={styles.controls}>
      <label>하위 축 {index + 1}<select value={levelValue(level)} onChange={event => update(levels.map((item, i) => i === index ? event.target.value === "siblings" ? { kind: "siblings", dimensions: ["equipment", "system"] } : event.target.value as WbsViewLevel : item))}>
        {WBS_VIEW_DIMENSIONS.filter(dimension => dimension !== spec.root).map(dimension => <option key={dimension} value={dimension}>{WBS_VIEW_LABELS[dimension]}</option>)}
        {spec.root !== "equipment" && spec.root !== "system" ? <option value="siblings">설비 / 시스템 (같은 깊이)</option> : null}
      </select></label>
      <button type="button" disabled={index === 0} aria-label={`${index + 1}번째 축 위로`} onClick={() => move(index, -1)}>위로</button>
      <button type="button" disabled={index === levels.length - 1} aria-label={`${index + 1}번째 축 아래로`} onClick={() => move(index, 1)}>아래로</button>
      <button type="button" aria-label={`${index + 1}번째 축 삭제`} onClick={() => {update(levels.filter((_, i) => i !== index));focusAxis(Math.min(index,levels.length-2));}}>삭제</button>
    </li>)}</ol>
    <div className={styles.controls}><button data-add-axis type="button" disabled={levels.length >= 7 || !WBS_VIEW_DIMENSIONS.some(d => d !== spec.root && !levels.some(l => typeof l === "string" ? l === d : l.dimensions.includes(d as "equipment" | "system")))} onClick={() => { const dimension = WBS_VIEW_DIMENSIONS.find(d => d !== spec.root && !levels.some(l => typeof l === "string" ? l === d : l.dimensions.includes(d as "equipment" | "system"))); if (dimension) update([...levels, dimension]); }}>하위 축 추가</button>
      {presets?.map(preset => <button type="button" key={preset.label} onClick={() => update(preset.levels)}>{preset.label}</button>)}
      {spec.root === "equipment" && !presets ? <><button type="button" onClick={() => update(["process", "system", "resource"])}>설비 → 공정 → 시스템 → Resource</button><button type="button" onClick={() => update(["milestone", "process"])}>설비 → Milestone → 공정</button></> : null}
      <button type="button" onClick={()=>update([])}>하위 없음</button>
      <button type="button" disabled={!validation.ok} onClick={() => { if (validation.ok) onApply(validation.spec); }}>적용</button>
      <button type="button" onClick={onReset}>조회 초기화</button>
    </div>{!validation.ok ? <p role="alert">{validation.message}</p> : null}
  </details>;
}
