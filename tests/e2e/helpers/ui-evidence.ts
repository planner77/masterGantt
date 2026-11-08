/** Issue #896 — 합성 브라우저 증거 수집. DESIGN/UAT 승인을 부여하지 않는다. */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { platform, release } from "node:os";
import type { Locator, Page, TestInfo } from "@playwright/test";

type VisualCapture = {
  issue: number;
  acceptanceCriteria: readonly string[];
  state: string;
  fixture: string;
  fixtureData?: unknown;
  locale: "ko" | "en" | "vi";
  flow?: { id: string; steps: readonly string[]; outcome: "PASS" | "FAIL" | "NOT TESTED" };
  checks?: ReadonlyArray<{ ac: string; designRef: string; measurement: string;
    expected: number | string | boolean; actual: number | string | boolean;
    tolerance?: number; outcome: "PASS" | "FAIL" | "NOT TESTED" }>;
  exclusions?: ReadonlyArray<{ scope: string; reason: string }>;
  elements: ReadonlyArray<{ name: string; locator: Locator }>;
};

const sha256 = (bytes: string | Buffer) => createHash("sha256").update(bytes).digest("hex");
const git = (...args: string[]) => execFileSync("git", args, { encoding: "utf8" }).trim();
function exactSha(value: string | undefined, fallback: () => string, label: string): string {
  if (process.env.GITHUB_ACTIONS === "true" && !value)
    throw new Error("CI UI 증거 출처 누락: " + label);
  const sha = value || fallback();
  if (!/^[0-9a-f]{40}$/.test(sha)) throw new Error("UI 증거 SHA 형식 오류: " + label);
  return sha;
}

export async function captureSyntheticUiEvidence(page: Page, info: TestInfo, input: VisualCapture): Promise<void> {
  if (!Number.isSafeInteger(input.issue) || input.issue <= 0
      || !/^[A-Za-z0-9_-]{1,100}$/.test(input.state)
      || !/^[A-Za-z0-9_-]{1,80}$/.test(input.fixture)
      || input.acceptanceCriteria.length === 0 || input.acceptanceCriteria.length > 12
      || new Set(input.acceptanceCriteria).size !== input.acceptanceCriteria.length
      || input.acceptanceCriteria.some(ac => !/^AC\d{2,4}$/.test(ac))
      || input.elements.length === 0 || input.elements.length > 20)
    throw new Error("UI 증거 범위 또는 합성 Fixture 식별자 오류");
  const captureStarted = performance.now();
  const ci = process.env.GITHUB_ACTIONS === "true";
  const sourceSha = exactSha(process.env.E2E_SOURCE_HEAD_SHA, () => git("rev-parse", "HEAD"), "source");
  const baselineSha = exactSha(process.env.E2E_SOURCE_BASE_SHA, () => git("rev-parse", "origin/main"), "baseline");
  const testMergeSha = exactSha(process.env.E2E_SOURCE_TEST_MERGE_SHA, () => git("rev-parse", "HEAD"), "test merge");
  const pr = process.env.E2E_SOURCE_PR_NUMBER ? Number(process.env.E2E_SOURCE_PR_NUMBER) : null;
  if (pr !== null && (!Number.isSafeInteger(pr) || pr <= 0)) throw new Error("UI 증거 PR 번호 오류");
  if (ci && process.env.GITHUB_EVENT_NAME === "pull_request" && pr === null)
    throw new Error("PR UI 증거 번호 누락");
  await page.evaluate(() => document.fonts.ready);
  const geometry: Array<{ name: string; x: number; y: number; width: number; height: number }> = [];
  for (const element of input.elements) {
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(element.name) || geometry.some(rect => rect.name === element.name))
      throw new Error("UI geometry 식별자 오류");
    const rect = await element.locator.boundingBox();
    if (!rect || rect.width <= 0 || rect.height <= 0) throw new Error("화면 geometry 누락: " + element.name);
    geometry.push({ name: element.name, x: rect.x, y: rect.y, width: rect.width, height: rect.height });
  }
  const viewport = page.viewportSize();
  if (!viewport) throw new Error("UI 증거에는 고정 viewport 필요");
  const rendering = await page.evaluate(() => ({
    font: getComputedStyle(document.body).fontFamily,
    theme: document.documentElement.dataset.theme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"),
    deviceScaleFactor: devicePixelRatio,
    cssZoom: getComputedStyle(document.documentElement).zoom || "1",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    documentLocale: document.documentElement.lang,
    observedTime: new Date().toISOString(),
  }));
  const browser = page.context().browser();
  if (!browser || browser.browserType().name() !== "chromium") throw new Error("Chromium UI 증거만 지원");
  const screenshotName = "ui-evidence-" + input.state + ".png";
  const png = await page.screenshot({ animations: "disabled" });
  const pngPath = info.outputPath(screenshotName);
  await writeFile(pngPath, png);
  const geometryName = "geometry-" + input.state + ".json";
  const geometryBytes = JSON.stringify(geometry, null, 2) + "\n";
  await writeFile(info.outputPath(geometryName), geometryBytes, "utf8");
  const fixtureName = "fixture-" + input.state + ".json";
  const fixtureBytes = JSON.stringify(input.fixtureData ?? { name: input.fixture }, null, 2) + "\n";
  await writeFile(info.outputPath(fixtureName), fixtureBytes, "utf8");
  const manifest = {
    schema: "mastergantt-ui-evidence/v2",
    verdict: "OBSERVED_NOT_APPROVED",
    issue: input.issue, sourceSha, baselineSha, testMergeSha,
    provenance: {
      kind: ci ? "github-actions" : "local", pr,
      repository: process.env.GITHUB_REPOSITORY || "local",
      runId: ci ? Number(process.env.GITHUB_RUN_ID) : null,
      runAttempt: ci ? Number(process.env.GITHUB_RUN_ATTEMPT) : null,
      workingTreeDirty: git("status", "--porcelain").length > 0,
      // 원본 diff/비밀값을 공개하지 않고 로컬 수정 여부를 결부한다.
      workingDiffSha256: sha256(execFileSync("git", ["diff", "--binary", "HEAD"])),
      testSourceSha256: sha256(await readFile(info.file)),
      helperSourceSha256: sha256(await readFile(__filename)),
    },
    test: { id: info.testId, title: info.title, project: info.project.name,
      // 수집 이후의 테스트 실패는 최종 Playwright report로 판단한다.
      outcome: "CAPTURED_BEFORE_TEST_COMPLETION" },
    captureDurationMs: Math.round(performance.now() - captureStarted),
    checks: input.checks ?? [],
    flow: input.flow ?? { id: input.state, steps: [], outcome: "NOT TESTED" },
    exclusions: input.exclusions ?? [{ scope: "manual-ui-acceptance", reason: "Owner 화면 수용은 별도 검토 필요" }],
    ownerReview: "NOT TESTED",
    acceptanceCriteria: [...input.acceptanceCriteria], state: input.state,
    fixture: { kind: "synthetic", name: input.fixture,
      scope: input.fixtureData === undefined ? "DECLARATION_ONLY" : "DATA_CAPTURED",
      file: fixtureName, sha256: sha256(fixtureBytes) },
    environment: { browser: "chromium", browserVersion: browser.version(),
      playwrightVersion: info.config.version, os: platform(), osRelease: release(),
      locale: input.locale, viewport, ...rendering },
    geometry, geometryFile: { name: geometryName, sha256: sha256(geometryBytes) },
    screenshot: { name: screenshotName, sha256: sha256(png) },
  };
  const jsonPath = info.outputPath("ui-evidence-" + input.state + ".json");
  await writeFile(jsonPath, JSON.stringify(manifest, null, 2) + "\n", "utf8");
  await info.attach("합성 UI PNG 증거 " + input.state, { path: pngPath, contentType: "image/png" });
  await info.attach("합성 UI JSON 증거 " + input.state, { path: jsonPath, contentType: "application/json" });
}
