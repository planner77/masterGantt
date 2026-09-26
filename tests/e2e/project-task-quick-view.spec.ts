import { expect, test } from "@playwright/test";
import {
  expectSameGanttRoot,
  installStatefulProjectFixture,
  publicId,
  rememberGanttRoot,
  rowNamed,
} from "../fixtures/stateful-project";

test.describe("Issue #196 Project Workspace Task/Milestone 빠른 보기 버튼", () => {
  test("일정 Toolbar에 빠른 보기 버튼이 렌더링되고 기본 상태는 전체다", async ({ page }) => {
    await installStatefulProjectFixture(page);
    await page.goto(`/projects/${publicId}`);
    await expect(page.getByText("편집 중", { exact: true })).toBeVisible();

    const quickViewGroup = page.getByRole("group", { name: "작업 유형 빠른 보기" });
    await expect(quickViewGroup).toBeVisible();

    const allButton = quickViewGroup.getByRole("button", { name: "전체", exact: true });
    const taskButton = quickViewGroup.getByRole("button", { name: "Task", exact: true });
    const milestoneButton = quickViewGroup.getByRole("button", { name: "Milestone", exact: true });

    await expect(allButton).toBeVisible();
    await expect(taskButton).toBeVisible();
    await expect(milestoneButton).toBeVisible();

    await expect(allButton).toHaveAttribute("aria-pressed", "true");
    await expect(taskButton).toHaveAttribute("aria-pressed", "false");
    await expect(milestoneButton).toHaveAttribute("aria-pressed", "false");
  });

  test("Task/Milestone 빠른 전환 시 필터가 즉시 적용되고 ancestor context를 유지하며 mutation이 없다", async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 900 });
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

    const quickViewGroup = page.getByRole("group", { name: "작업 유형 빠른 보기" });
    const allButton = quickViewGroup.getByRole("button", { name: "전체", exact: true });
    const taskButton = quickViewGroup.getByRole("button", { name: "Task", exact: true });
    const milestoneButton = quickViewGroup.getByRole("button", { name: "Milestone", exact: true });

    // 1. Task 버튼 클릭: 일반 Task만 일치 (Stable summary는 context로 유지될 수 있음)
    await taskButton.click();
    await expect(taskButton).toHaveAttribute("aria-pressed", "true");
    await expect(allButton).toHaveAttribute("aria-pressed", "false");
    await expect(rowNamed(page, "Stable leaf")).toBeVisible();
    await expect(rowNamed(page, "Existing summary child")).toBeVisible();
    await expect(rowNamed(page, "Stable milestone")).toHaveCount(0);
    await expectSameGanttRoot(page, identity);

    // 2. Milestone 버튼 클릭: Milestone만 표시
    await milestoneButton.click();
    await expect(milestoneButton).toHaveAttribute("aria-pressed", "true");
    await expect(taskButton).toHaveAttribute("aria-pressed", "false");
    await expect(rowNamed(page, "Stable milestone")).toBeVisible();
    await expect(rowNamed(page, "Stable leaf")).toHaveCount(0);
    await expect(rowNamed(page, "Existing summary child")).toHaveCount(0);
    await expectSameGanttRoot(page, identity);

    // 3. 전체 버튼 클릭: 복원
    await allButton.click();
    await expect(allButton).toHaveAttribute("aria-pressed", "true");
    await expect(milestoneButton).toHaveAttribute("aria-pressed", "false");
    await expect(rowNamed(page, "Stable leaf")).toBeVisible();
    await expect(rowNamed(page, "Stable milestone")).toBeVisible();
    await expect(rowNamed(page, "Stable summary")).toBeVisible();
    await expectSameGanttRoot(page, identity);

    expect(documents).toEqual([]);
    expect(mutations).toEqual([]);
  });

  test("검색어 필터와 빠른 보기가 AND 조합되며 전환 시 검색어가 보존된다", async ({ page }) => {
    await installStatefulProjectFixture(page);
    await page.goto(`/projects/${publicId}`);

    const search = page.getByRole("searchbox", { name: "작업명, 설명, External ID 검색" });
    await search.fill("Existing");

    const quickViewGroup = page.getByRole("group", { name: "작업 유형 빠른 보기" });
    const taskButton = quickViewGroup.getByRole("button", { name: "Task", exact: true });
    const milestoneButton = quickViewGroup.getByRole("button", { name: "Milestone", exact: true });

    await taskButton.click();
    await expect(search).toHaveValue("Existing");
    await expect(rowNamed(page, "Existing summary child")).toBeVisible();
    await expect(rowNamed(page, "Stable leaf")).toHaveCount(0);

    // Milestone 전환 시 검색어 "Existing"에 맞는 마일스톤이 없으므로 0개 일치
    await milestoneButton.click();
    await expect(search).toHaveValue("Existing");
    await expect(rowNamed(page, "Existing summary child")).toHaveCount(0);
    await expect(rowNamed(page, "Stable milestone")).toHaveCount(0);
  });

  test("모바일 390px 뷰포트와 readonly 상태에서도 정상 작동한다", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const fixture = await installStatefulProjectFixture(page);
    fixture.sessionEditable = false;

    await page.goto(`/projects/${publicId}`);
    await expect(page.getByText("읽기 전용", { exact: true })).toBeVisible();

    const quickViewGroup = page.getByRole("group", { name: "작업 유형 빠른 보기" });
    await expect(quickViewGroup).toBeVisible();

    const taskButton = quickViewGroup.getByRole("button", { name: "Task", exact: true });
    await taskButton.click();
    await expect(taskButton).toHaveAttribute("aria-pressed", "true");
    await expect(rowNamed(page, "Stable leaf")).toBeVisible();
    await expect(rowNamed(page, "Stable milestone")).toHaveCount(0);
  });
});
