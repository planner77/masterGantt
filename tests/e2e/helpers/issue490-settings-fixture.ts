import { expect, type Page, type TestInfo } from "@playwright/test";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { observeUi, assertUi, assertIdentifiableInput, assertFocusVisible } from "./ui-geometry";

export const widths490 = [390, 768, 1024, 1440, 1920];
export const longName490 = "프로젝트 설정 배치 검증 — 긴 한국어 프로젝트명과 International engineering workspace";
export const longDescription490 = "프로젝트 일정·근무 규칙·국가 공휴일·보안 설정을 확인하는 긴 설명입니다. ".repeat(8);

/** Observe before and after using the same fixture; never capture input values. */
export async function capture490(page: Page, info: TestInfo, key: string, selector = "dialog[open]", responseKind = "actual application", widths = widths490) {
  const root = resolve(__dirname, "../../..");
  const directory = process.env.ISSUE_490_EVIDENCE_DIR ? resolve(root, process.env.ISSUE_490_EVIDENCE_DIR) : info.outputPath("issue-490-evidence");
  await mkdir(directory, { recursive: true });
  const sourcePaths = execFileSync("git", ["ls-files", "src"], { cwd: root, encoding: "utf8" }).trim().split("\n");
  const hashes = async (paths: string[]) => Promise.all(paths.map(async path => ({ path, sha256: createHash("sha256").update(await readFile(resolve(root, path))).digest("hex") })));
  const sourceFiles = await hashes(sourcePaths);
  const provenance = {
    capturedAt: new Date().toISOString(), sourceSha: execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim(),
    sourceFiles, sourceAggregateSha256: createHash("sha256").update(JSON.stringify(sourceFiles)).digest("hex"),
    tests: await hashes(["tests/e2e/project-settings-layout-490.spec.ts", "tests/e2e/helpers/issue490-settings-fixture.ts", "tests/e2e/helpers/ui-geometry.ts", "tests/e2e/fixtures/isolated-application.ts", "tests/e2e/fixtures/task-editor-density.ts", "tests/config/playwright.config.ts"]),
    appVersion: JSON.parse(await readFile(resolve(root, "package.json"), "utf8")).version,
    browserVersion: page.context().browser()?.version(), responseKind,
    command: process.env.ISSUE_490_COMMAND ?? "npx playwright test --config tests/config/playwright.config.ts tests/e2e/project-settings-layout-490.spec.ts",
    report: process.env.PLAYWRIGHT_HTML_OUTPUT_DIR ?? "playwright-report", phase: process.env.ISSUE_490_PHASE ?? "after",
  };
  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 });
    const facts = await observeUi(page, selector);
    const modal = await page.locator(selector).evaluate(node => {
      const rect = node.getBoundingClientRect(); const style = getComputedStyle(node);
      const groups = Array.from(node.querySelectorAll("fieldset,[role=tablist],form > div,form")).filter(n => n.checkVisibility()).map(n => {const r=n.getBoundingClientRect();return {tag:n.tagName,role:n.getAttribute("role"),rect:{x:r.x,y:r.y,width:r.width,height:r.height},clientWidth:n.clientWidth,scrollWidth:n.scrollWidth,clientHeight:n.clientHeight,scrollHeight:n.scrollHeight};});
      return { native: node instanceof HTMLDialogElement, open: node.hasAttribute("open"), rect:{x:rect.x,y:rect.y,right:rect.right,bottom:rect.bottom,width:rect.width,height:rect.height},scrollWidth:node.scrollWidth,clientWidth:node.clientWidth,scrollHeight:node.scrollHeight,clientHeight:node.clientHeight,overflowX:style.overflowX,overflowY:style.overflowY,groups };
    });
    const record = { provenance, facts, modal };
    await page.screenshot({ path: resolve(directory, `${key}-${width}.png`), fullPage: true });
    await writeFile(resolve(directory, `${key}-${width}.json`), JSON.stringify(record, null, 2)+"\n");
    await info.attach(`${key}-${width}`, {body:JSON.stringify(record),contentType:"application/json"});
    assertUi(facts);
    if (process.env.ISSUE_490_PHASE !== "before" && selector === "dialog[open]") {
      if(key.startsWith("tab-") || key.startsWith("calendar-field-")){const focused=facts.controls.find(c=>c.focused);expect(focused).toBeDefined();assertFocusVisible(focused!);if(key.startsWith("calendar-field-")){expect(focused!.rect.y).toBeGreaterThanOrEqual(0);expect(focused!.rect.bottom).toBeLessThanOrEqual(page.viewportSize()!.height);}}
      expect(modal.scrollWidth).toBeLessThanOrEqual(modal.clientWidth + 1);
      for (const c of facts.controls.filter(c => ["INPUT", "SELECT", "TEXTAREA"].includes(c.tag))) assertIdentifiableInput(c);
      const preview=facts.controls.find(c=>c.label==="미리보기 계산"||c.label==="계산 중…");
      const save=facts.controls.find(c=>c.label==="작업 캘린더 저장");
      if(preview&&save&&Math.abs(preview.rect.y-save.rect.y)<=1){expect(Math.abs(preview.rect.height-save.rect.height)).toBeLessThanOrEqual(1);expect(save.rect.x-preview.rect.right).toBeGreaterThanOrEqual(8);}
    }
  }
}

export async function create490(page:Page, origin:string) {
  const response=await page.request.post("/api/projects",{headers:{Origin:origin},data:{name:longName490,description:longDescription490,ownerName:"E2E 자동화",editPassword:"Settings490!"}});
  expect(response.status()).toBe(201);
  const publicId=(await response.json()).data.project.publicId as string;
  await page.goto(`/projects/${publicId}`);
  await expect(page.getByText("편집 중",{exact:true})).toBeVisible();
  return publicId;
}
