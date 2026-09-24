import { randomUUID } from "node:crypto";
import type { Locator } from "@playwright/test";
import { expect, test, isolatedApplicationOptions } from "./fixtures/isolated-application";
import { expectSameGanttRoot, installStatefulProjectFixture, publicId, rememberGanttRoot } from "../fixtures/stateful-project";

test.use(isolatedApplicationOptions);

async function expectTwoToolbarRows(search: Locator, filter: Locator, result: Locator, reset: Locator, width: number) {
  const [searchBox, filterBox, resultBox, resetBox] = await Promise.all([search.boundingBox(), filter.boundingBox(), result.boundingBox(), reset.boundingBox()]);
  for (const box of [searchBox, filterBox, resultBox, resetBox]) {
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(width);
  }
  expect(searchBox!.y).toBeLessThan(filterBox!.y + filterBox!.height);
  expect(filterBox!.y).toBeLessThan(searchBox!.y + searchBox!.height);
  expect(resultBox!.y).toBeGreaterThanOrEqual(searchBox!.y + searchBox!.height - 1);
  expect(resetBox!.y).toBeGreaterThanOrEqual(filterBox!.y + filterBox!.height - 1);
}

test("Issue #130 Phase 4 Project List 검색·필터 상태와 Reset focus를 다섯 폭에서 유지한다", async ({ page, baseURL }, testInfo) => {
  const suffix = randomUUID().slice(0, 8);
  for (const name of [`Project Alpha ${suffix}`, `Project Beta ${suffix}`]) {
    const response = await page.request.post("/api/projects", {
      headers: { Origin: baseURL! },
      data: { name, ownerName: "Filter Team", description: "searchable description", editPassword: "PwdF123456!" },
    });
    expect(response.status()).toBe(201);
  }
  await page.goto("/");
  const toolbar = page.getByRole("search", { name: "프로젝트 검색과 필터" });
  const search = toolbar.getByRole("searchbox");
  const filter = toolbar.locator('button[aria-controls="project-list-advanced-filter"]');
  const result = toolbar.getByRole("status");
  const reset = toolbar.getByRole("button", { name: "초기화", exact: true });
  await expect(result).toContainText("2 / 2개 프로젝트");
  await expect(reset).toHaveCount(0);
  for (const [width, height] of [[390, 844], [768, 900], [1024, 900], [1440, 900], [1600, 900]] as const) {
    await page.setViewportSize({ width, height });
    await search.fill("Alpha");
    await expect(filter).toHaveText("필터 1");
    await expect(result).toContainText("1 / 2개 프로젝트");
    await expect(reset).toBeVisible();
    if (width <= 768) {
      await expectTwoToolbarRows(search, filter, result, reset, width);
    }
    await page.screenshot({ path: testInfo.outputPath(`issue-130-phase4-list-current-${width}.png`) });
    await filter.click();
    const panel = page.getByLabel("프로젝트 고급 필터");
    await expect(panel).toBeVisible();
    await panel.getByRole("textbox", { name: "프로젝트명", exact: true }).focus();
    await page.keyboard.press("Escape");
    await expect(panel).toHaveCount(0);
    await expect(filter).toBeFocused();
    await reset.click();
    await expect(search).toBeFocused();
    await expect(reset).toHaveCount(0);
    await expect(result).toContainText("2 / 2개 프로젝트");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
  }
});

test("Issue #130 Phase 4 일정·리소스 필터는 같은 조작 계층과 API 불변 경계를 유지한다", async ({ page }, testInfo) => {
  await installStatefulProjectFixture(page);
  await page.goto(`/projects/${publicId}`);
  const ganttIdentity = await rememberGanttRoot(page);
  await page.getByRole("tab", { name: "리소스", exact: true }).click();
  await expect(page.locator('[data-source="workload"]')).toHaveAttribute("data-state", "ready");
  await expect(page.locator('[data-source="targets"]')).toHaveAttribute("data-state", "ready");
  await page.getByRole("tab", { name: "일정", exact: true }).click();
  const filterRequests: string[] = [];
  page.on("request", (request) => {
    const path = new URL(request.url()).pathname;
    if (!["GET", "HEAD"].includes(request.method()) || path.endsWith("/resource-workload") || path.endsWith("/assigned-targets")) filterRequests.push(request.url());
  });

  for (const width of [390, 768, 1024, 1440, 1600]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    const taskToolbar = page.getByRole("toolbar", { name: "작업 검색과 필터" });
    const taskSearch = taskToolbar.getByRole("searchbox");
    const taskFilter = taskToolbar.locator('button[aria-controls="project-task-filter-panel"]');
    await taskSearch.fill("Stable leaf");
    await expect(taskFilter).toHaveText("필터 1");
    await expect(taskToolbar.getByRole("status")).toContainText("1개 일치 / 전체 4개 작업");
    await expect(page.locator(".schedule-heading-row p")).toHaveText("작업 일정을 확인하고 관리합니다.");
    const taskReset = taskToolbar.getByRole("button", { name: "초기화" });
    await expect(taskReset).toBeVisible();
    if (width <= 768) await expectTwoToolbarRows(taskSearch, taskFilter, taskToolbar.getByRole("status"), taskReset, width);
    await taskFilter.click();
    await page.locator("#project-task-filter-panel").getByLabel("작업명", { exact: true }).focus();
    await page.keyboard.press("Escape");
    await expect(taskFilter).toBeFocused();
    await taskReset.click();
    await expect(taskSearch).toBeFocused();
    await expect(taskReset).toHaveCount(0);

    await page.getByRole("tab", { name: "리소스", exact: true }).click();
    const resourceToolbar = page.getByRole("search", { name: "리소스 검색과 필터" });
    const resourceSearch = resourceToolbar.getByRole("searchbox");
    const resourceFilter = resourceToolbar.locator('button[aria-controls="resource-advanced-filter"]');
    const resourceReset = resourceToolbar.getByRole("button", { name: "초기화" });
    await expect(resourceFilter).toHaveAttribute("aria-expanded", "false");
    await expect(resourceReset).toHaveCount(0);
    await resourceSearch.fill("R-01");
    await expect(resourceFilter).toHaveText("필터 1");
    await expect(resourceToolbar.getByRole("status")).toContainText("리소스 1 / 전체 1");
    await resourceFilter.click();
    const advanced = page.getByLabel("리소스 고급 필터");
    await advanced.getByLabel("종류").selectOption("resource");
    await expect(resourceFilter).toHaveText("필터 2");
    await advanced.getByLabel("Task 기간 From").fill("2026-09-18");
    await expect(advanced.getByRole("status")).toContainText("기간 조건은 아직 적용되지 않습니다");
    await expect(resourceFilter).toHaveText("필터 2");
    await expect(resourceToolbar.getByRole("status")).toContainText("리소스 1 / 전체 1");
    await advanced.getByLabel("Task 기간 To").fill("2026-09-16");
    await expect(resourceFilter).toHaveText("필터 3");
    await expect(advanced.getByRole("status")).toContainText("두 날짜 사이");
    await page.keyboard.press("Escape");
    await expect(advanced).toBeHidden();
    await expect(resourceFilter).toBeFocused();
    await expect(resourceReset).toBeVisible();
    if (width <= 768) await expectTwoToolbarRows(resourceSearch, resourceFilter, resourceToolbar.getByRole("status"), resourceReset, width);
    await page.screenshot({ path: testInfo.outputPath(`issue-130-phase4-resource-current-${width}.png`) });
    await resourceReset.click();
    await expect(resourceSearch).toBeFocused();
    await expect(resourceReset).toHaveCount(0);
    await expect(resourceToolbar.getByRole("status")).toContainText("리소스 1 / 전체 1");
    await resourceFilter.click();
    await advanced.getByLabel("Task 기간 From").fill("2026-09-18");
    await expect(resourceFilter).toHaveText("필터");
    await expect(resourceReset).toBeVisible();
    await expect(advanced.getByRole("status")).toContainText("기간 조건은 아직 적용되지 않습니다");
    await expect(resourceToolbar.getByRole("status")).toContainText("리소스 1 / 전체 1");
    await resourceReset.click();
    await expect(resourceSearch).toBeFocused();
    await expect(resourceReset).toHaveCount(0);
    await advanced.getByLabel("Task 기간 From").focus();
    await page.keyboard.press("Escape");
    await expect(advanced).toBeHidden();
    await expect(resourceFilter).toHaveAttribute("aria-expanded", "false");
    await expect(resourceFilter).toBeFocused();
    await page.getByRole("tab", { name: "일정", exact: true }).click();
    await expectSameGanttRoot(page, ganttIdentity);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
  }
  expect(filterRequests).toEqual([]);
});
