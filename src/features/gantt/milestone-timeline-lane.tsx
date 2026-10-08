"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { MilestoneTimelineModel } from "../milestones/milestone-timeline-model";
import { WorkspaceDialog } from "../../components/workspace-dialog";
import type { MilestonePlotGeometry } from "./milestone-timeline-adapter";
import { milestoneLaneClusters, milestoneLaneDisplayReason, type MilestoneLanePoint } from "./milestone-timeline-lane-model";
import "./milestone-timeline-lane.css";

export interface MilestoneTimelineCapability {
  readonly enabled?: boolean;
  readonly timelineModel: MilestoneTimelineModel;
  readonly activeMilestoneTaskId?: string | null;
  readonly onOpenMilestone: (taskId: string, actualTrigger: HTMLElement) => void;
  readonly onOpenDashboard: () => void;
}

export function MilestoneTimelineLane({ capability, points, geometry, contextKey, busy, readOnly, onGuide }: Readonly<{
  capability: MilestoneTimelineCapability; points: readonly MilestoneLanePoint[]; geometry: MilestonePlotGeometry | null;
  contextKey: string; busy: boolean; readOnly: boolean; onGuide: (x: number | null) => void;
}>) {
  const clusters = useMemo(() => geometry ? milestoneLaneClusters(points, geometry.visibleLeft, geometry.visibleRight, geometry.controlLeft) : [], [geometry, points]);
  const [roving, setRoving] = useState<string | null>(null);
  const [opened, setOpened] = useState<{ key: string; context: string; page: number } | null>(null);
  const [restore, setRestore] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);
  const [focused, setFocused] = useState<string | null>(null);
  const [selected, setSelected] = useState<{ taskId: string; context: string } | null>(null);
  const trigger = useRef<HTMLElement | null>(null), list = useRef<HTMLButtonElement>(null);
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const current = opened ? clusters.find(cluster => cluster.key === opened.key) : null;
  if (opened && (!current || opened.context !== contextKey)) { setOpened(null); setRestore(true); }
  if (selected && (selected.context !== contextKey || !points.some(point => point.row.task.taskId === selected.taskId))) setSelected(null);
  const active = clusters.find(cluster => cluster.points.some(point => point.row.task.taskId === capability.activeMilestoneTaskId));
  const tabKey = clusters.some(cluster => cluster.key === roving) ? roving : active?.key ?? clusters[0]?.key;
  useEffect(() => {
    if (!restore) return;
    const frame = requestAnimationFrame(() => { if (!document.querySelector("dialog:modal")) list.current?.focus(); }); return () => cancelAnimationFrame(frame);
  }, [restore, opened]);
  useEffect(() => () => onGuide(null), [onGuide]);
  const guidePoint = points.find(point => point.row.task.taskId === focused)
    ?? points.find(point => point.row.task.taskId === hovered)
    ?? points.find(point => point.row.task.taskId === selected?.taskId)
    ?? points.find(point => point.row.task.taskId === capability.activeMilestoneTaskId);
  const guideX = guidePoint?.viewportX ?? null;
  useEffect(() => { onGuide(guideX); }, [guideX, onGuide]);
  function status(point: MilestoneLanePoint) {
    return `${readOnly ? "읽기 전용 · " : ""}${point.row.task.status === "completed" ? "완료" : "미완료"} · ${point.row.gate.manualEvent ? "수동 단계" : point.row.gate.blocked ? "Blocked" : point.row.gate.ready ? "Ready" : "진행 중"}${point.row.gate.completionInconsistent ? " · 완료 불일치" : ""}`;
  }
  function openCluster(key: string, button: HTMLButtonElement) { trigger.current = button; setRestore(false); setOpened({ key, context: contextKey, page: 0 }); }
  function moveLane(key: string, command: string) {
    const index = clusters.findIndex(cluster => cluster.key === key);
    const next = command === "Home" ? 0 : command === "End" ? clusters.length - 1 : Math.max(0, Math.min(clusters.length - 1, index + (command === "ArrowRight" ? 1 : -1)));
    const cluster = clusters[next]; if (cluster) { setRoving(cluster.key); buttons.current.get(cluster.key)?.focus(); }
  }
  const clusterRows = current?.points.slice((opened?.page ?? 0) * 50, ((opened?.page ?? 0) + 1) * 50) ?? [];
  const reason = milestoneLaneDisplayReason(capability.timelineModel, points, geometry, clusters.length);
  return <div className="project-milestone-lane" aria-label="Milestone Timeline" data-context-key={contextKey}>
    <button ref={list} className="project-milestone-lane-list" data-milestone-lane-focus="list" type="button" disabled={busy} aria-label={`프로젝트 전체 Milestone 목록 ${capability.timelineModel.timeline.milestones.length}개 · Task 필터와 범위에 관계없이 전체 프로젝트`} onClick={capability.onOpenDashboard}>프로젝트 전체<br />Milestone ({capability.timelineModel.timeline.milestones.length})</button>
    {reason ? <span className="project-milestone-lane-state" role="status">{reason}</span> : null}
    {geometry ? <div className="project-milestone-lane-plot" style={{ left: geometry.left, width: geometry.width }}>
      {clusters.flatMap(cluster => cluster.points.map(point => <span key={point.row.task.taskId} className="project-milestone-lane-tick" aria-hidden="true" style={{ left: point.viewportX }} data-milestone-tick={point.row.task.taskId} />))}
      {clusters.map(cluster => {
        const single = cluster.points.length === 1, point = cluster.points[0];
        const label = single ? `${point.row.task.name} · ${point.row.date} · ${point.row.task.externalId} · ${status(point)}` : `${cluster.firstDate}${cluster.firstDate === cluster.lastDate ? "" : `–${cluster.lastDate}`} · Milestone ${cluster.points.length}개 · 목록에서 이름과 상태 확인`;
        return <button key={cluster.key} ref={node => { if (node) buttons.current.set(cluster.key, node); else buttons.current.delete(cluster.key); }}
          className="project-milestone-lane-marker" data-milestone-lane-trigger={single ? point.row.task.taskId : cluster.key} style={{ left: cluster.controlLeft }} type="button" disabled={busy} aria-label={label} title={label}
          tabIndex={tabKey === cluster.key ? 0 : -1} onFocus={() => { setRoving(cluster.key); setFocused(point.row.task.taskId); }} onBlur={() => setFocused(null)} onPointerEnter={() => setHovered(point.row.task.taskId)} onPointerLeave={() => setHovered(null)}
          onKeyDown={event => { if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) { event.preventDefault(); moveLane(cluster.key, event.key); } }}
          onClick={event => { setSelected({ taskId: point.row.task.taskId, context: contextKey }); if (single) capability.onOpenMilestone(point.row.task.taskId, event.currentTarget); else openCluster(cluster.key, event.currentTarget); }}>{single ? <><span className="project-milestone-marker-title"><span aria-hidden="true">{point.row.task.status === "completed" ? "✓" : "◆"}</span><span className="project-milestone-marker-name">{point.row.task.name}</span></span><span className="project-milestone-marker-status">{status(point)}</span></> : <><span className="project-milestone-marker-name">{cluster.points.length}개 Milestone</span><span className="project-milestone-marker-status">{cluster.firstDate === cluster.lastDate ? cluster.firstDate : `${cluster.firstDate}–${cluster.lastDate}`}</span></>}</button>;
      })}
    </div> : null}
    {current && opened ? <WorkspaceDialog title="Milestone 날짜 목록" restoreFocusRef={trigger} onClose={() => { setOpened(null); onGuide(null); }}>
      <p>{current.firstDate}–{current.lastDate} · {current.points.length}개</p>
      <div className="project-milestone-cluster-items" onKeyDown={event => {
        if (!["ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) return;
        const items = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>("button")), index = items.indexOf(document.activeElement as HTMLButtonElement);
        const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : Math.max(0, Math.min(items.length - 1, index + (event.key === "ArrowDown" ? 1 : -1)));
        event.preventDefault(); items[next]?.focus();
      }}>{clusterRows.map(point => <button key={point.row.task.taskId} data-milestone-lane-trigger={point.row.task.taskId} type="button" disabled={busy} onClick={event => capability.onOpenMilestone(point.row.task.taskId, event.currentTarget)}>{point.row.task.name} · {point.row.date} · {point.row.task.externalId} · {status(point)}</button>)}</div>
      {current.points.length > 50 ? <div><button type="button" disabled={opened.page === 0} onClick={() => setOpened({ ...opened, page: opened.page - 1 })}>이전 50개</button><button type="button" disabled={(opened.page + 1) * 50 >= current.points.length} onClick={() => setOpened({ ...opened, page: opened.page + 1 })}>다음 50개</button></div> : null}
    </WorkspaceDialog> : null}
  </div>;
}
