import { randomUUID } from "node:crypto";
import { expect, test, isolatedApplicationOptions } from "./fixtures/isolated-application";

test.use(isolatedApplicationOptions);

async function createProject(page: import("@playwright/test").Page, baseURL: string, name: string, ownerName: string, description: string, password: string) {
  const response = await page.request.post("/api/projects", {
    headers: { Origin: baseURL },
    data: { name, ownerName, description, editPassword: password },
  });
  expect(response.status()).toBe(201);
  return (await response.json()).data.project.publicId as string;
}

test.describe("Issue #84 프로젝트 목록 검색·필터", () => {
  test("Quick Search와 고급 조건을 AND로 조합하고 서버 재조회 없이 초기화한다", async ({ page, baseURL }) => {
    const suffix = randomUUID().slice(0, 8);
    await createProject(page, baseURL!, `AMR Alpha ${suffix}`, "Automation Team", "Vietnam logistics", "PwdA123456!");
    await createProject(page, baseURL!, `Stocker Beta ${suffix}`, "Storage Team", "Korea stocker", "PwdB123456!");

    let collectionGets = 0;
    page.on("request", (request) => {
      if (request.method() === "GET" && new URL(request.url()).pathname === "/api/projects") collectionGets += 1;
    });

    await page.goto("/");
    const table = page.getByRole("table", { name: "프로젝트 목록" });
    await expect(table).toBeVisible();
    const initialGets = collectionGets;

    const search = page.getByLabel("프로젝트명, 소유자 또는 설명 검색");
    await search.fill(`  vietnam  `);
    await expect(table.locator("tbody tr")).toHaveCount(1);
    await expect(table).toContainText(`AMR Alpha ${suffix}`);
    await expect(page.locator(".project-filter-result")).toContainText("1 / 2개 프로젝트");
    expect(collectionGets).toBe(initialGets);

    const filterButton = page.getByRole("button", { name: /필터 1/ });
    await filterButton.click();
    const panel = page.getByLabel("프로젝트 고급 필터");
    await panel.getByRole("textbox", { name: "프로젝트명", exact: true }).fill("alpha");
    await expect(page.getByRole("button", { name: /필터 2/ })).toBeVisible();
    await panel.getByLabel("소유자 지정 여부").selectOption("assigned");
    await expect(page.getByRole("button", { name: /필터 3/ })).toBeVisible();
    await expect(table.locator("tbody tr")).toHaveCount(1);

    await panel.getByRole("textbox", { name: "프로젝트명", exact: true }).fill("does-not-match");
    await expect(page.getByRole("heading", { name: "조건에 맞는 프로젝트가 없습니다." })).toBeVisible();
    await page.getByRole("button", { name: "검색/필터 초기화" }).click();
    await expect(table.locator("tbody tr")).toHaveCount(2);
    await expect(search).toHaveValue("");
    expect(collectionGets).toBe(initialGets);
  });

  test("browser timezone 날짜 필터, Escape focus 복귀와 검색 상태의 Row Action을 유지한다", async ({ page, baseURL }) => {
    const suffix = randomUUID().slice(0, 8);
    const name = `Timezone Project ${suffix}`;
    await createProject(page, baseURL!, name, "Timezone Team", "calendar-date", "PwdT123456!");
    const collection = await (await page.request.get("/api/projects")).json();
    const project = collection.data.projects.find((candidate: { name: string }) => candidate.name === name);
    expect(project).toBeTruthy();

    await page.goto("/");
    const search = page.getByLabel("프로젝트명, 소유자 또는 설명 검색");
    await search.fill("timezone");
    const filterButton = page.locator('button[aria-controls="project-list-advanced-filter"]');
    await filterButton.click();
    const panel = page.getByLabel("프로젝트 고급 필터");
    const browserDate = await page.evaluate((value) => {
      const parts = new Intl.DateTimeFormat("en-US", { year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(value));
      const part = (type: string) => parts.find((item) => item.type === type)!.value;
      return `${part("year")}-${part("month")}-${part("day")}`;
    }, project.createdAt);
    await panel.getByLabel("생성일 조건").selectOption("equals");
    await panel.locator('input[type="date"]').first().fill(browserDate);
    await expect(page.getByRole("table", { name: "프로젝트 목록" }).locator("tbody tr")).toHaveCount(1);

    await page.keyboard.press("Escape");
    await expect(panel).toHaveCount(0);
    await expect(filterButton).toBeFocused();

    const trigger = page.getByRole("button", { name: `${name} 프로젝트 작업`, exact: true });
    await trigger.click();
    await expect(page.getByRole("menu", { name: `${name} 프로젝트 작업`, exact: true })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(trigger).toBeFocused();
    await expect(search).toHaveValue("timezone");
  });

  test("검색 상태에서 삭제 성공 후 삭제된 프로젝트가 결과에 남지 않는다", async ({ page, baseURL }) => {
    const suffix = randomUUID().slice(0, 8);
    const name = `Delete Filtered ${suffix}`;
    const password = "PwdD123456!";
    await createProject(page, baseURL!, name, "Delete Team", "delete filtered row", password);
    await createProject(page, baseURL!, `Keep ${suffix}`, "Keep Team", "other row", "PwdK123456!");

    await page.goto("/");
    const search = page.getByLabel("프로젝트명, 소유자 또는 설명 검색");
    await search.fill("delete filtered");
    const row = page.getByRole("table", { name: "프로젝트 목록" }).locator("tbody tr");
    await expect(row).toHaveCount(1);

    await row.getByRole("button", { name: `${name} 프로젝트 작업`, exact: true }).click();
    await page.getByRole("menu", { name: `${name} 프로젝트 작업`, exact: true }).getByRole("menuitem", { name: "삭제" }).click();
    const dialog = page.getByRole("dialog", { name: "프로젝트 삭제" });
    await dialog.getByLabel("삭제 확인 비밀번호").fill(password);
    await dialog.getByRole("button", { name: "비밀번호 확인 후 삭제" }).click();

    await expect(page.getByRole("heading", { name: "조건에 맞는 프로젝트가 없습니다." })).toBeVisible();
    await expect(search).toHaveValue("delete filtered");
    await expect(page.locator(".project-filter-result")).toContainText("0 / 1개 프로젝트");
  });

  test("390/768/1024/1440에서 문서 수준 가로 overflow가 없다", async ({ page, baseURL }) => {
    const suffix = randomUUID().slice(0, 8);
    await createProject(page, baseURL!, `Responsive ${suffix}`, "Responsive Team", "responsive search", "PwdR123456!");
    await page.goto("/");
    for (const width of [390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await expect(page.getByLabel("프로젝트명, 소유자 또는 설명 검색")).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
    }
  });
});

test.describe("Issue #130 Phase 1 Project List 시각·접근성 계약", () => {
  test("같은 긴 목록에서 table 내부 스크롤, 열·행 밀도, More 메뉴와 결과 상태를 유지한다", async ({ page, baseURL }, testInfo) => {
    const suffix = randomUUID().slice(0, 8);
    const names = [
      `장기 프로젝트 일정과 공급망 전환 계획 Alpha ${suffix}`,
      `Global engineering delivery and operations Beta ${suffix}`,
      `한국어 English 혼합 프로젝트 Gamma ${suffix}`,
    ];
    for (const [index, name] of names.entries()) {
      await createProject(page, baseURL!, name, `Owner Team ${index + 1}`,
        `긴 설명입니다. This description explains milestones, dependencies, delivery owners, and operational handoff for project ${index + 1}.`,
        "PwdL123456!");
    }
    await page.goto("/");
    const table = page.getByRole("table", { name: "프로젝트 목록" });
    const rows = table.locator("tbody tr");
    await expect(rows).toHaveCount(3);

    for (const [width, height] of [[390, 844], [768, 900], [1024, 900], [1440, 900], [1600, 900]] as const) {
      await page.setViewportSize({ width, height });
      await expect(table).toBeVisible();
      await expect(page.getByRole("link", { name: "프로젝트 만들기" })).toBeVisible();
      const geometry = await page.evaluate(() => {
        const tableElement = document.querySelector<HTMLTableElement>('table[aria-label="프로젝트 목록"]')!;
        const wrapper = tableElement.parentElement!;
        const firstRow = tableElement.tBodies[0].rows[0];
        const description = firstRow.cells[3].firstElementChild as HTMLElement;
        const lineHeight = Number.parseFloat(getComputedStyle(description).lineHeight);
        const action = firstRow.cells[6].getBoundingClientRect();
        return {
          documentOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
          wrapperClientWidth: wrapper.clientWidth,
          wrapperScrollWidth: wrapper.scrollWidth,
          rowHeight: firstRow.getBoundingClientRect().height,
          descriptionHeight: description.getBoundingClientRect().height,
          descriptionTwoLines: lineHeight * 2 + 2,
          actionWidth: action.width,
        };
      });
      expect(geometry.documentOverflow).toBe(false);
      expect(geometry.actionWidth).toBeGreaterThanOrEqual(36);
      expect(geometry.descriptionHeight).toBeLessThanOrEqual(geometry.descriptionTwoLines);
      expect(geometry.rowHeight).toBeLessThanOrEqual(90);
      if (width <= 768) expect(geometry.wrapperScrollWidth).toBeGreaterThan(geometry.wrapperClientWidth);
      await page.screenshot({ path: testInfo.outputPath(`issue-130-list-current-${width}.png`), fullPage: true });

      const trigger = rows.filter({ hasText: names[2] }).getByRole("button", { name: `${names[2]} 프로젝트 작업`, exact: true });
      if (width === 390) {
        await rows.filter({ hasText: names[2] }).getByRole("link", { name: names[2], exact: true }).focus();
        await page.keyboard.press("Tab");
        await expect(trigger).toBeFocused();
        await page.keyboard.press("Enter");
      } else {
        await trigger.click();
      }
      if (width <= 768) {
        expect(await table.evaluate((element) => element.parentElement!.scrollLeft)).toBeGreaterThan(0);
      }
      const menu = page.getByRole("menu", { name: `${names[2]} 프로젝트 작업`, exact: true });
      await expect(menu).toBeVisible();
      const bounds = await menu.boundingBox();
      expect(bounds).not.toBeNull();
      expect(bounds!.x).toBeGreaterThanOrEqual(8);
      expect(bounds!.y).toBeGreaterThanOrEqual(8);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width - 8);
      expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(height - 8);
      if (width === 390) await page.screenshot({ path: testInfo.outputPath("issue-130-list-current-menu-390.png"), fullPage: true });
      await expect(menu.getByRole("menuitem", { name: "프로젝트 복사" })).toBeFocused();
      await page.keyboard.press("End");
      await expect(menu.getByRole("menuitem", { name: "삭제" })).toBeFocused();
      await page.keyboard.press("Home");
      await expect(menu.getByRole("menuitem", { name: "프로젝트 복사" })).toBeFocused();
      await page.keyboard.press("Escape");
      await expect(menu).toHaveCount(0);
      await expect(trigger).toBeFocused();
      if (width === 390) {
        await page.keyboard.press("Enter");
        await expect(menu).toBeVisible();
        const triggerX = await trigger.evaluate((element) => element.getBoundingClientRect().x);
        await table.evaluate((element) => element.parentElement!.dispatchEvent(new Event("scroll")));
        await expect(menu).toBeVisible();
        await expect(trigger).toHaveAttribute("aria-expanded", "true");
        expect(await trigger.evaluate((element) => element.getBoundingClientRect().x)).toBe(triggerX);

        await table.evaluate((element) => {
          const wrapper = element.parentElement!;
          wrapper.scrollLeft = Math.max(0, wrapper.scrollLeft - 40);
        });
        await expect.poll(() => trigger.evaluate((element) => element.getBoundingClientRect().x)).not.toBe(triggerX);
        await expect(menu).toHaveCount(0);
        await expect(trigger).toHaveAttribute("aria-expanded", "false");
      }
    }

    await page.setViewportSize({ width: 390, height: 844 });
    const search = page.getByLabel("프로젝트명, 소유자 또는 설명 검색");
    await search.fill("no-matching-project");
    await expect(page.getByRole("heading", { name: "조건에 맞는 프로젝트가 없습니다." })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath("issue-130-list-current-no-result-390.png"), fullPage: true });
    await page.getByRole("button", { name: "검색/필터 초기화" }).click();
    await expect(rows).toHaveCount(3);
    await expect(search).toHaveValue("");

    await search.fill("혼합");
    await page.locator('button[aria-controls="project-list-advanced-filter"]').click();
    const panel = page.getByLabel("프로젝트 고급 필터");
    await panel.getByRole("textbox", { name: "프로젝트명", exact: true }).fill("Gamma");
    const created = panel.getByRole("group", { name: "생성일" });
    await created.getByLabel("생성일 조건").selectOption("range");
    await created.getByLabel("From").fill("2026-09-18");
    await created.getByLabel("To").fill("2026-09-01");
    const dateError = created.getByRole("alert");
    await expect(dateError).toBeVisible();
    await dateError.scrollIntoViewIfNeeded();
    const errorBounds = await dateError.boundingBox();
    expect(errorBounds).not.toBeNull();
    expect(errorBounds!.x).toBeGreaterThanOrEqual(0);
    expect(errorBounds!.x + errorBounds!.width).toBeLessThanOrEqual(390);
    await expect(rows).toHaveCount(1);
    await expect(table).toContainText(names[2]);
    await expect(search).toHaveValue("혼합");
    await expect(panel.getByRole("textbox", { name: "프로젝트명", exact: true })).toHaveValue("Gamma");
    await page.screenshot({ path: testInfo.outputPath("issue-130-list-current-invalid-range-390.png"), fullPage: true });
  });
});
