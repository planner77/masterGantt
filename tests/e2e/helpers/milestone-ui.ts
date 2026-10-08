import { expect, type Page } from "@playwright/test";
import type { MilestoneDashboardFilterInput } from "../../../src/contracts/milestone-dashboard";
import { createWorkingCalendar } from "../../../src/domain/scheduling/calendar";
import { projectStageGates } from "../../../src/domain/milestones/stage-gates";
import { stageSnapshotFromProject } from "../../../src/domain/milestones/project-stage-model";
import { calculateMilestoneDashboard } from "../../../src/server/projects/milestone-dashboard-calculation-core";
import { projectPath, type StatefulProjectFixture } from "../../fixtures/stateful-project";

/** Full Gate/member projections come from the authored canonical fixture, never fixed completion rows. */
export function canonicalMilestoneDashboard(state: StatefulProjectFixture, params = new URLSearchParams()) {
  const filter: MilestoneDashboardFilterInput = {};
  for (const key of ["search", "asOfDate", "from", "to"] as const) if (params.has(key)) Object.assign(filter, { [key]: params.get(key) });
  if (params.has("milestoneIds")) filter.milestoneIds = params.getAll("milestoneIds");
  return calculateMilestoneDashboard({ project: state.project, tasks: state.tasks,
    stageSnapshot: stageSnapshotFromProject(state.tasks, state.links), catalogRevision: 1,
    logistics: state.logistics ?? { processes: [], equipment: [], systems: [], systemLinks: [] },
    assignments: [], resources: [], groups: [], calendarForResource: () => createWorkingCalendar(state.project.calendar),
    filter, now: new Date("2026-10-06T00:00:00Z"), mdPerMmEnvironment: "20" });
}

/** Same full canonical projections as the stateful GET fixture for synthetic mutation responses. */
export function canonicalMilestoneTasks(state: StatefulProjectFixture) {
  const projection = projectStageGates(stageSnapshotFromProject(state.tasks, state.links));
  return state.tasks.map(entry => ({ ...entry, membership:projection.membership.get(entry.taskId)!, ...(entry.type === "milestone" ? {stageGate:projection.gates.get(entry.taskId)!} : {}) }));
}

/** Synthetic-only report adapter; actual HTTP specs never call this helper. */
export async function installMilestoneDashboardFixture(page: Page, state: StatefulProjectFixture) {
  await page.route(`**${projectPath}/milestone-dashboard*`, route => route.fulfill({ json: {
    data: canonicalMilestoneDashboard(state, new URL(route.request().url()).searchParams),
  } }));
}

/** Exact canonical identity works for equal names and milestones outside the date viewport. */
export async function openMilestoneEditor(page: Page, taskId: string) {
  await page.getByRole("tab", { name: "Milestone 대시보드", exact: true }).click();
  const panel = page.locator("#project-panel-milestones");
  await expect(panel.getByTestId("milestone-dashboard")).toHaveAttribute("data-ready", "true");
  const row = panel.locator(`[data-milestone-task-id="${taskId}"]`);
  await expect(row).toHaveCount(1);
  await row.getByRole("button", { name: / 단계 상세$/ }).click();
  const dialog = page.getByRole("dialog", { name: "작업 정보", exact: true });
  await expect(dialog).toBeVisible();
  return dialog;
}
