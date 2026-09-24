import { expect, test } from "@playwright/test";
import {
  expectSameGanttRoot,
  installStatefulProjectFixture,
  publicId,
  rememberGanttRoot,
  rowNamed,
} from "../fixtures/stateful-project";

test.describe("Issue #83 Project Task / Resource 검색·필터", () => {
  test("Task 통합 검색과 초기화는 canonical Gantt 인스턴스를 유지한다", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await installStatefulProjectFixture(page);
    const documents: string[] = [];
    const mutations: string[] = [];
    page.on("request", (request) => {
      if (request.resourceType() === "document") documents.push(request.url());
      if (!["GET", "HEAD"].includes(request.method())) mutations.push(request.method());
    });

    await page.goto(`/projects/${publicId}`);
    await expect(page.getByText("편집 중", { exact: true })).toBeVisible();
    const identity = await rememberGanttRoot(page);
    documents.length = 0;
    mutations.length = 0;

    const search = page.getByRole("searchbox", { name: "작업명, 설명, External ID 검색" });
    await search.fill("Stable milestone");
    await expect(page.getByRole("status").filter({ hasText: "1개 일치" })).toBeVisible();
    await expect(rowNamed(page, "Stable milestone")).toBeVisible();
    await expect(rowNamed(page, "Stable leaf")).toHaveCount(0);
    await expectSameGanttRoot(page, identity);

    await page.getByRole("button", { name: "초기화", exact: true }).click();
    await expect(rowNamed(page, "Stable leaf")).toBeVisible();
    await expect(rowNamed(page, "Stable milestone")).toBeVisible();
    await expectSameGanttRoot(page, identity);
    expect(documents).toEqual([]);
    expect(mutations).toEqual([]);
  });

  test("readonly에서도 Task 고급 필터를 사용할 수 있고 ancestor context는 match count에서 제외한다", async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 900 });
    const fixture = await installStatefulProjectFixture(page);
    fixture.sessionEditable = false;
    await page.goto(`/projects/${publicId}`);
    await expect(page.getByText("읽기 전용", { exact: true })).toBeVisible();
    const identity = await rememberGanttRoot(page);

    await page.getByRole("button", { name: "필터", exact: true }).click();
    await page.getByLabel("작업명", { exact: true }).fill("Existing summary child");
    await expect(page.getByRole("status").filter({ hasText: "1개 일치" })).toBeVisible();
    await expect(rowNamed(page, "Stable summary")).toBeVisible();
    await expect(rowNamed(page, "Existing summary child")).toBeVisible();
    await expect(rowNamed(page, "Stable leaf")).toHaveCount(0);
    await expectSameGanttRoot(page, identity);
  });

  test("Resource 검색·기간 필터는 표시 행만 제한하고 전체 Project 집계를 유지한다", async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 900 });
    await installStatefulProjectFixture(page);
    await page.goto(`/projects/${publicId}`);
    await page.getByRole("tab", { name: "리소스", exact: true }).click();

    const panel = page.getByRole("tabpanel", { name: "리소스" });
    await expect(panel.getByRole("heading", { name: "리소스 공수" })).toBeVisible();
    await expect(panel).toContainText("5.00 M/D");

    const search = panel.getByRole("searchbox", { name: "리소스 또는 그룹 이름과 코드 검색" });
    await search.fill("R-01");
    await expect(panel.getByText("테스트 리소스", { exact: false })).toBeVisible();

    const filter = panel.locator('button[aria-controls="resource-advanced-filter"]');
    await filter.click();
    const advanced = panel.getByLabel("리소스 고급 필터");
    await expect(advanced).toBeVisible();
    await advanced.getByLabel("Task 기간 From").fill("2026-10-01");
    await advanced.getByLabel("Task 기간 To").fill("2026-10-31");
    await expect(panel.getByText("검색 조건에 일치하는 리소스 할당이 없습니다.")).toBeVisible();
    await expect(panel).toContainText("5.00 M/D");

    await panel.getByRole("button", { name: "초기화", exact: true }).click();
    await expect(panel.getByText("테스트 리소스", { exact: false })).toBeVisible();
  });
});
