import { writeFile, mkdir } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { loginResourceAdmin453, resourceAdmin453 } from "../fixtures/resource-admin-453";

test("#453 baseline before 5폭 동일 긴 카탈로그 실제 화면과 geometry", async ({ page }) => {
  test.skip(process.env.RESOURCE_CAPTURE !== "before", "production 변경 전 baseline 캡처 전용");
  await resourceAdmin453(page);
  await loginResourceAdmin453(page);
  await page.getByRole("region", { name: "리소스 그룹", exact: true }).getByRole("button", { name: "구성원", exact: true }).first().click();
  await mkdir("output/playwright/issue-453/before", { recursive: true });
  for (const width of [390, 768, 1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    const geometry = await page.evaluate(() => {
      const box = (element: Element) => element.getBoundingClientRect().toJSON();
      const sections = Array.from(document.querySelectorAll(".workspace-section section"));
      return { viewport: innerWidth, documentWidth: document.documentElement.scrollWidth, zoom: "100% default browser zoom",
        sections: sections.map((element) => ({ heading: element.querySelector("h2")?.textContent, bounds: box(element) })),
        rows: Array.from(document.querySelectorAll(".workspace-section li")).map(box),
        controls: Array.from(document.querySelectorAll(".workspace-section button,.workspace-section input,.workspace-section select")).filter((element) => element.checkVisibility()).map((element) => ({ label: element.getAttribute("aria-label") ?? element.textContent ?? element.closest("label")?.textContent, bounds: box(element) })),
        footer: Array.from(document.querySelectorAll(".workspace-section button")).filter((element) => ["닫기", "구성원 저장"].includes(element.textContent ?? "")).map((element) => ({ label: element.textContent, bounds: box(element) })),
      };
    });
    expect(geometry.sections.length).toBeGreaterThanOrEqual(2);
    await writeFile(`output/playwright/issue-453/before/geometry-${width}.json`, JSON.stringify(geometry, null, 2));
    await page.screenshot({ path: `output/playwright/issue-453/before/catalog-${width}.png`, fullPage: true });
  }
});

test("#453 탭별 조건·스크롤·구성원 초안과 키보드 폐기 확인", async ({ page }) => {
  const state = await resourceAdmin453(page); await loginResourceAdmin453(page);
  const resourceTab = page.getByRole("tab", { name: /^리소스 \d/ }), groupTab = page.getByRole("tab", { name: /^리소스 그룹/ });
  await page.getByLabel("리소스 검색", { exact: true }).fill("RESOURCE");
  await page.getByLabel("리소스 상태", { exact: true }).selectOption("active");
  const scroll = page.getByRole("region", { name: "리소스 목록 가로 스크롤" });
  await page.setViewportSize({ width: 390, height: 900 });
  await scroll.evaluate((e) => { e.scrollLeft = 230; e.scrollTop = 70; });
  const before = await scroll.evaluate((e) => ({ left: e.scrollLeft, top: e.scrollTop }));
  expect(before.top).toBeGreaterThanOrEqual(70); expect(before.left).toBe(230);
  const gets = state.gets;
  await resourceTab.focus(); await resourceTab.press("End"); await expect(groupTab).toBeFocused();
  await expect(page.locator("#resource-panel-resources")).toBeHidden();
  await page.keyboard.press("Tab"); await expect(page.getByLabel("리소스 그룹 검색", { exact: true })).toBeFocused();
  await page.getByRole("button", { name: "구성원", exact: true }).first().click();
  const members = page.getByRole("region", { name: /관리 0 구성원/ });
  const extra = members.getByRole("checkbox", { name: `${state.catalog.data.resources[1].name} (${state.catalog.data.resources[1].code})`, exact: true }); await extra.check();
  await members.getByRole("textbox").fill("RESOURCE-1-");
  await groupTab.press("Home"); await expect(resourceTab).toBeFocused();
  await expect(page.getByLabel("리소스 검색", { exact: true })).toHaveValue("RESOURCE");
  await expect(page.getByLabel("리소스 상태", { exact: true })).toHaveValue("active");
  expect(await scroll.evaluate((e) => ({ left: e.scrollLeft, top: e.scrollTop }))).toEqual(before);
  await resourceTab.press("ArrowRight");
  await expect(extra).toBeChecked();
  await expect(members.getByRole("textbox")).toHaveValue("RESOURCE-1-");
  expect(state.gets).toBe(gets); expect(state.requests).toHaveLength(0);
  await members.getByRole("button", { name: "닫기", exact: true }).click();
  const confirm = page.getByRole("dialog", { name: "초안 폐기 확인" });
  await expect(confirm.getByRole("button", { name: "계속 편집" })).toBeFocused();
  await confirm.getByRole("button", { name: "계속 편집" }).click();
  await expect(extra).toBeChecked();
  await expect(members.getByRole("button", { name: "닫기", exact: true })).toBeFocused();
  await page.getByRole("button", { name: "구성원", exact: true }).nth(1).click();
  await confirm.getByRole("button", { name: "초안 폐기", exact: true }).click();
  await expect(page.getByRole("region", { name: /관리 1 구성원/ })).toBeVisible();
  expect(state.requests).toHaveLength(0);
});

test("#453 프로필 원자 저장·403 초안·폐기 확인·pending 중복과 Escape", async ({ page }) => {
  const state = await resourceAdmin453(page); await loginResourceAdmin453(page);
  const name = state.catalog.data.resources[0].name;
  await page.getByRole("button", { name: `${name} 프로필 편집`, exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "리소스 프로필 편집" });
  const grade = dialog.getByRole("combobox"), pi = dialog.getByRole("checkbox", { name: `${name} PI 역할`, exact: true });
  await grade.selectOption("EXPERT"); await pi.check(); expect(state.requests).toHaveLength(0);
  await page.keyboard.press("Escape");
  const confirm = page.getByRole("dialog", { name: "초안 폐기 확인" });
  await expect(confirm.getByRole("button", { name: "계속 편집" })).toBeFocused();
  await page.keyboard.press("Escape"); await expect(confirm).toHaveCount(0); await expect(pi).toBeFocused();
  await page.keyboard.press("Escape"); await expect(confirm.getByRole("button", { name: "계속 편집" })).toBeFocused();
  await confirm.getByRole("button", { name: "계속 편집" }).click();
  await expect(pi).toBeFocused();
  await expect(grade).toHaveValue("EXPERT"); await expect(pi).toBeChecked();
  state.failure = "403";
  await dialog.getByRole("button", { name: "프로필 저장" }).click();
  await expect(dialog.getByRole("alert")).toContainText("권한이 없습니다"); await expect(grade).toHaveValue("EXPERT"); await expect(pi).toBeChecked();
  expect(state.requests).toHaveLength(1); expect(state.requests[0].body).toEqual({ developerGrade: "EXPERT", roles: ["PI"] });
  state.failure = null; let release!: () => void; state.gate = new Promise<void>((r) => { release = r; });
  await dialog.locator("form").evaluate((form) => { (form as HTMLFormElement).requestSubmit(); (form as HTMLFormElement).requestSubmit(); });
  await expect(dialog.getByRole("button", { name: "저장 중…" })).toBeDisabled();
  await page.keyboard.press("Escape"); await expect(dialog).toBeVisible(); await expect(grade).toBeDisabled();
  expect(state.requests).toHaveLength(2); release();
  await expect(dialog).toHaveCount(0); expect(state.catalog.data.resources[0].roles).toEqual(["PI"]);
  await expect(page.getByRole("button", { name: `${name} 프로필 편집`, exact: true })).toBeFocused();
});

for (const unit of ["create", "member"] as const) test(`#453 ${unit} pending 중복 요청 1·Escape 잠금`, async ({ page }) => {
  const state = await resourceAdmin453(page); await loginResourceAdmin453(page);
  let release!: () => void; state.gate = new Promise<void>((r) => { release = r; });
  if (unit === "create") {
    await page.getByRole("button", { name: "리소스 추가", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "리소스 추가", exact: true });
    await dialog.getByLabel("이름", { exact: true }).fill("중복 생성 방지");
    await dialog.locator("form").evaluate((form) => { (form as HTMLFormElement).requestSubmit(); (form as HTMLFormElement).requestSubmit(); });
    await expect(dialog.getByRole("button", { name: "저장 중…" })).toBeDisabled(); await page.keyboard.press("Escape"); await expect(dialog).toBeVisible();
    expect(state.requests).toHaveLength(1); release(); await expect(dialog).toHaveCount(0);
  } else {
    await page.getByRole("tab", { name: /^리소스 그룹/ }).click(); await page.getByRole("button", { name: "구성원", exact: true }).first().click();
    const save = page.getByRole("button", { name: "구성원 저장", exact: true });
    await save.evaluate((button) => { (button as HTMLButtonElement).click(); (button as HTMLButtonElement).click(); });
    await expect(save).toBeDisabled(); expect(state.requests).toHaveLength(1); release(); await expect(save).toBeEnabled();
  }
});

for (const failure of [false, true]) test(`#453 명시 로그아웃 ${failure ? "실패" : "성공"} 잠금·늦은 응답과 기존 초기화 범위`, async ({ page }) => {
  const state = await resourceAdmin453(page); await loginResourceAdmin453(page);
  await page.getByLabel("리소스 검색", { exact: true }).fill("English");
  await page.getByRole("tab", { name: /^리소스 그룹/ }).click(); await page.getByRole("button", { name: "구성원", exact: true }).first().click();
  state.logoutFailure = failure; let release!: () => void; state.logoutGate = new Promise<void>((r) => { release = r; });
  await page.getByRole("button", { name: "로그아웃", exact: true }).click();
  await expect(page.getByRole("button", { name: "새로고침", exact: true })).toBeDisabled(); expect(state.logouts).toBe(1);
  release(); await expect(page.getByRole("heading", { name: "관리자 로그인" })).toBeVisible();
  await expect(page.getByLabel("관리자 비밀번호", { exact: true })).toHaveValue("");
  await page.getByLabel("관리자 비밀번호", { exact: true }).fill("Synthetic453!"); await page.getByRole("button", { name: "로그인", exact: true }).click();
  await expect(page.getByRole("region", { name: /관리 0 구성원/ })).toHaveCount(0);
  await page.getByRole("tab", { name: /^리소스 \d/ }).click(); await expect(page.getByLabel("리소스 검색", { exact: true })).toHaveValue("English");
  expect(state.requests).toHaveLength(0);
});

test("#453 after 동일 5폭 두 표·모달·footer·focus geometry", async ({ page, browser }) => {
  await resourceAdmin453(page); await loginResourceAdmin453(page);
  await mkdir("output/playwright/issue-453/after", { recursive: true });
  const environment = { ...await page.evaluate(() => ({ locale: navigator.language, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, userAgent: navigator.userAgent })), browserVersion: browser.version(), capturedAt: new Date().toISOString(), zoom: "100% default; native 125% NOT TESTED", widths: [390, 768, 1024, 1440, 1920] };
  await writeFile("output/playwright/issue-453/after/environment.json", JSON.stringify(environment, null, 2));
  for (const width of [390, 768, 1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    for (const kind of ["resources", "groups"] as const) {
      await page.getByRole("tab", { name: kind === "resources" ? /^리소스 \d/ : /^리소스 그룹/ }).click();
      if (kind === "groups") await page.getByRole("button", { name: "구성원", exact: true }).first().click();
      const panel = page.locator(`#resource-panel-${kind}`);
      await panel.getByRole("textbox").first().focus();
      const geometry = await panel.evaluate((element) => {
        const box = (e: Element) => { const r = e.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height }; };
        const contains = (owner: Element, control: Element, inset = 0) => { const a = box(owner), b = box(control); return b.left - inset >= a.left - 1 && b.right + inset <= a.right + 1 && b.top - inset >= a.top - 1 && b.bottom + inset <= a.bottom + 1; };
        const overlap = (a: Element, b: Element) => { const x = box(a), y = box(b); return Math.min(x.right, y.right) - Math.max(x.left, y.left) > 1 && Math.min(x.bottom, y.bottom) - Math.max(x.top, y.top) > 1; };
        const table = element.querySelector("table")!, headers = [...table.querySelectorAll("th")], cells = [...table.querySelectorAll("tbody tr:first-child td")];
        const controls = [...element.querySelectorAll("button,input,select")].filter((e) => e.checkVisibility());
        const cellControls = controls.filter((e) => !!e.closest("td"));
        const badges = [...table.querySelectorAll("tbody td:nth-child(2) span")];
        const owners = controls.filter((e) => !e.closest("td")).map((control) => ({ control, owner: control.closest("label") ?? control.parentElement! }));
        const siblingPairs = controls.flatMap((a, i) => controls.slice(i + 1).filter((b) => a.parentElement === b.parentElement).map((b) => ({ a, b })));
        const scroll = table.parentElement!, focus = document.activeElement!;
        const footer = [...element.querySelectorAll("button")].filter((e) => ["닫기", "구성원 저장"].includes(e.textContent ?? ""));
        return { viewport: innerWidth, documentWidth: document.documentElement.scrollWidth, available: box(document.querySelector(".workspace-section")!), panel: box(element), table: box(table), scrollOwner: { ...box(scroll), clientWidth: scroll.clientWidth, scrollWidth: scroll.scrollWidth, clientHeight: scroll.clientHeight, scrollHeight: scroll.scrollHeight, overflowX: getComputedStyle(scroll).overflowX },
          headerBodyAligned: headers.every((e, i) => Math.abs(box(e).left - box(cells[i]).left) < 1 && Math.abs(box(e).width - box(cells[i]).width) < 1), identityWidth: box(cells[0]).width,
          roleBadgeCount: badges.length, roleBadgesContained: badges.every((badge) => contains(badge.closest("td")!, badge)), roleBadgesNonOverlap: badges.every((a, i) => badges.slice(i + 1).filter((b) => a.parentElement === b.parentElement).every((b) => !overlap(a, b))), cellControlCount: cellControls.length, allControlsContained: cellControls.every((e) => contains(e.closest("td")!, e)), allOtherControlsContained: owners.every(({ owner, control }) => contains(owner, control)), siblingNonOverlap: siblingPairs.every(({ a, b }) => !overlap(a, b)),
          focus: { label: focus.getAttribute("aria-label"), bounds: box(focus), outline: getComputedStyle(focus).outlineWidth, fullyVisible: box(focus).left >= 6 && box(focus).right <= innerWidth - 6 }, footer: footer.map((e) => ({ label: e.textContent, ...box(e) })),
          inactiveFocusables: [...document.querySelectorAll('[role="tabpanel"][hidden] button,[role="tabpanel"][hidden] input')].filter((e) => e.checkVisibility()).length,
        };
      });
      expect(geometry.documentWidth).toBeLessThanOrEqual(width + 1); expect(geometry.panel.width).toBeGreaterThanOrEqual(geometry.available.width - 2);
      expect(geometry.table.width).toBeGreaterThanOrEqual(kind === "resources" ? 976 : 800); expect(geometry.identityWidth).toBeGreaterThanOrEqual(239);
      expect(geometry.roleBadgesContained).toBe(true); expect(geometry.roleBadgesNonOverlap).toBe(true); if (kind === "resources") expect(geometry.roleBadgeCount).toBe(20);
      expect(geometry.headerBodyAligned).toBe(true); expect(geometry.allControlsContained).toBe(true); expect(geometry.allOtherControlsContained).toBe(true); expect(geometry.siblingNonOverlap).toBe(true); expect(geometry.inactiveFocusables).toBe(0); expect(geometry.focus.fullyVisible).toBe(true);
      if (geometry.footer.length) { expect(geometry.footer[0].left).toBeLessThan(geometry.footer[1].left); expect(Math.abs(geometry.footer[0].top + geometry.footer[0].height / 2 - geometry.footer[1].top - geometry.footer[1].height / 2)).toBeLessThanOrEqual(2); }
      await writeFile(`output/playwright/issue-453/after/${kind}-${width}.json`, JSON.stringify(geometry, null, 2));
      await page.screenshot({ path: `output/playwright/issue-453/after/${kind}-${width}.png`, fullPage: true });
    }
    await page.getByRole("tab", { name: /^리소스 \d/ }).click();
    for (const mode of ["create", "profile"] as const) {
      await page.getByRole("button", { name: mode === "create" ? "리소스 추가" : /프로필 편집$/, exact: mode === "create" }).first().click();
      const dialog = page.getByRole("dialog").last();
      await expect(dialog).not.toContainText(/revision\s*\d|Catalog Revision/i);
      const geometry = await dialog.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        const controls = [...element.querySelectorAll("button,input,select")];
        const focus = document.activeElement!.getBoundingClientRect();
        return { viewport: { width: innerWidth, height: innerHeight }, bounds: rect.toJSON(), documentWidth: document.documentElement.scrollWidth, controlCount: controls.length, allControlsContained: controls.every((e) => { const r = e.getBoundingClientRect(); return r.left >= rect.left && r.right <= rect.right && r.top >= rect.top && r.bottom <= rect.bottom; }), focusVisible: focus.left - 6 >= rect.left && focus.right + 6 <= rect.right && focus.top - 6 >= rect.top && focus.bottom + 6 <= rect.bottom,
          scrollOwners: [...element.querySelectorAll("div")].filter((e) => getComputedStyle(e).overflowY === "auto").map((e) => ({ clientHeight: e.clientHeight, scrollHeight: e.scrollHeight })),
        };
      });
      expect(geometry.bounds.x).toBeGreaterThanOrEqual(0); expect(geometry.bounds.right).toBeLessThanOrEqual(width); expect(geometry.bounds.bottom).toBeLessThanOrEqual(900); expect(geometry.allControlsContained).toBe(true); expect(geometry.focusVisible).toBe(true);
      await writeFile(`output/playwright/issue-453/after/${mode}-${width}.json`, JSON.stringify(geometry, null, 2)); await page.screenshot({ path: `output/playwright/issue-453/after/${mode}-${width}.png` });
      await page.keyboard.press("Escape"); await expect(dialog).toHaveCount(0);
    }
  }
});

for (const kind of ["리소스", "그룹"]) test(`#453 ${kind} 생성 dirty 취소·계속 편집·명시 폐기와 조회 전용 삭제 불가`, async ({ page }) => {
  const state = await resourceAdmin453(page); await loginResourceAdmin453(page);
  if (kind === "그룹") await page.getByRole("tab", { name: /^리소스 그룹/ }).click();
  const trigger = page.getByRole("button", { name: `${kind} 추가`, exact: true }); await trigger.click();
  const dialog = page.getByRole("dialog", { name: `${kind} 추가`, exact: true });
  await expect(dialog.getByLabel("이름", { exact: true })).toBeFocused(); await dialog.getByLabel("이름", { exact: true }).fill("폐기 전 보존");
  await dialog.getByRole("button", { name: "취소", exact: true }).click();
  await page.getByRole("button", { name: "계속 편집", exact: true }).click();
  await expect(dialog.getByLabel("이름", { exact: true })).toHaveValue("폐기 전 보존");
  await dialog.getByRole("button", { name: "취소", exact: true }).click(); await page.getByRole("button", { name: "초안 폐기", exact: true }).click();
  await expect(dialog).toHaveCount(0); await expect(trigger).toBeFocused(); await trigger.click(); await expect(dialog.getByLabel("이름", { exact: true })).toHaveValue("");
  await dialog.getByRole("button", { name: "취소", exact: true }).click();
  for (const button of await page.getByRole("button", { name: /삭제 불가$/ }).all()) { await button.scrollIntoViewIfNeeded(); const box = (await button.boundingBox())!; await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2); await button.focus(); await button.press("Enter"); }
  expect(state.requests).toHaveLength(0);
});

test("#453 사라진 선택 리소스는 부분 PUT 없이 보존하고 검색 밖 선택까지 전체 저장", async ({ page }) => {
  const state = await resourceAdmin453(page); await loginResourceAdmin453(page);
  await page.getByRole("tab", { name: /^리소스 그룹/ }).click(); await page.getByRole("button", { name: "구성원", exact: true }).first().click();
  const members = page.getByRole("region", { name: /관리 0 구성원/ });
  await members.getByRole("checkbox").nth(1).check(); await members.getByRole("textbox").fill("RESOURCE-1-");
  await members.getByRole("button", { name: "구성원 저장" }).click();
  await expect(page.getByRole("status").filter({ hasText: "변경사항을 저장했습니다." })).toBeVisible();
  expect(state.requests[0].body.resourceIds).toEqual(["453-r-0", "453-r-2", "453-r-1"]);
  expect(state.requests[0].revision).toBe('"7"');
  state.catalog.data.resources = state.catalog.data.resources.filter((r) => r.id !== "453-r-2");
  await page.getByRole("button", { name: "새로고침", exact: true }).click();
  await expect(members.getByRole("alert")).toContainText("리소스 1개의 선택을 보존");
  await expect(members.getByRole("button", { name: "구성원 저장" })).toBeDisabled(); expect(state.requests).toHaveLength(1);
});

test("#453 dirty 확인·pending 모달 5폭 bounds와 닫기 잠금", async ({ page }) => {
  const state = await resourceAdmin453(page); await loginResourceAdmin453(page);
  let release!: () => void;
  await page.getByRole("button", { name: "리소스 추가", exact: true }).click();
  const editor = page.getByRole("dialog", { name: "리소스 추가", exact: true });
  await editor.getByLabel("이름", { exact: true }).fill("긴 한국어 English 초안 및 pending 경계 검증");
  await editor.getByRole("button", { name: "취소", exact: true }).click();
  for (const phase of ["dirty", "pending"]) {
    if (phase === "pending") {
      await page.getByRole("button", { name: "계속 편집", exact: true }).click();
      state.gate = new Promise<void>((resolve) => { release = resolve; });
      await editor.getByRole("button", { name: "추가", exact: true }).click();
      await expect(editor.getByRole("button", { name: "저장 중…" })).toBeDisabled();
    }
    for (const width of [390, 768, 1024, 1440, 1920]) {
      await page.setViewportSize({ width, height: 900 });
      const dialog = page.getByRole("dialog").last();
      const geometry = await dialog.evaluate((element) => {
        const rect = element.getBoundingClientRect(), controls = [...element.querySelectorAll("button,input,select")];
        return { viewport: { width: innerWidth, height: innerHeight }, bounds: rect.toJSON(), documentWidth: document.documentElement.scrollWidth,
          allControlsContained: controls.every((e) => { const r = e.getBoundingClientRect(); return r.left >= rect.left && r.right <= rect.right && r.top >= rect.top && r.bottom <= rect.bottom; }),
          allControlsDisabled: controls.every((e) => e.matches(":disabled")), focusWithinModal: element.contains(document.activeElement), focusedLabel: document.activeElement?.getAttribute("aria-labelledby"), nativeModal: element.matches(":modal"),
        };
      });
      expect(geometry.bounds.x).toBeGreaterThanOrEqual(0); expect(geometry.bounds.right).toBeLessThanOrEqual(width); expect(geometry.bounds.bottom).toBeLessThanOrEqual(900); expect(geometry.allControlsContained).toBe(true); expect(geometry.nativeModal).toBe(true);
      if (phase === "dirty") await expect(dialog.getByRole("button", { name: "계속 편집", exact: true })).toBeFocused();
      else {
        expect(geometry.allControlsDisabled).toBe(true); expect(geometry.focusWithinModal).toBe(true);
        await page.keyboard.press("Tab"); await expect(editor).toBeFocused();
        await page.keyboard.press("Shift+Tab"); await expect(editor).toBeFocused();
        const closeBox = (await editor.getByRole("button", { name: "리소스 추가 닫기", exact: true }).boundingBox())!;
        await page.mouse.click(closeBox.x + closeBox.width / 2, closeBox.y + closeBox.height / 2);
        await page.keyboard.press("Escape"); await expect(editor).toBeVisible();
      }
      await writeFile(`output/playwright/issue-453/after/${phase}-${width}.json`, JSON.stringify(geometry, null, 2)); await page.screenshot({ path: `output/playwright/issue-453/after/${phase}-${width}.png` });
    }
  }
  expect(state.requests).toHaveLength(1); release(); await expect(editor).toHaveCount(0); await expect(page.getByRole("button", { name: "리소스 추가", exact: true })).toBeFocused();
});
