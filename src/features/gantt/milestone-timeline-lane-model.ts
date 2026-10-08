import type { MilestoneTimelineRow } from "../milestones/milestone-timeline-model";
import type { MilestoneTimelineModel } from "../milestones/milestone-timeline-model";

export interface MilestoneLanePoint { readonly row: MilestoneTimelineRow; readonly viewportX: number; }
export interface MilestoneLaneCluster {
  readonly key: string;
  readonly points: readonly MilestoneLanePoint[];
  readonly controlLeft: number;
  readonly firstDate: string;
  readonly lastDate: string;
}

export function milestoneLaneDisplayReason(model: MilestoneTimelineModel, points: readonly MilestoneLanePoint[], geometry: { visibleLeft: number; visibleRight: number; controlLeft: number } | null, clusterCount: number): string | null {
  if (!model.timeline.milestones.length) return "프로젝트 전체 Milestone 0개";
  if (!model.timeline.datedMilestones.length) {
    const invalid = model.timeline.undatedMilestones.filter(row => row.dateState === "invalid").length;
    return `확정된 날짜 0개 · 날짜 미정 ${model.timeline.undatedMilestones.length - invalid}개 · 잘못된 날짜 ${invalid}개`;
  }
  if (!geometry) return "표시할 차트 viewport 없음 · 전체 목록에서 확인";
  if (geometry.visibleRight - geometry.controlLeft < 176) return "화면의 조작 폭 부족 · 전체 목록에서 확인";
  if (!points.length) return "현재 날짜 viewport 0개 · 프로젝트 전체 목록은 유지";
  if (!clusterCount) return "현재 물리 화면 밖 · 프로젝트 전체 목록은 유지";
  return null;
}

/** Clustering moves controls only; each date keeps its own original tick.
 * A 160px label control owns 6px focus outset plus 2px separation per side.
 */
export function milestoneLaneClusters(points: readonly MilestoneLanePoint[], visibleLeft: number, visibleRight: number, controlLeft = visibleLeft): readonly MilestoneLaneCluster[] {
  if (!Number.isFinite(visibleLeft) || !Number.isFinite(visibleRight) || !Number.isFinite(controlLeft) || visibleRight - controlLeft < 176) return [];
  const sorted = points.filter(point => point.row.date && Number.isFinite(point.viewportX) && point.viewportX >= visibleLeft && point.viewportX < visibleRight)
    .slice().sort((a, b) => a.viewportX - b.viewportX || (a.row.task.externalId < b.row.task.externalId ? -1 : a.row.task.externalId > b.row.task.externalId ? 1 : a.row.task.taskId < b.row.task.taskId ? -1 : a.row.task.taskId > b.row.task.taskId ? 1 : 0));
  const groups: MilestoneLanePoint[][] = [];
  for (const point of sorted) {
    const last = groups.at(-1);
    const left = Math.max(controlLeft + 8, Math.min(point.viewportX - 80, visibleRight - 168));
    const previousLeft = last ? Math.max(controlLeft + 8, Math.min(last[0].viewportX - 80, visibleRight - 168)) : -Infinity;
    if (last && left - previousLeft < 176) last.push(point); else groups.push([point]);
  }
  return groups.map(group => ({ key: group.map(point => `${point.row.task.taskId}:${point.row.date}`).join("|"), points: group,
    controlLeft: Math.max(controlLeft + 8, Math.min(group[0].viewportX - 80, visibleRight - 168)), firstDate: group[0].row.date!, lastDate: group.at(-1)!.row.date! }));
}
