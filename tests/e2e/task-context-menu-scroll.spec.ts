import { expect, test, type Request } from "@playwright/test";
import type { ProjectDto, ProjectTaskDto } from "../../src/contracts/projects";
import { taskContextMenu, taskInformationDialog } from "./helpers/task-context-menu";

test("화면 밖 막대를 우클릭한 뒤 지연된 스크롤 알림은 무시하고 실제 이동에는 메뉴를 닫는다", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.clock.setFixedTime(new Date("2026-09-16T12:00:00Z"));
  const publicId = "a3405d3d-8cb4-4da4-9b0f-43a5de330022";
  const taskId = "00000000-0000-4000-8000-000000000005";
  const apiPath = `/api/projects/${publicId}`;
  const project: ProjectDto = {
    publicId, name: "Menu scroll fixture", description: "Issue #22 scroll regression", revision: 20,
    calendar: { timezone: "Asia/Seoul", weekendDays: [6, 0], holidays: [] },
  };
  // 9월 23일은 이 viewport의 초기 표시 범위 안에 있었다. 초기 작업과 충분히
  // 떨어진 마일스톤을 두고 실제 geometry로 화면 밖이라는 준비 조건을 확인한다.
  const task: ProjectTaskDto = {
    taskId, externalId: "SCROLL-5", name: "Far milestone", type: "milestone", scheduleMode: "auto",
    requestedStart: "2026-10-16", start: "2026-10-16", end: "2026-10-16", duration: 0, progress: 0,
    parentExternalId: null, siblingOrder: 1,
  };
  const firstTask: ProjectTaskDto = {
    ...task, taskId: "00000000-0000-4000-8000-000000000001", externalId: "SCROLL-1",
    name: "Initial task", type: "task", duration: 1, siblingOrder: 0,
    requestedStart: "2026-09-16", start: "2026-09-16", end: "2026-09-16",
  };
  const mutations: Request[] = [];
  await page.route("**/api/projects/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() !== "GET") {
      mutations.push(request);
      await route.fulfill({ status: 405, json: { error: { code: "UNEXPECTED_MUTATION" } } });
    } else if (path === `${apiPath}/edit-sessions/current`) {
      await route.fulfill({ json: { data: { permission: "edit", expiresAt: "2099-01-01T00:00:00Z" } } });
    } else if (path === apiPath) {
      await route.fulfill({ json: { data: { project, tasks: [firstTask, task], links: [], permission: "readonly" } } });
    } else {
      await route.continue();
    }
  });
  await page.goto(`/projects/${publicId}`);
  await expect(page.getByText("편집 가능", { exact: true })).toBeVisible();
  const frame = page.locator(".project-gantt-frame");
  await expect(frame).toHaveAttribute("data-project-gantt-api-instance", /svar-api-/);
  const instance = await frame.getAttribute("data-project-gantt-api-instance");
  const chart = page.locator(".project-gantt-widget .wx-chart").first();
  const bar = page.locator(`.project-gantt-widget .wx-bar[data-task-id=":${taskId}"]`);
  await expect(bar).toBeAttached();
  await expect.poll(() => chart.evaluate((element) => element.scrollWidth - element.clientWidth)).toBeGreaterThan(0);
  await chart.evaluate((element) => { element.scrollLeft = 0; });
  await expect.poll(() => chart.evaluate((element) => element.scrollLeft)).toBe(0);
  await expect.poll(() => bar.evaluate((element) => {
    const parentChart = element.closest(".wx-chart");
    if (!parentChart) throw new Error("마일스톤의 Chart 조상을 찾을 수 없습니다.");
    return element.getBoundingClientRect().left - parentChart.getBoundingClientRect().right;
  })).toBeGreaterThan(0);
  // force/dispatchEvent로 우클릭을 우회하지 않는다. 실제 scrollIntoView 후 클릭을 검증한다.
  await bar.click({ button: "right" });
  await expect(taskContextMenu(page)).toBeVisible();
  await expect(taskInformationDialog(page)).toHaveCount(0);
  const before = await chart.evaluate((element) => element.scrollLeft);
  expect(before).toBeGreaterThan(0);
  // 이동은 이미 끝났고 위치는 동일한 지연 알림을 결정적으로 재현한다.
  await chart.dispatchEvent("scroll");
  await expect(taskContextMenu(page)).toBeVisible();
  expect(await chart.evaluate((element) => element.scrollLeft)).toBe(before);
  // 실제 이후 스크롤은 여전히 메뉴를 닫아야 한다. 타이머나 이벤트 차단은 사용하지 않는다.
  await chart.evaluate((element) => { element.scrollLeft -= 40; });
  await expect(taskContextMenu(page)).toHaveCount(0);
  await expect(taskInformationDialog(page)).toHaveCount(0);
  await expect(frame).toHaveAttribute("data-project-gantt-api-instance", instance!);
  expect(mutations).toHaveLength(0);
});
