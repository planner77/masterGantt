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
  await page.getByRole("tab", { name: "물류 구성", exact: true }).click();
  await page.getByRole("tab", { name: "통합 조회", exact: true }).click();
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
