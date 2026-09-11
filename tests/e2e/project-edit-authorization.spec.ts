import { expect, test } from "@playwright/test";

function uniqueSuffix(): string {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function createProject(
  page: import("@playwright/test").Page,
  name: string,
  password: string,
): Promise<string> {
  await page.goto("/projects/new");
  await page.getByLabel("프로젝트 이름").fill(name);
  await page.getByLabel("편집 비밀번호").fill(password);
  await page.getByRole("button", { name: "프로젝트 만들기" }).click();
  await page.waitForURL(/\/projects\/[0-9a-f-]{36}$/);
  return new URL(page.url()).pathname.split("/").at(-1)!;
}

test.describe.configure({ mode: "serial" });

test("keeps direct reads readonly and enforces the W05 edit session lifecycle", async ({
  browser,
  page,
}) => {
  const suffix = uniqueSuffix();
  const firstName = `W05 Project ${suffix}`;
  const savedName = `W05 Saved ${suffix}`;
  const password = `W05-original-${suffix}`;
  const rotatedPassword = `W05-rotated-${suffix}`;
  const projectId = await createProject(page, firstName, password);
  const projectPath = `/api/projects/${projectId}`;
  const origin = new URL(page.url()).origin;

  await expect(page.getByText("편집 가능", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "프로젝트 정보 저장" })).toBeVisible();

  const directSnapshot = await page.request.get(projectPath);
  expect(directSnapshot.status()).toBe(200);
  expect((await directSnapshot.json()).data.permission).toBe("readonly");

  const retainedSessionContext = await browser.newContext();
  const retainedSessionPage = await retainedSessionContext.newPage();
  try {
    const readonlyPage = retainedSessionPage;
    await readonlyPage.goto(`/projects/${projectId}`);
    await expect(readonlyPage.getByText("읽기 전용", { exact: true })).toBeVisible();
    await expect(readonlyPage.getByRole("button", { name: "편집 잠금 해제" })).toBeVisible();

    await readonlyPage.getByLabel("편집 비밀번호").fill("wrong-password-123");
    await readonlyPage.getByRole("button", { name: "편집 잠금 해제" }).click();
    await expect(readonlyPage.getByRole("status")).toContainText("올바르지 않습니다");
    await expect(readonlyPage.getByLabel("편집 비밀번호")).toHaveValue("");
    expect(await readonlyPage.locator("body").innerText()).not.toContain("wrong-password-123");

    const noSessionPatch = await readonlyPage.request.patch(projectPath, {
      data: { name: "Denied" },
      headers: { "If-Match": '"1"', Origin: origin },
    });
    expect(noSessionPatch.status()).toBe(401);

    await readonlyPage.getByLabel("편집 비밀번호").fill(password);
    await readonlyPage.getByRole("button", { name: "편집 잠금 해제" }).click();
    await expect(readonlyPage.getByText("편집 가능", { exact: true })).toBeVisible();
  } catch (error) {
    await retainedSessionContext.close();
    throw error;
  }

  await page.getByLabel("프로젝트 이름").fill(savedName);
  await page.getByRole("button", { name: "프로젝트 정보 저장" }).click();
  await expect(page.getByRole("status")).toContainText("저장했습니다");
  await expect(page.getByRole("heading", { name: savedName })).toBeVisible();
  await page.goto(`/projects/${projectId}`);
  await expect(page.getByRole("heading", { name: savedName })).toBeVisible();
  await expect(page.getByText("편집 가능", { exact: true })).toBeVisible();

  const afterSave = await page.request.get(projectPath);
  const afterSaveBody = await afterSave.json();
  let currentRevision = afterSaveBody.data.project.revision as number;
  const sessionBeforeSafeMethods = await page.request.get(
    `${projectPath}/edit-sessions/current`,
  );
  const expiresAtBefore = (await sessionBeforeSafeMethods.json()).data.expiresAt;
  const head = await page.request.head(projectPath);
  expect(head.status()).toBe(200);
  const options = await page.request.fetch(projectPath, { method: "OPTIONS" });
  expect(options.headers()["access-control-allow-credentials"]).toBeUndefined();
  expect(options.headers()["access-control-allow-origin"]).toBeUndefined();
  const afterSafeMethods = await page.request.get(projectPath);
  expect((await afterSafeMethods.json()).data.project.revision).toBe(currentRevision);
  const sessionAfterSafeMethods = await page.request.get(
    `${projectPath}/edit-sessions/current`,
  );
  expect((await sessionAfterSafeMethods.json()).data.expiresAt).toBe(expiresAtBefore);

  const concurrentMetadataWrites = await Promise.all([
    page.request.patch(projectPath, {
      data: { description: "concurrent write A" },
      headers: { "If-Match": `"${currentRevision}"`, Origin: origin },
    }),
    page.request.patch(projectPath, {
      data: { description: "concurrent write B" },
      headers: { "If-Match": `"${currentRevision}"`, Origin: origin },
    }),
  ]);
  expect(concurrentMetadataWrites.filter((response) => response.status() === 200)).toHaveLength(1);
  expect(concurrentMetadataWrites.filter((response) => response.status() === 412)).toHaveLength(1);
  const afterConcurrentWrite = await page.request.get(projectPath);
  const afterConcurrentWriteBody = await afterConcurrentWrite.json();
  expect(afterConcurrentWriteBody.data.project.revision).toBe(currentRevision + 1);
  expect(["concurrent write A", "concurrent write B"]).toContain(
    afterConcurrentWriteBody.data.project.description,
  );
  currentRevision = afterConcurrentWriteBody.data.project.revision as number;
  await page.goto(`/projects/${projectId}`);
  await expect(page.getByText("편집 가능", { exact: true })).toBeVisible();
  const stalePatch = await page.request.patch(projectPath, {
    data: { description: "stale write" },
    headers: {
      "If-Match": `"${currentRevision - 1}"`,
      Origin: origin,
    },
  });
  expect(stalePatch.status()).toBe(412);
  expect((await stalePatch.json()).error.code).toBe("REVISION_MISMATCH");

  const otherContext = await browser.newContext();
  try {
    const otherPage = await otherContext.newPage();
    const otherId = await createProject(otherPage, `W05 Other ${suffix}`, `W05-other-${suffix}`);
    const crossProjectPatch = await page.request.patch(`/api/projects/${otherId}`, {
      data: { name: "Cross project denied" },
      headers: { "If-Match": '"1"', Origin: origin },
    });
    expect(crossProjectPatch.status()).toBe(401);
  } finally {
    await otherContext.close();
  }

  await page.getByLabel("새 편집 비밀번호").fill(rotatedPassword);
  await page.getByRole("button", { name: "편집 비밀번호 변경" }).click();
  await expect(page.getByRole("status")).toContainText("변경했습니다");
  await page.goto(`/projects/${projectId}`);
  await expect(page.getByText("편집 가능", { exact: true })).toBeVisible();
  expect(await page.locator("body").innerText()).not.toContain(rotatedPassword);

  const revokedCurrent = await retainedSessionPage.request.get(
    `${projectPath}/edit-sessions/current`,
  );
  expect(revokedCurrent.status()).toBe(200);
  expect((await revokedCurrent.json()).data.permission).toBe("readonly");
  const revokedSessionPatch = await retainedSessionPage.request.patch(projectPath, {
    data: { description: "revoked session must not write" },
    headers: { "If-Match": `"${currentRevision + 1}"`, Origin: origin },
  });
  expect(revokedSessionPatch.status()).toBe(401);
  await retainedSessionContext.close();

  const oldPasswordContext = await browser.newContext();
  try {
    const oldPasswordPage = await oldPasswordContext.newPage();
    await oldPasswordPage.goto(`/projects/${projectId}`);
    await oldPasswordPage.getByLabel("편집 비밀번호").fill(password);
    await oldPasswordPage.getByRole("button", { name: "편집 잠금 해제" }).click();
    await expect(oldPasswordPage.getByText("읽기 전용", { exact: true })).toBeVisible();
    await expect(oldPasswordPage.getByRole("status")).toContainText("올바르지 않습니다");
    await oldPasswordPage.getByLabel("편집 비밀번호").fill(rotatedPassword);
    await oldPasswordPage.getByRole("button", { name: "편집 잠금 해제" }).click();
    await expect(oldPasswordPage.getByText("편집 가능", { exact: true })).toBeVisible();
  } finally {
    await oldPasswordContext.close();
  }

  await page.getByRole("button", { name: "편집 모드 종료" }).click();
  await expect(page.getByText("읽기 전용", { exact: true })).toBeVisible();
  await expect(page.getByRole("status")).toContainText("종료했습니다");
  const logoutAgain = await page.request.delete(`${projectPath}/edit-sessions/current`, {
    headers: { Origin: origin },
  });
  expect(logoutAgain.status()).toBe(204);
  const rejectedAfterLogout = await page.request.patch(projectPath, {
    data: { description: "must not write" },
    headers: { "If-Match": `"${currentRevision + 1}"`, Origin: origin },
  });
  expect(rejectedAfterLogout.status()).toBe(401);
});
