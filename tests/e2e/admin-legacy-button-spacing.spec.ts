import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test, isolatedApplicationOptions } from "./fixtures/isolated-application";

test.use(isolatedApplicationOptions);
test("Issue #452: empty project CTA and manual-copy dialog keep parent-owned spacing", async ({ page }, testInfo) => {
  const measurements: unknown[] = [];
  await page.goto("/");
  const cta = page.locator(".empty-state").getByRole("link", { name: "프로젝트 만들기" });
  await expect(cta).toBeVisible();
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const geometry = await cta.evaluate(element => {
      const r = element.getBoundingClientRect();
      return { height: r.height, margin: getComputedStyle(element).marginTop, parentMargin: getComputedStyle(element.parentElement!).marginTop };
    });
    expect(geometry.height).toBeGreaterThanOrEqual(40);
    expect(geometry.margin).toBe("0px");
    expect(geometry.parentMargin).toBe("24px");
    measurements.push({ state: "empty", width, ...geometry });
  }
  const origin = new URL(page.url()).origin;
  const created = await page.request.post("/api/projects", { headers: { Origin: origin }, data: { name: "Button spacing fixture", editPassword: "Test-only1!", description: "", ownerName: "E2E 자동화" } });
  expect(created.status()).toBe(201);
  await page.reload();
  await page.evaluate(() => Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async () => { throw new DOMException("Denied", "NotAllowedError"); } } }));
  const trigger = page.getByRole("button", { name: "Button spacing fixture 프로젝트 작업", exact: true });
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await trigger.click();
    await page.getByRole("menuitem", { name: "Button spacing fixture 프로젝트 링크 복사", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "프로젝트 링크 수동 복사", exact: true });
    await expect(dialog).toBeVisible();
    const retry = dialog.getByRole("button", { name: "복사 다시 시도" });
    await expect(retry).toBeVisible();
    const geometry = await retry.evaluate(element => ({ margin: getComputedStyle(element).marginTop, parentMargin: getComputedStyle(element.parentElement!).marginTop, height: element.getBoundingClientRect().height }));
    expect(geometry.margin).toBe("0px");
    expect(geometry.parentMargin).toBe("24px");
    expect(geometry.height).toBeGreaterThanOrEqual(40);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    measurements.push({ state: "copy-fallback", width, ...geometry });
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
  }
  const evidence = process.env.ISSUE_452_EVIDENCE_DIR;
  if (evidence) { mkdirSync(evidence, { recursive: true }); writeFileSync(resolve(evidence, "after-legacy.json"), JSON.stringify(measurements, null, 2)); }
  await testInfo.attach("legacy-geometry", { body: JSON.stringify(measurements), contentType: "application/json" });
});
