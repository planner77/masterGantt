import { readFile } from "node:fs/promises";
import { expect, test, isolatedApplicationOptions, submitProjectAndExpectCreated } from "./fixtures/isolated-application";

test.use(isolatedApplicationOptions);

test("SVG/PNG export uses current revision, preserves the workspace, and validates date range", async ({ page }) => {
  await page.goto("/projects/new");
  await page.getByLabel("프로젝트 이름").fill(`Image export ${Date.now()}`);
  await page.getByLabel("편집 비밀번호").fill("Export123!");
  await submitProjectAndExpectCreated(page);
  await page.waitForURL(/\/projects\/[0-9a-f-]{36}$/);
  const publicId = new URL(page.url()).pathname.split("/").at(-1)!;
  const apiPath = `/api/projects/${publicId}`;
  const origin = new URL(page.url()).origin;
  const initial = await (await page.request.get(apiPath)).json();
  const created = await page.request.post(`${apiPath}/tasks`, {
    headers: { "Content-Type": "application/json", "If-Match": `"${initial.data.project.revision}"`, Origin: origin },
    data: { externalId: "IMAGE-1", name: "Image export task", type: "task", start: "2026-09-14", duration: 3, progress: 25 },
  });
  expect(created.status()).toBe(201);
  const revision = (await created.json()).data.project.revision as number;
  await page.reload();
  const workspace = page.getByRole("region", { name: "프로젝트 일정 Grid와 Gantt 차트" });
  await expect(workspace).toBeVisible();
  const gantt = page.locator(".project-gantt-widget");
  const chart = page.locator(".project-gantt-widget .wx-chart").first();
  await chart.evaluate((element) => { element.scrollLeft = 160; });
  const chartScroll = await chart.evaluate((element) => element.scrollLeft);
  expect(chartScroll).toBeGreaterThan(0);
  const instance = await gantt.evaluate((node) => { node.setAttribute("data-export-instance", "kept"); return node; });
  expect(instance).toBeTruthy();

  const trigger = page.getByRole("button", { name: "내보내기", exact: true }).first();
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "내보내기", exact: true });
  await expect(dialog.getByLabel("형식")).toBeFocused();
  await expect(dialog.getByText("일정 Dependency 포함", { exact: true })).toBeVisible();
  await dialog.getByLabel("형식").selectOption("svg");
  await expect(dialog).toContainText("작업명·시작일·기간 고정 열");
  await dialog.getByLabel("날짜 범위 (차트만)").check();
  await dialog.getByRole("button", { name: "내보내기", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText("시작일과 종료일");
  await dialog.getByLabel("시작일").fill("2026-09-14");
  await dialog.getByLabel("종료일").fill("2026-09-16");
  if (process.env.CAPTURE_ISSUE_245_SCREENSHOT === "1") {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
    await page.screenshot({ path: "docs/images/issue-245-export-dialog.png" });
    await page.setViewportSize({ width: 1280, height: 900 });
  }
  const [svgRequest, svgDownload] = await Promise.all([
    page.waitForRequest((request) => request.method() === "POST" && new URL(request.url()).pathname === `${apiPath}/exports/gantt-svg`),
    page.waitForEvent("download"),
    dialog.getByRole("button", { name: "내보내기", exact: true }).click(),
  ]);
  expect(svgRequest.headers()["if-match"]).toBe(`"${revision}"`);
  expect(svgRequest.postDataJSON()).toMatchObject({ scope: "range", startDate: "2026-09-14", endDate: "2026-09-16", scale: "day" });
  expect(svgDownload.suggestedFilename()).toMatch(/\.svg$/);
  const rangeSvg = (await readFile(await svgDownload.path())).toString("utf8");
  expect(rangeSvg).toContain("<svg");
  const rangeDimensions = /<svg[^>]*width="(\d+)" height="(\d+)"/.exec(rangeSvg);
  expect(rangeDimensions).not.toBeNull();
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await expect(gantt).toHaveAttribute("data-export-instance", "kept");
  expect(await chart.evaluate((element) => element.scrollLeft)).toBe(chartScroll);

  await trigger.click();
  await dialog.getByLabel("형식").selectOption("png");
  const [pngRequest, pngDownload] = await Promise.all([
    page.waitForRequest((request) => request.method() === "POST" && new URL(request.url()).pathname === `${apiPath}/exports/gantt-svg`),
    page.waitForEvent("download"),
    dialog.getByRole("button", { name: "내보내기", exact: true }).click(),
  ]);
  expect(pngRequest.headers()["if-match"]).toBe(`"${revision}"`);
  expect(pngRequest.postDataJSON()).toMatchObject({ scope: "range", startDate: "2026-09-14", endDate: "2026-09-16" });
  expect(pngDownload.suggestedFilename()).toMatch(/\.png$/);
  const pngBytes = await readFile(await pngDownload.path());
  expect(pngBytes.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
  expect(pngBytes.readUInt32BE(16)).toBe(Number(rangeDimensions![1]));
  expect(pngBytes.readUInt32BE(20)).toBe(Number(rangeDimensions![2]));
  await expect(gantt).toHaveAttribute("data-export-instance", "kept");
  await expect(trigger).toBeFocused();

  await trigger.click();
  await dialog.getByLabel("형식").selectOption("svg");
  await dialog.getByLabel("프로젝트 전체 (Grid와 차트)").check();
  const [projectRequest, projectDownload] = await Promise.all([
    page.waitForRequest((request) => request.method() === "POST" && new URL(request.url()).pathname === `${apiPath}/exports/gantt-svg`),
    page.waitForEvent("download"),
    dialog.getByRole("button", { name: "내보내기", exact: true }).click(),
  ]);
  expect(projectRequest.postDataJSON()).toMatchObject({ scope: "project", scale: "day" });
  const projectSvg = (await readFile(await projectDownload.path())).toString("utf8");
  expect(projectSvg).toContain("Image export task");
  expect(projectSvg).toContain('text x="326"');
  await expect(gantt).toHaveAttribute("data-export-instance", "kept");

  await trigger.click();
  await dialog.getByLabel("날짜 범위 (차트만)").check();
  await dialog.getByLabel("시작일").fill("2030-01-01");
  await dialog.getByLabel("종료일").fill("2030-01-02");
  const noOverlapResponse = page.waitForResponse((response) => response.request().method() === "POST" &&
    new URL(response.url()).pathname === `${apiPath}/exports/gantt-svg`);
  await dialog.getByRole("button", { name: "내보내기", exact: true }).click();
  expect((await noOverlapResponse).status()).toBe(422);
  await expect(dialog.getByRole("alert")).toContainText("프로젝트 일정과 겹치지 않습니다");
  await expect(dialog.getByLabel("시작일")).toHaveAttribute("aria-invalid", "true");
  await expect(dialog.getByLabel("종료일")).toHaveAttribute("aria-describedby", "gantt-export-error");
  await dialog.getByLabel("시작일").fill("2026-09-14");
  await dialog.getByLabel("종료일").fill("2026-09-16");
  let staleRequests = 0;
  const staleHandler = async (route: import("@playwright/test").Route) => {
    if (route.request().method() !== "POST") { await route.continue(); return; }
    staleRequests += 1;
    await route.fulfill({ status: 412, contentType: "application/json", body: JSON.stringify({ error: { code: "REVISION_MISMATCH" } }) });
  };
  await page.route(`**${apiPath}/exports/gantt-svg`, staleHandler);
  await dialog.getByRole("button", { name: "내보내기", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText("프로젝트가 변경되었습니다");
  expect(staleRequests).toBe(1);
  await page.unroute(`**${apiPath}/exports/gantt-svg`, staleHandler);
  await dialog.getByRole("button", { name: "취소" }).click();

  await trigger.click();
  await dialog.getByLabel("형식").selectOption("excel");
  await dialog.getByLabel("일정 Dependency 제외").check();
  const [excelRequest, excelDownload] = await Promise.all([
    page.waitForRequest((request) => request.method() === "POST" && new URL(request.url()).pathname === `${apiPath}/exports/excel`),
    page.waitForEvent("download"),
    dialog.getByRole("button", { name: "내보내기", exact: true }).click(),
  ]);
  expect(excelRequest.headers()["if-match"]).toBe(`"${revision}"`);
  expect(excelRequest.postDataJSON()).toMatchObject({ includeDependencies: false, scope: "project", scale: "day" });
  expect(excelDownload.suggestedFilename()).toMatch(/\.xlsx$/);
  expect((await readFile(await excelDownload.path())).subarray(0, 2).toString("utf8")).toBe("PK");
  await expect(gantt).toHaveAttribute("data-export-instance", "kept");
  await expect(trigger).toBeFocused();

  await trigger.click();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
  for (const width of [390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const triggerBox = await trigger.boundingBox();
    expect(triggerBox).not.toBeNull();
    expect(triggerBox!.x).toBeGreaterThanOrEqual(0);
    expect(triggerBox!.x + triggerBox!.width).toBeLessThanOrEqual(width);
    await trigger.click();
    await expect(dialog).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
    await dialog.getByRole("button", { name: "취소" }).click();
    await expect(trigger).toBeFocused();
  }
});
