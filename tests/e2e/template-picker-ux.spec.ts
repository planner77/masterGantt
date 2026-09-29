import { expect, test, type Page } from "@playwright/test";
import { installStatefulProjectFixture, publicId } from "../fixtures/stateful-project";

const listPath = "**/api/project-templates?activeOnly=true";
const templates = ["Alpha", "Beta"].map((name, index) => ({ id: `template-${index}`, name, description: `${name} 설명`, taskCount: 2, milestoneCount: 1, processCount: 0, equipmentCount: 0, systemCount: 0 }));
async function installList(page: Page, data = templates) { await page.route(listPath, (route) => route.fulfill({ json: { data } })); }

for (const failure of ["500", "network", "malformed"] as const) {
  test(`조회 ${failure}를 빈 목록과 구분하고 재시도로 복구한다`, async ({ page }) => {
    let failed = true;
    let mutations = 0;
    await page.route(listPath, (route) => {
      if (!failed) return route.fulfill({ json: { data: templates } });
      if (failure === "network") return route.abort();
      return route.fulfill(failure === "500" ? { status: 500, json: {} } : { json: { data: [{ id: "bad", name: 15 }] } });
    });
    page.on("request", (request) => { if (request.method() === "POST") mutations++; });
    await page.goto("/projects/new?mode=template");
    await expect(page.locator("#panel-template").getByRole("alert")).toContainText("템플릿 목록을 불러오지 못했습니다");
    await expect(page.getByText("등록된 프로젝트 템플릿이 없습니다.")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "템플릿에서 프로젝트 생성", exact: true })).toHaveCount(0);
    await page.screenshot({ path: `output/playwright/issue-265/list-error-${failure}.png` });
    failed = false;
    await page.getByRole("button", { name: "템플릿 목록 다시 시도" }).click();
    await expect(page.getByRole("radio", { name: "Alpha", exact: true })).toBeChecked();
    expect(mutations).toBe(0);
  });
}

test("정상 빈 목록은 오류·재시도와 분리한다", async ({ page }) => {
  await installList(page, []);
  await page.goto("/projects/new?mode=template");
  await expect(page.getByText("등록된 프로젝트 템플릿이 없습니다.")).toBeVisible();
  await expect(page.locator("#panel-template").getByRole("alert")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "템플릿 목록 다시 시도" })).toHaveCount(0);
});

test("native radio 방향키·Space와 선택 요약, 검색 초기화, 사용자 이름 보존", async ({ page }) => {
  await installList(page);
  await page.goto("/projects/new?mode=template");
  const alpha = page.getByRole("radio", { name: "Alpha", exact: true });
  const beta = page.getByRole("radio", { name: "Beta", exact: true });
  await alpha.focus();
  await page.keyboard.press("ArrowRight");
  await expect(beta).toBeFocused();
  await expect(beta).toBeChecked();
  await page.keyboard.press("Tab");
  await expect(page.locator("#inst-project-name")).toBeFocused();
  await expect(page.locator("#inst-project-name")).toHaveValue("Beta 프로젝트");
  await page.locator("#inst-project-name").fill("사용자 지정 프로젝트");
  await alpha.check();
  await expect(page.locator("#inst-project-name")).toHaveValue("사용자 지정 프로젝트");
  await page.locator("#inst-project-name").fill("");
  await beta.focus();
  await page.keyboard.press("Space");
  await expect(beta).toBeChecked();
  await expect(page.locator("#inst-project-name")).toHaveValue("");
  await page.getByRole("searchbox", { name: "템플릿 검색" }).fill("검색 결과 없음");
  await expect(page.getByText("검색 조건에 맞는 템플릿이 없습니다.")).toBeVisible();
  await expect(page.getByText("검색 결과 0개 / 전체 2개", { exact: true })).toBeVisible();
  await expect(page.getByRole("note")).toContainText("선택한 템플릿: Beta");
  await expect(page.getByRole("note")).toContainText("현재 검색 결과에 없는 템플릿");
  await page.getByRole("button", { name: "검색 초기화" }).click();
  await expect(beta).toBeChecked();
});

test("필드 오류 aria 연결·최초 오류 focus·수정 후 해제 및 정상 생성", async ({ page }) => {
  await installStatefulProjectFixture(page);
  await installList(page);
  let payload: unknown;
  await page.route("**/api/project-templates/*/instantiate", (route) => { payload = route.request().postDataJSON(); return route.fulfill({ status: 201, json: { data: { project: { publicId } } } }); });
  await page.goto("/projects/new?mode=template");
  const name = page.locator("#inst-project-name");
  await name.fill("");
  await page.getByRole("button", { name: "템플릿에서 프로젝트 생성", exact: true }).click();
  await expect(name).toBeFocused();
  await expect(name).toHaveAttribute("aria-invalid", "true");
  await expect(name).toHaveAttribute("aria-describedby", "inst-project-name-error");
  await name.fill("새 프로젝트");
  await expect(name).toHaveAttribute("aria-invalid", "false");
  await page.locator("#inst-owner-name").fill("담당자");
  await page.locator("#inst-password").fill("Test123!");
  await page.locator("#inst-start-date").fill("2026-10-01");
  await page.getByRole("button", { name: "템플릿에서 프로젝트 생성", exact: true }).click();
  await page.waitForURL(`/projects/${publicId}`);
  expect(payload).toEqual({ name: "새 프로젝트", ownerName: "담당자", projectStartDate: "2026-10-01", editPassword: "Test123!" });
});

for (const width of [390, 768, 1024, 1440]) {
  test(`긴 카드·선택 요약·오류 필드의 overflow와 focus ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await installList(page, [{ ...templates[0], name: "가".repeat(200), description: "LongUnbrokenTemplateDescription".repeat(9) }]);
    await page.goto("/projects/new?mode=template");
    await expect(page.getByRole("radio")).toBeChecked();
    expect(Array.from(await page.locator("#inst-project-name").inputValue()).length).toBe(200);
    await page.getByRole("button", { name: "템플릿에서 프로젝트 생성", exact: true }).click();
    await expect(page.locator("#inst-owner-name")).toBeFocused();
    await expect(page.locator("#inst-owner-name-error")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
    await page.screenshot({ path: `output/playwright/issue-265/long-cards-${width}.png` });
  });
}
