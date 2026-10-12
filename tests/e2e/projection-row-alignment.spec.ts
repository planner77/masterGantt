import { expect, test, type Page } from "@playwright/test";
import { installStatefulProjectFixture, publicId, rowNamed, rememberGanttRoot, expectSameGanttRoot } from "../fixtures/stateful-project";

async function geometry(page: Page) {
  return page.locator(".project-gantt-frame").evaluate(root => {
    const grid = root.querySelector<HTMLElement>(".wx-table-container")!;
    const owner = root.querySelector<HTMLElement>(".wx-gantt")!;
    const chart = root.querySelector<HTMLElement>(".wx-chart")!;
    const rows = Array.from(grid.querySelectorAll<HTMLElement>(".wx-row[data-id]"));
    const pairs = Array.from(chart.querySelectorAll<HTMLElement>(".wx-bar[data-task-id]")).flatMap(bar => {
      const row = rows.find(row => row.dataset.id === bar.dataset.taskId);
      if (!row) return [];
      const r = row.getBoundingClientRect(), b = bar.getBoundingClientRect(), g = grid.getBoundingClientRect();
      if (r.bottom <= g.top || r.top >= g.bottom) return [];
      return [{ id: row.dataset.id, rowY: r.y, rowHeight: r.height, barY: b.y, barHeight: b.height, delta: b.y + b.height / 2 - r.y - r.height / 2 }];
    });
    return { gridTop: grid.scrollTop, gridLeft: grid.scrollLeft, gridHeight: grid.clientHeight, gridScrollHeight: grid.scrollHeight, gridWidth: grid.clientWidth, gridScrollWidth: grid.scrollWidth, headerHeight: grid.querySelector<HTMLElement>(".wx-header")!.getBoundingClientRect().height,
      rowHeight: rows[0]?.getBoundingClientRect().height ?? 0, mountedGridIds: rows.map(row => row.dataset.id!.replace(/^:/, "")), mountedBarIds: Array.from(chart.querySelectorAll<HTMLElement>(".wx-bar[data-task-id]")).map(bar => bar.dataset.taskId!.replace(/^:/, "")),
      ownerTop: owner.scrollTop, chartTop: chart.scrollTop, coreTop: (Reflect.get(root, "__masterganttPublicViewport") as { top: number }).top,
      receipt: JSON.parse(root.getAttribute("data-gantt-projection-receipt") ?? "null"), pairs };
  });
}
async function aligned(page: Page) {
  await expect.poll(async () => {
    const sample = await geometry(page);
    return sample.pairs.length > 0 && sample.pairs.every(pair => Math.abs(pair.delta) <= 1);
  }).toBe(true);
}

for (const width of [390, 768, 1024, 1440, 1920]) for (const scale of ["Day", "Week"]) {
  test(`#637 Grid hidden Y cannot move independently ${width}px ${scale}`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 1000 });
    const fixture = await installStatefulProjectFixture(page);
    await page.goto(`/projects/${publicId}?__coreTrace=1`);
    await expect(rowNamed(page, "Stable leaf")).toBeVisible();
    if (scale === "Week") await page.getByRole("button", { name: "주", exact: true }).click();
    await expect.poll(async () => (await geometry(page)).receipt?.outcome).toBe("SETTLED");
    const identity = await rememberGanttRoot(page);
    const before = await geometry(page);
    // Deterministic reproduction of the original native Grid-only 28px drift.
    // Keep the actual click and strict projection observer in #570 unchanged.
    await page.locator(".wx-table-container").evaluate(element => { element.scrollTop = 28; });
    const attempted = await geometry(page);
    await info.attach("hidden-grid-scroll-attempt", { body: JSON.stringify({ before, attempted }), contentType: "application/json" });
    expect(attempted.gridTop).toBe(0);
    expect(attempted.gridScrollHeight).toBe(attempted.gridHeight);
    const header = page.locator('.project-gantt-widget .wx-header [data-action="add-task"]').first();
    await header.evaluate(element => { element.scrollIntoView({ block: "center", inline: "nearest" }); (element as HTMLElement).focus(); });
    await expect(header).toBeFocused();
    await page.keyboard.press("Tab");
    await rowNamed(page, "Stable leaf").locator('[data-col-id=":text"]').evaluate(element => {
      element.scrollIntoView({ block: "center", inline: "nearest" }); (element as HTMLElement).focus();
    });
    await page.keyboard.press("ArrowDown");
    await aligned(page);
    const after = await geometry(page);
    expect(after.gridTop).toBe(0);
    expect(after.chartTop).toBe(0);
    expect(Math.abs(after.coreTop - after.ownerTop)).toBeLessThanOrEqual(1);
    await expectSameGanttRoot(page, identity);
    expect(fixture.posts).toHaveLength(0); expect(fixture.patchRequests).toHaveLength(0);
    await info.attach("focus-scrollIntoView-alignment", { body: JSON.stringify(after), contentType: "application/json" });
    if (width === 1440 && scale === "Day") await info.attach("grid-chart-alignment-1440", { body: await page.locator(".project-gantt-frame").screenshot(), contentType: "image/png" });
  });
}

for (const scale of ["Day", "Week"]) test(`#637 native owner Y and wide Grid X retain virtual rows ${scale}`, async ({ page }, info) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const fixture = await installStatefulProjectFixture(page);
  const leaf = fixture.tasks[2];
  for (let index = 0; index < 80; index++) fixture.tasks.push({ ...leaf,
    taskId: `00000000-0000-4000-8000-${String(700 + index).padStart(12, "0")}`,
    externalId: `ROW-${index}`, name: `Virtual row ${index}`, siblingOrder: index + 3,
    requestedStart: "2026-01-05", start: "2026-01-05", end: "2026-01-06", duration: 2 });
  await page.goto(`/projects/${publicId}?__coreTrace=1`);
  await expect(rowNamed(page, "Stable leaf")).toBeVisible();
  if (scale === "Week") await page.getByRole("button", { name: "주", exact: true }).click();
  const frame = page.locator(".project-gantt-frame");
  await expect.poll(async () => (await geometry(page)).receipt?.outcome).toBe("SETTLED");
  const identity = await rememberGanttRoot(page);
  const header = frame.locator(".wx-table-container .wx-header").first().getByText("작업", { exact: true }).locator("..");
  const grip = (await header.locator(".wx-grip").boundingBox())!;
  await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2);
  await page.mouse.down();
  await page.mouse.move(grip.x + grip.width / 2 + 600, grip.y + grip.height / 2, { steps: 6 });
  await page.mouse.up();
  await expect.poll(async () => { const value = await geometry(page); return value.gridScrollWidth - value.gridWidth; }).toBeGreaterThan(100);
  await frame.locator(".wx-table-container").evaluate(element => { element.scrollLeft = 120; });
  await expect.poll(async () => (await geometry(page)).gridLeft).toBe(120);
  const samples = [];
  for (const top of [300, 1200, 2400, 0]) {
    await frame.locator(".wx-gantt").evaluate((element, top) => { element.scrollTop = top; }, top);
    await expect.poll(async () => (await geometry(page)).coreTop).toBe(top);
    await aligned(page);
    const sample = await geometry(page);
    expect(sample.gridTop).toBe(0); expect(sample.chartTop).toBe(top);
    expect(sample.ownerTop).toBe(top); expect(sample.gridLeft).toBe(120);
    // This fixture has fixed-height rows and no collapsed nodes. Use the
    // actual Core order and measured row/viewport heights, not the subset
    // that happened to mount, to require every visible virtual row.
    expect(sample.rowHeight).toBeGreaterThan(0);
    const coreIds = sample.receipt.coreVisibleIds as string[];
    expect(coreIds).toHaveLength(fixture.tasks.length);
    const requiredGridIds = coreIds.filter((_, index) => index * sample.rowHeight + sample.rowHeight > top && index * sample.rowHeight < top + sample.gridHeight - sample.headerHeight);
    expect(requiredGridIds.length).toBeGreaterThan(5);
    expect(requiredGridIds.every(id => sample.mountedGridIds.includes(id))).toBe(true);
    // All January tasks intersect the initial Chart X viewport in both scales;
    // the September leaf and December milestone are legitimately outside it.
    const requiredBarIds = requiredGridIds.filter(id => ![leaf.taskId, fixture.tasks[3].taskId].includes(id));
    expect(requiredBarIds.every(id => sample.mountedBarIds.includes(id))).toBe(true);
    expect(requiredBarIds.every(id => sample.pairs.some(pair => pair.id === `:${id}`))).toBe(true);
    samples.push(sample);
  }
  await expectSameGanttRoot(page, identity);
  expect(fixture.posts).toHaveLength(0); expect(fixture.patchRequests).toHaveLength(0);
  await info.attach("native-scroll-virtual-geometry", { body: JSON.stringify(samples), contentType: "application/json" });
});

test("#637 genuine visible Grid Y mismatch still times out with matching canonical IDs", async ({ page }, info) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const fixture = await installStatefulProjectFixture(page);
  await page.goto(`/projects/${publicId}?__coreTrace=1`);
  await expect(rowNamed(page, "Stable leaf")).toBeVisible();
  await expect.poll(async () => (await geometry(page)).receipt?.outcome).toBe("SETTLED");
  const identity = await rememberGanttRoot(page), before = await geometry(page);
  // A separate test-only visual corruption: the product must never normalize
  // this genuine mismatch into SETTLED merely because membership agrees.
  const corruption = await page.addStyleTag({ content: '.project-gantt-widget .wx-table-container .wx-row[data-id] { transform: translateY(-28px); }' });
  await page.setViewportSize({ width: 1439, height: 1000 });
  await expect.poll(async () => { const value = await geometry(page); return value.receipt?.generation > before.receipt.generation ? value.receipt.outcome : null; }).toBe("TIMED_OUT");
  const failed = await geometry(page);
  expect(failed.receipt.logicalVisibleIds).toEqual(failed.receipt.coreVisibleIds);
  expect(failed.receipt.domIds).toEqual(failed.receipt.coreVisibleIds);
  expect(failed.pairs.length).toBe(fixture.tasks.length);
  expect(failed.pairs.every(pair => Math.abs(pair.delta - 27.5) <= 1)).toBe(true);
  await corruption.evaluate(element => element.parentNode?.removeChild(element));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect.poll(async () => { const value = await geometry(page); return value.receipt?.generation > failed.receipt.generation ? value.receipt.outcome : null; }).toBe("SETTLED");
  await aligned(page); await expectSameGanttRoot(page, identity);
  expect(fixture.posts).toHaveLength(0); expect(fixture.patchRequests).toHaveLength(0);
  await info.attach("strict-visible-offset-negative", { body: JSON.stringify({ before, failed, recovered: await geometry(page) }), contentType: "application/json" });
});
