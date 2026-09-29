import { expect, test, type Page } from "@playwright/test";
import { deferred } from "../fixtures/stateful-project";

async function installTemplates(page: Page) {
  let reads = 0;
  await page.route("**/api/project-templates?activeOnly=true", (route) => {
    reads++;
    return route.fulfill({ json: { data: ["Alpha", "Beta"].map((name, index) => ({ id: `template-${index}`, name, description: `${name} 설명`, sourceProjectId: null, sourceProjectName: null, active: true, taskCount: 2, milestoneCount: 1, processCount: 0, equipmentCount: 0, systemCount: 0, createdAt: "", updatedAt: "" })) } });
  });
  return () => reads;
}
const blank = (page: Page) => page.locator("#panel-blank");
const template = (page: Page) => page.locator("#panel-template");
const blankTab = (page: Page) => page.getByRole("tab", { name: "빈 프로젝트 만들기", exact: true });
const templateTab = (page: Page) => page.getByRole("tab", { name: "템플릿에서 만들기", exact: true });

for (const width of [390, 768, 1024, 1440]) {
  test(`양방향 독립 초안과 hidden panel·조회 횟수를 보존한다 ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const reads = await installTemplates(page);
    await page.goto("/projects/new");
    await blank(page).locator("#project-name").fill("빈 프로젝트 초안");
    await blank(page).locator("#project-owner").fill("초안 소유자");
    await blank(page).locator("#project-description").fill("빈 프로젝트 설명");
    await blank(page).locator("#project-status").selectOption("in_progress");
    expect(reads()).toBe(0);
    await templateTab(page).click();
    await template(page).getByRole("radio", { name: /Beta/ }).click();
    const initialReads = reads();
    expect(initialReads).toBeGreaterThan(0);
    await template(page).locator("#inst-project-name").fill("템플릿 프로젝트 초안");
    await template(page).locator("#inst-owner-name").fill("템플릿 소유자");
    await template(page).locator("#inst-desc").fill("템플릿 설명");
    await template(page).locator("#inst-start-date").fill("2026-10-15");
    await template(page).getByPlaceholder("템플릿 이름 또는 설명 검색…").fill("Beta");
    await expect(blank(page)).toBeHidden();
    await expect(page.getByRole("textbox", { name: "프로젝트 이름", exact: true })).toHaveCount(0);
    await blankTab(page).click();
    await expect(blank(page).locator("#project-name")).toHaveValue("빈 프로젝트 초안");
    await expect(blank(page).locator("#project-owner")).toHaveValue("초안 소유자");
    await expect(blank(page).locator("#project-description")).toHaveValue("빈 프로젝트 설명");
    await expect(blank(page).locator("#project-status")).toHaveValue("in_progress");
    await expect(template(page)).toBeHidden();
    await expect(page.getByRole("textbox", { name: /새 프로젝트 이름/ })).toHaveCount(0);
    await templateTab(page).click();
    await expect(template(page).locator("#inst-project-name")).toHaveValue("템플릿 프로젝트 초안");
    await expect(template(page).locator("#inst-owner-name")).toHaveValue("템플릿 소유자");
    await expect(template(page).locator("#inst-desc")).toHaveValue("템플릿 설명");
    await expect(template(page).locator("#inst-start-date")).toHaveValue("2026-10-15");
    await expect(template(page).getByRole("radio", { name: /Beta/ })).toBeChecked();
    await expect(template(page).getByPlaceholder("템플릿 이름 또는 설명 검색…")).toHaveValue("Beta");
    expect(reads()).toBe(initialReads);
    await page.keyboard.press("Tab");
    await expect(template(page).getByPlaceholder("템플릿 이름 또는 설명 검색…")).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
    await page.screenshot({ path: `output/playwright/issue-264/preserved-template-${width}.png` });
  });
}

test("초기 template 모드와 방향키/Home/End 및 본문 바로가기를 보존한다", async ({ page }) => {
  const reads = await installTemplates(page);
  await page.goto("/projects/new?mode=template");
  await expect(templateTab(page)).toHaveAttribute("aria-selected", "true");
  await expect(template(page).locator("#inst-project-name")).toBeVisible();
  const initialReads = reads();
  expect(initialReads).toBeGreaterThan(0);
  await expect(blank(page).locator("form")).toHaveCount(0);
  await templateTab(page).focus();
  await page.keyboard.press("Home");
  await expect(blankTab(page)).toBeFocused();
  await expect(blankTab(page)).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("End");
  await expect(templateTab(page)).toBeFocused();
  await page.keyboard.press("ArrowLeft");
  await expect(blankTab(page)).toBeFocused();
  await page.keyboard.press("ArrowRight");
  await expect(templateTab(page)).toBeFocused();
  await page.getByRole("link", { name: "본문으로 바로가기" }).focus();
  await page.keyboard.press("Enter");
  await page.keyboard.press("Tab");
  // The selected form, rather than the hidden blank form, receives skip navigation.
  await expect(template(page).getByPlaceholder("템플릿 이름 또는 설명 검색…")).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(templateTab(page)).toBeFocused();
  await expect(templateTab(page)).toHaveAttribute("tabindex", "0");
  expect(reads()).toBe(initialReads);
});

for (const mode of ["blank", "template"] as const) {
  test(`${mode} 요청 중 동기 중복 POST·탭 전환 차단과 실패 초안·비밀번호 삭제`, async ({ page }) => {
    await installTemplates(page);
    const gate = deferred();
    let posts = 0;
    const endpoint = mode === "blank" ? "**/api/projects" : "**/api/project-templates/*/instantiate";
    await page.route(endpoint, async (route) => {
      if (route.request().method() !== "POST") { await route.fallback(); return; }
      posts++;
      if (posts === 1) await gate.promise;
      await route.fulfill({ status: 500, json: { error: { code: "FAILED", message: "생성에 실패했습니다." } } });
    });
    await page.goto(`/projects/new${mode === "template" ? "?mode=template" : ""}`);
    const panel = mode === "blank" ? blank(page) : template(page);
    await panel.locator(mode === "blank" ? "#project-name" : "#inst-project-name").fill("실패 후 남는 초안");
    await panel.locator(mode === "blank" ? "#project-owner" : "#inst-owner-name").fill("초안 소유자");
    const password = panel.locator(mode === "blank" ? "#project-edit-password" : "#inst-password");
    await password.fill("Test123!");
    await panel.locator("form").evaluate((form: HTMLFormElement) => { form.requestSubmit(); form.requestSubmit(); });
    await expect.poll(() => posts).toBe(1);
    await expect(blankTab(page)).toBeDisabled();
    await expect(templateTab(page)).toBeDisabled();
    const otherTab = mode === "blank" ? templateTab(page) : blankTab(page);
    await otherTab.evaluate((button: HTMLButtonElement) => { button.disabled = false; button.click(); });
    await expect(mode === "blank" ? blankTab(page) : templateTab(page)).toHaveAttribute("aria-selected", "true");
    await expect(password).toHaveValue("");
    gate.resolve();
    await expect(panel.getByRole("alert")).toBeVisible();
    await expect(panel.locator(mode === "blank" ? "#project-name" : "#inst-project-name")).toHaveValue("실패 후 남는 초안");
    await expect(panel.locator(mode === "blank" ? "#project-owner" : "#inst-owner-name")).toHaveValue("초안 소유자");
    await expect(password).toHaveValue("");
    await expect(blankTab(page)).toBeEnabled();
    await expect(templateTab(page)).toBeEnabled();
    await password.fill("Retry123!");
    await panel.getByRole("button", { name: mode === "blank" ? "프로젝트 만들기" : "템플릿에서 프로젝트 생성", exact: true }).click();
    await expect.poll(() => posts).toBe(2);
  });
}
