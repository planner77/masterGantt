import { mkdir, writeFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import type { ProjectResourceMembershipDto } from "../../src/contracts/project-resource-memberships";

const publicId = "b57bb10c-9cd7-4d00-9c2a-4647e2240727";
const makeResource = (id: string, name: string, extra: Partial<ProjectResourceMembershipDto> = {}): ProjectResourceMembershipDto => ({ id, name, code: "PEOPLE-727", description: "", active: true, roles: ["PI", "DEVELOPER", "EQUIPMENT_OWNER"], developerGrade: "ADVANCED", groups: [{ id: "group", name: "장기 프로젝트 통합 개발 Group 이름", active: true }], registered: true, sources: { membership: true, taskAssignments: false, equipmentRoles: false, responsibilityAssignments: false, systemRoles: false }, usage: { taskAssignments: 0, equipmentRoles: 0, responsibilityAssignments: 0, systemRoles: 0 }, ...extra });
const rows = [makeResource("registered", "등록만 된 긴 이름의 프로젝트 참여자", { roles: [] }), makeResource("assigned", "작업 배정 담당자", { roles: ["DEVELOPER"], usage: { taskAssignments: 1, equipmentRoles: 0, responsibilityAssignments: 0, systemRoles: 0 }, sources: { membership: true, taskAssignments: true, equipmentRoles: false, responsibilityAssignments: false, systemRoles: false } }), makeResource("role", "시스템 책임 역할 담당자", { registered: false, usage: { taskAssignments: 0, equipmentRoles: 0, responsibilityAssignments: 0, systemRoles: 1 }, sources: { membership: false, taskAssignments: false, equipmentRoles: false, responsibilityAssignments: false, systemRoles: true } }), makeResource("inactive", "비활성 등록자", { active: false })];
async function setup(page: Page, editable = true) {
  let revision = 1;
  const current = structuredClone(rows);
  const mutations: string[] = [];
  const candidate = makeResource("candidate", "신규 등록할 기존 공용 리소스", { registered: false });
  const envelope = (catalog: boolean, q = "") => ({ data: { projectRevision: revision, catalogRevision: 7, groups: [{ id: "group", name: "장기 프로젝트 통합 개발 Group 이름", active: true }], total: (catalog ? [...current, candidate] : current).filter(row => !q || row.name.includes(q)).length, offset: 0, limit: 50, counts: { registered: current.filter(row => row.registered).length, assigned: 1, roleOnly: 1, inactive: 1 }, resources: (catalog ? [...current, candidate] : current).filter(row => !q || row.name.includes(q)) } });
  await page.route(`**/api/projects/${publicId}`, route => route.fulfill({ json: { data: { project: { publicId, name: "리소스 등록 검증", description: "", status: "planned", revision, calendar: { timezone: "Asia/Seoul", weekendDays: [6, 0], holidays: [] } }, tasks: [], links: [], permission: "readonly" } } }));
  await page.route(`**/api/projects/${publicId}/edit-sessions/current`, route => route.fulfill({ status: editable ? 200 : 401, json: { data: { permission: "edit", expiresAt: "2099-01-01T00:00:00Z" } } }));
  await page.route(`**/api/projects/${publicId}/resource-memberships**`, async route => {
    const req = route.request();
    const url = new URL(req.url());
    if (req.method() !== "GET") {
      mutations.push(req.method());
      expect(req.headers()["if-match"]).toBe(`"${revision}"`);
      revision++;
      if (req.method() === "POST") { expect(req.postDataJSON()).toEqual({ resourceId: "candidate", catalogRevision: 7 }); current.push({ ...candidate, registered: true }); }
      else current.splice(current.findIndex(row => row.id === url.pathname.split("/").at(-1)), 1);
    }
    await route.fulfill({ json: envelope(url.searchParams.get("scope") === "catalog", url.searchParams.get("q") ?? "") });
  });
  await page.goto(`/projects/${publicId}`);
  await page.getByRole("tab", { name: "기준정보", exact: true }).click();
  await page.getByRole("tablist", { name: "기준정보 보기" }).getByRole("tab", { name: "리소스", exact: true }).click();
  await expect(page.getByRole("heading", { name: "프로젝트 리소스", exact: true })).toBeVisible();
  await expect(page.getByText(rows[0].name, { exact: true })).toBeVisible();
  return { mutations };
}
for (const width of [390, 768, 1024, 1440, 1920]) {
  test(`membership layout and registration keyboard flow at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 1000 });
    const { mutations } = await setup(page);
    const panel = page.locator("#project-panel-resource-master");
    await expect(panel.getByText("등록 3명", { exact: true })).toBeVisible();
    await expect(panel.getByText("작업 배정 1명", { exact: true })).toBeVisible();
    await expect(panel.getByRole("row", { name: /작업 배정 담당자/ }).getByRole("button", { name: "등록 해제", exact: true })).toBeDisabled();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    const scroll = panel.getByRole("region", { name: /가로 스크롤/ });
    await scroll.focus();
    await expect(scroll).toBeFocused();
    await mkdir("output/playwright/issue-727", { recursive: true });
    const geometry = await panel.getByRole("table").evaluate(table => {
      const headers = [...table.querySelectorAll("th")].map(cell => cell.getBoundingClientRect().toJSON());
      const cells = [...table.querySelectorAll("tbody tr")].map(row => [...row.querySelectorAll("td")].map(cell => cell.getBoundingClientRect().toJSON()));
      return { headers, cells, documentWidth: document.documentElement.scrollWidth, viewport: innerWidth };
    });
    for (const row of geometry.cells) for (const [index, cell] of row.entries()) { expect(Math.abs(cell.x - geometry.headers[index].x)).toBeLessThan(1); expect(Math.abs(cell.width - geometry.headers[index].width)).toBeLessThan(1); }
    await writeFile(`output/playwright/issue-727/geometry-${width}.json`, JSON.stringify(geometry, null, 2));
    await panel.evaluate(element => { element.scrollTop = 0; });
    await page.screenshot({ path: `output/playwright/issue-727/memberships-${width}.png`, fullPage: true });
    const register = panel.getByRole("button", { name: "리소스 등록", exact: true });
    await register.click();
    const dialog = page.getByRole("dialog", { name: "프로젝트 리소스 등록", exact: true });
    await dialog.getByRole("searchbox", { name: "공용 리소스 이름 검색" }).fill("신규 등록");
    const candidate = dialog.getByRole("row", { name: /신규 등록할/ });
    await candidate.getByRole("radio").check();
    await page.keyboard.press("Escape");
    const discard = page.getByRole("dialog", { name: "리소스 선택 취소", exact: true });
    await expect(discard).toBeVisible();
    await discard.getByRole("button", { name: "계속 선택" }).click();
    await expect(candidate.getByRole("radio")).toBeChecked();
    await dialog.getByRole("button", { name: "선택 리소스 등록", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(register).toBeFocused();
    await expect(panel.getByText("등록 4명", { exact: true })).toBeVisible();
    await expect(panel.getByText("작업 배정 1명", { exact: true })).toBeVisible();
    expect(mutations).toEqual(["POST"]);
    await page.screenshot({ path: testInfo.outputPath(`registered-${width}.png`) });
  });
}
test("readonly permits discovery of project use without registration or unrelated catalog", async ({ page }) => {
  const { mutations } = await setup(page, false);
  const panel = page.locator("#project-panel-resource-master");
  await expect(panel.getByRole("button", { name: "리소스 등록", exact: true })).toBeDisabled();
  await expect(panel.getByRole("row", { name: /시스템 책임 역할 담당자/ }).getByText("등록 필요", { exact: true })).toBeVisible();
  await panel.getByRole("searchbox").fill("없는 이름");
  await expect(panel.getByText(/리소스가 없습니다/)).toBeVisible();
  expect(mutations).toEqual([]);
});
test("stale server blocks resubmission and retains selected draft", async ({ page }) => {
  await setup(page);
  await page.getByRole("button", { name: "리소스 등록", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "프로젝트 리소스 등록", exact: true });
  await dialog.getByRole("row", { name: /신규 등록할/ }).getByRole("radio").check();
  await page.route(`**/api/projects/${publicId}/resource-memberships`, route => route.fulfill({ status: 412, json: { error: { code: "REVISION_MISMATCH" } } }));
  await dialog.getByRole("button", { name: "선택 리소스 등록", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText("최신 목록");
  await expect(dialog.getByText("선택: 신규 등록할 기존 공용 리소스", { exact: true })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "선택 리소스 등록", exact: true })).toBeDisabled();
});
test("loading, empty and network error states keep mutations explicit", async ({ page }) => {
  await setup(page);
  let release: (() => void) | undefined;
  await page.route(`**/api/projects/${publicId}/resource-memberships?**`, async route => {
    await new Promise<void>(resolve => { release = resolve; });
    await route.fulfill({ status: 503, json: { error: { code: "UNAVAILABLE" } } });
  });
  const panel = page.locator("#project-panel-resource-master");
  await panel.getByRole("searchbox").fill("대기 검색");
  await expect(panel.getByRole("status")).toContainText("불러오는 중");
  await expect(panel.getByRole("table")).toHaveCount(0);
  release?.();
  await expect(panel.getByRole("alert")).toContainText("다시 불러온");
  await expect(panel.getByRole("button", { name: "최신 상태 조회" })).toBeEnabled();
});
test("unregister confirms separately, server detects fresh use, and pending prevents duplicate registration", async ({ page }) => {
  const { mutations } = await setup(page);
  const panel = page.locator("#project-panel-resource-master");
  await panel.getByRole("row", { name: /등록만 된/ }).getByRole("button", { name: "등록 해제", exact: true }).click();
  const removal = page.getByRole("dialog", { name: "프로젝트 리소스 등록 해제", exact: true });
  await page.route(`**/api/projects/${publicId}/resource-memberships/registered`, route => route.fulfill({ status: 409, json: { error: { code: "PROJECT_RESOURCE_IN_USE" } } }));
  await removal.getByRole("button", { name: "등록 해제 확인", exact: true }).click();
  await expect(removal.getByRole("alert")).toContainText("먼저 정리");
  await expect(removal.getByRole("button", { name: "등록 해제 확인" })).toBeDisabled();
  expect(mutations).toEqual([]);
  await page.keyboard.press("Escape");
  await panel.getByRole("button", { name: "최신 상태 조회" }).click();
  await expect(panel.getByRole("button", { name: "리소스 등록", exact: true })).toBeEnabled();
  await panel.getByRole("button", { name: "리소스 등록", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "프로젝트 리소스 등록", exact: true });
  await expect(dialog.getByRole("row", { name: /비활성 등록자/ }).getByRole("radio")).toBeDisabled();
  await dialog.getByRole("row", { name: /신규 등록할/ }).getByRole("radio").check();
  let release: (() => void) | undefined;
  let posts = 0;
  await page.route(`**/api/projects/${publicId}/resource-memberships`, async route => {
    posts++;
    await new Promise<void>(resolve => { release = resolve; });
    await route.fulfill({ status: 401, json: { error: { code: "UNAUTHORIZED" } } });
  });
  await dialog.getByRole("button", { name: "선택 리소스 등록", exact: true }).click();
  await expect(dialog.getByRole("button", { name: "등록 중…", exact: true })).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeVisible();
  expect(posts).toBe(1);
  release?.();
  await expect(dialog.getByRole("alert")).toContainText("편집 세션");
  await expect(dialog.getByText("선택: 신규 등록할 기존 공용 리소스", { exact: true })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "선택 리소스 등록", exact: true })).toBeDisabled();
});
test("uncertain mutation locks resubmission and canonical refresh failure leaves an explicit recovery action", async ({ page }) => {
  await setup(page);
  const panel = page.locator("#project-panel-resource-master");
  await panel.getByRole("button", { name: "리소스 등록", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "프로젝트 리소스 등록", exact: true });
  await dialog.getByRole("row", { name: /신규 등록할/ }).getByRole("radio").check();
  await page.route(`**/api/projects/${publicId}/resource-memberships`, route => route.abort("failed"));
  await dialog.getByRole("button", { name: "선택 리소스 등록", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText("적용되었을 수 있으므로");
  await expect(dialog.getByRole("button", { name: "선택 리소스 등록", exact: true })).toBeDisabled();
  await page.unroute(`**/api/projects/${publicId}/resource-memberships`);
  await dialog.getByRole("searchbox", { name: "공용 리소스 이름 검색" }).fill("신규 등록");
  await expect(dialog.getByRole("row", { name: /신규 등록할/ }).getByRole("radio")).toBeDisabled();
  await expect(dialog.getByRole("button", { name: "선택 리소스 등록", exact: true })).toBeDisabled();
  await dialog.getByRole("button", { name: "최신 목록 다시 불러오기" }).click();
  await dialog.getByRole("row", { name: /신규 등록할/ }).getByRole("radio").check();
  let canonicalFailed = true;
  await page.route(`**/api/projects/${publicId}`, route => canonicalFailed ? route.fulfill({ status: 503, json: { error: { code: "UNAVAILABLE" } } }) : route.fallback());
  await dialog.getByRole("button", { name: "선택 리소스 등록", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(panel.getByRole("alert")).toContainText("등록 변경은 저장되었지만");
  await expect(panel.getByRole("button", { name: "리소스 등록", exact: true })).toBeDisabled();
  const refresh = panel.getByRole("button", { name: "최신 상태 조회", exact: true });
  await expect(refresh).toBeEnabled();
  await expect(refresh).toBeFocused();
  canonicalFailed = false;
  await refresh.click();
  await expect(panel.getByRole("button", { name: "리소스 등록", exact: true })).toBeEnabled();
  await expect(panel.getByText("등록 4명", { exact: true })).toBeVisible();
});
