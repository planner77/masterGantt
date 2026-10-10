import { chooseTaskInformation } from "./helpers/task-context-menu";
import { expect, test } from "@playwright/test";
import { installStatefulProjectFixture, publicId, rowNamed, taskPath, rememberGanttRoot, expectSameGanttRoot } from "../fixtures/stateful-project";

for (const width of [390, 768, 1024, 1440, 1920]) for (const scale of ["Day", "Week"]) {
  test(`#570 metadata projection ${width}px ${scale}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.clock.setFixedTime(new Date("2026-09-16T12:00:00Z"));
    const fixture = await installStatefulProjectFixture(page);
    let patches = 0;
    await page.route(`**${taskPath}/*`, async route => {
      if (route.request().method() !== "PATCH") return route.fallback();
      patches++;
      const task = fixture.tasks.find(task => task.taskId === route.request().url().split("/").at(-1))!;
      task.name = route.request().postDataJSON().name;
      fixture.project.revision++;
      await route.fulfill({ json: { data: { project: { ...fixture.project }, tasks: fixture.tasks.map(task => ({ ...task })), links: [], warnings: [], operation: { kind: "taskUpdate", changedTaskExternalIds: [task.externalId], deletedTaskExternalIds: [], deletedLinkIds: [] } } } });
    });
    await page.goto(`/projects/${publicId}?__coreTrace=1`);
    const frame = page.locator(".project-gantt-frame");
    await expect(rowNamed(page, "Stable leaf")).toBeVisible();
    if (scale === "Week") await page.getByRole("button", { name: "주", exact: true }).click();
    await expect.poll(() => frame.getAttribute("data-gantt-projection-receipt")).not.toBeNull();
    const columnsBefore = JSON.parse((await frame.getAttribute("data-gantt-projection-receipt"))!).columns;
    const root = await rememberGanttRoot(page);
    await frame.evaluate(element => Reflect.get(element, "__issue568Trace").configure("issue570", "local", "metadata"));
    const contextCell = rowNamed(page, "Stable leaf").locator('[data-col-id=":text"]');
    await contextCell.focus();
    await page.keyboard.press("Shift+F10");
    await chooseTaskInformation(page);
    const editor = page.getByRole("dialog", { name: "작업 정보", exact: true });
    await expect(editor.getByLabel("작업명", { exact: true })).toHaveValue("Stable leaf");
    await editor.getByLabel("작업명", { exact: true }).fill("Projection renamed");
    await editor.getByRole("button", { name: "저장", exact: true }).click();
    await expect(rowNamed(page, "Projection renamed")).toBeVisible();
    if (await editor.isVisible()) await editor.getByRole("button", { name: "작업 편집기 닫기", exact: true }).click();
    await expect(editor).toHaveCount(0);
    await expect(rowNamed(page, "Projection renamed")).toBeVisible();
    await expectSameGanttRoot(page, root);
    await expect.poll(async () => {
      const raw = await frame.getAttribute("data-gantt-projection-receipt");
      return raw ? JSON.parse(raw).revision : null;
    }).toBe(fixture.project.revision);
    const receipt = JSON.parse((await frame.getAttribute("data-gantt-projection-receipt"))!);
    const trace = await frame.evaluate(element => Reflect.get(element, "__issue568Trace").snapshot());
    await testInfo.attach("projection-receipt", { body: JSON.stringify(receipt), contentType: "application/json" });
    await testInfo.attach("projection-actions", { body: JSON.stringify(trace), contentType: "application/json" });
    const entries = (trace as { entries: { event: string; action: string }[] }).entries;
    expect(entries.filter(entry => entry.event === "core-after" && ["filter-tasks", "set-columns"].includes(entry.action))).toEqual([]);
    expect(patches).toBe(1); expect(fixture.posts).toHaveLength(0);
    expect(receipt.outcome).toBe("SETTLED");
    expect(receipt.columns).toBe(columnsBefore);
    expect(receipt.selectedIds).toContain(fixture.tasks[2].taskId);
    expect(receipt.queryConditionsChanged).toBe(false);
    expect(receipt.reasons).toEqual(["data"]);
    if (scale === "Day" && [390, 1440].includes(width)) await testInfo.attach(`projection-${width}`, { body: await frame.screenshot(), contentType: "image/png" });
  });
}

for (const scenario of ["insert-before", "surviving-child-root", "surviving-child-new-parent", "new-parent-mixed-children"] as const) {
  test(`#570 actual Core structure ${scenario}`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    const fixture = await installStatefulProjectFixture(page);
    await page.goto(`/projects/${publicId}?__coreTrace=1`);
    await expect(rowNamed(page, "Existing summary child")).toBeVisible();
    const identity = await rememberGanttRoot(page);
    const child = fixture.tasks[1];
    if (scenario === "insert-before") {
      fixture.tasks.splice(2, 0, { ...fixture.tasks[2], taskId: "00000000-0000-4000-8000-000000000570", externalId: "NEW-570", name: "Inserted before leaf", siblingOrder: 1 });
      fixture.tasks[3].siblingOrder = 2;
    } else if (scenario === "surviving-child-root") {
      fixture.tasks.splice(0, fixture.tasks.length, { ...child, parentExternalId: null, siblingOrder: 0 });
    } else {
      fixture.tasks.splice(0, fixture.tasks.length, { ...fixture.tasks[0], taskId: "00000000-0000-4000-8000-000000000570", externalId: "NEW-570", name: "New parent" }, { ...child, parentExternalId: "NEW-570" });
    }
    if (scenario === "new-parent-mixed-children") {
      fixture.tasks.push({ ...child, taskId: "00000000-0000-4000-8000-000000000571", externalId: "NEW-571", parentExternalId: "NEW-570", name: "New sibling", siblingOrder: 1 });
      fixture.tasks.push({ ...child, taskId: "00000000-0000-4000-8000-000000000003", externalId: "LEAF-1", parentExternalId: "NEW-570", name: "Stable leaf", siblingOrder: 2 });
    }
    fixture.project.revision++;
    fixture.nextPost = { kind: "error", status: 422, code: "VALIDATION_ERROR" };
    await page.locator('.project-gantt-widget .wx-header [data-action="add-task"]').first().click();
    await expect(rowNamed(page, scenario === "insert-before" ? "Inserted before leaf" : "Existing summary child")).toBeVisible();
    await expectSameGanttRoot(page, identity);
    await expect.poll(async () => {
      const raw = await page.locator(".project-gantt-frame").getAttribute("data-gantt-projection-receipt");
      return raw ? `${JSON.parse(raw).revision}:${JSON.parse(raw).outcome}` : "";
    }).toBe(`${fixture.project.revision}:SETTLED`);
    if (scenario === "insert-before") {
      const names = await page.locator('.wx-table-container .wx-row [data-col-id=":text"] .wx-content > .wx-text').allTextContents();
      expect(names.indexOf("Inserted before leaf")).toBeLessThan(names.indexOf("Stable leaf"));
    }
  });
}

for (const variant of ["empty", "milestone-only"] as const) {
  test(`#570 readonly projection ${variant}`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    const fixture = await installStatefulProjectFixture(page);
    fixture.sessionEditable = false;
    await page.route("**/assigned-targets", route => route.fulfill({ json: { data: { projectRevision: fixture.project.revision, catalogRevision: 1, assignments: [], targets: [] } } }));
    await page.route("**/resource-workload**", route => route.fulfill({ json: { data: { projectRevision: fixture.project.revision, catalogRevision: 1, range: { from: "2026-09-01", to: "2026-09-30" }, mdPerMm: 20, grandTotalMd: 0, grandTotalMm: 0, unsetCount: 0, asOfDate: "2026-09-18", timezone: "Asia/Seoul", roleTotals: [], groups: [] } } }));
    if (variant === "empty") fixture.tasks.splice(0);
    else fixture.tasks.splice(0, 3);
    await page.goto(`/projects/${publicId}`);
    await expect(page.getByText("읽기 전용", { exact: true })).toBeVisible();
    const frame = page.locator(".project-gantt-frame");
    await expect.poll(async () => {
      const raw = await frame.getAttribute("data-gantt-projection-receipt");
      return raw ? JSON.parse(raw).outcome : null;
    }).toBe("SETTLED");
    const receipt = JSON.parse((await frame.getAttribute("data-gantt-projection-receipt"))!);
    expect(receipt.coreVisibleIds).toHaveLength(variant === "empty" ? 0 : 1);
    if (variant === "milestone-only") await expect(rowNamed(page, "Stable milestone")).toBeVisible();
    expect(fixture.posts).toHaveLength(0); expect(fixture.patchRequests).toHaveLength(0);
  });
}

test("#570 nested Summary filter, empty results and Day/Week retain native membership", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const fixture = await installStatefulProjectFixture(page);
  fixture.tasks[1].type = "summary";
  fixture.tasks.push({ ...fixture.tasks[2], taskId: "00000000-0000-4000-8000-000000000570", externalId: "GRAND-570", parentExternalId: fixture.tasks[1].externalId, name: "Nested child match", siblingOrder: 0 });
  await page.goto(`/projects/${publicId}`);
  const identity = await rememberGanttRoot(page);
  const nested = rowNamed(page, "Existing summary child");
  await nested.locator('[data-action="open-task"]').click();
  await expect(rowNamed(page, "Nested child match")).toHaveCount(0);
  await page.getByRole("button", { name: "주", exact: true }).click();
  await expect(rowNamed(page, "Nested child match")).toHaveCount(0);
  await page.getByRole("button", { name: "일", exact: true }).click();
  await expect(rowNamed(page, "Nested child match")).toHaveCount(0);
  const search = page.getByRole("searchbox", { name: "작업명, 설명, External ID 검색" });
  await search.fill("Nested child match");
  await expect(rowNamed(page, "Stable leaf")).toHaveCount(0);
  await expect(rowNamed(page, "Stable summary")).toBeVisible();
  await expect(nested).toBeVisible();
  await expect(rowNamed(page, "Nested child match")).toHaveCount(0);
  await page.getByRole("button", { name: "주", exact: true }).click();
  await expect(rowNamed(page, "Stable leaf")).toHaveCount(0);
  await expect(nested).toBeVisible();
  await page.getByRole("button", { name: "일", exact: true }).click();
  await expect(nested).toBeVisible();
  await expect(rowNamed(page, "Nested child match")).toHaveCount(0);
  await search.fill("no matches 570");
  await expect(page.locator(".wx-table-container .wx-row[data-id]")).toHaveCount(0);
  await page.getByRole("button", { name: "주", exact: true }).click();
  await expect(page.locator(".wx-table-container .wx-row[data-id]")).toHaveCount(0);
  await search.fill("");
  await expect(rowNamed(page, "Stable leaf")).toBeVisible();
  await expect(rowNamed(page, "Nested child match")).toHaveCount(0);
  await expectSameGanttRoot(page, identity);
  expect(fixture.posts).toHaveLength(0); expect(fixture.patchRequests).toHaveLength(0);
});


test("#570 scale-only restores resized columns once without resetting definitions", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await installStatefulProjectFixture(page);
  await page.goto(`/projects/${publicId}?__coreTrace=1`);
  const frame = page.locator(".project-gantt-frame");
  const receipt = async () => JSON.parse((await frame.getAttribute("data-gantt-projection-receipt")) ?? "null");
  await expect.poll(async () => (await receipt())?.outcome).toBe("SETTLED");
  const header = frame.locator(".wx-table-container .wx-header").first().getByText("작업", { exact: true }).locator("..");
  const widthBefore = (await header.boundingBox())!.width;
  const grip = (await header.locator(".wx-grip").boundingBox())!;
  await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2);
  await page.mouse.down();
  await page.mouse.move(grip.x + grip.width / 2 + 40, grip.y + grip.height / 2, { steps: 6 });
  await page.mouse.up();
  await expect.poll(async () => (await header.boundingBox())!.width).toBeGreaterThan(widthBefore + 20);
  const resizedWidth = (await header.boundingBox())!.width;
  for (const scale of ["주", "일"]) {
    await frame.evaluate(element => Reflect.get(element, "__issue568Trace").configure("issue570", "local", "scale-only"));
    await page.getByRole("button", { name: scale, exact: true }).click();
    await expect.poll(async () => {
      const value = await receipt();
      return value ? `${value.scale}:${value.outcome}` : "";
    }).toBe(`${scale === "주" ? "week" : "day"}:SETTLED`);
    expect((await header.boundingBox())!.width).toBeCloseTo(resizedWidth, 0);
    const trace = await frame.evaluate(element => Reflect.get(element, "__issue568Trace").snapshot());
    expect(trace.entries.filter((entry: { event: string; action: string }) => entry.event === "effect-apply" && entry.action === "set-columns")).toEqual([]);
    expect(trace.entries.filter((entry: { event: string; action: string }) => entry.event === "core-after" && entry.action === "set-columns")).toHaveLength(1);
  }
});

test("#570 passive reparent keeps its existing target Summary collapsed", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const fixture = await installStatefulProjectFixture(page);
  await page.goto(`/projects/${publicId}`);
  const identity = await rememberGanttRoot(page);
  const summary = rowNamed(page, "Stable summary");
  const toggle = summary.locator('[data-action="open-task"]');
  await toggle.click();
  await expect(toggle).toHaveClass(/wxi-menu-right/);
  fixture.tasks[2].parentExternalId = fixture.tasks[0].externalId;
  fixture.tasks[2].siblingOrder = 1;
  fixture.tasks[0].end = fixture.tasks[2].end;
  fixture.tasks[0].duration = 183;
  fixture.project.revision++;
  fixture.nextPost = { kind: "error", status: 422, code: "VALIDATION_ERROR" };
  await page.locator('.project-gantt-widget .wx-header [data-action="add-task"]').first().click();
  await expect.poll(async () => {
    const raw = await page.locator(".project-gantt-frame").getAttribute("data-gantt-projection-receipt");
    return raw ? `${JSON.parse(raw).revision}:${JSON.parse(raw).outcome}` : "";
  }).toBe(`${fixture.project.revision}:SETTLED`);
  await expect(toggle).toHaveClass(/wxi-menu-right/);
  await expect(rowNamed(page, "Stable leaf")).toHaveCount(0);
  await expect(rowNamed(page, "Existing summary child")).toHaveCount(0);
  await expectSameGanttRoot(page, identity);
});
