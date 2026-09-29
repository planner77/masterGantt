import { expect, test, type Page, type Route } from "@playwright/test";
import { deferred, expectSameGanttRoot, installStatefulProjectFixture, publicId, rememberGanttRoot } from "../fixtures/stateful-project";

const dashboardPath = `**/api/projects/${publicId}/logistics/dashboard?*`;
function dashboard(route: Route, revision = 40, longName = false) {
  const params = new URL(route.request().url()).searchParams;
  const row = { id: "proc-1", code: "PROC-01", name: longName ? "매우긴공정명LongUnbrokenName".repeat(20) : "입고 공정", active: true, taskCount: 1, progressPercent: 50, overdueTaskCount: 0, plannedMd: 1, taskIds: ["00000000-0000-4000-8000-000000000003"] };
  return { projectRevision: revision, catalogRevision: 1, asOfDate: params.get("asOfDate") || "2026-09-29", timezone: "Asia/Seoul", calculatedAt: "2026-09-29T00:00:00Z", horizonDays: Number(params.get("horizonDays") || 14), systemView: params.get("systemView") || "direct", activeOnly: params.get("activeOnly") === "true", includedTaskIds: row.taskIds, includedMilestoneIds: [],
    kpi: { progressPercent: 50, totalDuration: 2, taskCount: 1, overdueTaskCount: 0, overdueTaskIds: [], milestoneTotalCount: 0, milestoneOverdueCount: 0, milestoneOverdueIds: [], milestoneUpcomingCount: 0, milestoneUpcomingIds: [] },
    effort: { plannedMd: 1, plannedMm: null, mdPerMm: null, unsetAllocationCount: 0, workloadRange: { from: null, to: null } },
    quality: { unlinkedLeafTaskCount: 0, totalLeafTaskCount: 1, unlinkedLeafTaskPercent: 0, equipmentWithoutPrimaryControllerCount: 0, equipmentWithoutOwnerCount: 0, systemsWithoutPrimaryPICount: 0, totalEquipmentMasterCount: 0, totalEquipmentQuantity: 0 },
    breakdowns: { processes: [row], equipment: [], systems: [] },
  };
}
async function openDashboard(page: Page) {
  await page.goto(`/projects/${publicId}`);
  await page.getByRole("tab", { name: "물류 구성", exact: true }).click();
  return page.getByTestId("logistics-dashboard-view");
}

for (const failure of ["500", "network", "malformed", "invalid-date", "wrong-revision", "wrong-filter"] as const) {
  test(`조회 ${failure}는 이전 결과를 숨기고 다시 시도로 복구한다`, async ({ page }) => {
    await installStatefulProjectFixture(page);
    let fail = false;
    await page.route(dashboardPath, (route) => {
      if (fail && failure === "network") return route.abort();
      if (fail && failure === "500") return route.fulfill({ status: 500, json: {} });
      const value = dashboard(route, fail && failure === "wrong-revision" ? 39 : 40);
      return route.fulfill({ json: { data: fail && failure === "malformed" ? { ...value, breakdowns: { processes: [null], equipment: [], systems: [] } } : fail && failure === "invalid-date" ? { ...value, asOfDate: "2026-02-30" } : fail && failure === "wrong-filter" ? { ...value, horizonDays: 90 } : value } });
    });
    const view = await openDashboard(page);
    await expect(view.getByRole("button", { name: "일정에서 전체 작업 보기" })).toBeVisible();
    fail = true;
    await view.getByRole("button", { name: "새로고침", exact: true }).click();
    await expect(view.getByRole("alert")).toBeVisible();
    await expect(view.getByRole("button", { name: "일정에서 전체 작업 보기" })).toHaveCount(0);
    await page.screenshot({ path: `output/playwright/issue-267/error-${failure}.png` });
    fail = false;
    await view.getByRole("button", { name: "다시 시도", exact: true }).click();
    await expect(view.getByRole("button", { name: "일정에서 전체 작업 보기" })).toBeVisible();
  });
}

test("기준일 기본 응답은 추가 조회를 만들지 않고 조건 변경 즉시 오래된 drilldown을 숨긴다", async ({ page }) => {
  await installStatefulProjectFixture(page);
  let gate = deferred();
  let wait = false;
  let reads = 0;
  await page.route(dashboardPath, async (route) => { reads++; if (wait) await gate.promise; await route.fulfill({ json: { data: dashboard(route) } }); });
  const view = await openDashboard(page);
  await expect(view.getByLabel("기준일 (As of)")).toHaveValue("2026-09-29");
  await expect(view.getByRole("button", { name: "일정에서 전체 작업 보기" })).toBeVisible();
  expect(reads).toBe(1);
  await view.getByRole("tab", { name: /^설비별 현황/ }).click();
  expect(reads).toBe(1);
  wait = true;
  await view.getByLabel("기준일 (As of)").fill("2026-10-01");
  await expect(view.getByText("현재 조회 조건으로 물류 KPI 대시보드를 집계하는 중입니다…")).toBeVisible();
  await expect(view.getByRole("button", { name: "일정에서 전체 작업 보기" })).toHaveCount(0);
  await expect(view.getByRole("button", { name: "새로고침 중…", exact: true })).toBeDisabled();
  gate.resolve();
  await expect(view.getByRole("button", { name: "일정에서 전체 작업 보기" })).toBeVisible();
  expect(reads).toBe(2);
  for (const change of [
    () => view.getByLabel("시스템 집계 범위").selectOption("coordination"),
    () => view.getByLabel("활성 마스터만 보기").check(),
  ]) {
    gate = deferred();
    await change();
    await expect(view.getByText("현재 조회 조건으로 물류 KPI 대시보드를 집계하는 중입니다…")).toBeVisible();
    await expect(view.getByRole("button", { name: "일정에서 전체 작업 보기" })).toHaveCount(0);
    gate.resolve();
    await expect(view.getByRole("button", { name: "일정에서 전체 작업 보기" })).toBeVisible();
  }
  expect(reads).toBe(4);
});

test("빠른 기간 변경의 응답 역전은 최신 결과를 유지한다", async ({ page }) => {
  await installStatefulProjectFixture(page);
  const gate = deferred();
  const started = deferred();
  await page.route(dashboardPath, async (route) => {
    if (new URL(route.request().url()).searchParams.get("horizonDays") === "10") { started.resolve(); await gate.promise; }
    await route.fulfill({ json: { data: dashboard(route) } }).catch(() => {});
  });
  const view = await openDashboard(page);
  await expect(view.getByRole("button", { name: "일정에서 전체 작업 보기" })).toBeVisible();
  await view.getByLabel("임박 기준 (일)").fill("10");
  await started.promise;
  await view.getByLabel("임박 기준 (일)").fill("20");
  await expect(view.getByText("20일 이내 임박", { exact: true })).toBeVisible();
  gate.resolve();
  await expect(view.getByText("20일 이내 임박", { exact: true })).toBeVisible();
  await expect(view.getByText("10일 이내 임박", { exact: true })).toHaveCount(0);
});

test("기간 빈 값·0·91·소수는 field 오류와 GET 차단 후 정상 범위로 복구한다", async ({ page }) => {
  await installStatefulProjectFixture(page);
  let reads = 0;
  await page.route(dashboardPath, (route) => { reads++; return route.fulfill({ json: { data: dashboard(route) } }); });
  const view = await openDashboard(page);
  await expect(view.getByRole("button", { name: "일정에서 전체 작업 보기" })).toBeVisible();
  const initialReads = reads;
  const horizon = view.getByLabel("임박 기준 (일)");
  for (const invalid of ["", "0", "91", "1.5"]) {
    await horizon.fill(invalid);
    await expect(horizon).toHaveAttribute("aria-invalid", "true");
    await expect(view.getByRole("alert")).toContainText("1~90 사이의 정수");
    await expect(view.getByRole("button", { name: "새로고침", exact: true })).toBeDisabled();
    await expect(view.getByRole("button", { name: "일정에서 전체 작업 보기" })).toHaveCount(0);
    expect(reads).toBe(initialReads);
  }
  await horizon.fill("90");
  await expect(view.getByText("90일 이내 임박", { exact: true })).toBeVisible();
  await expect(horizon).toHaveAttribute("aria-invalid", "false");
  expect(reads).toBe(initialReads + 1);
});

for (const width of [390, 768, 1024, 1440]) {
  test(`세부 tab keyboard·빈 현황·긴 이름·정상 drilldown Gantt 보존 ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await installStatefulProjectFixture(page);
    await page.route(dashboardPath, (route) => route.fulfill({ json: { data: dashboard(route, 40, true) } }));
    await page.goto(`/projects/${publicId}`);
    const root = await rememberGanttRoot(page);
    await page.getByRole("tab", { name: "물류 구성", exact: true }).click();
    const view = page.getByTestId("logistics-dashboard-view");
    await expect(view.getByRole("tablist", { name: "물류 세부 현황" })).toBeVisible();
    const processes = view.getByRole("tab", { name: /^공정별 현황/ });
    const equipment = view.getByRole("tab", { name: /^설비별 현황/ });
    const systems = view.getByRole("tab", { name: /^물류 시스템별 현황/ });
    for (const tab of [processes, equipment, systems]) {
      const panelId = await tab.getAttribute("aria-controls");
      expect(panelId).toBeTruthy();
      await expect(view.locator(`[id="${panelId}"]`)).toHaveCount(1);
    }
    await expect(processes).toHaveAttribute("tabindex", "0");
    await expect(equipment).toHaveAttribute("tabindex", "-1");
    await expect(systems).toHaveAttribute("tabindex", "-1");
    await processes.focus();
    await page.keyboard.press("ArrowRight");
    await expect(equipment).toBeFocused();
    await expect(equipment).toHaveAttribute("aria-selected", "true");
    await expect(processes).toHaveAttribute("tabindex", "-1");
    await expect(equipment).toHaveAttribute("tabindex", "0");
    await expect(view.getByRole("tabpanel", { name: /^설비별 현황/ })).toContainText("등록된 설비가 없습니다.");
    await page.keyboard.press("End");
    await expect(systems).toBeFocused();
    await expect(view.getByRole("tabpanel", { name: /^물류 시스템별 현황/ })).toContainText("등록된 시스템이 없습니다.");
    await page.keyboard.press("Home");
    await expect(processes).toBeFocused();
    await expect(view.getByRole("tabpanel", { name: /^공정별 현황/ })).toContainText("매우긴공정명");
    expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
    await page.screenshot({ path: `output/playwright/issue-267/long-data-${width}.png` });
    await view.getByRole("button", { name: "일정에서 전체 작업 보기" }).click();
    await expect(page.getByRole("tab", { name: "일정", exact: true })).toHaveAttribute("aria-selected", "true");
    await expectSameGanttRoot(page, root);
  });
}
