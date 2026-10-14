import { mkdir, writeFile } from "node:fs/promises";
import type { Locator, Page } from "@playwright/test";
import type { ResourceDashboardDto } from "../../src/contracts/resource-dashboard";
import { expect, isolatedApplicationOptions, test } from "./fixtures/isolated-application";
import { targetMasterPassword } from "./fixtures/target-project";
import { chooseTaskInformation } from "./helpers/task-context-menu";
import { issue621ResourcePassword, seedIssue621 } from "./fixtures/issue-621-target-project";

test.use({ ...isolatedApplicationOptions, isolatedProjectMasterAdminPassword: targetMasterPassword, isolatedResourceAdminPassword: issue621ResourcePassword, viewport: { width: 1440, height: 900 } });

async function openResource(page: Page) {
  await page.getByRole("tab", { name: "리소스", exact: true }).click();
  const root = page.locator('[data-resource-dashboard="true"]:visible');
  await expect(root).toHaveAttribute("data-ready", "true");
  await root.getByLabel("기간 시작", { exact: true }).fill("2026-10-14");
  await root.getByLabel("기간 종료", { exact: true }).fill("2026-10-15");
  await expect(root).toHaveAttribute("data-ready", "true");
  return root;
}
async function taskEditor(page: Page) {
  const editor = page.getByRole("dialog", { name: "작업 정보", exact: true });
  await expect(editor).toBeVisible();
  return editor;
}
async function openShared(root: Locator) {
  await root.getByLabel("리소스 보기", { exact: true }).selectOption("targets");
  await root.getByLabel("Target 표시", { exact: true }).selectOption("matrix");
  await root.getByRole("region", { name: "Resource Target 비교표", exact: true }).locator("tbody td button").first().click();
  await expect(root.locator(".resource-dashboard-detail")).toHaveAttribute("data-detail-state", "ready");
  await root.locator(".resource-dashboard-detail").getByRole("button", { name: "통합 시운전", exact: true }).first().click();
}

test("#621 실제 HTTP union 총계·두 Target 공유 identity·페이지·권한/412·조회 mutation0", async ({ page, browser, isolatedApplication: origin }, info) => {
  test.setTimeout(180_000);
  page.setDefaultTimeout(15_000);
  const f = await seedIssue621(page, origin);
  const before = await f.snapshot();
  const report = await f.report();
  expect(report.summary).toMatchObject({ taskCount: 2, assignmentCount: 3, effort: { knownMd: 3, unsetCount: 1, state: "partial", plannedMm: null } });
  expect(report.targetProjection!.metadata.subtotalsAdditive).toBe(false);
  for (const projectionOrder of ["target,group,resource", "resource,group,target"]) expect((await f.report({ projectionOrder })).summary).toEqual(report.summary);
  const a = await f.report({ targetIds: f.targets[0].id });
  const b = await f.report({ targetIds: f.targets[1].id });
  expect(a.summary.effort.knownMd + b.summary.effort.knownMd).toBe(6);
  expect((await f.report({ targetIds: f.targets.map(row => row.id).join(",") })).summary).toEqual(report.summary);
  const first = await f.details(report, { limit: "1" });
  const second = await f.details(report, { limit: "1", offset: "1" });
  expect(first.totalCount).toBe(3); expect(first.nextOffset).toBe(1);
  expect(second.rows[0].assignment!.assignmentId).not.toBe(first.rows[0].assignment!.assignmentId);
  expect((await f.report()).summary).toEqual(report.summary);
  const exactId = (await f.details(report)).rows.find(row => row.taskId === f.task.taskId && row.assignment?.resourceId === f.resources[0].id)!.assignment!.assignmentId;
  for (const target of f.targets) {
    const exactResponse = await page.request.post(`${f.api}/resource-dashboard/query`, { headers: { Origin: origin }, data: {
      sourceContext: report.resourceScopeContext!, scope: { kind: "exactAssignments", assignmentIds: [exactId] },
      filters: { from: "2026-10-14", to: "2026-10-15", mdPerMm: null, targetIds: [target.id], projectionOrder: ["resource", "target"] }, projection: { kind: "report" },
    } });
    expect(exactResponse.status(), await exactResponse.text()).toBe(200);
    const exactReport = (await exactResponse.json()).data as ResourceDashboardDto;
    expect(exactReport.summary).toMatchObject({ assignmentCount: 1, resourceCount: 1, taskCount: 1, effort: { knownMd: 2 } });
    const exactTarget = exactReport.targetProjection!.children[0].children.find(node => node.id === target.id)!;
    const exactDetail = await page.request.post(`${f.api}/resource-dashboard/query`, { headers: { Origin: origin }, data: {
      sourceContext: report.resourceScopeContext!, scope: { kind: "exactAssignments", assignmentIds: [exactId] },
      filters: { from: "2026-10-14", to: "2026-10-15", mdPerMm: null, targetIds: [target.id], projectionOrder: ["resource", "target"] },
      projection: { kind: "details", snapshotId: exactReport.snapshotId, selector: exactTarget.summary.selector, view: "assignments", offset: 0, limit: 50 },
    } });
    expect(exactDetail.status(), await exactDetail.text()).toBe(200);
    const exactRows = (await exactDetail.json()).data;
    expect(exactRows.totalCount).toBe(1);
    expect(exactRows.rows[0].assignment.assignmentId).toBe(exactId);
  }
  const readonly = await browser.newContext({ baseURL: origin });
  try {
    const response = await readonly.request.patch(`${f.api}/tasks/${f.task.taskId}`, { headers: { Origin: origin, "If-Match": `"${before.data.project.revision}"` }, data: { name: "Denied" } });
    expect(response.status()).toBe(401);
    const wrongScope = await page.request.patch(`${f.api}/tasks/${f.targets[0].id}`, { headers: { Origin: origin, "If-Match": `"${before.data.project.revision}"` }, data: { name: "Virtual target must not become task" } });
    expect(wrongScope.status()).toBe(404);
    const stale = await page.request.patch(`${f.api}/tasks/${f.task.taskId}`, { headers: { Origin: origin, "If-Match": '"1"' }, data: { name: "Stale" } });
    expect(stale.status()).toBe(412);
    expect(await f.snapshot()).toEqual(before);
    const publicPage = await readonly.newPage();
    await publicPage.goto(`/projects/${f.publicId}`);
    const root = await openResource(publicPage);
    await openShared(root);
    const editor = await taskEditor(publicPage);
    await expect(editor.getByLabel("작업명", { exact: true })).toHaveJSProperty("readOnly", true);
    await editor.getByRole("button", { name: "작업 편집기 닫기", exact: true }).click();
    expect(await f.snapshot()).toEqual(before);
  } finally { await readonly.close(); }
  await info.attach("issue621-http-union", { contentType: "application/json", body: JSON.stringify({ summary: report.summary, a: a.summary, b: b.summary, taskId: f.task.taskId, assignmentIds: [first, second].map(detail => detail.rows[0].assignment!.assignmentId) }) });
});

test("#621 Resource 동일 Task 저장1·복제0·WBS/Target A/B 역방향 갱신·dirty/pending", async ({ page, isolatedApplication: origin }, info) => {
  test.setTimeout(180_000);
  page.setDefaultTimeout(15_000);
  const f = await seedIssue621(page, origin);
  const before = await f.snapshot();
  const frame = page.locator(".project-gantt-frame");
  const instance = await frame.getAttribute("data-project-gantt-instance");
  const writes: { method: string; path: string }[] = [];
  page.on("request", request => { const path = new URL(request.url()).pathname; if (path.startsWith(`/api/projects/${f.publicId}`) && ["POST", "PUT", "PATCH", "DELETE"].includes(request.method()) && !path.endsWith("/resource-dashboard/query")) writes.push({ method: request.method(), path }); });
  const root = await openResource(page);
  await openShared(root);
  const editor = await taskEditor(page);
  await editor.getByLabel("작업명", { exact: true }).fill("Resource에서 수정한 같은 원본");
  await page.keyboard.press("Escape");
  await expect(editor).toBeVisible();
  await page.getByRole("button", { name: "계속 편집", exact: true }).click();
  await expect(editor.getByLabel("작업명", { exact: true })).toHaveValue("Resource에서 수정한 같은 원본");
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route(`**/api/projects/${f.publicId}/tasks/${f.task.taskId}`, async route => { if (route.request().method() === "PATCH") await gate; await route.continue(); });
  await editor.getByRole("button", { name: "저장", exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(editor).toBeVisible();
  await expect(editor.getByLabel("작업명", { exact: true })).toBeDisabled();
  expect(writes).toHaveLength(1);
  release();
  await expect(editor).toHaveCount(0);
  await page.unroute(`**/api/projects/${f.publicId}/tasks/${f.task.taskId}`);
  const changed = await f.snapshot();
  expect(changed.data.tasks).toHaveLength(before.data.tasks.length);
  expect(changed.data.tasks.find(task => task.taskId === f.task.taskId)!.name).toBe("Resource에서 수정한 같은 원본");
  for (const target of f.targets) {
    const report = await f.report({ targetIds: target.id });
    const detail = await f.details(report, { targetIds: target.id });
    expect(detail.rows.filter(row => row.taskId === f.task.taskId).map(row => row.taskName)).toEqual(["Resource에서 수정한 같은 원본", "Resource에서 수정한 같은 원본"]);
  }
  await expect(frame).toHaveAttribute("data-project-gantt-instance", instance!);
  await page.getByRole("tab", { name: "일정", exact: true }).click();
  await expect(frame.locator(`.wx-row[data-id=":${f.task.taskId}"]`).first()).toContainText("Resource에서 수정한 같은 원본");
  await frame.locator(`.wx-row[data-id=":${f.task.taskId}"]`).first().click({ button: "right" });
  await chooseTaskInformation(page);
  await editor.getByLabel("작업명", { exact: true }).fill("WBS에서 갱신한 같은 원본");
  await editor.getByRole("button", { name: "저장", exact: true }).click();
  await expect(editor).toHaveCount(0);
  await expect(frame).toHaveAttribute("data-project-gantt-instance", instance!);
  await openResource(page);
  await root.locator(".resource-dashboard-kpis > div").filter({ hasText: /^할당 Task/ }).getByRole("button").click();
  await expect(root.locator(".resource-dashboard-detail")).toContainText("WBS에서 갱신한 같은 원본");
  expect((await f.snapshot()).data.tasks).toHaveLength(before.data.tasks.length);
  await info.attach("issue621-canonical-identity", { contentType: "application/json", body: JSON.stringify({ taskId: f.task.taskId, resourceUiWrites: writes, taskCount: changed.data.tasks.length, instance }) });
});

test("#621 Target 계층/비교표 server 총계·5폭 내부 scroll·native keyboard·조회 mutation0·remount0", async ({ page, isolatedApplication: origin }, info) => {
  test.setTimeout(180_000);
  page.setDefaultTimeout(15_000);
  const f = await seedIssue621(page, origin, true);
  const before = await f.snapshot();
  const frame = page.locator(".project-gantt-frame");
  const instance = await frame.getAttribute("data-project-gantt-instance");
  await expect(frame.locator(".wx-gantt")).toBeVisible();
  const coreNode = await frame.locator(".wx-gantt").elementHandle();
  const coreApiInstance = await frame.getAttribute("data-project-gantt-api-instance");
  const writes: string[] = [];
  const reports: ResourceDashboardDto[] = [];
  const boundQueries: unknown[] = [];
  const navigationNetwork: unknown[] = [];
  page.on("request", request => { if (new URL(request.url()).pathname.includes("/resource-dashboard")) navigationNetwork.push({ at: Date.now(), phase: "request", path: new URL(request.url()).pathname, method: request.method() }); });
  page.on("response", response => { if (new URL(response.url()).pathname.includes("/resource-dashboard")) navigationNetwork.push({ at: Date.now(), phase: "response", path: new URL(response.url()).pathname, status: response.status() }); });
  page.on("request", request => { if (request.method() === "POST" && new URL(request.url()).pathname.endsWith("/resource-dashboard/query")) { const body = request.postDataJSON(); boundQueries.push({ scope: body.scope, filters: body.filters, projection: body.projection }); } });
  page.on("request", request => { if (/\/api\/projects\//.test(request.url()) && ["POST", "PATCH", "PUT", "DELETE"].includes(request.method()) && !new URL(request.url()).pathname.endsWith("/resource-dashboard/query")) writes.push(request.method() + " " + new URL(request.url()).pathname); });
  page.on("response", async response => { if (new URL(response.url()).pathname === `/api/projects/${f.publicId}/resource-dashboard` && response.ok()) { const body = await response.json().catch(() => null); if (body) reports.push(body.data); } });
  const root = await openResource(page);
  await root.getByLabel("리소스 보기", { exact: true }).selectOption("targets");
  await expect(root.getByTestId("resource-target-view")).toBeVisible();
  await expect(root).toHaveAttribute("data-ready", "true");
  const server = await f.report();
  for (const order of ["resource", "target"]) {
    await root.getByLabel("Target 집계 순서", { exact: true }).selectOption(order);
    await expect(root).toHaveAttribute("data-ready", "true");
    await expect.poll(() => reports.at(-1)?.summary.effort.knownMd).toBe(server.summary.effort.knownMd);
    const tree = root.getByRole("region", { name: "Resource Target 계층", exact: true });
    const disclosure = tree.locator("button[aria-expanded]").first();
    await disclosure.focus(); await page.keyboard.press("Enter");
    const expanded = await disclosure.getAttribute("aria-expanded");
    await page.keyboard.press("Space");
    await expect(disclosure).toHaveAttribute("aria-expanded", expanded === "true" ? "false" : "true");
    await expect(root.getByLabel("선택 범위 KPI", { exact: true })).toContainText("3.00");
  }
  await root.getByLabel("Target 표시", { exact: true }).selectOption("matrix");
  await root.getByRole("button", { name: "다음 Target 열", exact: true }).click();
  await expect(root.getByTestId("resource-target-view")).toContainText("5개 Target 열 중 5–5");
  await expect(root.getByTestId("resource-target-view")).toContainText("선택 전체: 3.00");
  await root.getByRole("button", { name: "이전 Target 열", exact: true }).click();
  await root.getByLabel("Target 정렬", { exact: true }).selectOption("name");
  await root.getByLabel("Target 지표", { exact: true }).selectOption("tasks");
  await expect(root.getByTestId("resource-target-view")).toContainText("선택 전체: 3.00");
  await root.getByLabel("Target 지표", { exact: true }).selectOption("effort");
  const geometry = [];
  await mkdir("output/playwright/issue-621", { recursive: true });
  for (const mode of ["resource", "group"]) {
    await root.getByLabel("Target 비교 행", { exact: true }).selectOption(mode);
    const region = root.getByRole("region", { name: "Resource Target 비교표", exact: true });
    await expect(region.locator("tbody tr")).toHaveCount(2);
    for (const width of [390, 768, 1024, 1440, 1920]) {
      await page.setViewportSize({ width, height: 900 });
      await region.scrollIntoViewIfNeeded();
      const first = region.locator("tbody td button").first();
      await first.focus(); await page.keyboard.press("Tab");
      const observation = await region.evaluate(owner => {
        const active = document.activeElement as HTMLElement, box = active.getBoundingClientRect(), bounds = owner.getBoundingClientRect(), style = getComputedStyle(active);
        const ring = parseFloat(style.outlineWidth) + parseFloat(style.outlineOffset);
        const headers = [...owner.querySelectorAll("thead th")], cells = [...owner.querySelectorAll("tbody tr:first-child > *")];
        return { width: innerWidth, documentWidth: document.documentElement.scrollWidth, clientWidth: owner.clientWidth, scrollWidth: owner.scrollWidth, overflow: getComputedStyle(owner).overflowX,
          aligned: headers.every((header, index) => Math.abs(header.getBoundingClientRect().width - cells[index].getBoundingClientRect().width) < 1),
          contained: [...owner.querySelectorAll("td button")].every(button => { const b = button.getBoundingClientRect(), c = button.closest("td")!.getBoundingClientRect(); return b.left >= c.left - 1 && b.right <= c.right + 1; }),
          focus: { tag: active.tagName, left: box.left - ring, right: box.right + ring, ownerLeft: bounds.left, ownerRight: bounds.right, stickyRight: owner.querySelector("tbody th")!.getBoundingClientRect().right, painted: active.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)) } };
      });
      expect(observation.documentWidth).toBeLessThanOrEqual(width + 1);
      expect(observation.aligned).toBe(true); expect(observation.contained).toBe(true);
      expect(observation.focus.tag).toBe("BUTTON"); expect(observation.focus.painted, JSON.stringify(observation)).toBe(true);
      expect(observation.focus.left, JSON.stringify(observation)).toBeGreaterThanOrEqual(Math.max(observation.focus.ownerLeft, observation.focus.stickyRight));
      expect(observation.focus.right).toBeLessThanOrEqual(observation.focus.ownerRight + 1);
      if (width === 390) expect(observation.scrollWidth).toBeGreaterThan(observation.clientWidth);
      geometry.push({ mode, ...observation });
      if (mode === "resource" && [390, 1440].includes(width)) await page.screenshot({ path: `output/playwright/issue-621/target-matrix-${width}.png`, fullPage: true });
    }
  }
  await writeFile("output/playwright/issue-621/matrix-geometry.json", JSON.stringify(geometry, null, 2));
  await writeFile("output/playwright/issue-621/environment.json", JSON.stringify({ capturedAt: new Date().toISOString(), browser: page.context().browser()?.version(), widths: [390, 768, 1024, 1440, 1920], zoom: "default100%; native125% NOT TESTED", ...await page.evaluate(() => ({ locale: navigator.language, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone })) }, null, 2));
  await page.setViewportSize({ width: 1440, height: 900 });
  await root.getByLabel("Target", { exact: true }).selectOption(f.targets[1].id);
  await expect(root).toHaveAttribute("data-ready", "true");
  await expect.poll(() => reports.at(-1)?.summary.assignmentCount).toBe(2);
  expect(writes).toEqual([]); expect(await f.snapshot()).toEqual(before);
  await expect(frame).toHaveAttribute("data-project-gantt-instance", instance!);
  const scheduleSource = root.getByRole("region", { name: "Resource Target 비교표", exact: true }).locator("tbody td button").first();
  await scheduleSource.focus(); await page.keyboard.press("Enter");
  const schedule = root.locator(".resource-dashboard-detail").getByRole("button", { name: "이 Task 일정", exact: true }).first();
  const scheduleOrigin = await schedule.elementHandle();
  const originDescriptor = await scheduleOrigin!.evaluate(element => ({ detailKey: element.closest<HTMLElement>("[data-projection-detail-key]")?.dataset.projectionDetailKey, taskId: element.closest<HTMLElement>("[data-canonical-task-id]")?.dataset.canonicalTaskId, assignmentId: element.closest<HTMLElement>("[data-canonical-assignment-id]")?.dataset.canonicalAssignmentId, action: element.dataset.resourceAction }));
  const exactAssignmentId = (await f.details(await f.report())).rows.find(row => row.taskId === f.task.taskId && row.assignment?.resourceId === f.resources[0].id)!.assignment!.assignmentId;
  await schedule.click();
  await expect(page.getByRole("tab", { name: "일정", exact: true })).toHaveAttribute("aria-selected", "true");
  const source = page.getByRole("region", { name: "임시 조회 범위", exact: true });
  await expect(source).toContainText("Assignment");
  await frame.locator(`input[data-copy-selection="${f.task.taskId}"]`).check();
  await page.getByRole("button", { name: "선택 Task의 모든 개인 담당 조회", exact: true }).click();
  await expect(root).toHaveAttribute("data-ready", "true");
  await root.getByLabel("리소스 보기", { exact: true }).selectOption("targets");
  await root.getByRole("button", { name: /^필터(?: \d+)?$/ }).click();
  await root.getByLabel("개인 선택", { exact: true }).selectOption(f.resources[0].id);
  await root.getByLabel("Target", { exact: true }).selectOption(f.targets[1].id);
  await expect(root).toHaveAttribute("data-ready", "true");
  await expect(root.getByTestId("resource-target-view")).toContainText("Assignment 1");
  await root.getByLabel("Target 표시", { exact: true }).selectOption("matrix");
  await root.getByRole("region", { name: "Resource Target 비교표", exact: true }).locator("tbody td button").first().click();
  await expect(root.locator(".resource-dashboard-detail tbody tr")).toHaveCount(1);
  await expect(root.locator(".resource-dashboard-detail tbody tr")).toHaveAttribute("data-canonical-assignment-id", exactAssignmentId!);
  await page.evaluate(() => {
    const entries: unknown[] = [];
    let last = "";
    const record = (kind: string) => {
      const active = document.activeElement as HTMLElement;
      const contexts = [...document.querySelectorAll<HTMLElement>("[data-resource-context-id]")].map(node => ({ id: node.dataset.resourceContextId, hidden: node.hidden, ready: node.querySelector("[data-ready]")?.getAttribute("data-ready"), detail: [...node.querySelectorAll("[data-detail-state]")].map(el => el.getAttribute("data-detail-state")) }));
      const value = { tag: active?.tagName, text: active?.textContent?.slice(0, 80), action: active?.dataset.resourceAction, taskId: active?.closest<HTMLElement>("[data-canonical-task-id]")?.dataset.canonicalTaskId, assignmentId: active?.closest<HTMLElement>("[data-canonical-assignment-id]")?.dataset.canonicalAssignmentId, contexts };
      const signature = JSON.stringify(value);
      if ((signature !== last || kind === "focusin") && entries.length < 200) { entries.push({ at: Date.now(), kind, ...value }); last = signature; }
    };
    const focus = () => record("focusin");
    const observer = new MutationObserver(() => record("mutation"));
    document.addEventListener("focusin", focus, true);
    observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["data-ready", "data-detail-state", "hidden", "inert"] });
    (window as unknown as { issue621FocusProbe: { entries: unknown[]; stop: () => void } }).issue621FocusProbe = { entries, stop: () => { observer.disconnect(); document.removeEventListener("focusin", focus, true); } };
    record("start");
  });
  await source.getByRole("button", { name: /원래 보기/ }).click();
  await expect(page.getByRole("tab", { name: "일정", exact: true })).toHaveAttribute("aria-selected", "true");
  await source.getByRole("button", { name: /원래 보기/ }).click();
  await expect(page.getByRole("tab", { name: "리소스", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(root.getByLabel("Target", { exact: true })).toHaveValue(f.targets[1].id);
  await writeFile("output/playwright/issue-621/source-scope-evidence.json", JSON.stringify(boundQueries, null, 2));
  const returnFocus = {
    original: { ...originDescriptor, connected: await scheduleOrigin!.evaluate(element => element.isConnected) },
    current: await schedule.evaluate(element => ({ detailKey: element.closest<HTMLElement>("[data-projection-detail-key]")?.dataset.projectionDetailKey, taskId: element.closest<HTMLElement>("[data-canonical-task-id]")?.dataset.canonicalTaskId, assignmentId: element.closest<HTMLElement>("[data-canonical-assignment-id]")?.dataset.canonicalAssignmentId, action: element.dataset.resourceAction })),
    focus: await page.evaluate(() => ({ active: document.activeElement?.outerHTML.slice(0, 500), contexts: [...document.querySelectorAll<HTMLElement>("[data-resource-context-id]")].map(node => ({ id: node.dataset.resourceContextId, hidden: node.hidden, ready: node.querySelector("[data-ready]")?.getAttribute("data-ready") })) })),
  };
  await info.attach("issue621-schedule-origin-dom", { contentType: "application/json", body: JSON.stringify(returnFocus) });
  await writeFile("output/playwright/issue-621/return-focus-diagnostic.json", JSON.stringify(returnFocus, null, 2));
  try { await expect(schedule).toBeFocused(); }
  finally {
    const timeline = await page.evaluate(() => { const probe = (window as unknown as { issue621FocusProbe: { entries: unknown[]; stop: () => void } }).issue621FocusProbe; probe.stop(); return probe.entries; });
    await writeFile("output/playwright/issue-621/return-focus-timeline.json", JSON.stringify({ timeline, network: navigationNetwork }, null, 2));
    await info.attach("issue621-return-focus-timeline", { contentType: "application/json", body: JSON.stringify({ timeline, network: navigationNetwork }) });
  }
  await expect(frame).toHaveAttribute("data-project-gantt-instance", instance!);
  // A new keyboard focus while the return report is pending owns the destination.
  await schedule.click();
  await expect(page.getByRole("tab", { name: "일정", exact: true })).toHaveAttribute("aria-selected", "true");
  let releaseReturn!: () => void;
  let returnStarted!: () => void;
  const returnGate = new Promise<void>(resolve => { releaseReturn = resolve; });
  const returnRequest = new Promise<void>(resolve => { returnStarted = resolve; });
  let intercepted = false;
  await page.route(`**/api/projects/${f.publicId}/resource-dashboard?**`, async route => {
    if (intercepted) return route.continue();
    intercepted = true; returnStarted();
    await returnGate; await route.continue();
  });
  await source.getByRole("button", { name: /원래 보기/ }).click();
  await returnRequest;
  const newFocus = root.getByLabel("리소스·그룹·Task 이름과 코드 검색", { exact: true });
  await newFocus.focus(); await page.keyboard.press("ArrowRight");
  releaseReturn();
  await expect(root).toHaveAttribute("data-ready", "true");
  await expect(root.locator(".resource-dashboard-detail")).toHaveAttribute("data-detail-state", "ready");
  await expect(newFocus).toBeFocused();
  await page.unroute(`**/api/projects/${f.publicId}/resource-dashboard?**`);
  for (const view of ["tree", "matrix", "plan", "summary"]) {
    await root.getByLabel("리소스 보기", { exact: true }).selectOption(view);
    await expect(root).toHaveAttribute("data-ready", "true");
  }
  expect(await f.snapshot()).toEqual(before);
  await root.getByLabel("리소스 보기", { exact: true }).selectOption("targets");
  await root.getByLabel("Target", { exact: true }).selectOption("");
  await root.getByLabel("Target 표시", { exact: true }).selectOption("tree");
  await root.getByLabel("Target 집계 순서", { exact: true }).selectOption("target");
  const targetBranch = root.getByRole("region", { name: "Resource Target 계층", exact: true }).locator(`tbody[data-projection-row-key*="${f.targets[0].id}"]`).first();
  await targetBranch.getByRole("button", { name: "대상 구성 편집", exact: true }).first().click();
  const composer = page.getByRole("dialog", { name: "Target 수정", exact: true });
  await expect(composer.getByLabel("Target 이름", { exact: true })).toHaveValue(f.targets[0].name);
  await expect(composer.getByLabel("Target 코드", { exact: true })).toHaveValue(f.targets[0].code);
  await page.keyboard.press("Escape");
  await expect(composer).toHaveCount(0);
  await page.getByRole("button", { name: "Resource 보기로 돌아가기", exact: true }).click();
  await expect(page.getByRole("tab", { name: "리소스", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(frame).toHaveAttribute("data-project-gantt-instance", instance!);
  expect(writes).toEqual([]); expect(await f.snapshot()).toEqual(before);
  expect(await coreNode!.evaluate(element => element.isConnected)).toBe(true);
  if (coreApiInstance) await expect(frame).toHaveAttribute("data-project-gantt-api-instance", coreApiInstance);
  await info.attach("issue621-matrix-geometry", { contentType: "application/json", body: JSON.stringify(geometry) });
  await info.attach("issue621-source-bound-query-scopes", { contentType: "application/json", body: JSON.stringify(boundQueries) });
});

test("#621 Target exact Assignment 개인 수정·공동담당 불변·412/401 초안 보존", async ({ page, isolatedApplication: origin }, info) => {
  test.setTimeout(180_000);
  page.setDefaultTimeout(15_000);
  const f = await seedIssue621(page, origin);
  // A hidden co-assignee with unset allocation must not block this exact personal edit.
  const catalog = (await (await page.request.get(`${origin}/api/resources`)).json()).data;
  await f.mutate(`/tasks/${f.task.taskId}/assignments`, { catalogRevision: catalog.revision, targets: [
    { kind: "resource", id: f.resources[0].id, allocation: { start: null, end: null, percent: 100 } },
    { kind: "resource", id: f.resources[1].id },
  ] }, "put");
  await page.reload();
  const canonical = await f.snapshot();
  const before = (await (await page.request.get(`${f.api}/assigned-targets`)).json()).data;
  const alice = before.assignments.find((row: { taskId: string; target: { id: string } }) => row.taskId === f.task.taskId && row.target.id === f.resources[0].id);
  const bob = before.assignments.find((row: { taskId: string; target: { id: string } }) => row.taskId === f.task.taskId && row.target.id === f.resources[1].id);
  const root = await openResource(page);
  await root.getByLabel("리소스 보기", { exact: true }).selectOption("targets");
  await root.getByLabel("Target 표시", { exact: true }).selectOption("matrix");
  await root.getByRole("region", { name: "Resource Target 비교표", exact: true }).locator("tbody tr").filter({ hasText: f.resources[0].name }).locator("td button").first().click();
  const detail = root.locator(".resource-dashboard-detail");
  const row = detail.locator(`[data-canonical-task-id="${f.task.taskId}"][data-canonical-assignment-id="${alice.id}"]`);
  await expect(row).toBeVisible();
  const edit = row.getByRole("button", { name: `배정 편집: ${f.resources[0].name}`, exact: true });
  await edit.focus(); await page.keyboard.press("Enter");
  const editor = await taskEditor(page);
  await expect(editor.getByRole("tab", { name: /^리소스/ })).toHaveAttribute("aria-selected", "true");
  const allocation = editor.getByLabel(`리소스 1 ${f.resources[0].name} (${f.resources[0].code}) 투입률 (%)`, { exact: true });
  await expect(allocation).toHaveValue("100");
  await expect(editor.getByLabel(`리소스 2 ${f.resources[1].name} (${f.resources[1].code}) 투입률 (%)`, { exact: true })).toHaveCount(0);
  await allocation.fill("80");
  await editor.getByLabel(`리소스 1 ${f.resources[0].name} (${f.resources[0].code}) 투입 시작`, { exact: true }).fill("2026-10-14");
  await editor.getByLabel(`리소스 1 ${f.resources[0].name} (${f.resources[0].code}) 투입 종료`, { exact: true }).fill("2026-10-14");
  let failure: 401 | 412 | null = 412;
  let requests = 0;
  await page.route(`**/api/projects/${f.publicId}/tasks/${f.task.taskId}/assignments`, async route => {
    if (route.request().method() !== "PUT") return route.continue();
    requests += 1;
    if (failure) return route.fulfill({ status: failure, contentType: "application/json", body: JSON.stringify({ error: { code: failure === 412 ? "REVISION_CONFLICT" : "UNAUTHORIZED" } }) });
    await route.continue();
  });
  const save = editor.getByRole("button", { name: /^할당 저장 \(/ });
  await save.click();
  await expect(editor).toContainText("최신 정보를 다시 불러와 주세요");
  await expect(allocation).toHaveValue("80");
  expect((await f.snapshot()).data.project.revision).toBe(canonical.data.project.revision);
  failure = null;
  await save.click();
  await expect.poll(async () => (await (await page.request.get(`${f.api}/assigned-targets`)).json()).data.assignments.find((entry: { id: string }) => entry.id === alice.id)?.allocation.percent).toBe(80);
  const after = (await (await page.request.get(`${f.api}/assigned-targets`)).json()).data;
  expect(after.assignments.find((entry: { id: string }) => entry.id === bob.id)).toEqual(bob);
  expect(after.assignments.find((entry: { id: string }) => entry.id === alice.id)).toMatchObject({ taskId: f.task.taskId, allocation: { start: "2026-10-14", end: "2026-10-14", percent: 80 } });
  expect((await f.snapshot()).data.tasks).toHaveLength(canonical.data.tasks.length);
  await expect(allocation).toHaveValue("80");
  await editor.getByRole("button", { name: "작업 편집기 닫기", exact: true }).click();
  await expect(editor).toHaveCount(0);
  await expect(edit).toBeFocused();
  await edit.click();
  await expect(allocation).toHaveValue("80");
  await allocation.fill("70");
  failure = 401;
  await save.click();
  await expect(editor).toContainText("편집 권한이 없습니다");
  await expect(editor).toContainText("리소스 초안은 유지됩니다");
  await expect(allocation).toHaveValue("70");
  expect((await (await page.request.get(`${f.api}/assigned-targets`)).json()).data.assignments.find((entry: { id: string }) => entry.id === alice.id).allocation.percent).toBe(80);
  expect(requests).toBe(3);
  await info.attach("issue621-exact-assignment", { contentType: "application/json", body: JSON.stringify({ assignmentId: alice.id, resourceId: f.resources[0].id, unchangedAssignmentId: bob.id, requests, successfulWrites: 1, taskId: f.task.taskId }) });
});

test("#621 Target 응답역전·실제409 stale·필터탈락 fallback·취소 scope/focus", async ({ page, isolatedApplication: origin }) => {
  test.setTimeout(180_000);
  page.setDefaultTimeout(15_000);
  const f = await seedIssue621(page, origin);
  const root = await openResource(page);
  await root.getByLabel("리소스 보기", { exact: true }).selectOption("targets");
  await root.getByLabel("Target 표시", { exact: true }).selectOption("matrix");
  let release!: () => void;
  let started!: () => void;
  let delivered!: () => void;
  const oldDelivered = new Promise<void>(resolve => { delivered = resolve; });
  const delayed = new Promise<void>(resolve => { release = resolve; });
  const requested = new Promise<void>(resolve => { started = resolve; });
  await page.route(`**/api/projects/${f.publicId}/resource-dashboard?**`, async route => {
    if (new URL(route.request().url()).searchParams.get("targetIds") !== f.targets[0].id) return route.continue();
    const response = await route.fetch();
    started();
    await delayed;
    await route.fulfill({ response }).catch(() => undefined);
    delivered();
  });
  await root.getByLabel("Target", { exact: true }).selectOption(f.targets[0].id);
  await requested;
  await root.getByLabel("Target", { exact: true }).selectOption(f.targets[1].id);
  await expect(root).toHaveAttribute("data-ready", "true");
  await expect(root.getByLabel("Target", { exact: true })).toHaveValue(f.targets[1].id);
  release();
  await oldDelivered;
  await page.unroute(`**/api/projects/${f.publicId}/resource-dashboard?**`);
  await expect(root.getByTestId("resource-target-view")).toContainText("Assignment 2");
  await f.mutate(`/tasks/${f.task.taskId}`, { name: "외부 변경으로 보고서 stale" }, "patch");
  const region = root.getByRole("region", { name: "Resource Target 비교표", exact: true });
  await region.locator("tbody td button").first().click();
  await expect(root.locator(".resource-dashboard-detail")).toHaveAttribute("data-detail-state", "stale");
  await expect(root.locator(".resource-dashboard-detail").getByRole("button", { name: "전체 범위 일정 보기", exact: true })).toBeDisabled();
  await root.getByRole("button", { name: "새로고침", exact: true }).click();
  await root.getByRole("button", { name: "최신 일정 조회", exact: true }).click({ timeout: 10_000 });
  await expect(root).toHaveAttribute("data-ready", "true");
  await region.locator("tbody td button").first().click();
  const detail = root.locator(".resource-dashboard-detail");
  const trigger = detail.getByRole("button", { name: "외부 변경으로 보고서 stale", exact: true });
  await trigger.click();
  const editor = await taskEditor(page);
  await editor.getByLabel("작업명", { exact: true }).fill("버릴 초안");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "변경사항 버리고 닫기", exact: true }).click();
  await expect(editor).toHaveCount(0);
  await expect(trigger).toBeFocused();
  expect((await f.snapshot()).data.tasks.find(row => row.taskId === f.task.taskId)!.name).toBe("외부 변경으로 보고서 stale");
  await trigger.click();
  await editor.getByRole("tab", { name: /^물류 연결/ }).click();
  const binding = editor.getByRole("region", { name: "작업 Target 연결", exact: true });
  await binding.getByLabel(`${f.targets[1].name} (${f.targets[1].code})`, { exact: true }).uncheck();
  await binding.getByRole("button", { name: "Target 연결 저장", exact: true }).click();
  await expect(binding.getByLabel(`${f.targets[1].name} (${f.targets[1].code})`, { exact: true })).not.toBeChecked();
  await editor.getByRole("button", { name: "작업 편집기 닫기", exact: true }).click();
  await expect(root.getByTestId("resource-target-view")).toContainText("현재 조건에 일치하는 Target 관련 배정이 없습니다");
  await expect.poll(() => page.evaluate(() => { const active = document.activeElement as HTMLElement; return active !== document.body && active.checkVisibility(); })).toBe(true);
  await expect(root.getByLabel("Target", { exact: true })).toHaveValue(f.targets[1].id);
});
