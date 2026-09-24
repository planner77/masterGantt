import { expect, test } from "@playwright/test";
import { deferred, expectSameGanttRoot, installStatefulProjectFixture, publicId, rememberGanttRoot } from "../fixtures/stateful-project";

const workloadPath = `**/api/projects/${publicId}/resource-workload`;
const targetsPath = `**/api/projects/${publicId}/assigned-targets`;

async function openResources(page: import("@playwright/test").Page) {
  await page.goto(`/projects/${publicId}`);
  await page.getByRole("tab", { name: "리소스", exact: true }).click();
  await expect(page.getByRole("heading", { name: "리소스 공수" })).toBeVisible();
}

test("Issue #117 첫 공수 실패와 이름·코드 부분 실패는 독립적으로 재시도한다", async ({ page }) => {
  await installStatefulProjectFixture(page);
  let failWorkload = true;
  let failTargets = false;
  await page.route(workloadPath, async (route) => {
    if (failWorkload) await route.fulfill({ status: 503, json: { error: { code: "UNAVAILABLE" } } });
    else await route.fallback();
  });
  await page.route(targetsPath, async (route) => {
    if (failTargets) await route.fulfill({ status: 503, json: { error: { code: "UNAVAILABLE" } } });
    else await route.fallback();
  });
  await openResources(page);
  const workload = page.locator('[data-source="workload"]');
  const targets = page.locator('[data-source="targets"]');
  await expect(workload).toHaveAttribute("data-state", "error");
  await expect(workload.getByRole("alert")).toContainText("불러오지 못했습니다");
  await expect(targets).toHaveAttribute("data-state", "ready");
  await expect(page.getByText("조회 결과 없음 · 공수 조회 실패")).toBeVisible();
  await expect(page.getByText("검색 조건에 일치하는 리소스 할당이 없습니다.")).toHaveCount(0);
  failWorkload = false;
  await workload.getByRole("button", { name: "공수 다시 시도" }).click();
  await expect(workload).toHaveAttribute("data-state", "ready");
  await expect(page.getByText("5.00 M/D", { exact: true }).first()).toBeVisible();

  failTargets = true;
  await page.reload();
  await page.getByRole("tab", { name: "리소스", exact: true }).click();
  await expect(workload).toHaveAttribute("data-state", "ready");
  await expect(targets).toHaveAttribute("data-state", "error");
  await expect(targets.getByRole("alert")).toContainText("설명 검색은 사용할 수 없습니다");
  await expect(page.getByText("테스트 리소스 (R-01)")).toBeVisible();
  const search = page.getByRole("search", { name: "리소스 검색과 필터" }).getByRole("searchbox");
  await search.fill("R-01");
  await expect(page.getByText("테스트 리소스 (R-01)")).toBeVisible();
  await search.fill("G-01");
  await expect(page.getByText("검색 조건에 일치하는 리소스 할당이 없습니다.")).toBeVisible();
  await search.fill("테스트 리소스 설명");
  await expect(page.getByText("검색 조건에 일치하는 리소스 할당이 없습니다.")).toBeVisible();
  failTargets = false;
  await targets.getByRole("button", { name: "이름·코드 다시 시도" }).click();
  await expect(targets).toHaveAttribute("data-state", "ready");
  await expect(page.getByText("검색 조건에 일치하는 리소스 할당이 없습니다.")).toHaveCount(0);
  await expect(page.getByText("테스트 리소스 (R-01)")).toBeVisible();
  await search.fill("G-01");
  await expect(page.getByText("개발팀", { exact: true })).toBeVisible();
});

test("Issue #117 네트워크 실패와 형식이 잘못된 200 응답은 성공으로 표시하지 않는다", async ({ page }) => {
  await installStatefulProjectFixture(page);
  let workloadMode: "network" | "malformed" | "pass" = "network";
  let targetsMode: "malformed" | "pass" = "pass";
  await page.route(workloadPath, async (route) => {
    if (workloadMode === "network") await route.abort("failed");
    else if (workloadMode === "malformed") await route.fulfill({ status: 200, json: { data: {
      projectRevision: 40, catalogRevision: 1, range: { from: "2026-09-01", to: "2026-09-30" },
      mdPerMm: 20, grandTotalMd: 5, grandTotalMm: 0.25, unsetCount: 0,
      groups: [{ id: "group-1", name: "개발팀", active: true, start: "2026-09-16", end: "2026-09-18", effortMd: 5, effortMm: 0.25, unsetCount: 0,
        resources: [{ id: "resource-1", name: "테스트 리소스", code: "R-01", active: true, start: "2026-09-16", end: "2026-09-18",
          effortMd: 5, effortMm: 0.25, unsetCount: 0, overAllocated: false,
          tasks: [{ assignmentId: "assignment-1", taskName: "Stable leaf", start: "2026-09-16", end: "2026-09-18",
            allocationPercent: 100, effortMd: 5, effortMm: 0.25, effortConfigured: true }],
        }],
      }],
    } } }); // Task DTO의 필수 taskId가 빠진 200 응답.
    else await route.fallback();
  });
  await page.route(targetsPath, async (route) => {
    if (targetsMode === "malformed") await route.fulfill({ status: 200, json: { data: {
      projectRevision: 40, catalogRevision: 1,
      assignments: [{ taskId: "00000000-0000-4000-8000-000000000003", target: { kind: "resource", id: "resource-1" } }],
      targets: [{ kind: "resource", id: "resource-1", name: "테스트 리소스", code: "R-01", active: true }],
    } } }); // Assignment DTO의 필수 id가 빠진 200 응답.
    else await route.fallback();
  });
  await openResources(page);
  const workload = page.locator('[data-source="workload"]');
  const targets = page.locator('[data-source="targets"]');
  await expect(workload).toHaveAttribute("data-state", "error");
  await expect(targets).toHaveAttribute("data-state", "ready");
  await expect(workload.getByRole("alert")).toContainText("불러오지 못했습니다");
  workloadMode = "pass";
  await workload.getByRole("button", { name: "공수 다시 시도" }).click();
  await expect(workload).toHaveAttribute("data-state", "ready");

  targetsMode = "malformed";
  await page.reload();
  await page.getByRole("tab", { name: "리소스", exact: true }).click();
  await expect(workload).toHaveAttribute("data-state", "ready");
  await expect(targets).toHaveAttribute("data-state", "error");
  await expect(targets.getByRole("alert")).toContainText("불러오지 못했습니다");
  targetsMode = "pass";
  await targets.getByRole("button", { name: "이름·코드 다시 시도" }).click();
  await expect(targets).toHaveAttribute("data-state", "ready");

  workloadMode = "malformed";
  await page.getByRole("button", { name: "새로고침" }).click();
  await expect(workload).toHaveAttribute("data-state", "error");
  await expect(workload.getByRole("alert")).toContainText("마지막 성공");
  await expect(targets).toHaveAttribute("data-state", "ready");
  await expect(page.getByText("5.00 M/D", { exact: true }).first()).toBeVisible();
  workloadMode = "pass";
  await workload.getByRole("button", { name: "공수 다시 시도" }).click();
  await expect(workload).toHaveAttribute("data-state", "ready");
});

test("Issue #117 이전 성공 뒤 부분 실패는 stale 결과와 조작 상태를 보존한다", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installStatefulProjectFixture(page);
  let failWorkload = false;
  let failTargets = false;
  await page.route(workloadPath, async (route) => {
    if (failWorkload) await route.fulfill({ status: 503, json: { error: { code: "UNAVAILABLE" } } });
    else await route.fallback();
  });
  await page.route(targetsPath, async (route) => {
    if (failTargets) await route.fulfill({ status: 503, json: { error: { code: "UNAVAILABLE" } } });
    else await route.fallback();
  });
  await page.goto(`/projects/${publicId}`);
  const ganttIdentity = await rememberGanttRoot(page);
  await page.getByRole("tab", { name: "리소스", exact: true }).click();
  const workload = page.locator('[data-source="workload"]');
  const targets = page.locator('[data-source="targets"]');
  await expect(workload).toHaveAttribute("data-state", "ready");
  await expect(targets).toHaveAttribute("data-state", "ready");
  const originalSuccess = await workload.getByRole("status").textContent();
  await page.getByRole("button", { name: "M/M", exact: true }).click();
  const filters = page.getByRole("search", { name: "리소스 검색과 필터" });
  await filters.getByRole("searchbox").fill("테스트");
  await filters.getByLabel("종류").selectOption("resource");
  await filters.getByLabel("상태").selectOption("active");
  await filters.getByLabel("Task 기간 From").fill("2026-09-16");
  await filters.getByLabel("Task 기간 To").fill("2026-09-18");
  const resourceDetails = page.locator(".resource-workload-resource").first();
  await resourceDetails.locator("summary").click();
  await expect(resourceDetails).toHaveAttribute("open", "");
  failWorkload = true;
  await page.getByRole("button", { name: "새로고침" }).click();
  await expect(workload).toHaveAttribute("data-state", "error");
  await expect(workload.getByRole("alert")).toContainText("마지막 성공");
  const originalTime = originalSuccess?.replace(/^.*· /, "").trim();
  expect(originalTime).toBeTruthy();
  await expect(workload.getByRole("alert")).toContainText(originalTime!);
  await expect(targets).toHaveAttribute("data-state", "ready");
  await expect(page.getByText("0.25 M/M", { exact: true }).first()).toBeVisible();
  await expect(resourceDetails).toHaveAttribute("open", "");
  await expect(filters.getByRole("searchbox")).toHaveValue("테스트");
  await expect(filters.getByLabel("종류")).toHaveValue("resource");
  await expect(filters.getByLabel("상태")).toHaveValue("active");
  await expect(filters.getByLabel("Task 기간 From")).toHaveValue("2026-09-16");
  await expect(filters.getByLabel("Task 기간 To")).toHaveValue("2026-09-18");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
  await page.getByRole("tab", { name: "일정", exact: true }).click();
  await expectSameGanttRoot(page, ganttIdentity);
  await page.getByRole("tab", { name: "리소스", exact: true }).click();
  await expect(workload).toHaveAttribute("data-state", "error");
  await expect(resourceDetails).toHaveAttribute("open", "");
  await expect(filters.getByLabel("종류")).toHaveValue("resource");
  await expect(filters.getByLabel("상태")).toHaveValue("active");
  await expect(filters.getByLabel("Task 기간 From")).toHaveValue("2026-09-16");
  await expect(filters.getByLabel("Task 기간 To")).toHaveValue("2026-09-18");

  failWorkload = false;
  failTargets = true;
  await workload.getByRole("button", { name: "공수 다시 시도" }).click();
  await expect(workload).toHaveAttribute("data-state", "ready");
  await page.getByRole("button", { name: "새로고침" }).click();
  await expect(targets).toHaveAttribute("data-state", "error");
  await expect(targets.getByRole("alert")).toContainText("마지막 성공");
  await expect(page.getByText("테스트 리소스 (R-01)")).toBeVisible();
  const retryTargets = targets.getByRole("button", { name: "이름·코드 다시 시도" });
  for (const width of [390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    await expect(retryTargets).toBeVisible();
    const bounds = await retryTargets.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
  }
  failTargets = false;
  await retryTargets.click();
  await expect(targets).toHaveAttribute("data-state", "ready");
  await expect(page.getByRole("button", { name: "M/M", exact: true })).toHaveAttribute("aria-pressed", "true");
});

test("Issue #117 진행 중 중복 새로고침을 막고 화면 이탈 뒤 늦은 실패를 무시한다", async ({ page }) => {
  await installStatefulProjectFixture(page);
  const firstStarted = deferred();
  const releasePending = deferred();
  const pendingSettled = deferred();
  let count = 0;
  let pending = 0;
  let hold = true;
  let released = false;
  await page.route(workloadPath, async (route) => {
    count += 1;
    if (hold) {
      pending += 1;
      firstStarted.resolve();
      await releasePending.promise;
      await route.fulfill({ status: 503, json: { error: { code: "LATE_ERROR" } } }).catch(() => {});
      pending -= 1;
      if (released && pending === 0) pendingSettled.resolve();
    } else await route.fallback();
  });
  await openResources(page);
  await firstStarted.promise;
  await expect(page.locator('[data-source="targets"]')).toHaveAttribute("data-state", "ready");
  await expect(page.getByRole("button", { name: "조회 중…" })).toBeDisabled();
  const beforeNavigation = count;
  expect(beforeNavigation).toBeGreaterThanOrEqual(1);
  await page.goto("/projects/new");
  await expect(page.getByLabel("프로젝트 이름", { exact: true })).toBeVisible();
  hold = false;
  released = true;
  releasePending.resolve();
  if (pending === 0) pendingSettled.resolve();
  await pendingSettled.promise;
  const oldRequestCount = count;
  await openResources(page);
  const workload = page.locator('[data-source="workload"]');
  await expect(workload).toHaveAttribute("data-state", "ready");
  expect(count).toBeGreaterThan(oldRequestCount);
  await expect(workload.getByRole("status")).toContainText("확인 완료");
  await expect(workload.getByRole("alert")).toHaveCount(0);
});
