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
    for (const label of ["프로젝트", "사업부", "제품", "법인/사업장", "상태", "소유자", "설명", "생성", "최근 변경", "작업"]) {
      await expect(table.getByRole("columnheader", { name: label, exact: true })).toBeVisible();
    }
    const alphaRow = table.locator("tbody tr").filter({ hasText: `AMR Alpha ${suffix}` });
    await expect(alphaRow.locator("td").nth(1)).toHaveText("미지정");
    await expect(alphaRow.locator("td").nth(2)).toHaveText("미지정");
    await expect(alphaRow.locator("td").nth(3)).toHaveText("미지정");
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
    await panel.locator("summary").filter({ hasText: "프로젝트 정보" }).click();
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
    await panel.locator("summary").filter({ hasText: "날짜" }).click();
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

test.describe("Issue #229 Project List 상단 간격", () => {
  test("390/768/1024/1440에서 시스템 헤더와 WORKSPACE 사이의 compact spacing을 유지한다", async ({ page, baseURL }) => {
    const suffix = randomUUID().slice(0, 8);
    await createProject(page, baseURL!, `Spacing ${suffix}`, "Spacing Team", "project list top spacing", "Pwd2291234!");
    await page.goto("/");

    for (const [width, height] of [[390, 844], [768, 900], [1024, 900], [1440, 900]] as const) {
      await page.setViewportSize({ width, height });
      const geometry = await page.evaluate(() => {
        const header = document.querySelector<HTMLElement>(".site-header")!;
        const section = document.querySelector<HTMLElement>(".project-list-page")!;
        const workspace = section.querySelector<HTMLElement>(".eyebrow")!;
        const headerBottom = header.getBoundingClientRect().bottom;
        const sectionTop = section.getBoundingClientRect().top;
        const workspaceTop = workspace.getBoundingClientRect().top;
        return {
          sectionGap: sectionTop - headerBottom,
          workspaceGap: workspaceTop - headerBottom,
          documentOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        };
      });

      expect(geometry.documentOverflow).toBe(false);
      expect(geometry.sectionGap).toBeGreaterThanOrEqual(15);
      expect(geometry.sectionGap).toBeLessThanOrEqual(25);
      expect(geometry.workspaceGap).toBeGreaterThanOrEqual(geometry.sectionGap);
      expect(geometry.workspaceGap).toBeLessThanOrEqual(28);
    }
  });
});

test.describe("Issue #181 Project List 고급 필터 밀도", () => {
  test("비활성 그룹은 접고 활성 요약·keyboard·responsive geometry를 유지한다", async ({ page, baseURL }, testInfo) => {
    const suffix = randomUUID().slice(0, 8);
    await createProject(page, baseURL!, `Density Alpha ${suffix}`, "Automation Team", "긴 한국어 설명과 English description for responsive filter summary", "Pwd181A123!");
    await createProject(page, baseURL!, `Density Beta ${suffix}`, "Storage Team", "secondary project", "Pwd181B123!");
    await page.goto("/");

    const filterButton = page.locator('button[aria-controls="project-list-advanced-filter"]');
    for (const [width, height] of [[390, 844], [768, 900], [1024, 900], [1440, 900]] as const) {
      await page.setViewportSize({ width, height });
      if (await filterButton.getAttribute("aria-expanded") === "true") await filterButton.click();
      await filterButton.click();
      const panel = page.getByLabel("프로젝트 고급 필터");
      const info = panel.locator("details").nth(0);
      const dates = panel.locator("details").nth(1);
      await expect(info).not.toHaveAttribute("open", "");
      await expect(dates).not.toHaveAttribute("open", "");
      await expect(panel.getByRole("textbox", { name: "프로젝트명", exact: true })).not.toBeVisible();
      await expect(panel.getByLabel("생성일 조건")).not.toBeVisible();

      const geometry = await panel.evaluate((element) => {
        const bounds = element.getBoundingClientRect();
        const list = element.parentElement?.querySelector('[class*="tableWrap"]')?.getBoundingClientRect() ?? null;
        return {
          scrollHeight: element.scrollHeight,
          height: bounds.height,
          top: bounds.top,
          bottom: bounds.bottom,
          listTop: list?.top ?? null,
          documentOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        };
      });
      expect(geometry.documentOverflow).toBe(false);
      expect(geometry.height).toBeLessThanOrEqual(Math.min(384, height * 0.45) + 2);
      expect(geometry.scrollHeight).toBeLessThanOrEqual(geometry.height + 2);
      await page.screenshot({ path: testInfo.outputPath(`issue-181-filter-collapsed-${width}.png`), fullPage: true });

      const infoSummary = panel.locator("summary").filter({ hasText: "프로젝트 정보" });
      await infoSummary.focus();
      await page.keyboard.press("Enter");
      await expect(info).toHaveAttribute("open", "");
      await panel.getByRole("textbox", { name: "프로젝트명", exact: true }).fill("Density Alpha");
      await expect(infoSummary).toContainText("1개");
      await expect(infoSummary).toContainText("Density Alpha");
      await infoSummary.click();
      await expect(info).not.toHaveAttribute("open", "");
      await expect(infoSummary).toContainText("Density Alpha");

      await page.keyboard.press("Escape");
      await expect(panel).toHaveCount(0);
      await expect(filterButton).toBeFocused();
      await page.getByRole("button", { name: "초기화", exact: true }).click();
    }
  });
});


test.describe("Issue #230 Project List 필터 입력 폭과 날짜 대칭 정렬", () => {
  test("desktop compact 폭, From/To 대칭, mobile label 방향과 clear button 정렬을 유지한다", async ({ page, baseURL }) => {
    const suffix = randomUUID().slice(0, 8);
    await createProject(page, baseURL!, `Filter Width ${suffix}`, "Filter Owner", "filter width regression", "Pwd230A123!");
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");

    const filterButton = page.locator('button[aria-controls="project-list-advanced-filter"]');
    await filterButton.click();
    const panel = page.getByLabel("프로젝트 고급 필터");
    await panel.locator("summary").filter({ hasText: "프로젝트 정보" }).click();
    await panel.locator("summary").filter({ hasText: "날짜" }).click();

    const nameOperator = panel.getByLabel("프로젝트명 조건");
    const nameInput = panel.getByRole("textbox", { name: "프로젝트명", exact: true });
    const ownerOperator = panel.getByLabel("소유자 조건");
    const desktopWidths = await Promise.all([
      nameOperator.evaluate((element) => element.getBoundingClientRect().width),
      ownerOperator.evaluate((element) => element.getBoundingClientRect().width),
      nameInput.evaluate((element) => element.getBoundingClientRect().width),
    ]);
    expect(Math.abs(desktopWidths[0] - desktopWidths[1])).toBeLessThanOrEqual(1);
    expect(desktopWidths[0]).toBeLessThanOrEqual(160);
    expect(desktopWidths[2]).toBeLessThanOrEqual(232);

    const created = panel.getByRole("group", { name: "생성일" });
    await created.getByLabel("생성일 조건").selectOption("range");
    const from = created.getByLabel("From");
    const to = created.getByLabel("To");
    const desktopDateWidths = await Promise.all([
      from.evaluate((element) => element.getBoundingClientRect().width),
      to.evaluate((element) => element.getBoundingClientRect().width),
    ]);
    expect(Math.abs(desktopDateWidths[0] - desktopDateWidths[1])).toBeLessThanOrEqual(1);

    const clearButton = created.getByRole("button", { name: "생성일 조건 삭제" });
    const clearStyle = await clearButton.evaluate((element) => {
      const style = getComputedStyle(element);
      return { marginTop: style.marginTop, whiteSpace: style.whiteSpace };
    });
    expect(clearStyle.marginTop).toBe("0px");
    expect(clearStyle.whiteSpace).toBe("nowrap");

    await page.setViewportSize({ width: 768, height: 900 });
    const mobileGeometry = await Promise.all([
      from.evaluate((element) => ({
        width: element.getBoundingClientRect().width,
        labelDirection: getComputedStyle(element.closest("label")!).flexDirection,
      })),
      to.evaluate((element) => ({
        width: element.getBoundingClientRect().width,
        labelDirection: getComputedStyle(element.closest("label")!).flexDirection,
      })),
    ]);
    expect(Math.abs(mobileGeometry[0].width - mobileGeometry[1].width)).toBeLessThanOrEqual(1);
    expect(mobileGeometry[0].labelDirection).toBe("column");
    expect(mobileGeometry[1].labelDirection).toBe("column");
    expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
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
        const description = firstRow.cells[6].firstElementChild as HTMLElement;
        const lineHeight = Number.parseFloat(getComputedStyle(description).lineHeight);
        const action = firstRow.cells[9].getBoundingClientRect();
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

      const targetRow = rows.filter({ hasText: names[2] });
      const trigger = targetRow.getByRole("button", { name: `${names[2]} 프로젝트 작업`, exact: true });
      if (width === 390) {
        await targetRow.getByRole("link", { name: names[2], exact: true }).focus();
        await page.keyboard.press("Tab");
        const statusControl = targetRow.getByRole("combobox", { name: `${names[2]} 프로젝트 상태`, exact: true });
        await expect(statusControl).toBeFocused();
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
    await panel.locator("summary").filter({ hasText: "프로젝트 정보" }).click();
    await panel.getByRole("textbox", { name: "프로젝트명", exact: true }).fill("Gamma");
    await panel.locator("summary").filter({ hasText: "날짜" }).click();
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


test.describe("Issue #403 Project List 날짜 열 geometry", () => {
  test("긴 metadata와 browser locale 날짜가 sibling cell을 침범하지 않고 table-owned scroll을 유지한다", async ({ page, baseURL }, testInfo) => {
    const suffix = randomUUID().slice(0, 8);
    const name = `Issue 403 장기 프로젝트 이름과 일정 추적 ${suffix}`;
    const owner = "국제 물류자동화 플랫폼 통합 운영 책임자".repeat(2);
    const description = "장기 프로젝트 설명과 공급망 자동화 일정, 인수인계, 관계자 정보를 함께 확인하기 위한 레이아웃 회귀 fixture입니다. ".repeat(8);
    await createProject(page, baseURL!, name, owner.slice(0, 100), description, "Pwd403Layout!");

    await page.goto("/");
    const table = page.getByRole("table", { name: "프로젝트 목록" });
    const row = table.locator("tbody tr").filter({ hasText: name });
    await expect(row).toBeVisible();
    await expect(row.getByRole("combobox", { name: `${name} 프로젝트 상태`, exact: true })).toBeEnabled();

    // Project master catalog CRUD is outside this layout regression. Replace only the
    // rendered labels so the browser exercises the same truncation/column geometry
    // with deliberately long business/product/site values.
    await row.evaluate((element) => {
      const labels = [
        "글로벌 물류자동화 및 스마트팩토리 통합 사업부 장기 표시명",
        "MCS SCS ACS OCS 통합 물류제어 플랫폼 제품 장기 표시명",
        "대한민국 수도권 통합물류센터 및 해외법인 연계 사업장 장기 표시명",
      ];
      for (const [index, column] of ["business-unit", "product", "site-entity"].entries()) {
        const value = element.querySelector<HTMLElement>(`td[data-column="${column}"] > span`);
        if (!value) throw new Error(`Missing ${column} Project List value`);
        value.textContent = labels[index];
        value.title = labels[index];
      }
    });

    for (const [width, height] of [[390, 844], [768, 900], [1024, 900], [1440, 900], [1600, 900]] as const) {
      await page.setViewportSize({ width, height });
      const geometry = await row.evaluate((element) => {
        const tableElement = element.closest("table") as HTMLTableElement;
        const wrapper = tableElement.parentElement as HTMLElement;
        const rect = (selector: string) => {
          const target = element.querySelector<HTMLElement>(selector);
          if (!target) throw new Error(`Missing cell: ${selector}`);
          const bounds = target.getBoundingClientRect();
          return {
            left: bounds.left,
            right: bounds.right,
            width: bounds.width,
            clientWidth: target.clientWidth,
            scrollWidth: target.scrollWidth,
          };
        };
        const headerRect = (column: string) => {
          const target = tableElement.querySelector<HTMLElement>(`thead [data-column="${column}"]`);
          if (!target) throw new Error(`Missing header: ${column}`);
          const bounds = target.getBoundingClientRect();
          return { left: bounds.left, right: bounds.right, width: bounds.width };
        };

        const created = rect('td[data-column="created"]');
        const updated = rect('td[data-column="updated"]');
        const actions = rect('td[data-column="actions"]');
        const createdHeader = headerRect("created");
        const updatedHeader = headerRect("updated");
        const actionsHeader = headerRect("actions");
        const masterValues = Array.from(element.querySelectorAll<HTMLElement>('[data-column="business-unit"] > span, [data-column="product"] > span, [data-column="site-entity"] > span')).map((value) => ({
          clientWidth: value.clientWidth,
          scrollWidth: value.scrollWidth,
          overflow: getComputedStyle(value).overflow,
          textOverflow: getComputedStyle(value).textOverflow,
          whiteSpace: getComputedStyle(value).whiteSpace,
        }));
        const actionButton = element.querySelector<HTMLElement>('[data-column="actions"] button')!;
        return {
          documentOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
          wrapperClientWidth: wrapper.clientWidth,
          wrapperScrollWidth: wrapper.scrollWidth,
          created,
          updated,
          actions,
          createdHeader,
          updatedHeader,
          actionsHeader,
          actionButtonWidth: actionButton.getBoundingClientRect().width,
          masterValues,
        };
      });

      expect(geometry.documentOverflow).toBe(false);
      expect(geometry.created.scrollWidth).toBeLessThanOrEqual(geometry.created.clientWidth + 1);
      expect(geometry.updated.scrollWidth).toBeLessThanOrEqual(geometry.updated.clientWidth + 1);
      expect(geometry.created.right).toBeLessThanOrEqual(geometry.updated.left + 1);
      expect(geometry.updated.right).toBeLessThanOrEqual(geometry.actions.left + 1);
      expect(geometry.actions.clientWidth).toBeGreaterThanOrEqual(geometry.actionButtonWidth);
      expect(Math.abs(geometry.created.left - geometry.createdHeader.left)).toBeLessThanOrEqual(1);
      expect(Math.abs(geometry.created.width - geometry.createdHeader.width)).toBeLessThanOrEqual(1);
      expect(Math.abs(geometry.updated.left - geometry.updatedHeader.left)).toBeLessThanOrEqual(1);
      expect(Math.abs(geometry.updated.width - geometry.updatedHeader.width)).toBeLessThanOrEqual(1);
      expect(Math.abs(geometry.actions.left - geometry.actionsHeader.left)).toBeLessThanOrEqual(1);
      expect(Math.abs(geometry.actions.width - geometry.actionsHeader.width)).toBeLessThanOrEqual(1);
      expect(geometry.masterValues).toHaveLength(3);
      for (const value of geometry.masterValues) {
        expect(value.overflow).toBe("hidden");
        expect(value.textOverflow).toBe("ellipsis");
        expect(value.whiteSpace).toBe("nowrap");
        expect(value.scrollWidth).toBeGreaterThan(value.clientWidth);
      }
      if (width <= 1024) expect(geometry.wrapperScrollWidth).toBeGreaterThan(geometry.wrapperClientWidth);
      if (width >= 1440) expect(geometry.wrapperScrollWidth).toBeLessThanOrEqual(geometry.wrapperClientWidth + 1);

      await page.screenshot({ path: testInfo.outputPath(`issue-403-project-list-columns-${width}.png`), fullPage: true });
    }
  });
});
