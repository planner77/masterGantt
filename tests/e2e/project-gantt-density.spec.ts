import { expect, isolatedApplicationOptions, test } from "./fixtures/isolated-application";

test.use(isolatedApplicationOptions);

test("Issue #233/#367: Project Gantt 정보 밀도 개선 — Grid 폭 480px, 기간 숫자화, Chart 날짜 cell 폭 36px/68px", async ({ page, baseURL }) => {
  const origin = new URL(baseURL!).origin;

  // 1. 프로젝트 생성 (단일 작업 포함)
  const createResponse = await page.request.post("/api/projects", {
    headers: { Origin: origin },
    data: {
      name: "Gantt Density Test",
      ownerName: "E2E 자동화",
      description: "Issue #233 Gantt density verification",
      editPassword: "password123",
    },
  });
  expect(createResponse.status()).toBe(201);
  const publicId = (await createResponse.json()).data.project.publicId as string;

  // 작업 1개 생성 (duration: 5)
  const taskResponse = await page.request.post(`/api/projects/${publicId}/tasks`, {
    headers: { Origin: origin, "If-Match": '"1"' },
    data: {
      name: "Density Task 1",
      type: "task",
      start: "2026-10-05",
      duration: 5,
      progress: 0,
    },
  });
  expect(taskResponse.status()).toBe(201);

  await page.goto(`/projects/${publicId}`);
  await expect(page.getByText("편집 중", { exact: true })).toBeVisible();

  // 2. Grid 기간 컬럼 숫자만 표시 검증
  const gridContainer = page.locator(".project-gantt-widget .wx-table-container");
  await expect(gridContainer).toBeVisible();
  // '5 근무일'이 아니라 '5'만 렌더링되어야 함
  await expect(gridContainer.getByText("5", { exact: true }).first()).toBeVisible();
  await expect(gridContainer.getByText("5 근무일", { exact: true })).toHaveCount(0);

  // 3. Grid 너비 검증 (약 480px)
  const gridElement = page.locator(".project-gantt-widget .wx-grid").first();
  await expect(gridElement).toBeVisible();
  const gridBox = await gridElement.boundingBox();
  expect(gridBox).not.toBeNull();
  // 480px 근처 (470px ~ 490px)
  expect(gridBox!.width).toBeGreaterThanOrEqual(470);
  expect(gridBox!.width).toBeLessThanOrEqual(490);

  // 4. Issue #367에서 숫자-only Day Header를 활용해 44px보다 더 조밀한 36px 계약으로 확장한다.
  // 내부 .wx-cell geometry는 scale/header 레벨에 따라 합성 폭을 가질 수 있으므로
  // private DOM 폭을 cellWidth 자체로 간주하지 않는다.
  const ganttFrame = page.locator(".project-gantt-frame");
  await expect(ganttFrame).toHaveAttribute("data-gantt-scale-mode", "day");
  await expect(ganttFrame).toHaveAttribute("data-gantt-cell-width", "36");

  await page.getByRole("group", { name: "Gantt 표시 단위" }).getByRole("button", { name: "주", exact: true }).click();
  await expect(ganttFrame).toHaveAttribute("data-gantt-scale-mode", "week");
  await expect(ganttFrame).toHaveAttribute("data-gantt-cell-width", "68");
  await page.getByRole("group", { name: "Gantt 표시 단위" }).getByRole("button", { name: "일", exact: true }).click();
  await expect(ganttFrame).toHaveAttribute("data-gantt-cell-width", "36");

  // 5. 반응형 뷰포트(390, 768, 1024, 1440)에서 unintended document horizontal overflow 없음 검증
  for (const width of [390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const hasHorizontalScroll = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth
    );
    expect(hasHorizontalScroll).toBe(false);
  }
});
