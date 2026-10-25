import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { MilestoneDashboardStageDto } from "../../../src/contracts/milestone-dashboard";
import { ProjectMilestoneStageTable } from "../../../src/features/milestones/project-milestone-stage-table";
import { milestoneTimelineFixture } from "../../fixtures/milestone-timeline";

describe("Milestone name-first identity", () => {
  it("keeps duplicate names with status/date context and full canonical IDs in closed disclosure", () => {
    const tasks = milestoneTimelineFixture().tasks.filter((task) => ["M1", "M2"].includes(task.taskId)).map((task, index) => ({
      ...task,
      taskId: `00000000-0000-4000-8000-00000000000${index}`,
      externalId: `EXTERNAL-IDENTIFIER-WITHOUT-TRUNCATION-${index}`,
    }));
    const rows: MilestoneDashboardStageDto[] = tasks.map((task) => ({
      milestoneTaskId: task.taskId, externalId: task.externalId, name: task.name,
      scheduledDate: task.start!, status: task.status ?? "not_started", progress: task.progress!, stageGate: task.stageGate!,
      memberDurationSum: 0, memberWeightedProgressSum: 0, overdue: false, upcoming: false,
      atRisk: false, riskTaskIds: [], risks: [],
    }));
    const before = JSON.stringify({ tasks, rows });
    const markup = renderToStaticMarkup(createElement(ProjectMilestoneStageTable, { tasks, rows, enabled: true, onOpenTask: () => {} }));
    const visibleText = markup.replace(/<details\b[\s\S]*?<\/details>/g, "").replace(/<[^>]+>/g, "");
    expect(visibleText).toContain(tasks[0].name);
    expect(visibleText).toContain("2026-10-12");
    expect(visibleText).toContain("시작 전");
    expect(visibleText).toContain("완료 기록");
    for (const task of tasks) {
      expect(visibleText).not.toContain(task.externalId);
      expect(visibleText).not.toContain(task.taskId);
      expect(markup).toContain(task.externalId);
      expect(markup).toContain(task.taskId);
    }
    expect(markup.match(/<details\b/g)).toHaveLength(2);
    expect(markup).not.toMatch(/<details[^>]*\sopen(?:=|\s|>)/);
    expect(JSON.stringify({ tasks, rows })).toBe(before);
    const missingName = renderToStaticMarkup(createElement(ProjectMilestoneStageTable, { tasks, rows: rows.map(row => ({ ...row, name: "" })), enabled: true, onOpenTask: () => {} }));
    expect(missingName).toContain(">이름 확인 필요</button>");
  });
});
