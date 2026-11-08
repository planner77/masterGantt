/** Issue #896 — synthetic Playwright visual evidence; never asserts DESIGN/UAT acceptance. */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { writeFile } from "node:fs/promises";
import type { Locator, Page, TestInfo } from "@playwright/test";

type VisualCapture = {
  issue: number;
  acceptanceCriteria: readonly string[];
  state: string;
  fixture: string;
  locale: "ko" | "en" | "vi";
  elements: ReadonlyArray<{ name: string; locator: Locator }>;
};

function exactSourceSha(): string {
  const declaredSha = process.env.E2E_SOURCE_HEAD_SHA;
  // CI checkout may be test-merge: never silently relabel it as the PR source.
  if (process.env.GITHUB_ACTIONS === "true" && !declaredSha)
    throw new Error("CI UI evidence requires E2E_SOURCE_HEAD_SHA");
  const sha = declaredSha
    || execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  if (!/^[0-9a-f]{40}$/.test(sha)) throw new Error("UI evidence requires exact source SHA");
  return sha;
}

export async function captureSyntheticUiEvidence(page: Page, info: TestInfo, input: VisualCapture): Promise<void> {
  if (!Number.isSafeInteger(input.issue) || input.issue <= 0
      || !/^[A-Za-z0-9_-]{1,100}$/.test(input.state)
      || !/^[A-Za-z0-9_-]{1,80}$/.test(input.fixture)
      || input.acceptanceCriteria.length === 0 || input.acceptanceCriteria.length > 12
      || input.acceptanceCriteria.some(ac => !/^AC\d{2,4}$/.test(ac))
      || input.elements.length === 0 || input.elements.length > 20)
    throw new Error("Invalid UI evidence scope or synthetic fixture");
  const geometry = [];
  for (const element of input.elements) {
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(element.name)) throw new Error("Invalid geometry identity");
    const rect = await element.locator.boundingBox();
    if (!rect || rect.width <= 0 || rect.height <= 0) throw new Error("Visible geometry missing: " + element.name);
    geometry.push({ name: element.name, x: rect.x, y: rect.y, width: rect.width, height: rect.height });
  }
  const screenshotName = "ui-evidence-" + input.state + ".png";
  const png = await page.screenshot({ animations: "disabled" });
  const pngPath = info.outputPath(screenshotName);
  await writeFile(pngPath, png);
  const viewport = page.viewportSize();
  if (!viewport) throw new Error("UI evidence requires fixed viewport");
  const manifest = {
    schema: "mastergantt-ui-evidence/v1",
    verdict: "OBSERVED_NOT_APPROVED",
    issue: input.issue,
    sourceSha: exactSourceSha(),
    acceptanceCriteria: [...input.acceptanceCriteria],
    state: input.state,
    fixture: { kind: "synthetic", name: input.fixture },
    environment: { browser: "chromium", locale: input.locale,
                   viewport: { width: viewport.width, height: viewport.height } },
    geometry,
    screenshot: { name: screenshotName, sha256: createHash("sha256").update(png).digest("hex") },
  };
  const jsonPath = info.outputPath("ui-evidence-" + input.state + ".json");
  await writeFile(jsonPath, JSON.stringify(manifest, null, 2) + "\n", "utf8");
  // Report attachments remain useful to reviewers, but must not look like
  // independent canonical ui-evidence files when Playwright copies them.
  await info.attach("합성 UI PNG 증거 " + input.state, { path: pngPath, contentType: "image/png" });
  await info.attach("합성 UI JSON 증거 " + input.state, { path: jsonPath, contentType: "application/json" });
}
