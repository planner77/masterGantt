import { expect, test } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { FixtureCommand } from "../../src/features/gantt/diagnostics/core-action-trace-fixture";

test.afterEach(async ({ page }, testInfo) => {
  const snapshot = await page.evaluate(() => window.__issue568?.snapshot());
  if (snapshot) await testInfo.attach("issue568-final-observation.json", { body: JSON.stringify(snapshot, null, 2), contentType: "application/json" });
  if (snapshot && process.env.ISSUE568_EVIDENCE_DIR) {
    await mkdir(process.env.ISSUE568_EVIDENCE_DIR, { recursive: true });
    await writeFile(join(process.env.ISSUE568_EVIDENCE_DIR, `trace-${testInfo.title.match(/\d+px/)?.[0]}-repeat${testInfo.repeatEachIndex}.json`), JSON.stringify({ status: testInfo.status, expectedStatus: testInfo.expectedStatus, snapshot }, null, 2));
  }
});

for (const width of [390, 1440]) {
  test(`Issue568 actual Core action ordering at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/diagnostics/core-action-trace");
    await expect(page.getByRole("heading", { name: "Core 2.7.3 Action Trace" })).toBeVisible();
    await expect.poll(() => page.evaluate(() => !!window.__issue568)).toBe(true);
    const run = `local-${testInfo.repeatEachIndex}-${width}`;
    await page.evaluate(({ run, head }) => window.__issue568!.configure(run, head, "core-wrapper-matrix"), { run, head: process.env.ISSUE568_HEAD ?? "uncommitted" });
    const capacityResult = width === 390 ? "NO_SCROLL_CAPACITY" : "NATIVE_LAYOUT_SETTLED";
    expect(await page.evaluate(() => window.__issue568!.settle())).toBe(capacityResult);
    const initial = await page.evaluate(() => window.__issue568!.sample());
    if (width === 390) {
      expect(initial.native?.clientWidth).toBe(0);
      expect(initial.core.chartWidth).toBeGreaterThan(0);
      const evidence = await page.evaluate(() => window.__issue568!.snapshot());
      expect(evidence.entries.at(-1)).toMatchObject({ result: "NO_SCROLL_CAPACITY", params: { stableFrames: 3 } });
    }
    else expect(initial.native!.clientWidth).toBeGreaterThan(0);
    const measurements: { command: string; result: string; sample: unknown }[] = [];
    const command = async (command: FixtureCommand) => {
      const result = await page.evaluate(command => window.__issue568!.command(command), command);
      measurements.push({ command, result, sample: await page.evaluate(() => window.__issue568!.sample()) });
      return result;
    };
    expect(await command("scroll120")).toBe(capacityResult);
    expect((await page.evaluate(() => window.__issue568!.sample())).core).toMatchObject({ left: 120, top: 96 });
    await command("rename-core");
    await command("rename-react");
    // metadata prop commit과 공개 API 실행을 별개 관측으로 남긴다.
    const postRename = await page.evaluate(() => window.__issue568!.sample());
    expect(postRename.native).not.toBeNull();
    await command("filter-empty");
    await expect(page.getByRole("grid").getByText("Synthetic task 35", { exact: true })).toHaveCount(0);
    await command("filter-reset");
    await command("reveal");
    const beforeDate = await page.evaluate(() => window.__issue568!.sample());
    expect(await command("date")).toBe(capacityResult);
    const afterDate = await page.evaluate(() => window.__issue568!.sample());
    expect(afterDate.core.left).not.toBe(beforeDate.core.left);
    expect(afterDate.core.left).toBe(45 * 40);
    await command("columns");
    await command("resize");
    await command("delete-core");
    await command("week");
    await command("day");
    await command("scroll30");
    if (width === 1440) {
      const chart = page.locator('[data-testid="core-trace-root"] .wx-chart');
      await chart.hover(); await page.mouse.wheel(30, 0);
      const wheelResult = await page.evaluate(() => window.__issue568!.settle());
      measurements.push({ command: "native-wheel30", result: wheelResult, sample: await page.evaluate(() => window.__issue568!.sample()) });
    } else measurements.push({ command: "native-wheel30", result: "NOT TESTED: NO_SCROLL_CAPACITY", sample: await page.evaluate(() => window.__issue568!.sample()) });
    // 실제 브라우저 keyboard event로 activation/focus를 확인한다.
    const control = page.getByRole("button", { name: "scroll120", exact: true });
    await control.focus(); await expect(control).toBeFocused(); await page.keyboard.press("Enter");
    await expect(page.getByTestId("trace-ready")).toHaveText(capacityResult);
    await page.keyboard.press("Tab"); await page.keyboard.press("Escape");
    const snapshot = await page.evaluate(() => window.__issue568!.snapshot());
    expect(snapshot.dropped).toBe(0);
    expect(snapshot.entries.some(entry => entry.event === "command-return" && entry.params.thenable === true)).toBe(true);
    expect(snapshot.entries.some(entry => entry.event === "command-resolved")).toBe(true);
    expect(snapshot.entries.some(entry => entry.event === "react-commit" && entry.layer === "REACT_WRAPPER")).toBe(true);
    expect(snapshot.entries.some(entry => entry.event === "native-intent" && entry.action === "wheel")).toBe(width === 1440);
    expect(snapshot.entries.every((entry, index) => index === 0 || entry.sequence > snapshot.entries[index - 1].sequence)).toBe(true);
    await testInfo.attach("issue568-core-trace.json", { body: JSON.stringify({ run, width, version: "2.7.3", measurements, snapshot,
      notTested: ["server-401-412-network", "full-app-peer", "native-inline", "milestone-lane", "fullscreen"] }, null, 2), contentType: "application/json" });
    await testInfo.attach("issue568-core-fixture.png", { body: await page.screenshot(), contentType: "image/png" });
    if (process.env.ISSUE568_EVIDENCE_DIR) {
      await mkdir(process.env.ISSUE568_EVIDENCE_DIR, { recursive: true });
      await writeFile(join(process.env.ISSUE568_EVIDENCE_DIR, `measurements-${width}-repeat${testInfo.repeatEachIndex}.json`), JSON.stringify({ run, width, measurements }, null, 2));
      await page.screenshot({ path: join(process.env.ISSUE568_EVIDENCE_DIR, `fixture-${width}-repeat${testInfo.repeatEachIndex}.png`) });
    }
  });
}
