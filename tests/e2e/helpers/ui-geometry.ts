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
