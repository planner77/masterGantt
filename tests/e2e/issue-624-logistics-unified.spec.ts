import type { Locator, Page } from "@playwright/test";
import { openWorkspaceView } from "./helpers/workspace-navigation";
import type { ResourceDashboardDto, ResourceDashboardDetailsDto } from "../../src/contracts/resource-dashboard";
import { detailsQuery } from "../../src/features/resources/resource-dashboard-model";
import { expect, isolatedApplicationOptions, test } from "./fixtures/isolated-application";
import { issue621ResourcePassword } from "./fixtures/issue-621-target-project";
import { seedIssue623 } from "./fixtures/issue-623-target-resource";
import { targetMasterPassword } from "./fixtures/target-project";

test.use({
  ...isolatedApplicationOptions,
  isolatedProjectMasterAdminPassword: targetMasterPassword,
  isolatedResourceAdminPassword: issue621ResourcePassword,
  viewport: { width: 1440, height: 1000 },
});

// Replace only the DOM origin to exercise a disconnected React reference, then
// restore it after the focus assertion. Canonical fixture data is untouched.
async function replaceFocusOrigin(origin: Locator, navigate: () => Promise<void>) {
  const handle = await origin.elementHandle();
  if (!handle) throw new Error("Focus origin must exist before navigation");
  await navigate();
  await handle.evaluate(node => {
    // Some projections naturally unmount their inactive details. That already
    // supplies the disconnected origin; retain the real reference either way.
    if (!node.isConnected) return;
    const replacement = node.cloneNode(true) as HTMLButtonElement;
    replacement.disabled = false;
    replacement.dataset.issue724FocusReplacement = "true";
    Reflect.set(replacement, "originalFocusNode", node);
    node.replaceWith(replacement);
  });
  expect(await handle.evaluate(node => node.isConnected)).toBe(false);
  await handle.dispose();
}
async function restoreFocusOrigin(page: Page) {
  await page.locator('[data-issue724-focus-replacement="true"]').evaluateAll(nodes => {
    for (const node of nodes) {
      const original = Reflect.get(node, "originalFocusNode") as HTMLElement;
      node.replaceWith(original);
    }
  });
}

const orders = {
  process: "processType,process,workArea,target",
  equipment: "equipmentType,equipment,target",
  system: "systemType,system,target",
  target: "target,resource",
} as const;

test("#624 same canonical Project across four logistics perspectives, full Milestone gate, exact drill and five widths", async ({ page, isolatedApplication: origin, observeIsolatedApi }, info) => {
  // The isolated #623 fixture already performs numerous real HTTP mutations; keep this
  // larger integration probe finite and do not change the global E2E timeout.
  test.setTimeout(120_000);
  page.setDefaultTimeout(15_000);
  // #703 observer is required; preserve the original #624 wide fixture flag.
  const f = await seedIssue623(page, origin, observeIsolatedApi, true);
  const milestoneMutation = await f.mutate("/tasks", {
    name: "V1 교차 조회 Gate", type: "milestone", start: "2026-10-09", duration: 0, progress: 0,
  });
  const milestone = (await milestoneMutation.json()).data.tasks.find((task: { name: string }) => task.name === "V1 교차 조회 Gate");
  expect(milestone?.taskId).toBeTruthy();
  await page.reload();
  const before = await f.snapshot();
  const frame = page.locator(".project-gantt-frame");
  const ganttInstance = await frame.getAttribute("data-project-gantt-instance");
  async function expectReturnedFocus(phase: string, expectedScreen: string, expectedTaskId?: string) {
    await expect(root).toBeVisible();
    const observe = () => page.evaluate(({ expectedScreen, expectedTaskId }) => {
      const active = document.activeElement;
      const screen = new URL(location.href).searchParams.get("screen");
      const visible = active instanceof HTMLElement && active.isConnected && active.checkVisibility({ checkVisibilityCSS: true, checkOpacity: true }) && active.getBoundingClientRect().width > 0 && active.getBoundingClientRect().height > 0;
      const hidden = Boolean(active?.closest("[hidden],[inert]"));
      const disabled = active?.matches(":disabled,[aria-disabled=true]") ?? true;
      const panel = document.querySelector("#project-panel-logistics");
      const currentTab = active?.matches('[role=tab]') && active.getAttribute("tabindex") === "0" &&
        (active.id === (expectedScreen === "dashboard.target" ? "project-tab-dashboard.process" : `project-tab-${expectedScreen}`) || active.id === "project-tab-dashboard");
      const sameOwner = Boolean(panel?.contains(active)) || Boolean(currentTab);
      const controlOrHeading = active?.matches('button,input,select,textarea,a[href],[role=button],h1,h2,h3,h4,h5,h6,[role=heading]') ?? false;
      const taskButton = active?.matches('[data-resource-action],[data-resource-assignment-edit]') ?? false;
      const taskId = active?.closest("[data-canonical-task-id]")?.getAttribute("data-canonical-task-id") ?? null;
      const identityMatches = !taskButton || (expectedTaskId !== undefined && taskId === expectedTaskId);
      return { screen, expectedScreen, visible, hidden, disabled, sameOwner, controlOrHeading, taskId, expectedTaskId, identityMatches,
        active: active ? { tag: active.tagName, id: active.id, role: active.getAttribute("role"), text: active.textContent?.slice(0, 180) } : null,
        accepted: screen === expectedScreen && visible && !hidden && !disabled && sameOwner && controlOrHeading && identityMatches };
    }, { expectedScreen, expectedTaskId });
    try {
      await expect.poll(async () => (await observe()).accepted).toBe(true);
    } catch (error) {
      const evidence = await observe();
      await info.attach(`issue724-focus-failure-${phase}`, { contentType: "application/json", body: JSON.stringify(evidence, null, 2) });
      console.log(`issue724-focus-failure-${phase}: ${JSON.stringify(evidence)}`);
      throw error;
    }
    await info.attach(`issue724-focus-pass-${phase}`, { contentType: "application/json", body: JSON.stringify(await observe(), null, 2) });
  }
  const writes: string[] = [];
  page.on("request", request => {
    const path = new URL(request.url()).pathname;
    if (path.startsWith(`/api/projects/${f.publicId}`) &&
      ["POST", "PUT", "PATCH", "DELETE"].includes(request.method()) &&
      !path.endsWith("/resource-dashboard/query")) writes.push(`${request.method()} ${path}`);
  });

  const reports: Partial<Record<keyof typeof orders, ResourceDashboardDto>> = {};
  let firstCanonicalIds: string[] | null = null;
  const nextReport = async (order: string) => {
    const response = await page.waitForResponse(candidate => {
      const url = new URL(candidate.url());
      return candidate.request().method() === "GET" &&
        url.pathname === `/api/projects/${f.publicId}/resource-dashboard` &&
        url.searchParams.get("projectionOrder") === order;
    });
    expect(response.status(), await response.text()).toBe(200);
    return (await response.json()).data as ResourceDashboardDto;
  };
  const first = nextReport(orders.process);
  await openWorkspaceView(page, "logistics");
  await openWorkspaceView(page, "unified");
  const root = page.getByTestId("logistics-unified-view");
  await expect(root).toBeVisible();
  reports.process = await first;
  await expect(root.getByRole("region", { name: "Resource Target 계층", exact: true })).toBeVisible();
  await expect(root).toContainText("Project 구성 설비 수량 (고유 ID)");
  await expect(root).toContainText("현재 Task 범위의 설비 대상");
  await expect(root).toContainText("Milestone 전체 Stage Gate");

  const baseline = reports.process!;
  const baselineGate = baseline.stages.find(stage => stage.milestoneTaskId === milestone.taskId)?.full;
  expect(baselineGate).toBeDefined();
  expect(baseline.summary.assignmentCount).toBeGreaterThanOrEqual(1);
  expect(baseline.targetProjection?.metadata.subtotalsAdditive).toBe(false);
  expect(baseline.targetProjection?.metadata.assignmentScope).toBe("A");
  for (const perspective of ["equipment", "system", "target", "process"] as const) {
    const pending = nextReport(orders[perspective]);
    await root.getByLabel("물류 통합 조회 관점").selectOption(perspective);
    reports[perspective] = await pending;
    const result = reports[perspective]!;
    expect(result.targetProjection?.order.join(",")).toBe(orders[perspective]);
    expect(result.summary.taskCount).toBe(baseline.summary.taskCount);
    expect(result.summary.assignmentCount).toBe(baseline.summary.assignmentCount);
    expect(result.summary.effort.knownMd).toBe(baseline.summary.effort.knownMd);
    expect(result.stages.find(stage => stage.milestoneTaskId === milestone.taskId)?.full).toEqual(baselineGate);
    // Compare raw immutable IDs, not only numerically equal summary values.
    const detailsResponse = await page.request.get(
      `${f.api}/resource-dashboard/details?${detailsQuery(result, result.summary.selector, "assignments", 0)}`,
    );
    expect(detailsResponse.status(), await detailsResponse.text()).toBe(200);
    const detailDto = ((await detailsResponse.json()) as { data: ResourceDashboardDetailsDto }).data;
    expect(detailDto.totalCount).toBe(result.summary.assignmentCount);
    const canonicalIds = detailDto.rows.map(row =>
      `${row.taskId}:${row.assignment?.assignmentId ?? "unassigned"}:${row.assignment?.resourceId ?? "unassigned"}`).sort();
    if (firstCanonicalIds === null) firstCanonicalIds = canonicalIds;
    else expect(canonicalIds).toEqual(firstCanonicalIds);
    expect(canonicalIds.some(value => value.startsWith(`${f.task.taskId}:`))).toBe(true);
    await expect(root.getByRole("region", { name: "Resource Target 계층", exact: true })).toBeVisible();
  }

  const geometry: { width: number; documentWidth: number; ownScroll: boolean; focus: boolean }[] = [];
  const region = root.getByRole("region", { name: "Resource Target 계층", exact: true });
  for (const width of [390, 768, 1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: 1000 });
    const observation = await region.evaluate(element => {
      const root = element.closest('[data-testid="logistics-unified-view"]');
      const documentWidth = document.documentElement.scrollWidth;
      const overflowingNodes: { tag: string; className: string; right: number; width: number }[] = [];
      if (documentWidth > window.innerWidth + 1) {
        for (const node of document.querySelectorAll("body *")) {
          const bounds = node.getBoundingClientRect();
          if (bounds.width <= 0 || bounds.right <= window.innerWidth + 1) continue;
          overflowingNodes.push({
            tag: node.tagName,
            className: String(node.className).slice(0, 110),
            right: Math.round(bounds.right),
            width: Math.round(bounds.width),
          });
          if (overflowingNodes.length >= 16) break;
        }
      }
      return {
        documentWidth,
        ownScroll: element.scrollWidth > element.clientWidth,
        rootWidth: root ? Math.round(root.getBoundingClientRect().width) : null,
        regionClientWidth: element.clientWidth,
        regionScrollWidth: element.scrollWidth,
        overflowingNodes,
      };
    });
    if (observation.documentWidth > width + 1) {
      await info.attach(`issue624-overflow-${width}`, {
        contentType: "application/json",
        body: JSON.stringify({ viewport: width, ...observation }, null, 2),
      });
    }
    expect(observation.documentWidth, `Viewport ${width}px document overflow: ${JSON.stringify(observation)}`).toBeLessThanOrEqual(width + 1);
    if (width === 390) expect(observation.ownScroll).toBe(true);
    await region.focus();
    await expect(region).toBeFocused();
    geometry.push({ width, ...observation, focus: await region.evaluate(element => document.activeElement === element) });
  }

  await page.setViewportSize({ width: 1440, height: 1000 });
  const trigger = region.getByRole("button", { name: "작업·배정 상세", exact: true }).first();
  await trigger.click();
  const detail = root.getByRole("region", { name: "정확 Task 및 Assignment 상세", exact: true });
  await expect(detail).toBeVisible();
  await expect(detail.locator(`[data-canonical-task-id="${f.task.taskId}"]`).first()).toBeVisible();
  await detail.getByRole("button", { name: "상세 닫기", exact: true }).click();
  await expect(trigger).toBeFocused();

  // A retained screen must restore visible focus even when the original node
  // disappeared while its panel was inactive.
  await trigger.click();
  const scheduleOrigin = root.locator('section[aria-label="정확 Task 및 Assignment 상세"]').getByRole("button", { name: "전체 범위 일정 보기", exact: true, includeHidden: true });
  await replaceFocusOrigin(scheduleOrigin, async () => {
    await scheduleOrigin.click();
    await expect(page.locator("#project-panel-schedule")).toBeVisible();
  });
  await page.getByRole("region", { name: "임시 조회 범위", exact: true }).getByRole("button", { name: /원래 보기/ }).click();
  const processTab = page.getByRole("tablist", { name: "대시보드 보기" }).getByRole("tab", { name: "공정&WorkArea", exact: true });
  await expectReturnedFocus("schedule-return", "dashboard.process");
  await expect(processTab).toHaveAttribute("aria-selected", "true");
  await restoreFocusOrigin(page);

  const taskOrigin = detail.locator('[data-resource-action="task"]').first();
  const originTaskId = await taskOrigin.evaluate(node => node.closest("[data-canonical-task-id]")!.getAttribute("data-canonical-task-id")!);
  const taskEditor = page.getByRole("dialog", { name: "작업 정보", exact: true });
  await replaceFocusOrigin(taskOrigin, async () => {
    await taskOrigin.click();
    await expect(taskEditor).toBeVisible();
  });
  await taskEditor.getByRole("button", { name: "작업 편집기 닫기", exact: true }).click();
  await expectReturnedFocus("task-editor-return", "dashboard.process", originTaskId);
  await restoreFocusOrigin(page);

  const targetReport = nextReport(orders.target);
  await root.getByLabel("물류 통합 조회 관점").selectOption("target");
  await targetReport;
  const targetOrigin = root.getByRole("button", { name: "대상 구성 편집", exact: true, includeHidden: true }).first();
  const targetDialog = page.getByRole("dialog", { name: "Target 수정", exact: true });
  await replaceFocusOrigin(targetOrigin, async () => {
    await targetOrigin.click();
    await expect(targetDialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(targetDialog).toHaveCount(0);
  });
  await page.getByRole("button", { name: "통합 조회로 돌아가기", exact: true }).click();
  await expect(root.getByLabel("물류 통합 조회 관점")).toHaveValue("target");
  await expectReturnedFocus("target-unified-return", "dashboard.target");
  await restoreFocusOrigin(page);

  expect(writes).toEqual([]);
  expect(await f.snapshot()).toEqual(before);
  await expect(frame).toHaveAttribute("data-project-gantt-instance", ganttInstance!);
  await info.attach("issue624-cross-view-evidence", {
    contentType: "application/json",
    body: JSON.stringify({
      synthetic: true,
      projectPublicId: f.publicId,
      milestoneTaskId: milestone.taskId,
      canonicalTaskId: f.task.taskId,
      projectRevision: before.data.project.revision,
      reports: Object.fromEntries(Object.entries(reports).map(([name, dto]) => [name, {
        snapshotId: dto!.snapshotId,
        order: dto!.targetProjection?.order,
        taskCount: dto!.summary.taskCount,
        assignmentCount: dto!.summary.assignmentCount,
        knownMd: dto!.summary.effort.knownMd,
        stageGate: dto!.stages.find(stage => stage.milestoneTaskId === milestone.taskId)?.full,
      }])),
      geometry, writes,
    }, null, 2),
  });
});
