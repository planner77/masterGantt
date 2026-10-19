import { expect, test, isolatedApplicationOptions } from "./fixtures/isolated-application";
import { readBrowserCanonicalSnapshot } from "./helpers/browser-canonical-snapshot";
import { readBrowserProjectResourceData } from "./helpers/browser-project-resource-data";

const password = "Membership727Synthetic!";
test.use({ ...isolatedApplicationOptions, isolatedResourceAdminPassword: password, viewport: { width: 1440, height: 1000 } });

test("membership real SQLite registration survives reload/restart and exact assignment editor keeps dirty guard and Gantt", async ({ page, baseURL, restartIsolatedApplication, observeIsolatedApi }) => {
  test.setTimeout(180_000);
  const origin = { Origin: baseURL! };
  expect((await page.request.post("/api/resource-catalog/admin-sessions", { headers: origin, data: { password } })).status()).toBe(201);
  let catalog = (await (await page.request.get("/api/resources")).json()).data;
  for (const [name, roles] of [["등록 전용 담당자", []], ["개인 배정 담당자", ["DEVELOPER"]]] as const) {
    const response = await page.request.post("/api/resources", { headers: { ...origin, "If-Match": `"${catalog.revision}"` }, data: { name, roles } });
    expect(response.status(), await response.text()).toBe(201); catalog = (await response.json()).data;
  }
  const member = catalog.resources.find((row: { name: string }) => row.name === "등록 전용 담당자");
  const assigned = catalog.resources.find((row: { name: string }) => row.name === "개인 배정 담당자");
  const created = await page.request.post("/api/projects", { headers: origin, data: { name: "Issue727 실제 리소스 등록", ownerName: "E2E 자동화", description: "독립 등록 저장 검증", editPassword: "Member727!" } });
  expect(created.status(), await created.text()).toBe(201);
  const publicId = (await created.json()).data.project.publicId;
  const api = `/api/projects/${publicId}`;
  // Seed reads are independent API requests; only post-UI persistence reads
  // use the browser's same-origin transport and the isolated observer.
  const snapshot = async () => {
    const response = await page.request.get(api);
    expect(response.status(), "초기 Project API 상태").toBe(200);
    return (await response.json()).data;
  };
  const browserSnapshot = async () => (await readBrowserCanonicalSnapshot(page, api, observeIsolatedApi)).data;
  const browserResourceRead = <T>(suffix: "assigned-targets" | "resource-memberships") =>
    readBrowserProjectResourceData<T>(page, `${api}/${suffix}`, observeIsolatedApi);
  let canonical = await snapshot();
  const added = await page.request.post(`${api}/tasks`, { headers: { ...origin, "If-Match": `"${canonical.project.revision}"` }, data: { name: "진척 0 개인 배정 작업", type: "task", start: "2026-10-05", duration: 45, progress: 0 } });
  expect(added.status(), await added.text()).toBe(201); canonical = await snapshot();
  const task = canonical.tasks[0];
  const assignedResponse = await page.request.put(`${api}/tasks/${task.taskId}/assignments`, { headers: { ...origin, "If-Match": `"${canonical.project.revision}"` }, data: { catalogRevision: catalog.revision, targets: [{ kind: "resource", id: assigned.id, allocation: { percent: 50 } }] } });
  expect(assignedResponse.status(), await assignedResponse.text()).toBe(200);
  const before = await snapshot();
  const assignedBefore = (await (await page.request.get(`${api}/assigned-targets`)).json()).data.assignments;
  await page.goto(`/projects/${publicId}`);
  const frame = page.locator("[data-project-gantt-instance]");
  await expect(frame.locator(".wx-gantt")).toBeVisible();
  const instance = await frame.getAttribute("data-project-gantt-instance");
  const chart = frame.locator(".wx-chart");
  await chart.evaluate(element => { element.scrollLeft = 120; });
  const chartScroll = await chart.evaluate(element => element.scrollLeft);
  expect(chartScroll).toBeGreaterThan(0);
  const openMembership = async () => {
    await page.getByRole("tab", { name: "기준정보", exact: true }).click();
    await page.getByRole("tablist", { name: "기준정보 보기" }).getByRole("tab", { name: "리소스", exact: true }).click();
    await expect(page.getByRole("heading", { name: "프로젝트 리소스", exact: true })).toBeVisible();
  };
  await openMembership();
  const panel = page.locator("#project-panel-resource-master");
  await expect(panel.getByText("작업 배정 1명", { exact: true })).toBeVisible();
  await panel.getByRole("button", { name: "리소스 등록", exact: true }).click();
  const registration = page.getByRole("dialog", { name: "프로젝트 리소스 등록", exact: true });
  await registration.getByRole("row", { name: /등록 전용 담당자/ }).getByRole("radio").check();
  await registration.getByRole("button", { name: "선택 리소스 등록", exact: true }).click();
  await expect(registration).toHaveCount(0);
  await expect(panel.getByText("등록 1명", { exact: true })).toBeVisible();
  const after = await browserSnapshot();
  expect(after.tasks).toEqual(before.tasks); expect(after.links).toEqual(before.links);
  expect((await browserResourceRead<{ assignments: typeof assignedBefore }>("assigned-targets")).assignments).toEqual(assignedBefore);
  await expect(frame).toHaveAttribute("data-project-gantt-instance", instance!);
  await panel.getByRole("row", { name: /개인 배정 담당자/ }).getByRole("button", { name: "배정 보기", exact: true }).click();
  const assignmentDialog = page.getByRole("dialog", { name: "개인 배정 담당자 작업 배정", exact: true });
  await assignmentDialog.getByRole("button", { name: "진척 0 개인 배정 작업 배정 편집", exact: true }).click();
  const editor = page.getByRole("dialog");
  await expect(editor.getByRole("tab", { name: /리소스/ })).toHaveAttribute("aria-selected", "true");
  await expect(editor.getByText(/선택한 개인의 배정만 편집/)).toContainText(assignedBefore[0].id);
  const allocation = editor.getByRole("spinbutton", { name: /개인 배정 담당자.*투입률/ });
  await allocation.fill("60");
  await editor.getByRole("button", { name: "작업 편집기 닫기", exact: true }).click();
  await expect(editor.getByRole("alert")).toContainText("저장하지 않은 변경사항");
  await editor.getByRole("button", { name: "계속 편집", exact: true }).click();
  await expect(allocation).toHaveValue("60");
  await editor.getByRole("button", { name: "작업 편집기 닫기", exact: true }).click();
  await editor.getByRole("button", { name: "변경사항 버리고 닫기", exact: true }).click();
  await expect(editor).toHaveCount(0);
  await expect(frame).toHaveAttribute("data-project-gantt-instance", instance!);
  await page.getByRole("tab", { name: "일정", exact: true }).click();
  await expect.poll(() => chart.evaluate(element => element.scrollLeft)).toBe(chartScroll);
  await page.reload(); await openMembership();
  await expect(panel.getByRole("row", { name: /등록 전용 담당자/ })).toContainText("작업 미배정");
  await restartIsolatedApplication();
  await page.reload(); await openMembership();
  await expect(panel.getByText("등록 1명", { exact: true })).toBeVisible();
  const memberships = await browserResourceRead<{ resources: Array<{ id: string; registered: boolean }> }>("resource-memberships");
  expect(memberships.resources.find((row: { id: string }) => row.id === member.id).registered).toBe(true);
  expect((await browserSnapshot()).tasks).toEqual(before.tasks);
  expect((await browserResourceRead<{ assignments: typeof assignedBefore }>("assigned-targets")).assignments).toEqual(assignedBefore);
});
