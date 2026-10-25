import { expect, type Page, type TestInfo } from "@playwright/test";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

/** Observe displayed controls without recording user values or credentials. */
export async function observeUi(page: Page, selector = "main") {
  return page.locator(selector).evaluate(element => {
    const box = (node: Element) => { const r = node.getBoundingClientRect(); return { x: r.x, y: r.y, right: r.right, bottom: r.bottom, width: r.width, height: r.height }; };
    const boxFromRect = (r: DOMRect) => ({ x: r.x, y: r.y, right: r.right, bottom: r.bottom, width: r.width, height: r.height });
    const visible = (node: Element) => node.checkVisibility({ checkVisibilityCSS: true }) && !node.closest('[inert],[aria-hidden="true"],details:not([open]) > :not(summary)');
    const candidates = Array.from(element.querySelectorAll("input,select,textarea,button,a[href]"));
    const controls = candidates.filter(visible).map(node => {
      const s = getComputedStyle(node);
      const clipOwners = [];
      for (let parent = node.parentElement; parent; parent = parent.parentElement) { const style = getComputedStyle(parent); if ([style.overflowX, style.overflowY].some(value => ["hidden", "clip", "auto", "scroll"].includes(value))) clipOwners.push({ rect: box(parent), overflowX: style.overflowX, overflowY: style.overflowY }); }
      const labels = Array.from((node as HTMLInputElement).labels ?? []).map(label => ({ id: label.id, htmlFor: label.htmlFor, wrapsControl: label.contains(node), text: label.textContent?.trim() }));
      const describedBy = (node.getAttribute("aria-describedby") ?? "").split(/\s+/).filter(Boolean).map(id => { const target = document.getElementById(id); return { id, exists: !!target, visible: target ? visible(target) : false, text: target?.textContent?.trim() ?? null }; });
      return { tag: node.tagName, id: node.id, type: node.getAttribute("type"), label: node.getAttribute("aria-label") ?? (node as HTMLInputElement).labels?.[0]?.textContent?.trim() ?? node.textContent?.trim(), rect: box(node), owner: box(node.closest("td,label,form,[role=group],[role=tablist]") ?? node.parentElement!), labels, clipOwners, focused: node === document.activeElement, focusVisible: node.matches(":focus-visible"), disabled: node.matches(":disabled"), readonly: node.hasAttribute("readonly"), invalid: node.getAttribute("aria-invalid"), describedBy, style: { borderWidths: [s.borderTopWidth,s.borderRightWidth,s.borderBottomWidth,s.borderLeftWidth], borderStyles: [s.borderTopStyle,s.borderRightStyle,s.borderBottomStyle,s.borderLeftStyle], borderColors: [s.borderTopColor,s.borderRightColor,s.borderBottomColor,s.borderLeftColor], background: s.backgroundColor, surroundingBackground: getComputedStyle(node.parentElement!).backgroundColor, padding: s.padding, font: s.font, fontSize: s.fontSize, fontFamily: s.fontFamily, lineHeight: s.lineHeight, minHeight: s.minHeight, boxSizing: s.boxSizing, outlineStyle: s.outlineStyle, outlineWidth: s.outlineWidth, outlineColor: s.outlineColor, outlineOffset: s.outlineOffset, color: s.color, opacity: s.opacity, marginTop: s.marginTop } };
    });
    const tables = Array.from(element.querySelectorAll("table")).filter(visible).map(table => {
      const headers = Array.from(table.querySelectorAll("thead th")).map(box);
      const rows = Array.from(table.querySelectorAll("tbody tr")).filter(visible).filter(row => Array.from(row.children).every(cell => (cell as HTMLTableCellElement).colSpan === 1)).map(row => ({ rect: box(row), cells: Array.from(row.children).map(cell => { const walker = document.createTreeWalker(cell, NodeFilter.SHOW_TEXT); const textRects = []; let text; while ((text = walker.nextNode())) { if (!text.textContent?.trim() || !text.parentElement || !visible(text.parentElement)) continue; const range = document.createRange(); range.selectNodeContents(text); const style = getComputedStyle(text.parentElement!); const textRect = range.getBoundingClientRect(); if (textRect.width <= 0 || textRect.height <= 0) continue; textRects.push({ rect: boxFromRect(textRect), intentionalClip: style.textOverflow === "ellipsis" || ["hidden", "clip"].includes(style.overflowX) }); } return { ...box(cell), textRects }; }), visibleControls: Array.from(row.querySelectorAll("input,select,textarea,button")).filter(visible).length }));
      const owner = table.parentElement!;
      return { rect: box(table), owner: { ...box(owner), clientWidth: owner.clientWidth, scrollWidth: owner.scrollWidth, scrollLeft: owner.scrollLeft, clientHeight: owner.clientHeight, scrollHeight: owner.scrollHeight }, headers, rows, visibleRows: rows.filter(row => row.rect.bottom > Math.max(0, box(owner).y) && row.rect.y < Math.min(innerHeight, box(owner).bottom)).length, rowHeightMin: rows.length ? Math.min(...rows.map(row => row.rect.height)) : null, rowHeightMax: rows.length ? Math.max(...rows.map(row => row.rect.height)) : null };
    });
    const heading = document.querySelector("main h1"), header = document.querySelector(".site-header");
    const auth = document.querySelector(".admin-auth");
    return { route: location.pathname, viewport: { width: innerWidth, height: innerHeight }, document: { scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth }, environment: { locale: navigator.language, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, dpr: devicePixelRatio, rootFont: getComputedStyle(document.documentElement).fontSize, visualViewportScale: visualViewport?.scale, userAgent: navigator.userAgent, zoom: "default 100%; native125% NOT TESTED; no DPR zoom substitution" }, shell: { main: box(document.querySelector("main")!), heading: heading ? box(heading) : null, headerBottom: header?.getBoundingClientRect().bottom ?? null, auth: auth ? box(auth) : null }, controls, excludedControls: candidates.length - controls.length, tables };
  });
}

export function assertUi(facts: Awaited<ReturnType<typeof observeUi>>, minimumControls = 1) {
  expect(facts.controls.length, "visible controls must be nonempty").toBeGreaterThanOrEqual(minimumControls);
  expect(facts.document.scrollWidth).toBeLessThanOrEqual(facts.document.clientWidth + 1);
  for (const control of facts.controls) {
    expect(control.rect.width).toBeGreaterThan(0); expect(control.rect.height).toBeGreaterThan(0);
    for (const target of control.describedBy) expect(target.exists, `missing description ${target.id}`).toBe(true);
  }
}

export function assertPopulatedTable(table: Awaited<ReturnType<typeof observeUi>>["tables"][number], minimumRows = 1) {
  expect(table.headers.length).toBeGreaterThan(0); expect(table.rows.length).toBeGreaterThanOrEqual(minimumRows);
  for (const row of table.rows) {
    expect(row.cells.length).toBe(table.headers.length);
    row.cells.forEach((cell, index) => { expect(Math.abs(cell.x - table.headers[index].x)).toBeLessThanOrEqual(1); expect(Math.abs(cell.width - table.headers[index].width)).toBeLessThanOrEqual(1); for (const text of cell.textRects.filter(text => !text.intentionalClip)) { expect(text.rect.x).toBeGreaterThanOrEqual(cell.x - 1); expect(text.rect.right).toBeLessThanOrEqual(cell.right + 1); } });
  }
}


export function assertIdentifiableInput(control: Awaited<ReturnType<typeof observeUi>>["controls"][number]) {
  expect(control.labels.length > 0 || !!control.label, "actual label association").toBe(true);
  expect(control.style.borderWidths.every(width => parseFloat(width) >= 1)).toBe(true);
  expect(control.style.borderStyles.every(style => style !== "none")).toBe(true);
  expect(control.style.background).not.toBe("rgba(0, 0, 0, 0)");
  expect(control.style.fontSize).not.toBe("0px"); expect(parseFloat(control.style.padding)).toBeGreaterThan(0);
}

export function assertFocusVisible(control: Awaited<ReturnType<typeof observeUi>>["controls"][number]) {
  expect(control.focused).toBe(true); expect(control.focusVisible).toBe(true);
  expect(control.style.outlineStyle).not.toBe("none"); expect(parseFloat(control.style.outlineWidth)).toBeGreaterThan(0);
  const outset = Math.max(0, parseFloat(control.style.outlineWidth) + parseFloat(control.style.outlineOffset));
  for (const owner of control.clipOwners) {
    if (["hidden", "clip", "auto", "scroll"].includes(owner.overflowX)) { expect(control.rect.x - outset).toBeGreaterThanOrEqual(owner.rect.x - 1); expect(control.rect.right + outset).toBeLessThanOrEqual(owner.rect.right + 1); }
    if (["hidden", "clip", "auto", "scroll"].includes(owner.overflowY)) { expect(control.rect.y - outset).toBeGreaterThanOrEqual(owner.rect.y - 1); expect(control.rect.bottom + outset).toBeLessThanOrEqual(owner.rect.bottom + 1); }
  }
}

export function assertSiblingControls(controls: Awaited<ReturnType<typeof observeUi>>["controls"]) {
  expect(controls.length).toBeGreaterThanOrEqual(2);
  controls.forEach((a, index) => controls.slice(index + 1).forEach(b => { expect(Math.min(a.rect.right, b.rect.right) - Math.max(a.rect.x, b.rect.x) > 1 && Math.min(a.rect.bottom, b.rect.bottom) - Math.max(a.rect.y, b.rect.y) > 1).toBe(false); }));
}

export async function captureUi(page: Page, testInfo: TestInfo, key: string, selector = "main", evidenceScope: "457" | "502" = "457") {
  const facts = await observeUi(page, selector); assertUi(facts);
  const root = resolve(__dirname, "../../..");
  const files = execFileSync("git", ["ls-files", "src"], { cwd: root, encoding: "utf8" }).trim().split("\n");
  const hashFiles = async (paths: string[]) => Promise.all(paths.map(async path => ({ path, sha256: createHash("sha256").update(await readFile(resolve(root, path))).digest("hex") })));
  const sourceFiles = await hashFiles(files);
  const fixtureFiles = execFileSync("git", ["ls-files", "tests/fixtures", "tests/e2e/fixtures", "tests/e2e/helpers"], { cwd: root, encoding: "utf8" }).trim().split("\n");
  const sourceAggregateSha256 = createHash("sha256").update(JSON.stringify(sourceFiles)).digest("hex");
  const evidenceSettings = evidenceScope === "502"
    ? { command: process.env.ISSUE_502_COMMAND, report: process.env.ISSUE_502_REPORT, baseline: process.env.ISSUE_502_BASELINE_SOURCE_AGGREGATE_SHA256?.trim(), directory: process.env.ISSUE_502_EVIDENCE_DIR?.trim() }
    : { command: process.env.ISSUE_457_COMMAND, report: process.env.ISSUE_457_REPORT, baseline: process.env.ISSUE_457_BASELINE_SOURCE_AGGREGATE_SHA256?.trim(), directory: process.env.ISSUE_457_EVIDENCE_DIR?.trim() };
  const provenance = { evidenceScope, capturedAt: new Date().toISOString(), sourceSha: execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim(), sourceFiles, sourceAggregateSha256, tests: await hashFiles([testInfo.file.replace(root + "/", ""), "tests/e2e/helpers/ui-geometry.ts", "tests/config/playwright.config.ts", ...fixtureFiles]), appVersion: JSON.parse(await readFile(resolve(root, "package.json"), "utf8")).version, browserVersion: page.context().browser()?.version(), testcase: testInfo.titlePath, command: evidenceSettings.command ?? "npx playwright test --config tests/config/playwright.config.ts", report: evidenceSettings.report ?? "playwright-report" };
  const baselineSourceAggregateSha256 = evidenceSettings.baseline;
  const judgment = baselineSourceAggregateSha256
    ? sourceAggregateSha256 === baselineSourceAggregateSha256
      ? "KEEP: product source matches explicit baseline"
      : "REVIEW: product source differs from explicit baseline"
    : "OBSERVATION: explicit product-source baseline not supplied";
  const explicitEvidenceDir = evidenceSettings.directory;
  const directory = explicitEvidenceDir ? resolve(root, explicitEvidenceDir) : evidenceScope === "502" ? testInfo.outputPath("issue-502-evidence") : testInfo.outputPath("issue-457-evidence");
  await mkdir(directory, { recursive: true });
  await page.screenshot({ path: resolve(directory, `${key}.png`), fullPage: true });
  await writeFile(resolve(directory, `${key}.json`), JSON.stringify({ judgment, provenance, facts }, null, 2) + "\n");
  await testInfo.attach(key, { body: JSON.stringify({ provenance, facts }), contentType: "application/json" });
  return facts;
}


/** #800: lightweight six-perspective geometry observer (no screenshots or writes). */
export type DashboardSurfaceKind = "kpi" | "milestone" | "process" | "equipment" | "system" | "resource";

export async function observeDashboardSurface(page: Page, kind: DashboardSurfaceKind) {
  const root = kind === "kpi"
    ? page.getByTestId("logistics-dashboard-view").filter({ visible: true })
    : page.locator('[data-wbs-view="' + kind + '"][data-ready="true"]').filter({ visible: true });
  return root.evaluate((element, perspective) => {
    const visible = (node: Element) =>
      node.checkVisibility({ checkVisibilityCSS: true }) &&
      !node.closest('[inert],[aria-hidden="true"],details:not([open]) > :not(summary)');
    const rect = (node: Element | null) => {
      if (!node) return null;
      const r = node.getBoundingClientRect();
      return { x: r.x, y: r.y, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
    };
    const pick = (selector: string) => Array.from(element.querySelectorAll(selector)).find(visible) ?? null;
    const insideViewport = (node: Element) => {
      const r = node.getBoundingClientRect();
      if (r.x < -1 || r.y < -1 || r.right > innerWidth + 1 || r.bottom > innerHeight + 1) return false;
      for (let parent = node.parentElement; parent; parent = parent.parentElement) {
        const p = parent.getBoundingClientRect(), s = getComputedStyle(parent);
        if (["auto", "scroll", "hidden", "clip"].includes(s.overflowY) && (r.y < p.y - 1 || r.bottom > p.bottom + 1)) return false;
        if (["auto", "scroll", "hidden", "clip"].includes(s.overflowX) && (r.x < p.x - 1 || r.right > p.right + 1)) return false;
      }
      return true;
    };
    // KPI uses h4 inside its cards; its first h3 is the *later* related-Milestone section.
    // Anchor KPI to its visible view root, not an optional lower heading.
    const header = perspective === "kpi" ? element : pick("h1,h2,h3");
    const toolbar = pick(perspective === "kpi" ? '[class*="filterBar"]' : '[aria-label="빠른 조회 조건"]');
    const summary = pick(perspective === "kpi" ? '[class*="kpiGrid"]' : "dl");
    const values = Array.from(element.querySelectorAll(perspective === "kpi" ? '[class*="kpiValueRow"]' : "dl dd")).filter(visible);
    const table = pick("table");
    const rows = table ? Array.from(table.querySelectorAll("tbody tr")).filter(visible) : [];
    const controls = toolbar ? Array.from(toolbar.children).filter(visible) : [];
    const intersections: number[][] = [];
    for (let i = 0; i < controls.length; i++) for (let j = i + 1; j < controls.length; j++) {
      const a = controls[i].getBoundingClientRect(), b = controls[j].getBoundingClientRect();
      if (Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 &&
          Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1) intersections.push([i, j]);
    }
    let scrollOwner: Element | null = table?.parentElement ?? null;
    while (scrollOwner && scrollOwner !== element) {
      const style = getComputedStyle(scrollOwner);
      if (["auto", "scroll"].includes(style.overflowX)) break;
      scrollOwner = scrollOwner.parentElement;
    }
    if (scrollOwner === element) scrollOwner = null;
    const rootStyle = getComputedStyle(document.documentElement);
    return {
      kind: perspective,
      route: location.pathname,
      viewport: { width: innerWidth, height: innerHeight },
      environment: {
        locale: navigator.language, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        dpr: devicePixelRatio, rootFont: rootStyle.fontSize,
        visualViewportScale: visualViewport?.scale ?? null,
      },
      state: element.getAttribute("data-wbs-state") ?? "kpi",
      ready: element.getAttribute("data-ready") ?? "kpi",
      header: rect(header), toolbar: rect(toolbar), firstSummary: rect(summary), firstTable: rect(table),
      metricCount: values.length, visibleMetricCount: values.filter(insideViewport).length,
      rowCount: rows.length, visibleRowCount: rows.filter(insideViewport).length,
      controlCount: controls.length,
      controlRows: [...new Set(controls.map(node => Math.round(node.getBoundingClientRect().y)))].length,
      siblingOverlap: intersections,
      documentOverflow: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
      scrollOwner: scrollOwner ? {
        rect: rect(scrollOwner), scrollWidth: scrollOwner.scrollWidth, clientWidth: scrollOwner.clientWidth,
        scrollHeight: scrollOwner.scrollHeight, clientHeight: scrollOwner.clientHeight,
        overflowX: getComputedStyle(scrollOwner).overflowX,
      } : null,
      states: {
        alerts: Array.from(element.querySelectorAll('[role="alert"]')).filter(visible).length,
        statuses: Array.from(element.querySelectorAll('[role="status"]')).filter(visible).length,
      },
    };
  }, kind);
}

export function assertDashboardSurface(facts: Awaited<ReturnType<typeof observeDashboardSurface>>, expectedWidth: number) {
  expect(facts.viewport).toEqual({ width: expectedWidth, height: 900 });
  expect(facts.documentOverflow, facts.kind + " document horizontal overflow").toBeLessThanOrEqual(1);
  expect(facts.header, facts.kind + " heading").not.toBeNull();
  expect(facts.firstSummary, facts.kind + " first summary").not.toBeNull();
  expect(facts.firstTable, facts.kind + " first table").not.toBeNull();
  expect(facts.metricCount, facts.kind + " visible metric elements").toBeGreaterThan(0);
  expect(facts.rowCount, facts.kind + " populated fixture table rows").toBeGreaterThan(0);
  expect(facts.siblingOverlap, facts.kind + " toolbar sibling overlap").toEqual([]);
  expect(facts.firstSummary!.y).toBeGreaterThanOrEqual(facts.header!.y - 1);
  expect(facts.firstTable!.y).toBeGreaterThanOrEqual(facts.firstSummary!.y - 1);
  if (facts.kind !== "kpi") {
    expect(facts.ready).toBe("true");
    expect(facts.scrollOwner?.overflowX, facts.kind + " table-owned horizontal scrolling").toMatch(/auto|scroll/);
  }
}

/** Attach exact source, test/fixture hashes and runtime conditions to #800's 30 samples. */
export async function dashboardSurfaceReceipt(page: Page, testInfo: TestInfo, samples: Awaited<ReturnType<typeof observeDashboardSurface>>[]) {
  const root = resolve(__dirname, "../../..");
  const paths = [
    "tests/e2e/issue-730-view-composer.spec.ts", "tests/e2e/helpers/ui-geometry.ts",
    "tests/e2e/fixtures/wbs-view-composer.ts", "tests/e2e/fixtures/target-project.ts",
    "tests/config/playwright.config.ts", "package.json", "package-lock.json",
  ];
  const hashes = await Promise.all(paths.map(async path => ({
    path, sha256: createHash("sha256").update(await readFile(resolve(root, path))).digest("hex"),
  })));
  const sourceSha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
  const dirty = execFileSync("git", ["status", "--porcelain"], { cwd: root, encoding: "utf8" }).trim().length > 0;
  const appVersion = JSON.parse(await readFile(resolve(root, "package.json"), "utf8")).version;
  const domAppVersion = (await page.locator(".brand-version").first().textContent())?.trim();
  expect(domAppVersion, "actual DOM app version").toBe("v" + appVersion);
  const receipt = {
    schema: "issue-800:dashboard-geometry:v1",
    captureStatus: "OBSERVED: fixture browser geometry, not product before/after or QA approval",
    sourceSha, dirty, appVersion, domAppVersion,
    capturedAt: new Date().toISOString(), command: process.env.ISSUE_800_RUN_COMMAND ?? "NOT RECORDED",
    browserVersion: page.context().browser()?.version() ?? "UNKNOWN",
    case: testInfo.titlePath, testAndFixtureHashes: hashes,
    sampleCount: samples.length, samples,
    notTested: ["native 125% / screen reader / real device (#517)", "production/operational browser",
      "before/after cross-SHA comparison without a separately authenticated same-fixture pair"],
  };
  await testInfo.attach("issue-800-dashboard-geometry", { body: JSON.stringify(receipt, null, 2), contentType: "application/json" });
  return receipt;
}
