import { expect, test, type Page } from "@playwright/test";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { installStatefulProjectFixture, publicId, projectPath, rowNamed, rememberGanttRoot, expectSameGanttRoot } from "../fixtures/stateful-project";
import { dashboardFixture } from "../fixtures/milestone-dashboard";

test.use({ timezoneId: "America/New_York" });
const toggle = (page: Page) => page.getByRole("button", { name: "◆ Milestone 표시", exact: true });
const sourceFiles = ["src/features/projects/project-readonly-view.tsx", "src/features/gantt/project-gantt.tsx", "src/features/gantt/milestone-timeline-lane.tsx", "src/features/milestones/milestone-timeline-preference.ts", "src/features/milestones/use-milestone-timeline-preference.ts", "src/features/milestones/project-milestone-dashboard.tsx", "src/features/gantt/milestone-timeline-adapter.ts", "src/features/gantt/task-selection-model.ts", "src/features/gantt/gantt-scale-toolbar.css", "src/features/milestones/project-milestone-stage-table.tsx", "src/features/milestones/project-milestone-dashboard.module.css", "src/features/projects/project-copy-membership-confirm.tsx", "tests/e2e/milestone-visibility.spec.ts"];
async function fixture(page: Page, editable = false, rootTaskId?: string) {
  await page.clock.setFixedTime(new Date("2026-10-01T12:00:00-04:00"));
  const state = await installStatefulProjectFixture(page); state.sessionEditable = editable;
  for (const task of state.tasks) { task.start = "2026-10-05"; task.end = "2026-10-05"; task.requestedStart = task.type === "summary" ? null : "2026-10-05"; task.duration = task.type === "milestone" ? 0 : 1; task.progress = 0; }
  state.links.push({ id: "00000000-0000-4000-9000-000000000001", predecessorExternalId: state.tasks[1].externalId, successorExternalId: state.tasks[2].externalId, type: "SS", lag: 0 });
  state.tasks[3].parentExternalId = state.tasks[0].externalId; state.tasks[3].siblingOrder = 1;
  state.tasks[0].membership = { explicitMilestoneTaskId: state.tasks[3].taskId, effectiveMilestoneTaskId: state.tasks[3].taskId, inheritedFromTaskId: null };
  await page.route(`**${projectPath}/milestone-dashboard*`, route => route.fulfill({ json: { data: dashboardFixture(state, new URL(route.request().url()).searchParams) } }));
  await page.goto(`/projects/${publicId}${rootTaskId ? `?rootTask=${rootTaskId}` : ""}`);
  await expect(toggle(page)).toHaveAttribute("aria-pressed", "true");
  await expect(rowNamed(page, rootTaskId ? "Existing summary child" : "Stable leaf")).toBeVisible();
  await capture(page, "initial-projection-diagnostic", await page.locator(".project-gantt-frame").evaluate(node => Reflect.get(node, "__masterganttMilestoneTimeline")?.read()));
  await expect(page.locator('.wx-table-container .wx-row[data-id$="00000000-0000-4000-8000-000000000004"]')).toHaveCount(0);
  return state;
}
async function capture(page: Page, name: string, data: unknown) {
  if (!process.env.CAPTURE_ISSUE_552) return;
  const directory = `output/playwright/issue-552/${process.env.CAPTURE_ISSUE_552}`; await mkdir(directory, { recursive: true });
  const sourceHashes = Object.fromEntries(await Promise.all(sourceFiles.map(async path => [path, createHash("sha256").update(await readFile(path)).digest("hex")])));
  await writeFile(`${directory}/${name}.json`, JSON.stringify({ capturedAt: new Date().toISOString(), environment: "Chromium / Next dev / Core2.7.3 / synthetic API / America/New_York", sourceHashes, data }, null, 2));
  await page.screenshot({ path: `${directory}/${name}.png` });
}

test("#552 readonly visibility independent from membership, filters, reset and peer; no loss/mutation/GET", async ({ page }) => {
  const state = await fixture(page); const identity = await rememberGanttRoot(page); const canonical = JSON.stringify([state.tasks, state.links]);
  const writes: string[] = [], reads: string[] = [];
  page.on("request", request => { if (!["GET", "HEAD"].includes(request.method())) writes.push(request.method()); if (new URL(request.url()).pathname === projectPath && request.method() === "GET") reads.push(request.url()); });
  const picker = page.locator(".project-schedule-filter-toolbar").getByRole("button", { name: "완료 단계: 전체", exact: true });
  await picker.click(); await page.getByRole("option", { name: /Stable milestone/ }).click();
  await expect(rowNamed(page, "Existing summary child")).toBeVisible(); await expect(rowNamed(page, "Stable leaf")).toHaveCount(0);
  for (const on of [false, true]) {
    await toggle(page).click(); await expect(toggle(page)).toHaveAttribute("aria-pressed", String(on));
    await expect(rowNamed(page, "Existing summary child")).toBeVisible(); await expect(page.locator('.wx-table-container .wx-row[data-id$="00000000-0000-4000-8000-000000000004"]')).toHaveCount(0);
    await expectSameGanttRoot(page, identity);
  }
  await toggle(page).click(); await expect(toggle(page)).toHaveAttribute("aria-pressed", "false");
  await page.getByRole("button", { name: "초기화", exact: true }).click();
  await expect(rowNamed(page, "Stable leaf")).toBeVisible(); await expect(toggle(page)).toHaveAttribute("aria-pressed", "false");
  await page.getByRole("tab", { name: "Milestone 대시보드", exact: true }).click(); await page.getByRole("tab", { name: "일정", exact: true }).click();
  await expect(toggle(page)).toHaveAttribute("aria-pressed", "false"); await expectSameGanttRoot(page, identity);
  expect(JSON.stringify([state.tasks, state.links])).toBe(canonical); expect(writes).toEqual([]); expect(reads).toEqual([]);
  expect(await page.evaluate(id => JSON.parse(localStorage.getItem(`mastergantt:milestone-timeline:${id}`)!), publicId)).toEqual({ version: 1, showMilestones: false });
  await capture(page, "visibility-membership-reset-peer", { canonicalUnchanged: true, writes, reads, instance: identity });
});

test("#552 storage denied keeps explicit memory choice and reports once", async ({ page }) => {
  await page.addInitScript(() => { Storage.prototype.getItem = function(key) { if (key.startsWith("mastergantt:milestone-timeline:")) throw new DOMException("blocked", "SecurityError"); return null; }; Storage.prototype.setItem = function(key) { if (key.startsWith("mastergantt:milestone-timeline:")) throw new DOMException("quota", "QuotaExceededError"); }; });
  await fixture(page); await expect(page.getByText("Milestone 표시 설정을 저장소에서 읽거나 저장하지 못했습니다. 현재 화면의 선택은 유지합니다.", { exact: true })).toBeVisible();
  await toggle(page).click(); await expect(toggle(page)).toHaveAttribute("aria-pressed", "false"); await expect(page.getByLabel("Milestone Timeline", { exact: true })).toHaveCount(0);
  await toggle(page).click(); await expect(toggle(page)).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("Milestone 표시 설정을 저장소에서 읽거나 저장하지 못했습니다. 현재 화면의 선택은 유지합니다.", { exact: true })).toHaveCount(1);
  await capture(page, "storage-denied-memory", { defaultOn: true, explicitMemoryPreserved: true, notificationCount: 1 });
});

for (const width of [390, 768, 1024, 1440, 1920]) test(`#552 enabled Day/Week column hide/show geometry ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 1000 }); const state = await fixture(page), identity = await rememberGanttRoot(page);
  const frame = page.locator(".project-gantt-frame"), header = frame.locator(".wx-table-container .wx-header").first();
  for (const scale of ["일", "주"]) {
    await page.getByRole("button", { name: scale, exact: true }).click();
    for (const [phase, visible] of [true, false, true].entries()) {
      if (width === 390) { await frame.locator(".project-milestone-lane-list").hover(); await page.mouse.wheel(-1200, 0); await expect.poll(() => frame.locator(".project-gantt-scroll").evaluate(node => node.scrollLeft)).toBe(0); }
      await header.click({ button: "right" }); const option = page.locator(".project-column-menu").getByRole("checkbox", { name: "외부 ID", exact: true });
      if (visible) await option.check(); else await option.uncheck(); await page.keyboard.press("Escape");
      if (width === 390) { await frame.locator(".project-milestone-lane-list").hover(); await page.mouse.wheel(1200, 0); await expect.poll(() => frame.locator(".project-gantt-scroll").evaluate(node => node.scrollLeft)).toBeGreaterThan(0); }
      if (width <= 768) {
        const splitter = frame.locator(".wx-resizer.wx-resizer-display-all").first(), bounds = (await splitter.boundingBox())!;
        const grid = await frame.evaluate(node => Reflect.get(node, "__masterganttMilestoneTimeline").read().gridWidth);
        await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + 100); await page.mouse.down();
        await page.mouse.move(bounds.x + bounds.width / 2 - (grid - 440), bounds.y + 100, { steps: 5 }); await page.mouse.up();
        await expect.poll(() => frame.evaluate(node => Reflect.get(node, "__masterganttMilestoneTimeline").read().gridWidth)).toBe(440);
      }
      await expect(frame.locator(".project-milestone-lane-plot")).toBeVisible();
      await expect.poll(() => frame.evaluate(node => { const chart = node.querySelector(".wx-chart")!.getBoundingClientRect(), lane = node.querySelector(".project-milestone-lane-plot")!.getBoundingClientRect(); return Math.abs(chart.x - lane.x) + Math.abs(chart.width - lane.width); })).toBeLessThanOrEqual(1);
      // Wait for the canonical projection and native derived row/bar after a column resize.
      // A missing row remains a failure rather than being hidden by a non-null assertion.
      await expect(frame.locator('.wx-table-container .wx-row[data-id$="00000000-0000-4000-8000-000000000002"]')).toBeVisible();
      await expect(frame.locator('.wx-bar[data-task-id=":00000000-0000-4000-8000-000000000002"]')).toBeVisible();
      const geometry = await frame.evaluate(node => {
        const rect = (element: Element) => { const r = element.getBoundingClientRect(); return { x:r.x, y:r.y, width:r.width, height:r.height }; };
        const row = node.querySelector('.wx-table-container .wx-row[data-id$="00000000-0000-4000-8000-000000000002"]')!, bar = node.querySelector('.wx-bar[data-task-id=":00000000-0000-4000-8000-000000000002"]')!, tick = node.querySelector('[data-milestone-tick="00000000-0000-4000-8000-000000000004"]');
        const r = rect(row), b = rect(bar); return { lane:rect(node.querySelector(".project-milestone-lane")!), chart:rect(node.querySelector(".wx-chart")!), rowCenter:r.y+r.height/2, chartCenter:b.y+b.height/2, anchor:tick ? { tick:rect(tick).x, task:b.x+1 } : null, documentWidth:document.documentElement.scrollWidth, windowWidth:innerWidth };
      });
      await capture(page, `diagnostic-${width}-${scale}-${visible}-${phase}`, { geometry, core: await frame.evaluate(node => Reflect.get(node, "__masterganttMilestoneTimeline")?.read()) });
      expect(geometry.lane.height).toBe(64); expect(Math.abs(geometry.rowCenter-geometry.chartCenter)).toBeLessThanOrEqual(1);
      expect(geometry.anchor).not.toBeNull(); expect(Math.abs(geometry.anchor!.tick-geometry.anchor!.task)).toBeLessThanOrEqual(1);
      expect(geometry.documentWidth).toBeLessThanOrEqual(width); await expectSameGanttRoot(page, identity);
      await capture(page, `geometry-${width}-${scale === "일" ? "day" : "week"}-${visible ? "show" : "hide"}-${phase}`, geometry);
    }
  }
  expect(state.posts).toHaveLength(0); expect(state.patchRequests).toHaveLength(0);
});

for (const width of [390, 1024]) test(`#552 OFF date request ${width}px exact marker/list fallback and original Dashboard conditions/viewport`, async ({ page }) => {
  await page.setViewportSize({ width, height: 1000 }); const state = await fixture(page), identity = await rememberGanttRoot(page);
  const frame = page.locator(".project-gantt-frame"), panel = page.locator("#project-panel-milestones");
  await toggle(page).click(); await expect(toggle(page)).toHaveAttribute("aria-pressed", "false");
  await frame.evaluate(node => Reflect.get(node, "__masterganttMilestoneTimeline").scroll(200));
  const original = await frame.evaluate(node => Reflect.get(node, "__masterganttMilestoneTimeline").read().left);
  await page.getByRole("tab", { name: "Milestone 대시보드", exact: true }).click();
  await panel.getByLabel("단계 검색", { exact: true }).fill("Stable milestone");
  const id = state.tasks[3].taskId, row = panel.locator(`[data-milestone-task-id="${id}"]`);
  const trigger = row.getByRole("button", { name: / 관리$/ });
  if (width === 390) { await trigger.focus(); await page.keyboard.press("Enter"); }
  else await trigger.click();
  const dateCommand = page.getByRole("dialog", { name: / 관리$/ }).getByRole("button", { name: "해당 날짜에서 보기", exact: true });
  if (width === 390) { await dateCommand.focus(); await page.keyboard.press("Enter"); }
  else await dateCommand.click();
  if (width === 390) {
    await expect(panel).toBeVisible(); await expect(row).toHaveAttribute("data-date-highlight", "true");
    await expect.poll(() => page.evaluate(() => document.activeElement?.closest("[data-milestone-task-id]")?.getAttribute("data-milestone-task-id"))).toBe(id);
    await expect(panel.getByLabel("단계 검색", { exact: true })).toHaveValue("Stable milestone");
    const physicalFocus = await page.evaluate(() => {
      const inactivePeer = document.querySelector<HTMLElement>('.project-schedule[data-dashboard-inactive="true"]')!;
      const inactivePaint = [inactivePeer, ...Array.from(inactivePeer.querySelectorAll<HTMLElement>(".project-gantt-scope-owner, .project-gantt-frame, .project-gantt-scale-toolbar, .wx-gantt, .wx-table-container, .wx-chart"))].map(element => {
        const bounds = element.getBoundingClientRect();
        return { className: element.className, visibility: getComputedStyle(element).visibility, width: bounds.width, height: bounds.height };
      });
      const target = document.activeElement as HTMLElement, style = getComputedStyle(target), r = target.getBoundingClientRect();
      const owner = target.closest("table")!.parentElement!, o = owner.getBoundingClientRect();
      const ring = parseFloat(style.outlineWidth) + parseFloat(style.outlineOffset);
      const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      const occluding = Array.from(document.querySelectorAll("body *")).filter(element => {
        const css = getComputedStyle(element), b = element.getBoundingClientRect();
        if (!["sticky", "fixed"].includes(css.position) || css.visibility === "hidden" || css.display === "none" || Number(css.opacity) === 0 || !b.width || !b.height || element.contains(target)) return false;
        if (css.backgroundColor === "transparent" || /rgba\([^)]*,\s*0\s*\)/.test(css.backgroundColor)) return false;
        return b.x < r.right + ring && b.right > r.x - ring && b.y < r.bottom + ring && b.bottom > r.y - ring;
      }).map(element => ({ tag: element.tagName, className: element.className }));
      return { taskId: target.closest("[data-milestone-task-id]")?.getAttribute("data-milestone-task-id"), label: target.getAttribute("aria-label"),
        rect: { x:r.x, y:r.y, right:r.right, bottom:r.bottom, width:r.width, height:r.height },
        ownerClip: { x:o.x+owner.clientLeft, y:o.y+owner.clientTop, right:o.x+owner.clientLeft+owner.clientWidth, bottom:o.y+owner.clientTop+owner.clientHeight },
        viewport: { width:innerWidth, height:innerHeight }, outline:style.outlineStyle, outlineWidth:parseFloat(style.outlineWidth), outlineOffset:parseFloat(style.outlineOffset), ring,
        centerHit:Boolean(hit && (hit === target || target.contains(hit))), occluding, ownerScroll:{left:owner.scrollLeft,top:owner.scrollTop},
        inactivePeer: { ariaHidden: inactivePeer.getAttribute("aria-hidden"), inert: inactivePeer.inert, position: getComputedStyle(inactivePeer).position, pointerEvents: getComputedStyle(inactivePeer).pointerEvents, paint: inactivePaint } };
    });
    await capture(page, "date-fallback-390-physical-focus", physicalFocus);
    expect(physicalFocus.inactivePeer.ariaHidden).toBe("true"); expect(physicalFocus.inactivePeer.inert).toBe(true);
    expect(physicalFocus.inactivePeer.position).toBe("absolute"); expect(physicalFocus.inactivePeer.pointerEvents).toBe("none");
    for (const className of ["project-gantt-scope-owner", "project-gantt-frame", "project-gantt-scale-toolbar", "wx-gantt", "wx-table-container", "wx-chart"]) {
      expect(physicalFocus.inactivePeer.paint.some(element => element.className.split(" ").includes(className))).toBe(true);
    }
    for (const element of physicalFocus.inactivePeer.paint) {
      expect(element.visibility).toBe("hidden"); expect(element.width).toBeGreaterThan(0); expect(element.height).toBeGreaterThan(0);
    }
    expect(physicalFocus.taskId).toBe(id); expect(physicalFocus.label).toContain("Stable milestone");
    expect(physicalFocus.outline).not.toBe("none"); expect(physicalFocus.ring).toBe(6);
    expect(physicalFocus.centerHit).toBe(true); expect(physicalFocus.occluding).toEqual([]);
    expect(physicalFocus.rect.x-6).toBeGreaterThanOrEqual(Math.max(0,physicalFocus.ownerClip.x));
    expect(physicalFocus.rect.right+6).toBeLessThanOrEqual(Math.min(physicalFocus.viewport.width,physicalFocus.ownerClip.right));
    expect(physicalFocus.rect.y-6).toBeGreaterThanOrEqual(Math.max(0,physicalFocus.ownerClip.y));
    expect(physicalFocus.rect.bottom+6).toBeLessThanOrEqual(Math.min(physicalFocus.viewport.height,physicalFocus.ownerClip.bottom));
    await page.getByRole("tab", { name: "일정", exact: true }).click();
    await expect(toggle(page)).toHaveAttribute("aria-pressed", "false");
    await expect.poll(() => frame.evaluate(node => Reflect.get(node, "__masterganttMilestoneTimeline").read().left)).toBe(original);
  } else {
    const marker = frame.locator(`[data-milestone-lane-trigger="${id}"]`);
    await expect(marker).toBeFocused(); await expect(toggle(page)).toHaveAttribute("aria-pressed", "true");
    expect(await page.evaluate(id => JSON.parse(localStorage.getItem(`mastergantt:milestone-timeline:${id}`)!).showMilestones, publicId)).toBe(false);
    await page.getByRole("button", { name: "원래 보기로 돌아가기", exact: true }).click();
    await expect(panel).toBeVisible(); await expect(trigger).toBeFocused(); await expect(panel.getByLabel("단계 검색", { exact: true })).toHaveValue("Stable milestone");
    await page.getByRole("tab", { name: "일정", exact: true }).click();
    await expect(toggle(page)).toHaveAttribute("aria-pressed", "false");
    await expect.poll(() => frame.evaluate(node => Reflect.get(node, "__masterganttMilestoneTimeline").read().left)).toBe(original);
  }
  await expectSameGanttRoot(page, identity); expect(state.posts).toHaveLength(0); expect(state.patchRequests).toHaveLength(0);
  await capture(page, `date-return-${width}`, { originalPublicLeft: original, exactTaskId: id, storedOffPreserved: true, instance: identity });
});

test("#552 legacy native M selection is removed by public toggle while the ordinary Task selection remains", async ({ page }) => {
  const state = await fixture(page, true), frame = page.locator(".project-gantt-frame");
  const taskId = state.tasks[1].taskId, milestoneId = state.tasks[3].taskId;
  await rowNamed(page, "Existing summary child").locator("input[data-copy-selection]").check();
  await frame.evaluate((node, id) => Reflect.get(node, "__masterganttMilestoneTimeline").select([id]), milestoneId);
  const before = await frame.evaluate(node => Reflect.get(node, "__masterganttMilestoneTimeline").read());
  expect(before.selected).toEqual(expect.arrayContaining([taskId, milestoneId])); expect(before.appSelection).toEqual([taskId]);
  await page.getByRole("button", { name: "필터", exact: true }).click();
  await page.getByRole("group", { name: "Task type", exact: true }).getByRole("checkbox", { name: "task", exact: true }).check(); await page.keyboard.press("Escape");
  await expect.poll(() => frame.evaluate(node => Reflect.get(node, "__masterganttMilestoneTimeline").read().selected)).toEqual([taskId]);
  await expect(rowNamed(page, "Existing summary child").locator("input[data-copy-selection]")).toBeChecked();
  expect(state.posts).toHaveLength(0); expect(state.patchRequests).toHaveLength(0);
  await capture(page, "legacy-native-selection-public-cleanup", { before, after: await frame.evaluate(node => Reflect.get(node, "__masterganttMilestoneTimeline").read()), method: "development-only public select-task UI selection experiment" });
});

test("#552 scoped Summary becoming M keeps the native instance and requires explicit full-project recovery", async ({ page }) => {
  const rootId = "00000000-0000-4000-8000-000000000001", state = await fixture(page, false, rootId), identity = await rememberGanttRoot(page);
  Object.assign(state.tasks[0], { type: "milestone", duration: 0, requestedStart: "2026-10-05", membership: undefined });
  state.tasks[1].parentExternalId = null; state.tasks[1].siblingOrder = 1;
  state.tasks[2].siblingOrder = 2; state.tasks[3].parentExternalId = null; state.tasks[3].siblingOrder = 3;
  state.project.revision++;
  await page.evaluate(({ publicId, revision }) => window.dispatchEvent(new StorageEvent("storage", { key: `mastergantt:project-revision:${publicId}`, newValue: String(revision) })), { publicId, revision: state.project.revision });
  await expect(page.getByRole("alert").filter({ hasText: "선택한 Summary 범위를 열 수 없습니다." })).toContainText("선택한 범위가 Milestone으로 변경되었습니다. 데이터는 프로젝트 전체 Milestone 목록에 있으며 WBS 범위는 자동으로 넓히지 않습니다.");
  await expect(page.locator(".project-gantt-scope-owner")).toHaveAttribute("inert", ""); await expectSameGanttRoot(page, identity);
  await expect(rowNamed(page, "Stable leaf")).not.toBeVisible();
  await page.getByRole("button", { name: "전체 프로젝트로 돌아가기", exact: true }).click();
  await expect(rowNamed(page, "Stable leaf")).toBeVisible(); await expectSameGanttRoot(page, identity);
  await expect(page.locator(`.wx-table-container .wx-row[data-id$="${rootId}"]`)).toHaveCount(0);
  await capture(page, "scope-summary-m-drift-explicit-recovery", { instance: identity, rootId, canonicalIds: state.tasks.map(task => task.taskId), mutationCount: state.posts.length + state.patchRequests.length });
});

test("#552 Grid-only and metadata canonical queue retain ordinary WBS rows and full canonical links", async ({ page }) => {
  const state = await fixture(page), frame = page.locator(".project-gantt-frame"), identity = await rememberGanttRoot(page);
  await frame.evaluate(node => Reflect.get(node, "__masterganttMilestoneTimeline").display("grid"));
  await expect(frame.locator('.wx-table-container .wx-row[data-id$="00000000-0000-4000-8000-000000000004"]')).toHaveCount(0);
  await expect(rowNamed(page, "Stable leaf")).toBeVisible();
  state.tasks[2].name = "Updated ordinary leaf"; state.project.revision++;
  await page.evaluate(({ publicId, revision }) => window.dispatchEvent(new StorageEvent("storage", { key: `mastergantt:project-revision:${publicId}`, newValue: String(revision) })), { publicId, revision: state.project.revision });
  await expect(rowNamed(page, "Updated ordinary leaf")).toBeVisible();
  await expect(frame.locator('.wx-table-container .wx-row[data-id$="00000000-0000-4000-8000-000000000004"]')).toHaveCount(0);
  await frame.evaluate(node => Reflect.get(node, "__masterganttMilestoneTimeline").display("all"));
  await expect(rowNamed(page, "Updated ordinary leaf")).toBeVisible();
  await expect(frame.locator('.wx-table-container .wx-row[data-id$="00000000-0000-4000-8000-000000000004"]')).toHaveCount(0);
  const after = await frame.evaluate(node => Reflect.get(node, "__masterganttMilestoneTimeline").read());
  expect(after.canonicalIds).toEqual(state.tasks.map(task => task.taskId)); expect(after.links).toHaveLength(state.links.length);
  await expect(frame.locator('.wx-links [data-link-id=":00000000-0000-4000-9000-000000000001"]')).toHaveCount(1);
  await expectSameGanttRoot(page, identity); expect(state.posts).toHaveLength(0); expect(state.patchRequests).toHaveLength(0);
  await capture(page, "grid-metadata-controlled-projection", { after, instance: identity, method: "development-only public displayMode experiment and canonical metadata revision" });
});

test("#552 project-specific stored OFF survives readonly reload and another project defaults ON", async ({ page }) => {
  const state = await fixture(page), secondId = "a3405d3d-8cb4-4da4-9b0f-43a5de330004";
  await toggle(page).click(); await page.reload(); await expect(toggle(page)).toHaveAttribute("aria-pressed", "false");
  const snapshot = await page.evaluate(async path => (await fetch(path)).json(), projectPath); snapshot.data.project.publicId = secondId;
  await page.route(`**/api/projects/${secondId}**`, route => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/edit-sessions/current")) return route.fulfill({ json: { data: { permission: "readonly" } } });
    if (path === `/api/projects/${secondId}`) return route.fulfill({ json: snapshot });
    return route.fulfill({ status: 503, json: { error: { code: "SYNTHETIC_REPORT_UNAVAILABLE" } } });
  });
  await page.goto(`/projects/${secondId}`); await expect(toggle(page)).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("읽기 전용", { exact: true })).toBeVisible();
  await page.goto(`/projects/${publicId}`); await expect(toggle(page)).toHaveAttribute("aria-pressed", "false");
  expect(state.posts).toHaveLength(0); expect(state.patchRequests).toHaveLength(0);
  await capture(page, "project-storage-readonly-reload", { first: publicId, second: secondId, firstOff: true, secondDefaultOn: true });
});

test("#552 hidden M dependency endpoints never attach to Summary/other rows across visibility and collapse", async ({ page }) => {
  const state = await fixture(page), frame = page.locator(".project-gantt-frame"), identity = await rememberGanttRoot(page);
  const second = { ...state.tasks[3], taskId: "00000000-0000-4000-8000-000000000005", externalId: "SECOND-M", name: "Secondary milestone", siblingOrder: 2 };
  state.tasks.push(second);
  state.links.push(
    { id: "MM-552", predecessorExternalId: second.externalId, successorExternalId: state.tasks[3].externalId, type: "FS", lag: 0 },
    { id: "legacy-MT-552", predecessorExternalId: state.tasks[3].externalId, successorExternalId: state.tasks[2].externalId, type: "SS", lag: 0, legacyMixed: true },
    { id: "legacy-TM-552", predecessorExternalId: state.tasks[1].externalId, successorExternalId: second.externalId, type: "SS", lag: 0, legacyMixed: true });
  const canonical = JSON.stringify([state.tasks, state.links]); state.project.revision++;
  await page.evaluate(({ publicId, revision }) => window.dispatchEvent(new StorageEvent("storage", { key: `mastergantt:project-revision:${publicId}`, newValue: String(revision) })), { publicId, revision: state.project.revision });
  await expect.poll(() => frame.evaluate(node => Reflect.get(node, "__masterganttMilestoneTimeline").read().canonicalIds.length)).toBe(5);
  const tt = frame.locator('.wx-links [data-link-id=":00000000-0000-4000-9000-000000000001"]');
  const hidden = frame.locator('.wx-links [data-link-id=":MM-552"],.wx-links [data-link-id=":legacy-MT-552"],.wx-links [data-link-id=":legacy-TM-552"]');
  const phases = [];
  for (const on of [false, true]) {
    await toggle(page).click(); await expect(toggle(page)).toHaveAttribute("aria-pressed", String(on));
    await expect(tt).toHaveCount(1); await expect(hidden).toHaveCount(0);
    await rowNamed(page, "Stable summary").locator('[data-action="open-task"]').click(); await expect(rowNamed(page, "Existing summary child")).toHaveCount(0);
    await expect(tt).toHaveCount(0); await expect(hidden).toHaveCount(0);
    await rowNamed(page, "Stable summary").locator('[data-action="open-task"]').click(); await expect(rowNamed(page, "Existing summary child")).toBeVisible();
    await expect(tt).toHaveCount(1); await expect(hidden).toHaveCount(0);
    const core = await frame.evaluate(node => Reflect.get(node, "__masterganttMilestoneTimeline").read());
    expect(core.links.map((link: { id: string }) => link.id)).toEqual(state.links.map(link => link.id)); phases.push({ on, core });
  }
  expect(JSON.stringify([state.tasks, state.links])).toBe(canonical); await expectSameGanttRoot(page, identity); expect(state.posts).toHaveLength(0); expect(state.patchRequests).toHaveLength(0);
  await capture(page, "hidden-link-endpoints-no-replacement", { phases, canonicalLinkIds: state.links.map(link => link.id), instance: identity, syntheticLegacyMixedOnly: true });
});
