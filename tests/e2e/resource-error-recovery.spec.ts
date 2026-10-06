import { expect, test, type Page, type Route } from "@playwright/test";
import { deferred } from "../fixtures/stateful-project";

type Failure = "409" | "422" | "412" | "500" | "network" | "malformed" | "401";
async function fixture(page: Page, longName = false) {
  const state = {
    catalog: { data: { revision: 7,
      resources: [{ id: "r1", name: longName ? "긴리소스이름".repeat(30) : "담당자 A", code: "R1", description: "", active: true }, { id: "r2", name: "담당자 B", code: "R2", description: "", active: true }],
      groups: [{ id: "g1", name: "물류팀", code: "G1", description: "", active: true, memberResourceIds: ["r1"] }],
    } },
    mutationFailure: null as Failure | null, getFailure: null as Failure | null,
    loginNetwork: false, passwordNetwork: false, gate: null as ReturnType<typeof deferred> | null,
    gets: 0, posts: 0, logins: 0, memberPuts: 0, matches: [] as string[], passwordMatches: [] as (string | undefined)[],
  };
  await page.route("**/api/resource-catalog/admin-sessions", (route) => {
    if (route.request().method() === "DELETE") return route.fulfill({ status: 204 });
    state.logins++;
    return state.loginNetwork ? route.abort() : route.fulfill({ status: 201, json: { data: { permission: "resource_catalog_admin", expiresAt: "2026-09-30T00:00:00Z" } } });
  });
  await page.route("**/api/resource-catalog/admin-password", (route) => {
    state.passwordMatches.push(route.request().headers()["if-match"]);
    return state.passwordNetwork ? route.abort() : route.fulfill({ json: { data: {} } });
  });
  async function mutate(route: Route) {
    state.posts++;
    state.matches.push(route.request().headers()["if-match"]);
    if (route.request().method() === "PUT") state.memberPuts++;
    const failure = state.mutationFailure;
    if (failure === "network") return route.abort();
    if (failure === "malformed") return route.fulfill({ json: { data: { ...state.catalog.data, revision: 1.5 } } });
    if (failure) {
      if (failure === "412") state.catalog.data.revision++;
      return route.fulfill({ status: Number(failure), json: { error: { code: "TEST_FAILURE" } } });
    }
    const body = route.request().postDataJSON();
    if (route.request().method() === "POST") {
      const item = { id: `new-${state.posts}`, name: body.name, code: body.code, description: "", active: true };
      if (new URL(route.request().url()).pathname === "/api/resources") state.catalog.data.resources.push(item);
      else state.catalog.data.groups.push({ ...item, memberResourceIds: [] });
    }
    state.catalog.data.revision++;
    return route.fulfill({ json: state.catalog });
  }
  await page.route("**/api/resources", async (route) => {
    if (route.request().method() !== "GET") return mutate(route);
    state.gets++;
    if (state.gate) await state.gate.promise;
    if (state.getFailure === "network") return route.abort();
    if (state.getFailure === "malformed") return route.fulfill({ json: { data: { ...state.catalog.data, groups: [null] } } });
    if (state.getFailure) return route.fulfill({ status: Number(state.getFailure), json: {} });
    return route.fulfill({ json: state.catalog });
  });
  await page.route("**/api/resources/*", mutate);
  await page.route("**/api/resource-groups", mutate);
  await page.route("**/api/resource-groups/*/members", mutate);
  await page.route("**/api/resource-groups/*", mutate);
  return state;
}
async function login(page: Page) {
  await page.getByLabel("관리자 비밀번호", { exact: true }).fill("test-admin");
  await page.getByRole("button", { name: "로그인", exact: true }).click();
}
function forms(page: Page) {
  return { resource: page.getByRole("dialog", { name: "리소스 추가", exact: true }), group: page.getByRole("tabpanel", { name: /^리소스 그룹/ }) };
}
async function openCreate(page: Page, kind: "resource" | "group" = "resource") {
  await page.getByRole("tab", { name: kind === "resource" ? /^리소스 \d/ : /^리소스 그룹/ }).click();
  await page.getByRole("button", { name: kind === "resource" ? "리소스 추가" : "그룹 추가", exact: true }).click();
  return page.getByRole("dialog", { name: kind === "resource" ? "리소스 추가" : "그룹 추가", exact: true });
}
async function openMembers(page: Page) {
  await page.getByRole("tab", { name: /^리소스 그룹/ }).click();
  await forms(page).group.getByRole("button", { name: "구성원", exact: true }).click();
}

for (const kind of ["resource", "group"] as const) {
  for (const failure of ["409", "422", "412", "500", "network"] as const) {
    test(`${kind} ${failure} 실패는 초안을 보존하고 명시 재시도 성공만 해당 폼을 비운다`, async ({ page }) => {
      const state = await fixture(page);
      await page.goto("/resources"); await login(page);
      await openMembers(page);
      await page.getByLabel("담당자 B (R2)", { exact: true }).check();
      const form = await openCreate(page, kind);
      await form.getByLabel("이름", { exact: true }).fill("새 이름");
      await form.getByLabel("코드", { exact: true }).fill("NEW-CODE");
      state.mutationFailure = failure;
      await form.getByRole("button", { name: "추가", exact: true }).click();
      await expect(page.getByRole("alert").filter({ hasText: /\S/ }).last()).toBeVisible();
      await expect(form.getByLabel("이름", { exact: true })).toHaveValue("새 이름");
      await expect(form.getByLabel("코드", { exact: true })).toHaveValue("NEW-CODE");
      expect(state.posts).toBe(1);
      state.mutationFailure = null;
      if (failure === "500" || failure === "network") {
        await expect(form.getByRole("button", { name: "추가", exact: true })).toBeDisabled();
        await form.getByRole("button", { name: "최신 목록 조회", exact: true }).click();
      }
      await form.getByRole("button", { name: "추가", exact: true }).click();
      await expect(form).toHaveCount(0);
      await openCreate(page, kind);
      await expect(form.getByLabel("이름", { exact: true })).toHaveValue("");
      await expect(form.getByLabel("코드", { exact: true })).toHaveValue("");
      await form.getByRole("button", { name: "취소", exact: true }).click();
      await page.getByRole("tab", { name: /^리소스 그룹/ }).click();
      await expect(page.getByLabel("담당자 B (R2)", { exact: true })).toBeChecked();
      expect(state.posts).toBe(2);
      expect(state.matches).toEqual(failure === "412" ? ['"7"', '"8"'] : ['"7"', '"7"']);
    });
  }
}

for (const failure of ["500", "network", "malformed"] as const) {
  test(`목록 ${failure} 실패는 이전 결과를 구분하고 GET retry 전에 mutation을 차단한다`, async ({ page }) => {
    const state = await fixture(page);
    await page.goto("/resources"); await login(page);
    const resource = await openCreate(page);
    await resource.getByLabel("이름", { exact: true }).fill("보존할 초안");
    state.getFailure = failure;
    await resource.getByRole("button", { name: "최신 목록 조회", exact: true }).click();
    await expect(page.getByRole("alert").filter({ hasText: /\S/ }).last()).toBeVisible();
    await expect(page.getByText("이전 조회 결과입니다. 최신 목록을 확인하기 전에는 변경할 수 없습니다.")).toBeVisible();
    await expect(resource.getByRole("button", { name: "추가", exact: true })).toBeDisabled();
    expect(state.posts).toBe(0);
    state.getFailure = null;
    await resource.getByRole("button", { name: "최신 목록 조회", exact: true }).click();
    await expect(resource.getByRole("button", { name: "추가", exact: true })).toBeEnabled();
    await expect(resource.getByLabel("이름", { exact: true })).toHaveValue("보존할 초안");
  });
}

test("목록 refresh 지연은 중복 GET과 mutation을 잠그고 멤버 초안을 덮지 않는다", async ({ page }) => {
  const state = await fixture(page);
  await page.goto("/resources"); await login(page);
  await openMembers(page);
  const members = page.getByRole("region", { name: "물류팀 구성원", exact: true });
  await members.getByLabel("담당자 B (R2)", { exact: true }).check();
  await members.getByRole("textbox", { name: "물류팀 구성원 리소스 검색" }).fill("담당자 B");
  state.gate = deferred();
  const initial = state.gets;
  await page.getByRole("button", { name: "새로고침", exact: true }).click();
  await expect(page.getByText("최신 목록을 불러오는 중… 이전 조회 결과를 표시합니다.")).toBeVisible();
  await expect(page.getByRole("button", { name: "새로고침", exact: true })).toBeDisabled();
  await expect(members.getByRole("button", { name: "구성원 저장" })).toBeDisabled();
  expect(state.posts).toBe(0);
  state.gate.resolve();
  await expect(members.getByRole("button", { name: "구성원 저장" })).toBeEnabled();
  expect(state.gets).toBe(initial + 1);
  await expect(members.getByLabel("담당자 B (R2)", { exact: true })).toBeChecked();
  await expect(members.getByRole("textbox", { name: "물류팀 구성원 리소스 검색" })).toHaveValue("담당자 B");
  state.catalog.data.groups = [];
  await page.getByRole("button", { name: "새로고침", exact: true }).click();
  await expect(members.getByRole("alert")).toContainText("초안을 보존");
  await expect(members.getByRole("button", { name: "구성원 저장" })).toBeDisabled();
  await expect(members.getByLabel("담당자 B (R2)", { exact: true })).toBeChecked();
  expect(state.memberPuts).toBe(0);
});

test("401 재로그인은 비민감 초안·검색·구성원을 보존하고 모든 비밀번호를 지운다", async ({ page }) => {
  const state = await fixture(page);
  await page.goto("/resources"); await login(page);
  await openMembers(page);
  await page.getByLabel("담당자 B (R2)", { exact: true }).check();
  await page.getByRole("tab", { name: /^리소스 \d/ }).click();
  await page.getByRole("textbox", { name: "리소스 검색", exact: true }).fill("담당자");
  await openCreate(page);
  await forms(page).resource.getByLabel("이름", { exact: true }).fill("보존 이름");
  state.mutationFailure = "401";
  await forms(page).resource.getByRole("button", { name: "추가", exact: true }).click();
  await expect(page.getByRole("heading", { name: "관리자 로그인" })).toBeVisible();
  await expect(page.getByLabel("관리자 비밀번호", { exact: true })).toHaveValue("");
  await expect(page.getByLabel("관리자 비밀번호", { exact: true })).toBeFocused();
  state.mutationFailure = null;
  await login(page);
  await page.getByRole("button", { name: "보존한 초안 계속 편집" }).click();
  await expect(forms(page).resource.getByLabel("이름", { exact: true })).toHaveValue("보존 이름");
  await forms(page).resource.getByRole("button", { name: "취소", exact: true }).click();
  await page.getByRole("button", { name: "초안 폐기", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "리소스 검색", exact: true })).toHaveValue("담당자");
  await page.getByRole("tab", { name: /^리소스 그룹/ }).click();
  await expect(page.getByLabel("담당자 B (R2)", { exact: true })).toBeChecked();
  await page.getByRole("button", { name: "관리자 비밀번호 변경", exact: true }).click();
  const passwordDialog = page.getByRole("dialog", { name: "관리자 비밀번호 변경" });
  await expect(passwordDialog.getByLabel("새 비밀번호", { exact: true })).toHaveValue("");
  await expect(passwordDialog.getByLabel("새 비밀번호 확인", { exact: true })).toHaveValue("");
  await passwordDialog.getByRole("button", { name: "취소", exact: true }).click();
  expect(state.posts).toBe(1);
});

test("인증 성공 후 목록 실패는 재로그인 없이 GET retry하고 불명확한 canonical은 mutation을 잠근다", async ({ page }) => {
  const state = await fixture(page);
  state.getFailure = "500";
  await page.goto("/resources"); await login(page);
  await expect(page.getByRole("button", { name: "다시 시도" })).toBeVisible();
  state.getFailure = null;
  await page.getByRole("button", { name: "다시 시도" }).click();
  const resource = await openCreate(page);
  await resource.getByLabel("이름", { exact: true }).fill("초안");
  state.mutationFailure = "malformed";
  await resource.getByRole("button", { name: "추가", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: /\S/ }).last()).toBeVisible();
  await expect(resource.getByRole("button", { name: "추가", exact: true })).toBeDisabled();
  await expect(resource.getByLabel("이름", { exact: true })).toHaveValue("초안");
  expect(state.posts).toBe(1);
  state.mutationFailure = null;
  await resource.getByRole("button", { name: "최신 목록 조회" }).click();
  await expect(resource.getByRole("button", { name: "추가", exact: true })).toBeEnabled();
  expect(state.logins).toBe(1);
  expect(state.posts).toBe(1);
});

test("인증·비밀번호 변경 network 실패도 비밀번호를 지우고 성공은 status로 안내한다", async ({ page }) => {
  const state = await fixture(page);
  state.loginNetwork = true;
  await page.goto("/resources"); await login(page);
  await expect(page.getByRole("alert").filter({ hasText: /\S/ }).last()).toBeVisible();
  await expect(page.getByLabel("관리자 비밀번호", { exact: true })).toHaveValue("");
  state.loginNetwork = false; await login(page);

  await page.getByRole("button", { name: "관리자 비밀번호 변경", exact: true }).click();
  const passwordDialog = page.getByRole("dialog", { name: "관리자 비밀번호 변경" });
  state.passwordNetwork = true;
  await passwordDialog.getByLabel("새 비밀번호", { exact: true }).fill("new-admin");
  await passwordDialog.getByLabel("새 비밀번호 확인", { exact: true }).fill("new-admin");
  await passwordDialog.getByRole("button", { name: "비밀번호 변경", exact: true }).click();
  await expect(passwordDialog.getByRole("alert")).toContainText("결과를 확인할 수 없습니다");
  await expect(passwordDialog.getByLabel("새 비밀번호", { exact: true })).toHaveValue("");
  await expect(passwordDialog.getByLabel("새 비밀번호 확인", { exact: true })).toHaveValue("");

  state.passwordNetwork = false;
  await passwordDialog.getByLabel("새 비밀번호", { exact: true }).fill("new-admin");
  await passwordDialog.getByLabel("새 비밀번호 확인", { exact: true }).fill("new-admin");
  await passwordDialog.getByRole("button", { name: "비밀번호 변경", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "관리자 비밀번호를 변경했습니다." })).toBeVisible();
  await expect(passwordDialog).toHaveCount(0);
  expect(state.passwordMatches).toEqual([undefined, undefined]);
});

test("비밀번호 변경 성공 뒤 client validation 실패는 이전 성공 안내를 제거한다", async ({ page }) => {
  await fixture(page);
  await page.goto("/resources"); await login(page);

  await page.getByRole("button", { name: "관리자 비밀번호 변경", exact: true }).click();
  let passwordDialog = page.getByRole("dialog", { name: "관리자 비밀번호 변경" });
  await passwordDialog.getByLabel("새 비밀번호", { exact: true }).fill("new-admin");
  await passwordDialog.getByLabel("새 비밀번호 확인", { exact: true }).fill("new-admin");
  await passwordDialog.getByRole("button", { name: "비밀번호 변경", exact: true }).click();
  const success = page.getByRole("status").filter({ hasText: "관리자 비밀번호를 변경했습니다." });
  await expect(success).toBeVisible();

  await page.getByRole("button", { name: "관리자 비밀번호 변경", exact: true }).click();
  passwordDialog = page.getByRole("dialog", { name: "관리자 비밀번호 변경" });
  await passwordDialog.getByLabel("새 비밀번호", { exact: true }).fill("1234567890123");
  await passwordDialog.getByLabel("새 비밀번호 확인", { exact: true }).fill("1234567890123");
  await passwordDialog.getByRole("button", { name: "비밀번호 변경", exact: true }).click();

  await expect(passwordDialog.getByRole("alert")).toContainText("새 관리자 비밀번호는 1~12자");
  await expect(success).toHaveCount(0);
});

for (const getFailure of ["500", "401"] as const) {
  test(`412 canonical GET ${getFailure}는 인증 만료와 목록 실패를 구분하고 POST를 자동 반복하지 않는다`, async ({ page }) => {
    const state = await fixture(page);
    await page.goto("/resources"); await login(page);
    const resource = await openCreate(page);
    await resource.getByLabel("이름", { exact: true }).fill("충돌 초안");
    state.mutationFailure = "412";
    state.getFailure = getFailure;
    await resource.getByRole("button", { name: "추가", exact: true }).click();
    if (getFailure === "401") {
      await expect(page.getByLabel("관리자 비밀번호", { exact: true })).toBeFocused();
      await expect(page.getByRole("alert").filter({ hasText: /\S/ }).last()).toContainText("세션이 만료");
    } else {
      await expect(page.getByRole("alert").filter({ hasText: /\S/ }).last()).toContainText("최신 목록");
      await expect(resource.getByRole("button", { name: "추가", exact: true })).toBeDisabled();
    }
    expect(state.posts).toBe(1);
    state.mutationFailure = null; state.getFailure = null;
    if (getFailure === "401") { await login(page); await page.getByRole("button", { name: "보존한 초안 계속 편집" }).click(); }
    else await resource.getByRole("button", { name: "최신 목록 조회", exact: true }).click();
    await expect(resource.getByLabel("이름", { exact: true })).toHaveValue("충돌 초안");
    await expect(resource.getByRole("button", { name: "추가", exact: true })).toBeEnabled();
    expect(state.posts).toBe(1);
    await resource.getByRole("button", { name: "추가", exact: true }).click();
    await expect(resource).toHaveCount(0);
    await openCreate(page);
    await expect(resource.getByLabel("이름", { exact: true })).toHaveValue("");
    expect(state.matches).toEqual(['"7"', '"8"']);
  });
}

for (const width of [390, 768, 1024, 1440]) {
  test(`오류 초안·긴 이름·키보드 retry ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const state = await fixture(page, true);
    await page.goto("/resources"); await login(page);
    const resource = await openCreate(page);
    await resource.getByLabel("이름", { exact: true }).fill("오류 후 보존 초안");
    state.getFailure = "500";
    await resource.getByRole("button", { name: "최신 목록 조회", exact: true }).click();
    await expect(page.getByRole("alert").filter({ hasText: /\S/ }).last()).toBeVisible();
    const retry = resource.getByRole("button", { name: "최신 목록 조회", exact: true });
    await retry.focus(); await expect(retry).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
    await page.screenshot({ path: `output/playwright/issue-268/error-draft-${width}.png` });
    state.getFailure = null;
    await page.keyboard.press("Enter");
    await expect(resource.getByLabel("이름", { exact: true })).toHaveValue("오류 후 보존 초안");
    await expect(resource.getByRole("button", { name: "추가", exact: true })).toBeEnabled();
  });
}
