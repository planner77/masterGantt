import { expect, test } from "@playwright/test";
import { installMilestoneDashboardFixture, openMilestoneEditor } from "./helpers/milestone-ui";
import { editor, setup } from "./fixtures/task-editor-density";

test("#571 Editor locate는 실제 행을 이동하고 후속 Project metadata가 이전 위치를 되살리지 않는다", async ({ page }, info) => {
  const fixture = await setup(page, { longList: true });
  const locatedTask = fixture.tasks[3], milestone = fixture.tasks[4];
  milestone.siblingOrder = 0;
  fixture.tasks = [milestone, ...fixture.tasks.filter(task => task !== milestone)];
  await installMilestoneDashboardFixture(page, fixture);
  await page.reload();
  await page.setViewportSize({ width: 1440, height: 900 });
  const frame = page.locator(".project-gantt-frame");
  const viewport = () => frame.evaluate(element => ({
    api: element.getAttribute("data-project-gantt-api-instance"),
    core: Reflect.get(element, "__masterganttPublicViewport") as { left: number; top: number },
    native: { left: element.querySelector(".wx-chart")!.scrollLeft, top: element.querySelector(".wx-gantt")!.scrollTop },
  }));
  const dialog = await openMilestoneEditor(page, milestone.taskId);
  await dialog.getByRole("tab", { name: /소속 작업/ }).click();
  await dialog.getByRole("combobox", { name: /^소속 상태/ }).selectOption("all");
  await frame.locator(".wx-gantt").evaluate(element => { element.scrollTop = 300; });
  await expect.poll(async () => (await viewport()).core.top).toBe(300);
  const before = await viewport();
  await dialog.getByRole("row").filter({ hasText: locatedTask.name }).getByRole("button", { name: "일정에서 보기", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect.poll(async () => (await viewport()).core.top).toBeLessThan(before.core.top);
  // Scroll position may move while TASK_REVEAL is still SETTLING. Require the
  // actual completion receipt, then keep the original Grid focus assertion.
  await expect.poll(async () => {
    const raw = await frame.getAttribute("data-gantt-viewport-coordinator");
    const receipt = raw ? JSON.parse(raw) as { kind?: string; phase?: string; outcome?: string } : null;
    return receipt?.kind === "TASK_REVEAL" ? { phase: receipt.phase, outcome: receipt.outcome } : null;
  }).toEqual({ phase: "SETTLED", outcome: "SETTLED" });
  const target = frame.locator(`.wx-table-container .wx-row[data-id=":${locatedTask.taskId}"]`);
  await expect(target).toBeFocused();
  await expect.poll(async () => {
    const receipt = JSON.parse((await frame.getAttribute("data-gantt-task-focus-handoff")) ?? "null");
    return receipt && { taskId: receipt.taskId, outcome: receipt.outcome };
  }).toEqual({ taskId: locatedTask.taskId, outcome: "SETTLED" });
  // A late SVAR virtual-row replacement must not silently steal the focus.
  await frame.evaluate(async () => {
    for (let frame = 0; frame < 8; frame++) await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
  });
  await expect(target).toBeFocused();
  const located = await viewport();
  expect(Math.abs(located.core.top - located.native.top)).toBeLessThanOrEqual(1);
  await page.route(`**/api/projects/${fixture.project.publicId}`, async route => {
    if (route.request().method() !== "PATCH") { await route.fallback(); return; }
    expect(route.request().headers()["if-match"]).toBe(`"${fixture.project.revision}"`);
    fixture.project.name = route.request().postDataJSON().name;
    fixture.project.revision++;
    await route.fulfill({ json: { data: { project: fixture.project, tasks: fixture.tasks, links: fixture.links, warnings: [], operation: { kind: "projectMetadata", changedFields: ["name"] } } } });
  });
  await page.getByRole("button", { name: "프로젝트 설정", exact: true }).click();
  const settings = page.getByRole("dialog", { name: "프로젝트 설정", exact: true });
  await settings.getByLabel("프로젝트 이름").fill("Locate metadata remains current");
  await settings.getByRole("button", { name: "프로젝트 정보 저장", exact: true }).click();
  await expect(settings).toHaveCount(0);
  await expect.poll(viewport).toEqual(located);
  await info.attach("locate-metadata-viewport", { body: JSON.stringify({ before, located, after: await viewport(), trace: await frame.getAttribute("data-gantt-viewport-coordinator-history") }), contentType: "application/json" });
});

for (const input of ["wheel", "keyboard", "transient-modal"] as const) test(`#571 settled viewport의 DOM focus handoff는 좌표 불변 ${input} 의도 뒤 재개하지 않는다`, async ({ page }, info) => {
  const fixture = await setup(page, { longList: true });
  const locatedTask = fixture.tasks[3], milestone = fixture.tasks[4];
  milestone.siblingOrder = 0;
  fixture.tasks = [milestone, ...fixture.tasks.filter(task => task !== milestone)];
  await installMilestoneDashboardFixture(page, fixture);
  await page.reload();
  await page.setViewportSize({ width: 1440, height: 900 });
  const frame = page.locator(".project-gantt-frame");
  const dialog = await openMilestoneEditor(page, milestone.taskId);
  await dialog.getByRole("tab", { name: /소속 작업/ }).click();
  await dialog.getByRole("combobox", { name: /^소속 상태/ }).selectOption("all");
  await frame.locator(".wx-gantt").evaluate(element => { element.scrollTop = 300; });
  await expect.poll(() => frame.locator(".wx-gantt").evaluate(element => element.scrollTop)).toBe(300);
  // Hold subsequent browser frames after the first actual row focus. This
  // establishes the in-flight handoff boundary without racing its 12RAF budget.
  // Release every held callback; no product completion/assertion is mocked.
  await page.evaluate(taskId => {
    const original = window.requestAnimationFrame.bind(window);
    const gate = { held: false, armed: true, focusEvents: 0, callbacks: [] as Array<() => void> };
    window.requestAnimationFrame = callback => original(time => {
      if (gate.held) gate.callbacks.push(() => callback(time)); else callback(time);
    });
    const focused = (event: FocusEvent) => {
      if ((event.target as HTMLElement).getAttribute("data-id") === `:${taskId}`) {
        gate.focusEvents++;
        if (gate.armed) gate.held = true;
      }
    };
    document.addEventListener("focusin", focused, true);
    Reflect.set(window, "__focusHandoffTestGate", gate);
    Reflect.set(window, "__releaseFocusHandoffTestGate", () => {
      gate.held = false; gate.armed = false; window.requestAnimationFrame = original;
      gate.callbacks.splice(0).forEach(callback => callback());
    });
    Reflect.set(window, "__cleanupFocusHandoffTestGate", () => document.removeEventListener("focusin", focused, true));
  }, locatedTask.taskId);
  try {
    await dialog.getByRole("row").filter({ hasText: locatedTask.name }).getByRole("button", { name: "일정에서 보기", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => Reflect.get(window, "__focusHandoffTestGate").held)).toBe(true);
    const target = frame.locator(`.wx-table-container .wx-row[data-id=":${locatedTask.taskId}"]`);
    await expect(target).toBeFocused();
    const before = await frame.evaluate(element => ({ core: Reflect.get(element, "__masterganttPublicViewport"),
      left: element.querySelector(".wx-chart")!.scrollLeft, top: element.querySelector(".wx-gantt")!.scrollTop }));
    expect(before.left).toBe(0);
    if (input === "wheel") { await frame.locator(".wx-chart").hover(); await page.mouse.wheel(-500, 0); }
    else if (input === "keyboard") await page.keyboard.press("Shift");
    else await page.evaluate(() => {
      const dialog = document.createElement("dialog");
      document.body.append(dialog); dialog.showModal(); dialog.close(); dialog.remove();
    });
    const chosen = page.getByRole("searchbox", { name: "작업명, 설명, External ID 검색" });
    // For transient-modal, first prove cancellation while native dialog close
    // has restored the original row. A different focused control must not be
    // the reason this case passes instead of the open-attribute observer.
    if (input === "transient-modal") await expect(target).toBeFocused();
    else await chosen.focus();
    const focusEvents = await page.evaluate(() => Reflect.get(window, "__focusHandoffTestGate").focusEvents);
    await page.evaluate(() => Reflect.get(window, "__releaseFocusHandoffTestGate")());
    await expect.poll(async () => {
      const receipt = JSON.parse((await frame.getAttribute("data-gantt-task-focus-handoff")) ?? "null");
      return receipt && { taskId: receipt.taskId, outcome: receipt.outcome };
    }).toEqual({ taskId: locatedTask.taskId, outcome: "SUPERSEDED" });
    if (input === "transient-modal") await chosen.focus();
    await page.evaluate(async () => { for (let i = 0; i < 12; i++) await new Promise<void>(resolve => requestAnimationFrame(() => resolve())); });
    const after = await frame.evaluate(element => ({ core: Reflect.get(element, "__masterganttPublicViewport"),
      left: element.querySelector(".wx-chart")!.scrollLeft, top: element.querySelector(".wx-gantt")!.scrollTop }));
    expect(after).toEqual(before);
    await expect(chosen).toBeFocused();
    expect(await page.evaluate(() => Reflect.get(window, "__focusHandoffTestGate").focusEvents)).toBe(focusEvents);
    expect(fixture.patches).toHaveLength(0);
    await info.attach("focus-handoff-user-cancel", { body: JSON.stringify({ input, before, after, focus: await frame.getAttribute("data-gantt-task-focus-handoff") }), contentType: "application/json" });
  } finally { await page.evaluate(() => { Reflect.get(window, "__releaseFocusHandoffTestGate")(); Reflect.get(window, "__cleanupFocusHandoffTestGate")(); }); }
});

test("#571 WBS 범위의 빠른 필터 bookmark는 복귀하고 실제 wheel 뒤에는 부활하지 않는다", async ({ page }, info) => {
  const fixture = await setup(page, { longList: true, editable: false });
  const mutations: string[] = [];
  page.on("request", request => { if (!["GET", "HEAD"].includes(request.method())) mutations.push(request.method()); });
  await page.setViewportSize({ width: 1440, height: 900 });
  const frame = page.locator(".project-gantt-frame");
  await frame.locator(`.wx-table-container .wx-row[data-id=":${fixture.tasks[0].taskId}"]`).click({ button: "right", position: { x: 12, y: 19 } });
  await page.getByRole("menuitem", { name: "최상위로 열기 (작업공간 탭)", exact: true }).click();
  await frame.getByRole("button", { name: "주", exact: true }).click();
  const chart = frame.locator(".wx-chart").first();
  const viewport = () => frame.evaluate(element => ({
    core: (Reflect.get(element, "__masterganttPublicViewport") as { left: number }).left,
    native: element.querySelector(".wx-chart")!.scrollLeft,
  }));
  await chart.evaluate(element => { element.scrollLeft = 120; });
  await expect.poll(async () => (await viewport()).core).toBe(120);
  const quick = page.getByRole("group", { name: "작업 유형 빠른 보기" });
  await quick.getByRole("button", { name: "Milestone", exact: true }).click();
  await expect(frame.locator(".wx-table-container .wx-row[data-id]")).toHaveCount(0);
  await expect.poll(viewport).toEqual({ core: 0, native: 0 });
  await quick.getByRole("button", { name: "전체", exact: true }).click();
  await expect.poll(viewport).toEqual({ core: 120, native: 120 });
  const search = page.getByRole("searchbox", { name: "작업명, 설명, External ID 검색" });
  await search.fill("긴 작업명");
  await expect(frame.locator(`.wx-table-container .wx-row[data-id=":${fixture.tasks[3].taskId}"]`)).toBeVisible();
  await chart.hover();
  await page.mouse.wheel(-500, 0);
  await expect.poll(viewport).toEqual({ core: 0, native: 0 });
  await search.fill("");
  await expect(frame.locator(`.wx-table-container .wx-row[data-id=":${fixture.tasks[0].taskId}"]`)).toBeVisible();
  await expect.poll(viewport).toEqual({ core: 0, native: 0 });
  await info.attach("scoped-filter-bookmark", { body: JSON.stringify({ viewport: await viewport(), trace: await frame.getAttribute("data-gantt-viewport-coordinator-history") }), contentType: "application/json" });
  expect(fixture.patches).toHaveLength(0);
  expect(mutations).toEqual([]);
});

for (const input of [false, true]) test(`#571 delayed native add ${input ? "actual wheel cancels captured restore" : "preserves unmodified viewport"}`, async ({ page }, info) => {
  const fixture = await setup(page, { longList: true });
  await page.setViewportSize({ width: 1440, height: 700 });
  const frame = page.locator(".project-gantt-frame"), chart = frame.locator(".wx-chart").first(), vertical = frame.locator(".wx-gantt").first();
  const viewport = () => frame.evaluate(element => ({ core: (Reflect.get(element, "__masterganttPublicViewport") as { top: number }).top, native: element.querySelector(".wx-gantt")!.scrollTop }));
  await vertical.evaluate(element => { element.scrollTop = 300; });
  await expect.poll(viewport).toEqual({ core: 300, native: 300 });
  let release!: () => void, started!: () => void, postStarted = false;
  const gate = new Promise<void>(resolve => { release = resolve; }), pending = new Promise<void>(resolve => { started = resolve; });
  await page.route(`**/api/projects/${fixture.project.publicId}/tasks`, async route => {
    if (route.request().method() !== "POST") { await route.fallback(); return; }
    const body = route.request().postDataJSON();
    postStarted = true; started(); await gate;
    fixture.project.revision++;
    const created = { ...fixture.tasks[2], ...body, taskId: "00000000-0000-4000-8000-000000000200", externalId: "EDITOR-200", requestedStart: body.start, status: "not_started", siblingOrder: 100 };
    fixture.tasks.push(created);
    await route.fulfill({ json: { data: { project: fixture.project, tasks: fixture.tasks, links: fixture.links, warnings: [], operation: { kind: "taskCreate", changedTaskExternalIds: [created.externalId], deletedTaskExternalIds: [], deletedLinkIds: [] } } } });
  });
  const add = frame.locator('.wx-table-container .wx-header [data-action="add-task"]');
  await page.evaluate(() => document.fonts.ready);
  await expect.poll(async () => (await add.boundingBox())?.width ?? 0).toBeGreaterThan(0);
  const addBox = await add.boundingBox();
  expect(addBox).not.toBeNull();
  expect(addBox!.y).toBeGreaterThanOrEqual(0);
  expect(addBox!.y + addBox!.height).toBeLessThanOrEqual(700);
  // Click the already visible header without Playwright scrolling an overflow
  // hidden Grid container independently of the native Gantt scroll owner.
  const point = { x: addBox!.x + addBox!.width / 2, y: addBox!.y + addBox!.height / 2 };
  const hit = await page.evaluate(point => { const el = document.elementFromPoint(point.x, point.y); return { html: el?.outerHTML, action: el?.closest("[data-action]")?.getAttribute("data-action") }; }, point);
  await info.attach("native-add-hit", { body: JSON.stringify({ addBox, point, hit }), contentType: "application/json" });
  expect(hit.action).toBe("add-task");
  await page.mouse.click(point.x, point.y);
  await expect.poll(() => postStarted).toBe(true);
  await pending;
  await expect(frame).toHaveAttribute("data-task-mutation-locked", "true");
  const beforeWheel = await viewport();
  if (input) {
    await chart.hover();
    await page.mouse.wheel(0, -500);
    await expect.poll(viewport).toEqual({ core: 0, native: 0 });
    expect(beforeWheel.core).toBeGreaterThan(0);
  }
  const expected = await viewport();
  release();
  await expect(frame).not.toHaveAttribute("data-task-mutation-locked", "true");
  await expect.poll(viewport).toEqual(expected);
  await expect.poll(async () => {
    const receipt = JSON.parse((await frame.getAttribute("data-gantt-projection-receipt")) ?? "null");
    return receipt && { revision: receipt.revision, outcome: receipt.outcome };
  }).toEqual({ revision: fixture.project.revision, outcome: "SETTLED" });
  if (!input) await expect.poll(async () => {
    const history = JSON.parse((await frame.getAttribute("data-gantt-viewport-coordinator-history")) ?? "[]") as { kind: string; outcome?: string }[];
    return history.some(event => event.kind === "NATIVE_ADD" && event.outcome === "SETTLED");
  }).toBe(true);
  // Observe the same bounded frame budget used by the coordinator after the
  // new canonical receipt, so an old pending restore cannot pass immediately.
  await page.evaluate(async () => { for (let frame = 0; frame < 120; frame++) await new Promise<void>(resolve => requestAnimationFrame(() => resolve())); });
  await expect.poll(viewport).toEqual(expected);
  const history = JSON.parse((await frame.getAttribute("data-gantt-viewport-coordinator-history")) ?? "[]") as { kind: string; phase: string }[];
  if (input) expect(history.filter(event => event.kind === "NATIVE_ADD" && event.phase === "APPLYING")).toHaveLength(0);
  await info.attach("delayed-native-add", { body: JSON.stringify({ input, beforeWheel, expected, after: await viewport(), history }), contentType: "application/json" });
});
