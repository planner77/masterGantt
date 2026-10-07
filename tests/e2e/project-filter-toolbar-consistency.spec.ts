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

async function expectDirectChildrenDoNotOverlap(container: Locator) {
  const overlaps = await container.evaluate((root) => {
    const boxes = Array.from(root.children)
      .filter((element) => {
        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
      })
      .map((element) => ({
        label: element.getAttribute("aria-label") ?? element.textContent?.trim().slice(0, 40) ?? element.tagName,
        rect: element.getBoundingClientRect(),
      }));
    const collisions: string[] = [];
    for (let left = 0; left < boxes.length; left += 1) {
      for (let right = left + 1; right < boxes.length; right += 1) {
        const a = boxes[left].rect;
        const b = boxes[right].rect;
        const horizontal = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        const vertical = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        if (horizontal > 1 && vertical > 1) collisions.push(`${boxes[left].label} <> ${boxes[right].label}`);
      }
    }
    return collisions;
  });
  expect(overlaps).toEqual([]);
}

async function expectAdvancedControlsWithinBounds(panel: Locator) {
  const geometry = await panel.evaluate((root) => {
    const panelRect = root.getBoundingClientRect();
    const controls = Array.from(root.querySelectorAll<HTMLElement>("input, select, button"))
      .filter((element) => {
        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
      })
      .map((element, index) => ({
        index,
        label: element.getAttribute("aria-label") ?? element.closest("label")?.textContent?.trim().slice(0, 40) ?? element.tagName,
        rect: element.getBoundingClientRect(),
      }));
    const outside = controls
      .filter(({ rect }) => rect.left < panelRect.left - 1 || rect.right > panelRect.right + 1)
      .map(({ index, label }) => `${index}:${label}`);
    const overlaps: string[] = [];
    for (let left = 0; left < controls.length; left += 1) {
      for (let right = left + 1; right < controls.length; right += 1) {
        const a = controls[left].rect;
        const b = controls[right].rect;
        const horizontal = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        const vertical = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        if (horizontal > 1 && vertical > 1) overlaps.push(`${controls[left].label} <> ${controls[right].label}`);
      }
    }
    return { outside, overlaps };
  });
  expect(geometry.outside).toEqual([]);
  expect(geometry.overlaps).toEqual([]);
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
    await panel.locator("summary").filter({ hasText: "프로젝트 정보" }).click();
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
  const fixture = await installStatefulProjectFixture(page);
  const timestamp = "2026-09-28T00:00:00.000Z";
  fixture.logistics = {
    processes: [{ id: "process-long-1", code: "PROC-LONG-001", name: "조립 공정 매우 긴 표시 이름", parentProcessId: null, sortOrder: 0, active: true, createdAt: timestamp, updatedAt: timestamp }],
    equipment: [{ id: "equipment-long-1", processId: "process-long-1", code: "EQUIP-LONG-001", name: "자동 반송 설비 매우 긴 표시 이름", equipmentType: "conveyor", managementUnit: "unit", quantity: 1, manufacturer: "", model: "", description: "", active: true, controlSystems: [], resourceRoles: [], createdAt: timestamp, updatedAt: timestamp }],
    systems: [{ id: "system-long-1", code: "SYSTEM-LONG-001", name: "물류 제어 시스템 매우 긴 표시 이름", systemType: "mcs", layer: "coordinator", scope: "project", processIds: ["process-long-1"], coordinatedSystemIds: [], resourceRoles: [], vendor: "", description: "", active: true, createdAt: timestamp, updatedAt: timestamp }],
    systemLinks: [], taskEquipmentLinks: [], taskSystemLinks: [],
  };
  await page.goto(`/projects/${publicId}`);
  const ganttIdentity = await rememberGanttRoot(page);
  await page.getByRole("tab", { name: "리소스", exact: true }).click();
  await expect(page.locator('[data-source="workload"]')).toHaveAttribute("data-state", "ready");
  await expect(page.locator('[data-resource-dashboard="true"]')).toHaveAttribute("data-ready", "true");
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
    const taskAdvanced = page.getByLabel("작업 고급 필터");
    await expect(taskAdvanced).toBeVisible();
    await expect(taskAdvanced.getByRole("heading", { name: "텍스트" })).toBeVisible();
    await expect(taskAdvanced.getByRole("heading", { name: "일정 · 수치" })).toBeVisible();
    await expect(taskAdvanced.getByRole("heading", { name: "유형 · 할당" })).toBeVisible();
    await expect(taskAdvanced.getByRole("heading", { name: "물류" })).toBeVisible();
    await expectDirectChildrenDoNotOverlap(taskToolbar);
    await expectAdvancedControlsWithinBounds(taskAdvanced);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`issue-260-task-filter-open-${width}.png`) });
    await taskAdvanced.getByLabel("작업명", { exact: true }).focus();
    await page.keyboard.press("Escape");
    await expect(taskFilter).toBeFocused();
    await taskReset.click();
    await expect(taskSearch).toBeFocused();
    await expect(taskReset).toHaveCount(0);

    await page.getByRole("tab", { name: "리소스", exact: true }).click();
    const dashboard = page.locator('[data-resource-dashboard="true"]');
    const resourceToolbar = dashboard.getByRole("search", { name: "리소스 검색과 필터" });
    const resourceSearch = resourceToolbar.getByRole("searchbox");
    const resourceFilter = resourceToolbar.locator('button[aria-controls="resource-dashboard-advanced-filter"]');
    const resourceReset = resourceToolbar.getByRole("button", { name: "초기화", exact: true });
    const dateFrom = resourceToolbar.getByLabel("기간 시작", { exact: true });
    const dateTo = resourceToolbar.getByLabel("기간 종료", { exact: true });
    await expect(dashboard).toHaveAttribute("data-ready", "true");
    await expect(resourceFilter).toHaveAttribute("aria-expanded", "false");
    await expect(resourceReset).toHaveCount(0);
    await resourceSearch.fill("R-01");
    await expect(resourceFilter).toHaveText("필터 1");
    await expect(dashboard).toHaveAttribute("data-ready", "true");
    await expect(dashboard.getByRole("region", { name: "그룹 현황" }).getByRole("button", { name: /개발팀 \(G-01\)/ })).toBeVisible();
    await resourceFilter.click();
    const advanced = dashboard.getByLabel("리소스 고급 필터");
    await advanced.getByLabel("Global Role", { exact: true }).selectOption("DEVELOPER");
    await expect(resourceFilter).toHaveText("필터 2");
    await dateFrom.fill("2026-09-18");
    await expect(dashboard).toHaveAttribute("data-ready", "true");
    await expect(resourceFilter).toHaveText("필터 3");
    await dateTo.fill("2026-09-16");
    await expect(resourceFilter).toHaveText("필터 4");
    await expect(dashboard).toHaveAttribute("data-ready", "false");
    await expect(dashboard.getByRole("alert")).toContainText("시작일이 종료일보다 늦습니다.");
    await expectDirectChildrenDoNotOverlap(resourceToolbar);
    await expectAdvancedControlsWithinBounds(advanced);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath("issue-260-resource-filter-open-" + width + ".png") });
    await advanced.getByLabel("Global Role", { exact: true }).focus();
    await page.keyboard.press("Escape");
    await expect(advanced).toBeHidden();
    await expect(resourceFilter).toBeFocused();
    await expect(resourceReset).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath("issue-130-phase4-resource-current-" + width + ".png") });
    await resourceReset.click();
    await expect(resourceSearch).toBeFocused();
    await expect(resourceReset).toHaveCount(0);
    await expect(dashboard).toHaveAttribute("data-ready", "true");
    await resourceFilter.click();
    await dateFrom.fill("2026-09-18");
    await expect(resourceFilter).toHaveText("필터 1");
    await expect(dashboard).toHaveAttribute("data-ready", "true");
    await resourceReset.click();
    await expect(resourceSearch).toBeFocused();
    await expect(resourceReset).toHaveCount(0);
    await advanced.getByLabel("개발자 등급", { exact: true }).focus();
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
