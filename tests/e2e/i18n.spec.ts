import { expect, test, type Page } from "@playwright/test";
import { expectSameGanttRoot, ganttRoot, installStatefulProjectFixture, publicId, rememberGanttRoot } from "../fixtures/stateful-project";
import { openRow, setup as setupTaskEditor } from "./fixtures/task-editor-density";

const localeSelector = (page: Page) => page.getByRole("combobox", { name: /^(표시 언어|Display language|Ngôn ngữ hiển thị)$/ }).first();
const storageKey = "mastergantt.ui.locale";

// ADD: preference/storage and live language switching are new #866 boundaries.
// REUSE: canonical Gantt fixture and editor draft fixture retain their existing business assertions.
test.describe("Issue #866 browser language preference", () => {
  test.use({ locale: "en-US" });

  test("first visit follows browser English, explicit Vietnamese survives reload and leaves canonical data unchanged", async ({ page, browser }, testInfo) => {
    const fixture = await installStatefulProjectFixture(page);
    const originalTasks = JSON.stringify(fixture.tasks);
    const pageErrors: string[] = [];
    page.on("pageerror", error => pageErrors.push(error.message));
    await page.goto(`/projects/${publicId}`);
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(localeSelector(page)).toHaveValue("en");
    const identity = await rememberGanttRoot(page);
    await expect(ganttRoot(page).getByRole("button", { name: "Gantt fullscreen", exact: true })).toBeVisible();
    const chart = ganttRoot(page).locator('.wx-chart[tabindex="-1"]').first();
    await chart.hover();
    await page.mouse.wheel(280, 0);
    await expect.poll(() => chart.evaluate(element => element.scrollLeft)).toBeGreaterThan(0);
    const originalScroll = await chart.evaluate(element => ({ left: element.scrollLeft, top: element.scrollTop }));

    await localeSelector(page).selectOption("vi");
    await expect(page.locator("html")).toHaveAttribute("lang", "vi");
    await expect(ganttRoot(page).getByRole("button", { name: "Gantt toàn màn hình", exact: true })).toBeVisible();
    await expectSameGanttRoot(page, identity);
    await expect.poll(() => chart.evaluate(element => ({ left: element.scrollLeft, top: element.scrollTop }))).toEqual(originalScroll);
    await expect(ganttRoot(page).locator('[role="columnheader"][data-header-id=":projectStart"]')).toHaveText("Bắt đầu");
    const localizedDate = new Intl.DateTimeFormat("vi-VN", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" }).format(new Date("2026-09-16T00:00:00.000Z"));
    await expect(ganttRoot(page).locator('.wx-row[data-id=":00000000-0000-4000-8000-000000000003"] [data-col-id=":projectStart"]').first()).toHaveText(localizedDate);
    await expect(ganttRoot(page).getByText("Stable leaf", { exact: true }).first()).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath("issue-866-vietnamese-gantt.png"), fullPage: true });
    expect(await page.evaluate(key => localStorage.getItem(key), storageKey)).toBe("vi");
    await page.reload();
    await expect(localeSelector(page)).toHaveValue("vi");
    await expect(page.locator("html")).toHaveAttribute("lang", "vi");
    expect(fixture.posts).toEqual([]);
    expect(fixture.patchRequests).toEqual([]);
    expect(fixture.project.revision).toBe(fixture.initialRevision);
    expect(JSON.stringify(fixture.tasks)).toBe(originalTasks);
    expect(pageErrors).toEqual([]);
    const independentContext = await browser.newContext({ locale: "en-US" });
    try {
      const independentPage = await independentContext.newPage();
      await installStatefulProjectFixture(independentPage);
      await independentPage.goto(page.url());
      await expect(localeSelector(independentPage)).toHaveValue("en");
      await expect(independentPage.locator("html")).toHaveAttribute("lang", "en");
    } finally { await independentContext.close(); }
  });

  test("invalid saved language uses the first supported browser preference", async ({ page }) => {
    await page.addInitScript(key => {
      localStorage.setItem(key, "unsupported");
      Object.defineProperty(navigator, "languages", { configurable: true, value: ["fr-FR", "vi-VN", "en-US"] });
    }, storageKey);
    await installStatefulProjectFixture(page);
    await page.goto(`/projects/${publicId}`);
    await expect(localeSelector(page)).toHaveValue("vi");
    await expect(page.locator("html")).toHaveAttribute("lang", "vi");
  });

  test("blocked localStorage still allows an explicit in-tab choice without throwing", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, "localStorage", { configurable: true, get() { throw new DOMException("Blocked storage", "SecurityError"); } });
    });
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await installStatefulProjectFixture(page);
    await page.goto(`/projects/${publicId}`);
    await expect(localeSelector(page)).toHaveValue("en");
    await localeSelector(page).selectOption("ko");
    await expect(page.locator("html")).toHaveAttribute("lang", "ko");
    await expect(ganttRoot(page).getByRole("button", { name: "Gantt 전체 화면", exact: true })).toBeVisible();
    expect(errors).toEqual([]);
  });
});

test("Issue #866 language change in another tab preserves the open task draft, schedule instance and canonical writes", async ({ page, context }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const fixture = await setupTaskEditor(page);
  const originalTasks = JSON.stringify(fixture.tasks);
  const originalRevision = fixture.project.revision;
  const identity = await rememberGanttRoot(page);
  await openRow(page, "Alpha leaf");
  const draft = page.locator('dialog[open] input[name="task-name"]');
  const draftName = "작성 중 <draft> · Bản nháp · unchanged";
  await draft.fill(draftName);
  const scrollPosition = await ganttRoot(page).locator('.wx-chart[tabindex="-1"]').first().evaluate(element => ({ left: element.scrollLeft, top: element.scrollTop }));
  const otherTab = await context.newPage();
  await installStatefulProjectFixture(otherTab);
  await otherTab.goto(`/projects/${publicId}`);

  for (const locale of ["en", "vi", "ko"] as const) {
    await localeSelector(otherTab).selectOption(locale);
    await expect(page.locator("html")).toHaveAttribute("lang", locale);
    await expect(draft).toHaveValue(draftName);
    await expect(page.locator("dialog[open] #task-editor-title")).toHaveText(locale === "en" ? "Task information" : locale === "vi" ? "Thông tin tác vụ" : "작업 정보");
    await expectSameGanttRoot(page, identity);
    await expect.poll(() => ganttRoot(page).locator('.wx-chart[tabindex="-1"]').first().evaluate(element => ({ left: element.scrollLeft, top: element.scrollTop }))).toEqual(scrollPosition);
  }
  expect(fixture.patches).toEqual([]);
  expect(fixture.linkMutations).toEqual([]);
  expect(fixture.assignmentMutations).toEqual([]);
  expect(fixture.project.revision).toBe(originalRevision);
  expect(JSON.stringify(fixture.tasks)).toBe(originalTasks);
  await otherTab.close();
});

test("Issue #866 Server Component admin headings and help follow English and Vietnamese", async ({ page }, testInfo) => {
  const mutations: string[] = [];
  await page.route("**/api/**", async route => {
    if (route.request().method() !== "GET") mutations.push(`${route.request().method()} ${new URL(route.request().url()).pathname}`);
    await route.fulfill({ status: 401, json: { error: { code: "UNAUTHORIZED" } } });
  });
  const surfaces = [
    {
      path: "/project-master-admin",
      eyebrow: { en: "Global master data", vi: "Danh mục toàn cục" },
      subtitle: { en: "Shared master data for all projects", vi: "Dữ liệu danh mục dùng chung cho mọi dự án" },
      link: { en: "Country calendar management", vi: "Quản lý lịch quốc gia" },
      heading: { en: "Project master data management", vi: "Quản lý danh mục dự án" },
      help: { en: "Project master data management help", vi: "Trợ giúp quản lý danh mục dự án" },
      content: { en: "Manage divisions, products and sites/companies as shared master data across all projects.", vi: "Quản lý bộ phận, sản phẩm và địa điểm/pháp nhân dưới dạng danh mục dùng chung cho mọi dự án." },
    },
    {
      path: "/resources",
      eyebrow: { en: "Global catalog", vi: "Danh mục toàn cục" },
      heading: { en: "Resource management", vi: "Quản lý nguồn lực" },
      help: { en: "Resource management help", vi: "Trợ giúp quản lý nguồn lực" },
      content: { en: "Manage resources and resource groups independently of projects.", vi: "Quản lý nguồn lực và nhóm nguồn lực độc lập với dự án." },
    },
    {
      path: "/logistics-admin",
      eyebrow: { en: "Global catalog", vi: "Danh mục toàn cục" },
      subtitle: { en: "Shared types for all projects", vi: "Loại dùng chung cho mọi dự án" },
      heading: { en: "Logistics type management", vi: "Quản lý loại logistics" },
      help: { en: "Logistics type management help", vi: "Trợ giúp quản lý loại logistics" },
      content: { en: "Manage equipment and system types as shared master data across all projects.", vi: "Quản lý loại thiết bị và hệ thống dưới dạng danh mục dùng chung cho mọi dự án." },
    },
    {
      path: "/country-calendar-admin",
      eyebrow: { en: "Global calendar data", vi: "Dữ liệu lịch toàn cục" },
      subtitle: { en: "Official country data for 2026–2037", vi: "Dữ liệu quốc gia chính thức cho năm 2026–2037" },
      link: { en: "Back to project master data", vi: "Trở lại danh mục dự án" },
      heading: { en: "Country calendar management", vi: "Quản lý lịch quốc gia" },
      help: { en: "Country calendar management help", vi: "Trợ giúp quản lý lịch quốc gia" },
      content: { en: "Register only verified official sources and their industry scope. Editing dates marks the source as unavailable and does not automatically change existing projects.", vi: "Chỉ đăng ký dữ liệu đã xác minh nguồn chính thức và phạm vi ngành áp dụng. Sửa ngày sẽ chuyển nguồn sang chưa có dữ liệu và không tự động thay đổi dự án hiện có." },
    },
  ] as const;
  for (const locale of ["en", "vi"] as const) {
    await page.setViewportSize({ width: locale === "vi" ? 390 : 1440, height: 900 });
    for (const surface of surfaces) {
      await page.goto(surface.path);
      await localeSelector(page).selectOption(locale);
      await expect(page.locator("html")).toHaveAttribute("lang", locale);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(surface.heading[locale]);
      await expect(page.locator("main .eyebrow")).toHaveText(surface.eyebrow[locale]);
      if ("subtitle" in surface) await expect(page.locator("main").getByText(surface.subtitle[locale], { exact: true })).toBeVisible();
      if ("link" in surface) await expect(page.getByRole("link", { name: surface.link[locale], exact: true })).toBeVisible();
      // The embedded catalog remains behind its normal authentication gate.
      await expect(page.locator('main input[type="password"]')).toBeVisible();
      const help = page.getByRole("button", { name: surface.help[locale], exact: true });
      await help.click();
      await expect(page.getByRole("tooltip")).toHaveText(surface.content[locale]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
      if (locale === "vi") await page.screenshot({ path: testInfo.outputPath(`issue-866-${surface.path.slice(1)}-vi-390.png`), fullPage: true });
      await page.keyboard.press("Escape");
      await expect(page.getByRole("tooltip")).toBeHidden();
      await expect(help).toBeFocused();
    }
  }
  expect(mutations).toEqual([]);
});

test("Issue #866 native Gantt keeps resized layout and latest canonical rows through each live locale in Day and Week", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(key => localStorage.setItem(key, "ko"), storageKey);
  const fixture = await installStatefulProjectFixture(page);
  const leaf = fixture.tasks[2];
  for (let index = 5; index <= 34; index++) fixture.tasks.push({ ...leaf,
    taskId: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    externalId: `LOCALE-SCROLL-${index}`, name: `Locale scroll ${index}`, siblingOrder: index,
  });
  const deleted = fixture.tasks.find(task => task.externalId === "LOCALE-SCROLL-5")!;
  await page.goto(`/projects/${publicId}`);
  const identity = await rememberGanttRoot(page);
  const root = ganttRoot(page);
  const row = (id: string) => root.locator(`.wx-table-container .wx-row[data-id=":${id}"]`).first();
  await expect(row(deleted.taskId)).toBeVisible();

  // A real canonical GET after mount must replace Core's initial renderer rows.
  // Mutating only the fixture represents a second editor's committed revision;
  // the normal task-editor reload delivers it to the mounted application.
  const latest = { ...leaf, taskId: "00000000-0000-4000-8000-000000000090", externalId: "LOCALE-LATEST", name: "Latest canonical 이름", siblingOrder: 2 };
  fixture.tasks.splice(fixture.tasks.indexOf(deleted), 1);
  // The canonical API supplies hierarchy-ordered rows; siblingOrder alone
  // does not reorder Core's input array. Keep this witness in the viewport.
  fixture.tasks.splice(3, 0, latest);
  fixture.project.revision++;
  await openRow(page, "Stable leaf");
  const editor = page.getByRole("dialog", { name: "작업 정보", exact: true });
  await editor.getByRole("button", { name: "최신 정보 다시 불러오기", exact: true }).click();
  await expect(editor.getByText(`Revision ${fixture.project.revision}`, { exact: true })).toBeVisible();
  await editor.getByRole("button", { name: "작업 편집기 닫기", exact: true }).click();
  await expect(editor).toBeHidden();
  await expect.poll(async () => {
    const receipt = JSON.parse(await root.getAttribute("data-gantt-projection-receipt") ?? "{}");
    return { revision: receipt.revision, latest: receipt.coreVisibleIds?.includes(latest.taskId), deleted: receipt.coreVisibleIds?.includes(deleted.taskId) };
  }).toEqual({ revision: fixture.project.revision, latest: true, deleted: false });
  await expect(row(latest.taskId)).toBeVisible();
  await expect(row(deleted.taskId)).toHaveCount(0);
  await expectSameGanttRoot(page, identity);
  await expect(row("00000000-0000-4000-8000-000000000004")).toHaveCount(0);
  const canonical = JSON.stringify(fixture.tasks), revision = fixture.project.revision;
  const writes: string[] = [];
  page.on("request", request => {
    if (new URL(request.url()).pathname.startsWith("/api/") && !["GET", "HEAD", "OPTIONS"].includes(request.method()))
      writes.push(`${request.method()} ${new URL(request.url()).pathname}`);
  });

  const toggle = row(fixture.tasks[0].taskId).locator('[data-action="open-task"]');
  await toggle.click();
  await expect(toggle).toHaveClass(/wxi-menu-right/);
  await row(leaf.taskId).locator('[role="gridcell"][data-col-id=":projectStart"]').click();
  await expect(row(leaf.taskId)).toHaveClass(/wx-selected/);
  const header = root.locator('[role="columnheader"][data-header-id=":text"]').first();
  const grip = await header.locator(".wx-grip").boundingBox();
  expect(grip).not.toBeNull();
  const previousColumnWidth = (await header.boundingBox())!.width;
  await page.mouse.move(grip!.x + grip!.width / 2, grip!.y + grip!.height / 2);
  await page.mouse.down();
  await page.mouse.move(grip!.x + grip!.width / 2 + 48, grip!.y + grip!.height / 2, { steps: 6 });
  await page.mouse.up();
  expect((await header.boundingBox())!.width).toBeGreaterThan(previousColumnWidth + 20);
  const grid = root.locator(".wx-table-container").first();
  const splitter = await root.locator(".wx-resizer.wx-resizer-display-all").first().boundingBox();
  expect(splitter).not.toBeNull();
  const previousGridWidth = (await grid.boundingBox())!.width;
  await page.mouse.move(splitter!.x + splitter!.width / 2, splitter!.y + 20);
  await page.mouse.down();
  await page.mouse.move(splitter!.x + splitter!.width / 2 + 48, splitter!.y + 20, { steps: 6 });
  await page.mouse.up();
  expect((await grid.boundingBox())!.width).toBeGreaterThan(previousGridWidth + 20);

  const chart = root.locator('.wx-chart[tabindex="-1"]').first();
  const vertical = root.locator(".wx-gantt").first();
  for (const scale of ["day", "week"] as const) {
    if (scale === "week") await root.getByRole("button", { name: "주", exact: true }).click();
    await expect(root).toHaveAttribute("data-gantt-scale-mode", scale);
    await chart.evaluate(element => { element.scrollLeft = 120; });
    await vertical.evaluate(element => { element.scrollTop = 34; });
    await expect.poll(() => chart.evaluate(element => element.scrollLeft)).toBeGreaterThan(0);
    await expect.poll(() => vertical.evaluate(element => element.scrollTop)).toBeGreaterThan(0);
    const scroll = { left: await chart.evaluate(element => element.scrollLeft), top: await vertical.evaluate(element => element.scrollTop) };
    const widths = { column: (await header.boundingBox())!.width, grid: (await grid.boundingBox())!.width };
    for (const locale of ["en", "vi", "ko"] as const) {
      await localeSelector(page).selectOption(locale);
      await expect(page.locator("html")).toHaveAttribute("lang", locale);
      await expectSameGanttRoot(page, identity);
      await expect(root).toHaveAttribute("data-gantt-scale-mode", scale);
      await expect.poll(async () => ({ column: (await header.boundingBox())!.width, grid: (await grid.boundingBox())!.width })).toEqual(widths);
      await expect.poll(async () => ({ left: await chart.evaluate(element => element.scrollLeft), top: await vertical.evaluate(element => element.scrollTop) })).toEqual(scroll);
      await expect(row(leaf.taskId)).toHaveClass(/wx-selected/);
      await expect(toggle).toHaveClass(/wxi-menu-right/);
      await expect(row(latest.taskId)).toBeVisible();
      await expect(row(latest.taskId)).toContainText(latest.name);
      await expect(row(deleted.taskId)).toHaveCount(0);
      await expect(row("00000000-0000-4000-8000-000000000004")).toHaveCount(0);
      expect(JSON.stringify(fixture.tasks)).toBe(canonical);
      expect(fixture.project.revision).toBe(revision);
      expect(writes).toEqual([]);
    }
  }
  // An empty query resets its origin once. A later user pan must survive
  // presentation-only locale revalidation, without resurrecting WBS rows.
  const search = page.locator('.project-schedule-filter-toolbar input[type="search"]');
  await page.getByRole("searchbox", { name: "작업명, 설명, External ID 검색", exact: true }).fill("no-locale-task-can-match-this-query");
  await expect(root.locator(".wx-table-container .wx-row[data-id]")).toHaveCount(0);
  await expect.poll(() => chart.evaluate(element => element.scrollLeft)).toBe(0);
  await chart.hover();
  await page.mouse.wheel(160, 0);
  await expect.poll(() => chart.evaluate(element => element.scrollLeft)).toBeGreaterThan(0);
  const userPosition = await chart.evaluate(element => element.scrollLeft);
  await localeSelector(page).selectOption("en");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expectSameGanttRoot(page, identity);
  await expect(search).toHaveValue("no-locale-task-can-match-this-query");
  await expect(root.locator(".wx-table-container .wx-row[data-id]")).toHaveCount(0);
  await expect.poll(() => chart.evaluate(element => element.scrollLeft)).toBe(userPosition);
  await expect.poll(async () => {
    const receipt = JSON.parse(await root.getAttribute("data-gantt-projection-receipt") ?? "{}");
    return { revision: receipt.revision, rows: receipt.coreVisibleIds?.length };
  }).toEqual({ revision, rows: 0 });
  expect(writes).toEqual([]);
});
