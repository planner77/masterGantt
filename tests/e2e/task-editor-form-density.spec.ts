import { mkdir, writeFile } from "node:fs/promises";
import { expect, test, type Locator } from "@playwright/test";
import { chooseTaskInformation } from "./helpers/task-context-menu";
import { editor, openRow, publicId, relationEditor, setup } from "./fixtures/task-editor-density";

const phase = process.env.ISSUE456_CAPTURE_PHASE ?? "after";
const output = `output/playwright/issue-456/${phase}`;
const widths = [390, 768, 1024, 1440, 1920];
async function geometry(dialog: Locator) {
  return dialog.evaluate((element) => {
    const rect = (node: Element) => { const r = node.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom }; };
    return {
      dialog: rect(element), documentOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      controls: Array.from(element.querySelectorAll<HTMLElement>("input,select,textarea,button,output")).filter((node) => node.getClientRects().length).map((node) => {
        const style = getComputedStyle(node);
        return { tag: node.tagName, name: node.getAttribute("name"), text: node.getAttribute("aria-label") ?? node.textContent?.trim(), type: node.getAttribute("type"), ...rect(node), scrollWidth: node.scrollWidth, clientWidth: node.clientWidth, minHeight: style.minHeight, minWidth: style.minWidth, margin: style.margin, padding: style.padding, fontSize: style.fontSize, outline: style.outline };
      }),
      owners: Array.from(element.querySelectorAll<HTMLElement>("header,footer,[role=tablist],[role=tabpanel],form > div")).filter((node) => node.getClientRects().length).map((node) => ({ role: node.getAttribute("role"), className: node.className, ...rect(node), clientHeight: node.clientHeight, scrollHeight: node.scrollHeight, scrollTop: node.scrollTop, scrollWidth: node.scrollWidth, clientWidth: node.clientWidth })),
    };
  });
}

test("#456 동일 유효 자료로 다섯 폭의 Task Resource Relation과 nested Baseline footer를 측정한다", async ({ page, browser }) => {
  test.setTimeout(120_000);
  await mkdir(output, { recursive: true });
  const fixture = await setup(page, { assignmentTargets: true, links: true });
  const identity = await page.locator(".project-gantt-frame").getAttribute("data-project-gantt-api-instance");
  await writeFile(`${output}/environment.json`, JSON.stringify({ browser: browser.version(), phase, zoom: "browser default 100%; native 125% NOT TESTED", fixture: { nameCharacters: Array.from(fixture.tasks[3].name).length, descriptionCharacters: Array.from(fixture.tasks[3].description!).length, urlCharacters: Array.from(fixture.tasks[3].url!).length, baselineDuration: fixture.tasks[3].baselineDuration }, browserEnvironment: await page.evaluate(() => ({ locale: navigator.language, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, userAgent: navigator.userAgent, devicePixelRatio, visualViewportScale: visualViewport?.scale })) }, null, 2));
  for (const width of widths) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    await openRow(page);
    const dialog = editor(page);
    for (const [label, key] of [["작업 정보", "task"], ["리소스", "resource"], ["관계", "relation"]]) {
      await dialog.getByRole("tab", { name: label === "작업 정보" ? label : new RegExp(label), exact: label === "작업 정보" }).click();
      await expect(dialog.getByRole("tabpanel", { name: label === "작업 정보" ? label : new RegExp(label), exact: label === "작업 정보" })).toBeVisible();
      if (key === "resource") await expect(dialog.getByRole("checkbox", { name: /Resource A/ })).toBeVisible();
      if (phase === "after") {
        const measured = await geometry(dialog);
        expect(measured.documentOverflow).toBeLessThanOrEqual(1);
        expect(measured.dialog.x).toBeGreaterThanOrEqual(0);
        expect(measured.dialog.right).toBeLessThanOrEqual(width);
        if (key === "task") {
          await expect(dialog.getByRole("group", { name: "일정", exact: true })).toBeVisible();
          await expect(dialog.getByRole("group", { name: "상세 정보", exact: true })).toBeVisible();
          const progress = await dialog.locator('[class*="sliderRow"]').evaluate((element) => {
            const owner = element.getBoundingClientRect(), range = element.querySelector("input")!.getBoundingClientRect(), value = element.querySelector("span")!.getBoundingClientRect(), textRange = document.createRange(); textRange.selectNodeContents(element.querySelector("span")!); const text = textRange.getBoundingClientRect();
            return { ownerLeft: owner.left, ownerRight: owner.right, rangeLeft: range.left, rangeRight: range.right, rangeBottom: range.bottom, valueTop: value.top, valueLeft: value.left, valueRight: value.right, textLeft: text.left, textRight: text.right, value: element.querySelector("span")!.textContent };
          });
          expect(progress.value).toBe("10%");
          expect(progress.rangeLeft).toBeGreaterThanOrEqual(progress.ownerLeft);
          if (width > 480) expect(progress.rangeRight).toBeLessThanOrEqual(progress.valueLeft);
          else expect(progress.rangeBottom).toBeLessThanOrEqual(progress.valueTop);
          expect(progress.valueRight).toBeLessThanOrEqual(progress.ownerRight + 1);
          expect(progress.textRight).toBeLessThanOrEqual(progress.ownerRight + 1);
          expect(progress.textLeft).toBeGreaterThanOrEqual(progress.ownerLeft);
          await writeFile(`${output}/progress-${width}.json`, JSON.stringify(progress, null, 2));
          await expect(dialog.locator('select[name="task-schedule-mode"]')).toHaveAccessibleName(/일정 모드/);
          if (width >= 1024) expect((await dialog.locator('select[name="task-schedule-mode"]').boundingBox())!.width).toBeLessThanOrEqual(208);
        }
      }
      await page.screenshot({ path: `${output}/${key}-${width}.png` });
      await writeFile(`${output}/${key}-${width}.json`, JSON.stringify(await geometry(dialog), null, 2));
    }
    await dialog.getByRole("button", { name: "관계 추가", exact: true }).click();
    await expect(relationEditor(page)).toBeVisible();
    await page.screenshot({ path: `${output}/nested-${width}.png` });
    await writeFile(`${output}/nested-${width}.json`, JSON.stringify(await geometry(relationEditor(page)), null, 2));
    await page.keyboard.press("Escape");
    await expect(relationEditor(page)).toHaveCount(0);
    await dialog.getByRole("tab", { name: "작업 정보", exact: true }).click();
    await dialog.getByRole("heading", { name: "기준 일정 (Baseline)", exact: true }).scrollIntoViewIfNeeded();
    if (phase === "after") {
      const buttons = [dialog.getByRole("button", { name: "현재 일정으로 설정", exact: true }), dialog.getByRole("button", { name: "기준 일정 삭제", exact: true }), dialog.getByRole("button", { name: "취소", exact: true }), dialog.getByRole("button", { name: "저장", exact: true })];
      const bounds = await Promise.all(buttons.map((button) => button.boundingBox()));
      for (const boundsOfButton of bounds) expect(boundsOfButton!.height).toBeGreaterThanOrEqual(44);
      expect(Math.abs(bounds[2]!.y - bounds[3]!.y)).toBeLessThanOrEqual(1);
      expect(Math.abs(bounds[2]!.height - bounds[3]!.height)).toBeLessThanOrEqual(1);
      if (width >= 768) { expect(bounds[2]!.width).toBeLessThan(104); expect(bounds[3]!.width).toBeLessThan(104); }
    }
    await page.screenshot({ path: `${output}/baseline-${width}.png` });
    await writeFile(`${output}/baseline-${width}.json`, JSON.stringify(await geometry(dialog), null, 2));
    await dialog.getByRole("button", { name: "취소", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.locator(".project-gantt-frame")).toHaveAttribute("data-project-gantt-api-instance", identity!);
  }
  expect(fixture.patches).toHaveLength(0);
  expect(fixture.linkMutations).toHaveLength(0);
  expect(fixture.assignmentMutations).toHaveLength(0);
});

test("#456 Milestone 동적 소속과 물류 탭의 조회 geometry를 다섯 폭에 기록한다", async ({ page }) => {
  test.setTimeout(90_000);
  await mkdir(output, { recursive: true });
  const fixture = await setup(page);
  for (const width of widths) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    await openRow(page, "Milestone");
    const dialog = editor(page);
    await expect(dialog.getByRole("tab")).toHaveCount(5);
    for (const [label, key] of [["소속 작업", "membership"], ["물류 연결", "logistics"]]) {
      await dialog.getByRole("tab", { name: new RegExp(label) }).click();
      await expect(dialog.getByRole("tabpanel", { name: new RegExp(label) })).toBeVisible();
      await page.screenshot({ path: `${output}/${key}-${width}.png` });
      await writeFile(`${output}/${key}-${width}.json`, JSON.stringify(await geometry(dialog), null, 2));
    }
    await dialog.getByRole("button", { name: "취소", exact: true }).click();
    await expect(dialog).toHaveCount(0);
  }
  expect(fixture.patches).toHaveLength(0);
  expect(fixture.assignmentMutations).toHaveLength(0);
});

test("#456 실제 keyboard 100%·날짜 오류·pending action 폭과 닫기 잠금을 보존한다", async ({ page }) => {
  await mkdir(output, { recursive: true });
  const fixture = await setup(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await openRow(page);
  const dialog = editor(page), progress = dialog.getByLabel("진행률 (%)", { exact: true });
  await progress.focus(); await page.keyboard.press("End");
  await expect(progress).toHaveValue("100");
  await expect(dialog.getByLabel("상태", { exact: true })).toHaveValue("completed");
  const progressGeometry = await dialog.locator('[class*="sliderRow"]').evaluate((element) => { const range = element.querySelector("input")!, value = element.querySelector("span")!, owner = element.getBoundingClientRect(), textRange = document.createRange(); textRange.selectNodeContents(value); const text = textRange.getBoundingClientRect(), input = range.getBoundingClientRect(), style = getComputedStyle(range), outset = parseFloat(style.outlineWidth) + parseFloat(style.outlineOffset); return { text: value.textContent, left: text.left, right: text.right, ownerLeft: owner.left, ownerRight: owner.right, inputLeft: input.left, inputRight: input.right, outset, outline: style.outlineStyle, focused: document.activeElement === range }; });
  expect(progressGeometry.text).toBe("100%"); expect(progressGeometry.focused).toBe(true); expect(progressGeometry.outline).not.toBe("none");
  expect(progressGeometry.right).toBeLessThanOrEqual(progressGeometry.ownerRight + 1);
  await writeFile(`${output}/progress100-keyboard.json`, JSON.stringify(progressGeometry, null, 2));
  await page.screenshot({ path: `${output}/progress100-keyboard.png` });
  const end = dialog.getByLabel("요청 종료일", { exact: true }); await end.fill("2026-09-19");
  await expect(end).toHaveAttribute("aria-invalid", "true"); await expect(end).toHaveAttribute("aria-describedby", "task-requested-end-error");
  await expect(dialog.locator("#task-requested-end-error")).toBeVisible();
  await expect(dialog.getByRole("button", { name: "저장", exact: true })).toBeEnabled();
  await page.screenshot({ path: `${output}/date-error.png` }); await writeFile(`${output}/date-error.json`, JSON.stringify(await geometry(dialog), null, 2));
  await end.fill("2026-09-18");
  let release!: () => void; fixture.gate = new Promise<void>((resolve) => { release = resolve; });
  const save = dialog.getByRole("button", { name: "저장", exact: true }), before = await save.boundingBox();
  await save.click(); await expect(dialog.getByRole("button", { name: "저장 중…", exact: true })).toBeDisabled();
  const during = await dialog.getByRole("button", { name: "저장 중…", exact: true }).boundingBox();
  expect(during).toEqual(before); await expect(dialog.getByRole("button", { name: "취소", exact: true })).toBeDisabled();
  await expect.poll(() => page.evaluate(() => document.activeElement === document.body)).toBe(true);
  const pendingGantt = () => page.locator(".project-gantt-frame").evaluate((element) => ({ api: element.getAttribute("data-project-gantt-api-instance"), instance: element.getAttribute("data-project-gantt-instance"), publicViewport: Reflect.get(element, "__masterganttPublicViewport"), chartLeft: element.querySelector(".wx-chart")!.scrollLeft, gridTop: element.querySelector(".wx-gantt")!.scrollTop, scale: element.getAttribute("data-gantt-scale-mode"), fullscreen: document.fullscreenElement === element }));
  const pendingBeforeEscape = await pendingGantt();
  await page.keyboard.press("Escape"); await page.keyboard.press("Escape"); await expect(dialog).toBeVisible();
  expect(await pendingGantt()).toEqual(pendingBeforeEscape);
  expect(fixture.patches).toHaveLength(1);
  await page.screenshot({ path: `${output}/saving.png` }); await writeFile(`${output}/saving.json`, JSON.stringify({ before, during, controls: await geometry(dialog), patchCount: fixture.patches.length, pendingBeforeEscape, pendingAfterEscape: await pendingGantt(), bodyFocused: await page.evaluate(() => document.activeElement === document.body) }, null, 2));
  release(); await expect(dialog).toHaveCount(0); expect(fixture.patches).toHaveLength(1);
});

test("#456 비기본 WBS fullscreen scroll tree column scale selection은 Editor와 metadata 저장 후 유지된다", async ({ page }) => {
  await mkdir(output, { recursive: true });
  const fixture = await setup(page, { longList: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  const frame = page.locator(".project-gantt-frame"), target = page.locator('.project-gantt-widget .wx-table-container .wx-row[data-id=":00000000-0000-4000-8000-000000000004"]');
  await page.locator('.project-gantt-widget .wx-table-container .wx-row[data-id=":00000000-0000-4000-8000-000000000001"]').click({ button: "right", position: { x: 12, y: 19 } });
  await page.getByRole("menuitem", { name: "최상위로 열기 (작업공간 탭)", exact: true }).click();
  const scope = page.getByRole("tablist", { name: "WBS 범위 탭" }).getByRole("tab", { name: "Summary", exact: true });
  await expect(scope).toHaveAttribute("aria-selected", "true");
  const header = frame.locator(".wx-table-container .wx-header").first();
  await header.click({ button: "right" }); await page.locator(".project-column-menu").getByRole("checkbox", { name: "외부 ID", exact: true }).check(); await page.keyboard.press("Escape");
  await frame.getByRole("button", { name: "주", exact: true }).click();
  await frame.getByRole("button", { name: "Gantt 전체 화면", exact: true }).click();
  await expect.poll(() => page.evaluate(() => document.fullscreenElement === document.querySelector(".project-gantt-frame"))).toBe(true);
  await target.click({ button: "right", position: { x: 12, y: 19 } }); await page.keyboard.press("Escape");
  const chart = frame.locator(".wx-chart").first(), vertical = frame.locator(".wx-gantt").first();
  await chart.evaluate((element) => { element.scrollLeft = 120; }); await vertical.evaluate((element) => { element.scrollTop = 38; });
  const state = async () => ({ ...(await frame.evaluate((element) => ({ api: element.getAttribute("data-project-gantt-api-instance"), instance: element.getAttribute("data-project-gantt-instance"), publicViewport: Reflect.get(element, "__masterganttPublicViewport") as { left: number; top: number }, fullscreen: document.fullscreenElement === element, scale: element.getAttribute("data-gantt-scale-mode"), chartScroll: element.querySelector(".wx-chart")!.scrollLeft, verticalScroll: element.querySelector(".wx-gantt")!.scrollTop, selected: Array.from(element.querySelectorAll('.wx-row[data-copy-selected="true"]')).map((node) => node.getAttribute("data-id")), tree: Array.from(element.querySelectorAll('[data-action="open-task"]')).map((node) => ({ id: node.closest("[data-id]")?.getAttribute("data-id"), closed: node.classList.contains("wxi-menu-right") })), scope: document.querySelector('.project-scope-tabs [aria-selected="true"]')?.textContent, rootTask: new URL(location.href).searchParams.get("rootTask") }))), columnGeometry: { task: (await header.getByText("작업", { exact: true }).locator("..").boundingBox())!.width, externalId: (await header.getByText("외부 ID", { exact: true }).locator("..").boundingBox())!.width } });
  await expect.poll(async () => (await state()).chartScroll).toBe(120);
  await expect.poll(async () => (await state()).verticalScroll).toBe(38);
  const before = await state();
  expect(before.columnGeometry.task).toBeGreaterThan(180);
  expect(before.columnGeometry.externalId).toBeGreaterThan(0);
  expect(before.selected).toHaveLength(1);
  expect(before.tree.length).toBeGreaterThan(0);
  const phases: { label: string; state: Awaited<ReturnType<typeof state>> }[] = [{ label: "before", state: before }];
  await target.click({ button: "right", position: { x: 12, y: 19 } }); phases.push({ label: "context menu", state: await state() });
  await chooseTaskInformation(page);
  phases.push({ label: "editor opened", state: await state() });
  const dialog = editor(page);
  for (const name of [/리소스/, /관계/, /물류 연결/, "작업 정보"]) {
    await dialog.getByRole("tab", { name, exact: typeof name === "string" }).click();
    phases.push({ label: `tab ${String(name)}`, state: await state() });
  }
  phases.push({ label: "tabs visited", state: await state() });
  await dialog.getByRole("button", { name: "취소", exact: true }).click(); await expect(dialog).toHaveCount(0);
  phases.push({ label: "editor cancelled", state: await state() });
  await writeFile(`${output}/gantt-state-phases.json`, JSON.stringify(phases, null, 2));
  await writeFile(`${output}/gantt-public-events.json`, (await frame.getAttribute("data-gantt-public-scroll-events")) ?? "[]");
  await expect.poll(state).toEqual(before);
  await target.click({ button: "right", position: { x: 12, y: 19 } }); await chooseTaskInformation(page);
  await dialog.getByLabel("작업명", { exact: true }).fill("State preserved metadata"); await dialog.getByRole("button", { name: "저장", exact: true }).click(); await expect(dialog).toHaveCount(0);
  phases.push({ label: "metadata saved", state: await state() });
  await writeFile(`${output}/gantt-state-phases.json`, JSON.stringify(phases, null, 2));
  await writeFile(`${output}/gantt-public-events.json`, (await frame.getAttribute("data-gantt-public-scroll-events")) ?? "[]");
  await expect.poll(state).toEqual(before); expect(fixture.patches).toHaveLength(1); expect(fixture.patches[0].postDataJSON()).toEqual({ name: "State preserved metadata" });
  await writeFile(`${output}/gantt-state.json`, JSON.stringify({ before, after: await state(), patchCount: fixture.patches.length, path: `/projects/${publicId}` }, null, 2));
  await page.screenshot({ path: `${output}/gantt-state.png` });
  await frame.getByRole("button", { name: "Gantt 전체 화면 종료", exact: true }).click();
});


test("#456 필터 ID 변경·빈집합·해제와 새 API는 필요한 행을 다시 표시한다", async ({ page }) => {
  await setup(page);
  const frame = page.locator(".project-gantt-frame"), target = page.locator('.project-gantt-widget .wx-table-container .wx-row[data-id=":00000000-0000-4000-8000-000000000004"]');
  const search = page.getByRole("searchbox", { name: "작업명, 설명, External ID 검색" });
  const initial = await frame.getAttribute("data-project-gantt-api-instance");
  await search.fill("EDITOR-4"); await expect(target).toBeVisible();
  await expect(page.locator('.project-gantt-widget .wx-table-container .wx-row[data-id=":00000000-0000-4000-8000-000000000003"]')).toHaveCount(0);
  await search.fill("no-match-issue456"); await expect(target).toHaveCount(0);
  await expect(page.locator(".project-gantt-widget .wx-table-container .wx-row[data-id]")).toHaveCount(0);
  await page.getByRole("button", { name: "초기화", exact: true }).click(); await expect(target).toBeVisible();
  expect(await frame.getAttribute("data-project-gantt-api-instance")).toBe(initial);
  await page.reload(); await expect(target).toBeVisible();
  await search.fill("EDITOR-4"); await expect(target).toBeVisible();
  await search.fill("no-match-issue456"); await expect(target).toHaveCount(0);
  await page.getByRole("button", { name: "초기화", exact: true }).click(); await expect(target).toBeVisible();
});


test("#456 active name filter의 metadata 저장으로 실제 ID 집합이 바뀌면 이전 viewport를 복원하지 않는다", async ({ page }) => {
  await mkdir(output, { recursive: true });
  const fixture = await setup(page, { longList: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  const frame = page.locator(".project-gantt-frame"), target = page.locator('.project-gantt-widget .wx-table-container .wx-row[data-id=":00000000-0000-4000-8000-000000000004"]');
  await frame.getByRole("button", { name: "주", exact: true }).click();
  const search = page.getByRole("searchbox", { name: "작업명, 설명, External ID 검색" });
  await search.fill("긴 작업명"); await expect(target).toBeVisible();
  const chart = frame.locator(".wx-chart").first();
  await chart.evaluate((element) => { element.scrollLeft = 120; });
  const viewport = () => frame.evaluate((element) => ({ api: element.getAttribute("data-project-gantt-api-instance"), instance: element.getAttribute("data-project-gantt-instance"), public: Reflect.get(element, "__masterganttPublicViewport") as { left: number; top: number }, domLeft: element.querySelector(".wx-chart")!.scrollLeft }));
  await expect.poll(async () => (await viewport()).public.left).toBe(120);
  const before = await viewport();
  await target.click({ button: "right", position: { x: 12, y: 19 } }); await chooseTaskInformation(page);
  const dialog = editor(page); await dialog.getByLabel("작업명", { exact: true }).fill("Filtered name changed");
  await dialog.getByRole("button", { name: "저장", exact: true }).click(); await expect(dialog).toHaveCount(0);
  await expect(search).toHaveValue("긴 작업명"); await expect(target).toHaveCount(0);
  await expect(page.locator(".project-gantt-widget .wx-table-container .wx-row[data-id]")).toHaveCount(0);
  await expect.poll(async () => (await viewport()).public.left).toBe(0);
  await expect.poll(async () => (await viewport()).domLeft).toBe(0);
  const after = await viewport(); expect(after.api).toBe(before.api); expect(after.instance).toBe(before.instance);
  expect(fixture.patches).toHaveLength(1); expect(fixture.patches[0].postDataJSON()).toEqual({ name: "Filtered name changed" });
  await writeFile(`${output}/gantt-filter-membership.json`, JSON.stringify({ before, after, query: await search.inputValue(), visibleRows: 0, patchCount: fixture.patches.length }, null, 2));
  await page.screenshot({ path: `${output}/gantt-filter-membership.png` });
});
