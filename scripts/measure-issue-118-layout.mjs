import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const [baseURL, label, outputArg] = process.argv.slice(2);
if (!baseURL || !label || !outputArg) {
  console.error("사용법: node scripts/measure-issue-118-layout.mjs <baseURL> <label> <outputDir>");
  process.exit(2);
}

const outputDir = resolve(outputArg);
await mkdir(outputDir, { recursive: true });

const publicId = "a3405d3d-8cb4-4da4-9b0f-43a5de330003";
const projectPath = `/api/projects/${publicId}`;
const longTitle = "아주 긴 프로젝트 이름 ".repeat(18);
const longDescription = "긴 설명 ".repeat(300);
const viewports = [390, 768, 1024, 1440].map((width) => ({ width, height: 844 }));

function makeTasks() {
  return [
    {
      taskId: "00000000-0000-4000-8000-000000000001",
      externalId: "SUMMARY-1",
      name: "Stable summary",
      description: "",
      type: "summary",
      scheduleMode: "auto",
      requestedStart: null,
      start: "2026-01-05",
      end: "2026-01-06",
      duration: 2,
      progress: 25,
      parentExternalId: null,
      siblingOrder: 0,
    },
    {
      taskId: "00000000-0000-4000-8000-000000000002",
      externalId: "SUMMARY-CHILD-1",
      name: "Existing summary child",
      description: "",
      type: "task",
      scheduleMode: "auto",
      requestedStart: "2026-01-05",
      start: "2026-01-05",
      end: "2026-01-06",
      duration: 2,
      progress: 25,
      parentExternalId: "SUMMARY-1",
      siblingOrder: 0,
    },
    {
      taskId: "00000000-0000-4000-8000-000000000003",
      externalId: "LEAF-1",
      name: "Stable leaf",
      description: "",
      type: "task",
      scheduleMode: "auto",
      requestedStart: "2026-09-16",
      start: "2026-09-16",
      end: "2026-09-16",
      duration: 1,
      progress: 0,
      parentExternalId: null,
      siblingOrder: 1,
    },
    {
      taskId: "00000000-0000-4000-8000-000000000004",
      externalId: "MILESTONE-1",
      name: "Stable milestone",
      description: "",
      type: "milestone",
      scheduleMode: "auto",
      requestedStart: "2026-12-18",
      start: "2026-12-18",
      end: "2026-12-18",
      duration: 0,
      progress: 0,
      parentExternalId: null,
      siblingOrder: 2,
    },
  ];
}

function rectToJson(rect) {
  if (!rect) return null;
  return {
    x: Math.round(rect.x * 100) / 100,
    y: Math.round(rect.y * 100) / 100,
    width: Math.round(rect.width * 100) / 100,
    height: Math.round(rect.height * 100) / 100,
  };
}

async function installFixture(page, editing) {
  const project = {
    publicId,
    name: longTitle,
    description: longDescription,
    revision: 40,
    calendar: { timezone: "Asia/Seoul", weekendDays: [6, 0], holidays: [] },
  };
  const tasks = makeTasks();

  await page.route("**/api/projects/**", async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    if (pathname === `${projectPath}/edit-sessions/current` && request.method() === "GET") {
      await route.fulfill({
        json: editing
          ? { data: { permission: "edit", expiresAt: "2099-01-01T00:00:00.000Z" } }
          : { data: { permission: "readonly" } },
      });
      return;
    }
    if (pathname === projectPath && request.method() === "GET") {
      await route.fulfill({
        json: { data: { project, tasks, links: [], assignments: [], permission: "readonly" } },
      });
      return;
    }
    if (pathname === `${projectPath}/work-calendar` && request.method() === "GET") {
      await route.fulfill({ json: { data: { projectRevision: project.revision, rules: [], projectDates: [] } } });
      return;
    }
    if (pathname === `${projectPath}/assignment-targets` && request.method() === "GET") {
      await route.fulfill({ json: { data: { catalogRevision: 1, targets: [] } } });
      return;
    }
    if (pathname === `${projectPath}/assigned-targets` && request.method() === "GET") {
      await route.fulfill({ json: { data: { projectRevision: project.revision, catalogRevision: 1, assignments: [], targets: [] } } });
      return;
    }
    if (pathname === `${projectPath}/resource-workload` && request.method() === "GET") {
      await route.fulfill({
        json: {
          data: {
            projectRevision: project.revision,
            catalogRevision: 1,
            range: { from: "2026-09-01", to: "2026-09-30" },
            mdPerMm: 20,
            grandTotalMd: 0,
            grandTotalMm: 0,
            unsetCount: 0,
            groups: [],
          },
        },
      });
      return;
    }
    await route.continue();
  });
}

const browser = await chromium.launch({ headless: true });
const results = [];

try {
  for (const viewport of viewports) {
    for (const editing of [true, false]) {
      const context = await browser.newContext({ viewport });
      const page = await context.newPage();
      await installFixture(page, editing);
      await page.goto(`${baseURL}/projects/${publicId}`, { waitUntil: "domcontentloaded" });

      const expectedState = editing ? "편집 중" : "읽기 전용";
      await page.getByText(expectedState, { exact: true }).waitFor({ state: "visible", timeout: 30_000 });

      const contextBar = page.locator(".project-context-bar");
      const toolbar = page.getByRole("toolbar", { name: "작업 검색과 필터" });
      const gantt = page.locator(".project-gantt-frame").first();
      const info = page.locator(".project-info-popover > summary").first();

      await contextBar.waitFor({ state: "visible", timeout: 30_000 });
      await toolbar.waitFor({ state: "visible", timeout: 30_000 });
      await gantt.waitFor({ state: "visible", timeout: 30_000 });
      await info.waitFor({ state: "visible", timeout: 30_000 });

      const [contextRect, toolbarRect, ganttRect, infoRect] = await Promise.all([
        contextBar.boundingBox(),
        toolbar.boundingBox(),
        gantt.boundingBox(),
        info.boundingBox(),
      ]);
      if (!ganttRect) throw new Error(`Gantt 영역을 찾을 수 없습니다: ${viewport.width}px ${expectedState}`);

      const ganttVisibleHeight = Math.max(
        0,
        Math.min(viewport.height, ganttRect.y + ganttRect.height) - Math.max(0, ganttRect.y),
      );
      const documentOverflowX = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      );
      const infoLineCount = await info.evaluate((element) => {
        const range = document.createRange();
        range.selectNodeContents(element);
        return range.getClientRects().length;
      });

      const state = editing ? "edit" : "readonly";
      const screenshot = `${label}-${viewport.width}x${viewport.height}-${state}.png`;
      await page.screenshot({ path: resolve(outputDir, screenshot), fullPage: true });

      results.push({
        label,
        viewport,
        state,
        context: rectToJson(contextRect),
        toolbar: rectToJson(toolbarRect),
        gantt: rectToJson(ganttRect),
        ganttVisibleHeight: Math.round(ganttVisibleHeight * 100) / 100,
        info: rectToJson(infoRect),
        infoLineCount,
        documentOverflowX,
        screenshot,
      });
      await context.close();
    }
  }
} finally {
  await browser.close();
}

await writeFile(resolve(outputDir, "metrics.json"), JSON.stringify(results, null, 2) + "\n", "utf8");
console.log(JSON.stringify(results, null, 2));
