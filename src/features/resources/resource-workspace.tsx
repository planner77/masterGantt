"use client";
import { createContext, useCallback, useContext, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import styles from "./resource-workspace.module.css";

export type ResourceWorkspaceView = "summary" | "dynamic" | "milestone" | "plan" | "estimate";
export type ResourceWorkspacePeriod = { from: string; to: string; asOfDate: string; revision: number; snapshotId: string };
type Periods = Partial<Record<"report" | "dynamic", ResourceWorkspacePeriod>>;
const ResourceWorkspaceContext = createContext<{
  periods: Periods;
  publishPeriod: (kind: "report" | "dynamic", period: ResourceWorkspacePeriod) => void;
} | null>(null);
export const useResourceWorkspace = () => useContext(ResourceWorkspaceContext);
const VIEWS: ReadonlyArray<readonly [ResourceWorkspaceView, string]> = [
  ["summary", "기본 현황"], ["dynamic", "동적 계층 탐색"], ["milestone", "Milestone 교차"],
  ["plan", "Resource Plan"], ["estimate", "견적·Excel"],
];

/** Visits own their peer selection just as the existing report adapters own filters. */
export function ResourceWorkspace({ active, viewId, liveViewIds, revision, renderDynamic, renderReport }: {
  active: boolean; viewId: number; liveViewIds: readonly number[]; revision: number;
  renderDynamic: (active: boolean) => ReactNode;
  renderReport: (active: boolean, views: Readonly<Record<string, ResourceWorkspaceView>>) => ReactNode;
}) {
  const id = useId();
  const host = useRef<HTMLDivElement>(null);
  const navigation = useRef<HTMLDivElement>(null);
  const scrollPositions = useRef<Record<string, number>>({});
  useLayoutEffect(() => {
    const panel = host.current?.closest<HTMLElement>(".project-resource-panel"), nav = navigation.current;
    if (!panel || !nav) return;
    const previous = panel.style.scrollPaddingTop;
    const measure = () => { panel.style.scrollPaddingTop = `${nav.getBoundingClientRect().height + 8}px`; };
    const observer = new ResizeObserver(measure); observer.observe(nav); measure();
    return () => { observer.disconnect(); panel.style.scrollPaddingTop = previous; };
  }, []);
  const [visits, setVisits] = useState<Record<string, { view: ResourceWorkspaceView; periods: Periods }>>({});
  const key = String(viewId), pinned = new Set(liveViewIds.map(String));
  pinned.add(key);
  let current = visits;
  if (Object.keys(visits).some(visit => !pinned.has(visit))) current = Object.fromEntries(Object.entries(visits).filter(([visit]) => pinned.has(visit)));
  if (!current[key]) current = { ...current, [key]: { view: "summary", periods: {} } };
  if (current !== visits) setVisits(current);
  const view = current[key].view;
  const select = (next: ResourceWorkspaceView) => {
    const panel = host.current?.closest<HTMLElement>(".project-resource-panel");
    if (panel) scrollPositions.current[`${key}:${view}`] = panel.scrollTop;
    setVisits(previous => ({ ...previous, [key]: { ...previous[key], view: next } }));
  };
  useLayoutEffect(() => {
    const panel = host.current?.closest<HTMLElement>(".project-resource-panel");
    if (!active || !panel) return;
    panel.scrollTop = scrollPositions.current[`${key}:${view}`] ?? 0;
    const remember = () => { scrollPositions.current[`${key}:${view}`] = panel.scrollTop; };
    panel.addEventListener("scroll", remember, { passive: true });
    return () => panel.removeEventListener("scroll", remember);
  }, [active, key, view]);
  const publishPeriod = useCallback((kind: "report" | "dynamic", period: ResourceWorkspacePeriod) => {
    setVisits(previous => {
      const visit = previous[key];
      if (!visit || JSON.stringify(visit.periods[kind]) === JSON.stringify(period)) return previous;
      return { ...previous, [key]: { ...visit, periods: { ...visit.periods, [kind]: period } } };
    });
  }, [key]);
  const periods = Object.fromEntries(Object.entries(current[key].periods).filter(([, period]) => period.revision === revision));
  return <ResourceWorkspaceContext.Provider value={{ periods, publishPeriod }}>
    <div ref={host} className={styles.workspace} data-resource-workspace data-resource-peer={view}>
      <div ref={navigation} className={styles.views} role="group" aria-label="리소스 분석 보기">
        {VIEWS.map(([value, label]) => <button key={value} type="button" aria-pressed={view === value}
          aria-controls={`${id}-${value === "dynamic" ? "dynamic" : "report"}`} onClick={() => select(value)}>{label}</button>)}
      </div>
      <div id={`${id}-report`} hidden={view === "dynamic"} inert={view === "dynamic"}>
        {renderReport(active && view !== "dynamic", Object.fromEntries(Object.entries(current).map(([visit, state]) => [visit, state.view])))}
      </div>
      <div id={`${id}-dynamic`} hidden={view !== "dynamic"} inert={view !== "dynamic"}>
        {renderDynamic(active && view === "dynamic")}
      </div>
    </div>
  </ResourceWorkspaceContext.Provider>;
}
