import { expect, test, isolatedApplicationOptions, submitProjectAndExpectCreated } from "./fixtures/isolated-application";

test.use(isolatedApplicationOptions);

test("Issue #479 private project enforces list unlock, direct SSR lock and scoped API read gate", async ({ page, browser }) => {
  test.setTimeout(90_000);
  const name = `Private V479 ${Date.now()}`;
  const password = "Private479!";
  await page.goto("/projects/new");
  await page.getByLabel("프로젝트 이름").fill(name);
  await page.getByLabel("편집 비밀번호").fill(password);
  await page.getByRole("radio", { name: "비공개" }).check();
  await submitProjectAndExpectCreated(page);
  await page.waitForURL(/\/projects\/[0-9a-f-]{36}$/);
  const id = page.url().split("/").at(-1)!;
  const origin = new URL(page.url()).origin;
  const guestContext = await browser.newContext();
  const guest = await guestContext.newPage();
  try {
    await guest.goto(`${origin}/projects/${id}`);
    await expect(guest.getByRole("heading", { name: "비공개 프로젝트" })).toBeVisible();
    expect(await guest.title()).not.toContain(name);
    expect(await guest.locator("body").innerText()).not.toContain(name);

    const canonical = await guest.request.get(`${origin}/api/projects/${id}`);
    expect(canonical.status()).toBe(401);
    const canonicalBody = await canonical.text();
    expect(canonicalBody).not.toContain(name);
    // Code Review P1: URL.pathname retains percent escapes, but Next route params are decoded.
    // The same Project must be unauthorized under either route spelling.
    const encodedId = `%${id.charCodeAt(0).toString(16).padStart(2, "0")}${id.slice(1)}`;
    const encoded = await guest.request.get(`${origin}/api/projects/${encodedId}/logistics`);
    expect(encoded.status()).toBe(401);
    expect(await encoded.text()).not.toContain(name);
    const kpi = await guest.request.get(`${origin}/api/projects/${id}/logistics/kpi`);
    expect(kpi.status()).toBe(401);
    const views = await guest.request.post(`${origin}/api/projects/${id}/resource-dashboard/views`, { data: {} });
    expect(views.status()).toBe(401);

    await guest.goto(`${origin}/`);
    const privateButton = guest.getByRole("button", { name: `${name} 비공개 프로젝트 열기` });
    await expect(privateButton).toBeVisible();
    await privateButton.click();
    await expect(guest.getByRole("dialog")).toContainText("비공개 프로젝트 열기");
    await guest.getByLabel("프로젝트 비밀번호").fill("wrong479");
    await guest.getByRole("button", { name: "비밀번호 확인 후 열기" }).click();
    await expect(guest.getByRole("alert")).toContainText("올바르지 않습니다");
    await expect(guest.getByLabel("프로젝트 비밀번호")).toHaveValue("");
    expect(new URL(guest.url()).pathname).toBe("/");

    await guest.getByLabel("프로젝트 비밀번호").fill(password);
    await guest.getByRole("button", { name: "비밀번호 확인 후 열기" }).click();
    await expect(guest).toHaveURL(new RegExp(`/projects/${id}$`));
    await expect(guest.getByRole("heading", { name })).toBeVisible();
    const authenticated = await guest.request.get(`${origin}/api/projects/${id}`);
    expect(authenticated.status()).toBe(200);
    const snapshot = await authenticated.json();
    expect(snapshot.data.project.visibility).toBe("private");
    // Code Review P1: scoped exports must use the trusted internal snapshot after HTTP auth.
    const jsonExport = await guest.request.post(`${origin}/api/projects/${id}/exports/json`, {
      data: { scope: "project" },
      headers: { Origin: origin, "If-Match": `"${snapshot.data.project.revision}"` },
    });
    expect(jsonExport.status()).toBe(200);
    expect(jsonExport.headers()["content-type"]).toContain("application/vnd.mastergantt.import+json");
  } finally {
    await guestContext.close();
  }
});
