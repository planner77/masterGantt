import { describe, expect, it } from "vitest";
import { buildMilestoneTimelineModel } from "../../../src/features/milestones/milestone-timeline-model";
import { milestoneLaneClusters, milestoneLaneDisplayReason, type MilestoneLanePoint } from "../../../src/features/gantt/milestone-timeline-lane-model";
import { milestoneTimelineFixture } from "../../fixtures/milestone-timeline";

function points(xs: readonly number[]): MilestoneLanePoint[] {
  const rows = buildMilestoneTimelineModel(milestoneTimelineFixture()).timeline.datedMilestones;
  return xs.map((viewportX, i) => ({ row: rows[i % rows.length], viewportX }));
}
describe("single-lane hit and focus clustering", () => {
  it("retains each original anchor while same-date and nearby controls form one cluster", () => {
    const input = points([100, 100, 140]), before = JSON.stringify(input);
    const result = milestoneLaneClusters(input, 0, 400);
    expect(result).toHaveLength(1); expect(result[0].points.map(point => point.viewportX)).toEqual([100, 100, 140]);
    expect(result[0].controlLeft).toBe(20); expect(JSON.stringify(input)).toBe(before);
  });
  it("keeps 160px labels and 6px focus outsets separated at the supported 176px threshold", () => {
    const result = milestoneLaneClusters(points([100, 276, 452]), 0, 700);
    expect(result).toHaveLength(3);
    expect(result[1].controlLeft - (result[0].controlLeft + 160)).toBe(16);
  });
  it("clamps controls only and removes off-page or invalid anchors", () => {
    const result = milestoneLaneClusters(points([0, 299, 300, -1, NaN]), 0, 300);
    expect(result.map(cluster => cluster.controlLeft)).toEqual([8]);
    expect(result.flatMap(cluster => cluster.points.map(point => point.viewportX))).toEqual([0, 299]);
  });
  it("leaves a too-small or absent physical viewport without interactive markers", () => {
    expect(milestoneLaneClusters(points([20]), 0, 175)).toEqual([]);
    expect(milestoneLaneClusters(points([20]), 50, 40)).toEqual([]);
    expect(milestoneLaneClusters(points([20]), NaN, 400)).toEqual([]);
  });
  it("distinguishes full population, undated/invalid input, date viewport, physical clipping and control width", () => {
    const fixture = milestoneTimelineFixture(), model = buildMilestoneTimelineModel(fixture);
    expect(milestoneLaneDisplayReason(buildMilestoneTimelineModel({ tasks: [], links: [] }), [], null, 0)).toContain("프로젝트 전체 Milestone 0개");
    const undated = buildMilestoneTimelineModel({ tasks: fixture.tasks.filter(task => task.taskId === "M4" || task.taskId === "M5"), links: [] });
    expect(milestoneLaneDisplayReason(undated, [], null, 0)).toContain("날짜 미정 1개 · 잘못된 날짜 1개");
    expect(milestoneLaneDisplayReason(model, [], null, 0)).toContain("viewport 없음");
    expect(milestoneLaneDisplayReason(model, [], { visibleLeft: 0, visibleRight: 100, controlLeft: 0 }, 0)).toContain("조작 폭 부족");
    expect(milestoneLaneDisplayReason(model, [], { visibleLeft: 0, visibleRight: 400, controlLeft: 0 }, 0)).toContain("날짜 viewport 0개");
    expect(milestoneLaneDisplayReason(model, points([20]), { visibleLeft: 100, visibleRight: 500, controlLeft: 100 }, 0)).toContain("물리 화면 밖");
  });
});
