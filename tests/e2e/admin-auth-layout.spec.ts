import { expect, test } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const admins = [
  { page: "/resources", name: "resource", session: "/api/resource-catalog/admin-sessions", catalog: "/api/resources", data: { revision: 1, resources: [], groups: [] } },
  { page: "/logistics-admin", name: "logistics", session: "/api/logistics-catalog/admin-sessions", catalog: "/api/logistics-catalog/admin/equipment-types", data: { revision: 1, equipmentTypes: [], systemTypes: [] } },
  { page: "/project-master-admin", name: "master", session: "/api/project-master/admin-sessions", catalog: "/api/project-master/admin/items", data: { revision: 1, businessUnits: [], products: [], siteEntities: [], items: [] } },
];
const baseline = false;
const evidence = process.env.ISSUE_452_EVIDENCE_DIR;

for (const admin of admins) {
  test(`Issue #452: ${admin.name} authentication geometry and states`, async ({ page }, testInfo) => {
    let status = 204;
    let failNetwork = false;
    let reads = 0;
    let requests = 0;
    let release: (() => void) | undefined;
    await page.route(`**${admin.session}`, async route => {
      requests += 1;
      if (failNetwork) { await route.abort("failed"); return; }
      if (release === undefined) await route.fulfill({ status });
      else {
        await new Promise<void>(resolve => { release = resolve; });
        await route.fulfill({ status });
      }
    });
    await page.route(`**${admin.catalog}`, async route => {
      reads += 1;
      await route.fulfill({ status: reads > 1 ? 401 : 200, json: { data: admin.data } });
    });
    await page.goto(admin.page);
    const heading = page.locator("h1");
    const measurements: unknown[] = [];
    for (const width of [390, 768, 1024, 1440, 1920]) {
      await page.setViewportSize({ width, height: 900 });
      const input = page.getByLabel("관리자 비밀번호", { exact: true });
      await expect(input).toBeVisible();
      await input.focus();
      const metrics = await page.evaluate(() => {
        const input = document.querySelector('input[type="password"]')!;
        const form = input.closest("form")!;
        const rect = (el: Element) => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; };
        const style = getComputedStyle(input);
        const main = document.querySelector("main")!;
        return { main: rect(main), heading: rect(document.querySelector("h1")!), card: rect(form.closest(".admin-auth") ?? (form.parentElement?.closest("section[aria-labelledby=project-master-auth-title]") ?? form)), input: rect(input), submit: rect(form.querySelector('[type="submit"]')!), padding: getComputedStyle(main).paddingTop, headerBottom: document.querySelector(".site-header")!.getBoundingClientRect().bottom, cardPadding: getComputedStyle(form.closest(".admin-auth") ?? form).paddingTop, cardGap: getComputedStyle(form.closest(".admin-auth") ?? form).gap, headingFont: getComputedStyle(document.querySelector("h1")!).fontSize, headingBottom: document.querySelector(".section-heading")!.getBoundingClientRect().bottom, border: style.borderTopWidth, focus: style.outlineWidth, overflow: document.documentElement.scrollWidth > innerWidth + 1 };
      });
      measurements.push({ state: "before-auth", width, ...metrics });
      if (!baseline) {
        await expect(page.locator(".admin-page")).toBeVisible();
        expect(metrics.padding).toBe("20px");
        expect(metrics.card.width).toBe(Math.min(520, metrics.main.width));
        expect(metrics.main.width).toBe(Math.min(width - (width <= 640 ? 32 : 48), 1600));
        expect(metrics.cardPadding).toBe("16px");
        expect(metrics.cardGap).toBe("12px");
        expect(metrics.card.y - metrics.headingBottom).toBe(16);
        expect(metrics.headingFont).toBe("24px");
        expect(metrics.heading.y - metrics.headerBottom).toBeGreaterThanOrEqual(20);
        expect(metrics.input.height).toBe(40);
        expect(metrics.submit.height).toBe(40);
        expect(metrics.border).toBe("1px");
        expect(metrics.focus).toBe("3px");
        expect(metrics.overflow).toBe(false);
        if (width > 540) expect(Math.abs(metrics.input.y - metrics.submit.y)).toBeLessThanOrEqual(1);
        else { expect(metrics.submit.y).toBeGreaterThan(metrics.input.y + metrics.input.height); expect(metrics.submit.width).toBeCloseTo(metrics.input.width, 0); }
      }
      if (evidence) {
        mkdirSync(evidence, { recursive: true });
        await page.screenshot({ path: resolve(evidence, `${baseline ? "before" : "after"}-${admin.name}-${width}.png`), fullPage: true });
      }
    }
    if (!baseline) {
      await page.setViewportSize({ width: 390, height: 900 });
      const field = page.locator(".admin-auth label");
      const originalText = await page.locator(".admin-auth h2, .admin-auth p").allTextContents();
      await page.locator(".admin-auth h2, .admin-auth p").evaluateAll(nodes => nodes.forEach(node => { node.textContent = "AdministratorAuthenticationGlobalCatalog".repeat(8); }));
      await field.evaluate(label => { label.firstChild!.textContent = "관리자 인증 비밀번호" + "AdministratorAuthenticationPassword".repeat(8); });
      for (const width of [390, 768, 1024, 1440, 1920]) {
        await page.setViewportSize({ width, height: 900 });
        const a = await field.locator("input").boundingBox();
        const b = await page.getByRole("button", { name: "로그인", exact: true }).boundingBox();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
        if (width === 390) expect(b!.y).toBeGreaterThan(a!.y + a!.height);
        else expect(Math.abs(a!.y - b!.y)).toBeLessThanOrEqual(1);
      }
      await page.locator(".admin-auth h2, .admin-auth p").evaluateAll((nodes, texts) => nodes.forEach((node, index) => { node.textContent = texts[index]; }), originalText);
      await field.evaluate(label => { label.firstChild!.textContent = "관리자 비밀번호"; });
    }
    for (const failure of [401, 403, 429]) {
      status = failure;
      const input = page.getByLabel("관리자 비밀번호", { exact: true });
      await input.fill("test-only");
      await input.press("Enter");
      await expect(page.locator("main").getByRole("alert")).toBeVisible();
      await expect(input).toHaveValue("");
      if (!baseline) {
        const errorId = await page.locator("main").getByRole("alert").getAttribute("id");
        expect(errorId).toBeTruthy();
        await expect(input).toHaveAttribute("aria-describedby", errorId!);
        await expect(input).not.toHaveAttribute("aria-invalid", "true");
        await page.locator("main").getByRole("alert").evaluate(node => { node.textContent = "인증 오류 AdministratorAuthenticationFailed".repeat(12); });
        if (failure === 401) for (const width of [390, 768, 1024, 1440, 1920]) {
          await page.setViewportSize({ width, height: 900 });
          expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
        }
      }
    }
    failNetwork = true;
    await page.getByLabel("관리자 비밀번호", { exact: true }).fill("test-only");
    await page.getByLabel("관리자 비밀번호", { exact: true }).press("Enter");
    await expect(page.locator("main").getByRole("alert")).toContainText("연결");
    await expect(page.getByLabel("관리자 비밀번호", { exact: true })).toHaveValue("");
    failNetwork = false;
    status = 204;
    release = () => {};
    const input = page.getByLabel("관리자 비밀번호", { exact: true });
    await input.fill("test-only");
    const count = requests;
    await input.press("Enter");
    await expect(page.getByRole("button", { name: baseline && admin.name === "logistics" ? "로그인" : "확인 중…", exact: true })).toBeDisabled();
    await page.locator("form").evaluate(form => { form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); });
    expect(requests).toBe(count + 1);
    if (!baseline) for (const width of [390, 768, 1024, 1440, 1920]) {
      await page.setViewportSize({ width, height: 900 });
      await expect(input).toBeDisabled();
      const a = await input.boundingBox(); const b = await page.getByRole("button", { name: "확인 중…", exact: true }).boundingBox();
      expect(a!.height).toBe(40); expect(b!.height).toBe(40);
      if (width > 540) expect(Math.abs(a!.y - b!.y)).toBeLessThanOrEqual(1);
      else expect(b!.y).toBeGreaterThan(a!.y + a!.height);
    }
    release!();
    await expect(page.getByRole("button", { name: "새로고침", exact: true })).toBeVisible();
    const headingBefore = measurements as { heading: { x: number; y: number } ; width: number }[];
    for (const width of [390, 768, 1024, 1440, 1920]) {
      await page.setViewportSize({ width, height: 900 });
      const box = await heading.boundingBox();
      const previous = headingBefore.find(item => item.width === width)!;
      if (!baseline) { expect(box!.x).toBe(previous.heading.x); expect(box!.y).toBe(previous.heading.y); }
      if (!baseline) {
        const actionButtons = await page.getByRole("button", { name: /^(관리자 비밀번호 변경|새로고침|로그아웃)$/ }).evaluateAll(nodes => nodes.map(node => { const r = node.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, margin: getComputedStyle(node).marginTop }; }));
        for (const a of actionButtons) {
          expect(a.margin).toBe("0px");
          expect(a.height).toBeGreaterThanOrEqual(40);
          for (const b of actionButtons) {
            if (a === b) continue;
            if (Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y) > 1) { expect(Math.abs(a.y - b.y)).toBeLessThanOrEqual(1); expect(Math.abs(a.height - b.height)).toBeLessThanOrEqual(1); }
            expect(Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x) > 1 && Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y) > 1).toBe(false);
          }
        }
      }
      measurements.push({ state: "after-auth", width, heading: box, buttons: await page.locator(".secondary-button").evaluateAll(buttons => buttons.map(button => ({ margin: getComputedStyle(button).marginTop, height: button.getBoundingClientRect().height }))) });
      if (evidence) await page.screenshot({ path: resolve(evidence, `${baseline ? "before" : "after"}-${admin.name}-${width}-authenticated.png`), fullPage: true });
    }
    await page.getByRole("button", { name: "새로고침", exact: true }).click();
    await expect(page.getByRole("button", { name: "로그인", exact: true })).toBeVisible();
    await expect(page.locator("main").getByRole("alert")).toContainText("세션");
    await expect(page.getByLabel("관리자 비밀번호", { exact: true })).toBeFocused();
    if (evidence) writeFileSync(resolve(evidence, `${baseline ? "before" : "after"}-${admin.name}.json`), JSON.stringify(measurements, null, 2));
    await testInfo.attach("geometry", { body: JSON.stringify(measurements), contentType: "application/json" });
  });
}
