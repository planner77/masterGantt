import { expect, test } from "@playwright/test";

function contrastRatio(first: string, second: string): number {
  const luminance = (value: string) => {
    const rgb = value.match(/\d+(?:\.\d+)?/g)?.slice(0, 3).map(Number) ?? [];
    const linear = rgb.map((channel) => {
      const normalized = channel / 255;
      return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * linear[0]! + 0.7152 * linear[1]! + 0.0722 * linear[2]!;
  };
  const [light, dark] = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (light + 0.05) / (dark + 0.05);
}

test.describe("Issue #120 semantic UI state tokens", () => {
  test("semantic state colors keep measured text contrast and focus is visible", async ({ page }) => {
    await page.goto("/resources");
    const values = await page.evaluate(() => {
      const root = getComputedStyle(document.documentElement);
      const resolve = (name: string) => {
        const probe = document.createElement("span");
        probe.style.color = `var(${name})`;
        document.body.append(probe);
        const value = getComputedStyle(probe).color;
        probe.remove();
        return value;
      };
      return {
        primary: resolve("--action-primary"),
        primaryForeground: resolve("--action-primary-foreground"),
        error: resolve("--status-error"),
        errorSurface: resolve("--status-error-surface"),
        success: resolve("--status-success"),
        successSurface: resolve("--status-success-surface"),
        info: resolve("--status-info"),
        infoSurface: resolve("--status-info-surface"),
        warning: resolve("--status-warning"),
        warningSurface: resolve("--status-warning-surface"),
        focusOutline: root.getPropertyValue("--focus-outline").trim(),
        focusRing: resolve("--focus-ring"),
        panel: resolve("--surface-panel"),
        readonlyText: resolve("--text-readonly"),
        readonlySurface: "rgb(241, 245, 249)",
        inactiveBadgeSurface: "rgb(226, 232, 240)",
      };
    });
    expect(contrastRatio(values.primary, values.primaryForeground)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(values.error, values.errorSurface)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(values.success, values.successSurface)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(values.info, values.infoSurface)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(values.warning, values.warningSurface)).toBeGreaterThanOrEqual(4.5);
    expect(values.focusOutline).toContain("3px");
    expect(contrastRatio(values.focusRing, values.panel)).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(values.readonlyText, values.readonlySurface)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(values.readonlyText, values.inactiveBadgeSurface)).toBeGreaterThanOrEqual(4.5);

    const password = page.getByLabel("관리자 비밀번호");
    await password.focus();
    const focus = await password.evaluate((element) => {
      const style = getComputedStyle(element);
      return { style: style.outlineStyle, width: style.outlineWidth, offset: style.outlineOffset, color: style.outlineColor, background: style.backgroundColor };
    });
    expect(focus.style).not.toBe("none");
    expect(Number.parseFloat(focus.width)).toBeGreaterThanOrEqual(3);
    expect(Number.parseFloat(focus.offset)).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(focus.color, focus.background)).toBeGreaterThanOrEqual(3);
  });


  test("resource admin measures rendered inactive badge contrast without ancestor opacity", async ({ page }) => {
    await page.route("**/api/resource-catalog/admin-sessions", async (route) => {
      if (route.request().method() === "POST") {
        await route.fulfill({ status: 201, json: { data: { permission: "admin" } } });
        return;
      }
      await route.continue();
    });
    await page.route("**/api/resources", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({ json: { data: {
          revision: 7,
          resources: [{ id: "resource-inactive", name: "Inactive Resource", code: "R-OFF", description: null, active: false }],
          groups: [{ id: "group-inactive", name: "Inactive Group", code: "G-OFF", description: null, active: false, memberResourceIds: [] }],
        } } });
        return;
      }
      await route.continue();
    });

    await page.goto("/resources");
    await page.getByLabel("관리자 비밀번호").fill("x");
    await page.getByRole("button", { name: "로그인" }).click();
    const inactiveBadge = page.getByText("비활성", { exact: true }).first();
    await expect(inactiveBadge).toBeVisible();
    const rendered = await inactiveBadge.evaluate((element) => {
      const style = getComputedStyle(element);
      const row = element.closest("li");
      const rowStyle = row ? getComputedStyle(row) : null;
      return {
        color: style.color,
        background: style.backgroundColor,
        rowBackground: rowStyle?.backgroundColor ?? "rgba(0, 0, 0, 0)",
        rowOpacity: rowStyle?.opacity ?? "1",
      };
    });
    expect(Number(rendered.rowOpacity)).toBe(1);
    const background = rendered.background === "rgba(0, 0, 0, 0)" ? (rendered.rowBackground === "rgba(0, 0, 0, 0)" ? "rgb(255, 255, 255)" : rendered.rowBackground) : rendered.background;
    expect(contrastRatio(rendered.color, background)).toBeGreaterThanOrEqual(4.5);
  });

  test("resource admin keeps the representative viewport widths free of document overflow", async ({ page }) => {
    for (const width of [390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/resources");
      expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
    }
  });
});
