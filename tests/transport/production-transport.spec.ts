import { execFileSync } from "node:child_process";
import { expect, test, type Page } from "@playwright/test";
import { chooseTaskInformation } from "../e2e/helpers/task-context-menu";
import type { ProjectSnapshotResponse, TaskMutationResponse } from "../../src/contracts/projects";

const TRANSPORT_PROJECT_OWNER = "Transport CI";

async function gotoProjectCreate(page: Page): Promise<void> {
  try {
    await page.goto("/projects/new");
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes("ERR_NETWORK_CHANGED")) throw error;
    // Docker restart can invalidate Chromium's cached network route for an
    // already-open production page. Retry navigation once after that explicit
    // infrastructure transition; mutation requests themselves are never retried.
    await page.goto("/projects/new");
  }
}

async function createProject(page: Page, name: string, password: string): Promise<string> {
  await gotoProjectCreate(page);
  await page.getByLabel("프로젝트 이름", { exact: true }).fill(name);
  await page.getByLabel("소유자", { exact: true }).fill(TRANSPORT_PROJECT_OWNER);
  await page.getByLabel("편집 비밀번호", { exact: true }).fill(password);
  const pending = page.waitForResponse((r) => new URL(r.url()).pathname === "/api/projects" && r.request().method() === "POST");
  await page.getByRole("button", { name: "프로젝트 만들기" }).click();
  expect((await pending).status()).toBe(201);
  await page.waitForURL(/\/projects\/[0-9a-f-]{36}$/);
  return new URL(page.url()).pathname.split("/").at(-1)!;
}

async function unlock(page: Page, password: string): Promise<void> {
  const dialog = page.getByRole("dialog", { name: "편집 활성화", exact: true });
  if (!(await dialog.isVisible().catch(() => false))) {
    await page.getByRole("button", { name: "편집 잠금 해제", exact: true }).click();
    await expect(dialog).toBeVisible();
  }
  await dialog.getByLabel("편집 비밀번호", { exact: true }).fill(password);
  await dialog.getByRole("button", { name: "편집 활성화", exact: true }).click();
  await expect(page.getByText("편집 중", { exact: true })).toBeVisible();
}

async function openSettings(page: Page): Promise<void> {
  const button = page.getByRole("button", { name: "편집 모드 종료", exact: true });
  if (!(await button.isVisible())) await page.getByText("프로젝트 설정", { exact: true }).click();
  await expect(button).toBeVisible();
}

test("실제 쿠키로 생성·편집·Origin/revision 보호·재시작·비밀번호 변경·로그아웃", async ({ page, browser, baseURL }, info) => {
  if (!baseURL) throw new Error("검증 origin 누락");
  const secure = info.project.name === "production-https";
  const cookieName = secure ? "__Host-mastergantt_edit" : "mastergantt_edit";
  const suffix = `${Date.now()}-${info.project.name}`;
  const password = "TrOrig12345!";
  const rotated = "TrNew123456!";
  const publicId = await createProject(page, `Transport ${suffix}`, password);
  const api = `/api/projects/${publicId}`;
  await expect(page.getByText("편집 중", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => window.isSecureContext)).toBe(secure);
  expect(new URL(page.url()).hostname).not.toMatch(/localhost|127\.0\.0\.1/);

  const cookies = await page.context().cookies(baseURL);
  const cookie = cookies.find((entry) => entry.name === cookieName);
  expect(Boolean(cookie)).toBe(true);
  expect(cookie!.secure).toBe(secure);
  expect(cookie!.httpOnly).toBe(true);
  expect(cookie!.sameSite).toBe("Strict");
  expect(cookie!.path).toBe("/");
  expect(cookie!.domain).toBe(new URL(baseURL).hostname);
  expect(cookie!.expires > Date.now() / 1000 + 60).toBe(true);
  expect(await page.evaluate(() => document.cookie.includes("mastergantt_edit"))).toBe(false);
  const session = await page.request.get(`${api}/edit-sessions/current`);
  expect(session.status()).toBe(200);
  expect((await session.json()).data.permission).toBe("edit");

  const createTask = page.waitForResponse((r) => new URL(r.url()).pathname === `${api}/tasks` && r.request().method() === "POST");
  await page.locator('.project-gantt-widget [data-action="add-task"]').first().click();
  const created = await createTask;
  expect(created.status()).toBe(201);
  expect(Boolean((await created.request().allHeaders()).cookie?.includes(`${cookieName}=`))).toBe(true);
  const snapshot = await created.json() as TaskMutationResponse;
  const task = snapshot.data.tasks[0];
  expect(Boolean(task)).toBe(true);
  await expect(page.getByRole("grid").getByText(task.name, { exact: true })).toBeVisible();
  await expect(page.locator(`.wx-bar[data-task-id=":${task.taskId}"]`)).toBeVisible();

  await page.locator(".project-gantt-widget .wx-row", { hasText: task.name }).first()
    .getByText(task.name, { exact: true }).click({ button: "right" });
  await chooseTaskInformation(page);
  const dialog = page.getByRole("dialog", { name: "작업 정보", exact: true });
  const savedTaskName = `HTTP compatible task ${suffix}`;
  await dialog.getByLabel("작업명", { exact: true }).fill(savedTaskName);
  const patch = page.waitForResponse((r) => new URL(r.url()).pathname === `${api}/tasks/${task.taskId}` && r.request().method() === "PATCH");
  await dialog.getByRole("button", { name: "저장", exact: true }).click();
  expect((await patch).status()).toBe(200);
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("grid").getByText(savedTaskName, { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("grid").getByText(savedTaskName, { exact: true })).toBeVisible();
  let saved = await (await page.request.get(api)).json() as ProjectSnapshotResponse;
  expect(saved.data.project.ownerName).toBe(TRANSPORT_PROJECT_OWNER);
  let revision = saved.data.project.revision;

  for (const origin of [baseURL.replace(/^https?:/, secure ? "http:" : "https:"), `${new URL(baseURL).protocol}//${new URL(baseURL).hostname}:18089`, "http://evil.test"]) {
    const denied = await page.request.patch(`${api}/tasks/${task.taskId}`, {
      headers: { Origin: origin, "If-Match": `"${revision}"`, "X-Forwarded-Proto": secure ? "https" : "http", "X-Forwarded-Host": new URL(baseURL).host },
      data: { name: "forbidden" },
    });
    expect(denied.status()).toBe(403);
  }
  const stale = await page.request.patch(`${api}/tasks/${task.taskId}`, {
    headers: { Origin: baseURL, "If-Match": `"${revision - 1}"` }, data: { name: "stale" },
  });
  expect(stale.status()).toBe(412);
  const wrongName = secure ? "mastergantt_edit" : "__Host-mastergantt_edit";
  const wrongCookie = await page.request.patch(api, {
    headers: { Origin: baseURL, "If-Match": `"${revision}"`, Cookie: `${wrongName}=${cookie!.value}` }, data: { name: "wrong cookie" },
  });
  expect(wrongCookie.status()).toBe(401);

  const otherContext = await browser.newContext({ baseURL, ignoreHTTPSErrors: false });
  try {
    const otherPage = await otherContext.newPage();
    await otherPage.goto(`/projects/${publicId}`);
    await expect(otherPage.getByText("읽기 전용", { exact: true })).toBeVisible();
    const unauthorized = await otherPage.request.patch(api, {
      headers: { Origin: baseURL, "If-Match": `"${revision}"` }, data: { name: "no cookie" },
    });
    expect(unauthorized.status()).toBe(401);
    await otherPage.getByRole("button", { name: "편집 잠금 해제", exact: true }).click();
    const unlockDialog = otherPage.getByRole("dialog", { name: "편집 활성화", exact: true });
    await unlockDialog.getByLabel("편집 비밀번호", { exact: true }).fill("Wrong123456!");
    await unlockDialog.getByRole("button", { name: "편집 활성화", exact: true }).click();
    await expect(otherPage.getByTestId("workspace-toast")).toContainText("올바르지 않습니다");
    await unlock(otherPage, password);

    const container = secure ? process.env.TRANSPORT_HTTPS_CONTAINER : process.env.TRANSPORT_HTTP_CONTAINER;
    if (process.env.GITHUB_ACTIONS !== "true" || !container?.match(/^mastergantt-transport-\d+-\d+-(http|https)$/)) {
      throw new Error("격리된 CI 컨테이너만 재시작할 수 있습니다.");
    }
    execFileSync("docker", ["restart", container], { stdio: "ignore", timeout: 30_000 });
    await expect.poll(async () => {
      try { return (await page.request.get("/api/health/ready", { timeout: 2000 })).status(); } catch { return 0; }
    }, { timeout: 60_000 }).toBe(200);
    await page.reload();
    await expect(page.getByRole("grid").getByText(savedTaskName, { exact: true })).toBeVisible();
    await expect(page.getByText("편집 중", { exact: true })).toBeVisible();
    saved = await (await page.request.get(api)).json() as ProjectSnapshotResponse;
    expect(saved.data.project.revision).toBe(revision);
    expect(saved.data.project.ownerName).toBe(TRANSPORT_PROJECT_OWNER);

    await openSettings(page);
    await page.getByLabel("새 편집 비밀번호", { exact: true }).fill(rotated);
    const rotating = page.waitForResponse((r) => new URL(r.url()).pathname === `${api}/edit-password` && r.request().method() === "PUT");
    await page.getByRole("button", { name: "편집 비밀번호 변경", exact: true }).click();
    expect((await rotating).status()).toBe(204);
    await expect(page.getByTestId("workspace-toast")).toContainText("변경했습니다");
    const revoked = await otherPage.request.get(`${api}/edit-sessions/current`);
    expect((await revoked.json()).data.permission).toBe("readonly");
    const crossSession = await otherPage.request.patch(api, {
      headers: { Origin: baseURL, "If-Match": `"${revision + 1}"` }, data: { name: "revoked" },
    });
    expect(crossSession.status()).toBe(401);

    const otherId = await createProject(otherPage, `Other ${suffix}`, "Other123456!");
    const crossProject = await page.request.patch(`/api/projects/${otherId}`, {
      headers: { Origin: baseURL, "If-Match": '"1"' }, data: { name: "cross project" },
    });
    expect(crossProject.status()).toBe(401);
  } finally {
    await otherContext.close();
  }

  revision = (await (await page.request.get(api)).json()).data.project.revision;
  await openSettings(page);
  await page.getByRole("button", { name: "편집 모드 종료", exact: true }).click();
  await expect(page.getByText("읽기 전용", { exact: true })).toBeVisible();
  expect((await page.context().cookies(baseURL)).some((entry) => entry.name === cookieName)).toBe(false);
  const afterLogout = await page.request.patch(api, {
    headers: { Origin: baseURL, "If-Match": `"${revision}"` }, data: { name: "after logout" },
  });
  expect(afterLogout.status()).toBe(401);
  await unlock(page, rotated);
  await expect(page.getByRole("grid").getByText(savedTaskName, { exact: true })).toBeVisible();
  const finalCookie = (await page.context().cookies(baseURL)).find((entry) => entry.name === cookieName);
  expect(Boolean(finalCookie)).toBe(true);
  expect(finalCookie!.secure).toBe(secure);
});
