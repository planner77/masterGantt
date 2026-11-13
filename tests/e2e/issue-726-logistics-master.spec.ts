import { writeFile } from "node:fs/promises";
import { readLegacyFixtureCounts } from "./fixtures/legacy-logistics-seed";
import { expect, isolatedApplicationOptions, test } from "./fixtures/isolated-application";
import { createTargetProject, targetMasterPassword } from "./fixtures/target-project";
import { openWorkspaceView } from "./helpers/workspace-navigation";
import type { ProjectLogisticsResponse } from "../../src/contracts/logistics";

test.use({ ...isolatedApplicationOptions, isolatedProjectMasterAdminPassword: targetMasterPassword });

test("#726 Target0 master 설비·시스템 생성, 유형 실패 복구, Fleet·WorkArea와 초안 보존", async ({ page, isolatedApplication: origin, observeIsolatedApi }) => {
  test.setTimeout(150_000);
  const f = await createTargetProject(page, origin, observeIsolatedApi);
  const logistics = async () => {
    const response = await page.request.get(`${f.api}/logistics`);
    expect(response.ok()).toBe(true);
    return (await response.json() as ProjectLogisticsResponse).data.logistics;
  };
  const baseline = await f.snapshot();
  let failTypes = true;
  await page.route("**/api/logistics-catalog/types", async route => {
    if (failTypes) await route.fulfill({ status: 503, json: { error: { code: "TEST_UNAVAILABLE" } } });
    else await route.continue();
  });
  await page.reload();
  await openWorkspaceView(page, "equipment");
  await page.getByRole("button", { name: "+ 설비 추가", exact: true }).click();
  let dialog = page.getByRole("dialog", { name: "설비 추가", exact: true });
  await dialog.getByRole("textbox", { name: "설비 코드", exact: false }).fill("AMRA");
  await dialog.getByRole("textbox", { name: "설비명", exact: false }).fill("A 운반로봇");
  await expect(dialog).toContainText("설비 유형 조회에 실패해 저장할 수 없습니다");
  await expect(dialog.getByRole("button", { name: "유형 조회 실패", exact: true })).toBeDisabled();
  failTypes = false;
  await dialog.getByRole("button", { name: "유형 목록 다시 시도", exact: true }).click();
  await expect(dialog.getByRole("combobox", { name: "설비 유형", exact: false })).toBeEnabled();
  await dialog.getByRole("combobox", { name: "설비 유형", exact: false }).selectOption("amr");
  await dialog.getByRole("combobox", { name: "관리 단위", exact: true }).selectOption("fleet");
  await dialog.getByRole("spinbutton", { name: /수량/ }).fill("10");
  await dialog.getByRole("checkbox", { name: /A 작업구역/ }).check();
  for (const width of [390, 768, 1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: 1000 });
    const geometry = await dialog.evaluate(element => ({ document: document.documentElement.scrollWidth, viewport: window.innerWidth, left: element.getBoundingClientRect().left, right: element.getBoundingClientRect().right }));
    expect(geometry.document).toBeLessThanOrEqual(geometry.viewport + 1);
    expect(geometry.left).toBeGreaterThanOrEqual(0);
    expect(geometry.right).toBeLessThanOrEqual(width + 1);
  }
  await dialog.getByRole("button", { name: "저장", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  let saved = await logistics();
  expect(saved.equipment).toHaveLength(1);
  expect(saved.equipment[0]).toMatchObject({ code: "AMRA", managementUnit: "fleet", quantity: 10, workAreaIds: [f.catalog.data.workAreas[0].id] });

  await openWorkspaceView(page, "systems");
  for (const [code, type, layer, scope] of [["ACS-A", "acs", "controller", "processes"], ["MCS", "mcs", "coordinator", "project"]]) {
    await page.getByRole("button", { name: "+ 시스템 추가", exact: true }).click();
    dialog = page.getByRole("dialog", { name: "시스템 추가", exact: true });
    await dialog.getByRole("textbox", { name: "시스템 코드", exact: false }).fill(code);
    await dialog.getByRole("textbox", { name: "시스템명", exact: false }).fill(`${code} 원본`);
    await dialog.getByRole("combobox", { name: "시스템 유형", exact: false }).selectOption(type);
    await dialog.getByRole("combobox", { name: /계층/ }).selectOption(layer);
    await dialog.getByRole("combobox", { name: /적용 범위/ }).selectOption(scope);
    if (scope === "processes") {
      await expect(dialog.getByRole("button", { name: "저장", exact: true })).toBeDisabled();
      await dialog.getByRole("checkbox", { name: /A 공정/ }).check();
    }
    // Escape keeps the draft and returns focus to its originating field.
    const codeInput = dialog.getByRole("textbox", { name: "시스템 코드", exact: false });
    await codeInput.focus();
    await codeInput.press("Escape");
    await expect(dialog).toContainText("저장하지 않은 시스템 변경을 폐기할까요?");
    await expect(dialog.getByRole("button", { name: "계속 편집", exact: true })).toBeFocused();
    await dialog.getByRole("button", { name: "계속 편집", exact: true }).click();
    await expect(codeInput).toBeFocused();
    await codeInput.press("Escape");
    await expect(dialog.getByRole("button", { name: "계속 편집", exact: true })).toBeFocused();
    await dialog.getByRole("button", { name: "계속 편집", exact: true }).press("Escape");
    await expect(codeInput).toBeFocused();
    await expect(codeInput).toHaveValue(code);
    await expect(dialog.getByRole("textbox", { name: "시스템명", exact: false })).toHaveValue(`${code} 원본`);
    await expect(dialog.getByRole("combobox", { name: "시스템 유형", exact: false })).toHaveValue(type);
    await expect(dialog.getByRole("combobox", { name: /계층/ })).toHaveValue(layer);
    await expect(dialog.getByRole("combobox", { name: /적용 범위/ })).toHaveValue(scope);
    if (scope === "processes") await expect(dialog.getByRole("checkbox", { name: /A 공정/ })).toBeChecked();
    await dialog.getByRole("button", { name: "저장", exact: true }).click();
    await expect(dialog).toHaveCount(0);
  }
  saved = await logistics();
  expect(saved.equipment).toHaveLength(1);
  expect(saved.systems).toHaveLength(2);
  expect(saved.systems.find(system => system.code === "ACS-A")).toMatchObject({ scope: "processes", processIds: [f.processIds[0]] });
  expect(saved.systems.find(system => system.code === "MCS")).toMatchObject({ layer: "coordinator", scope: "project" });
  expect((await f.snapshot()).data.tasks).toEqual(baseline.data.tasks);
  const targets = await page.request.get(`${f.api}/logistics/targets`);
  expect(targets.status()).toBe(410);expect((await targets.json()).error.code).toBe("LOGISTICS_API_RETIRED");
  expect(readLegacyFixtureCounts(origin,f.publicId)).toEqual({targets:0,members:0,bindings:0,selectedMembers:0});
  await page.reload();
  await openWorkspaceView(page, "equipment");
  const equipmentCell = page.locator("#panel-equipment").getByRole("cell")
    .filter({ has: page.getByText("A 운반로봇", { exact: true }) });
  await expect(equipmentCell).toHaveCount(1);
  await expect(equipmentCell).toBeVisible();
  await expect(equipmentCell.getByText("A 운반로봇", { exact: true })).toBeVisible();
  await openWorkspaceView(page, "systems");
  const systemCell = page.locator("#panel-systems").getByRole("cell")
    .filter({ has: page.getByText("MCS 원본", { exact: true }) });
  await expect(systemCell).toHaveCount(1);
  await expect(systemCell).toBeVisible();
  await expect(systemCell.getByText("MCS 원본", { exact: true })).toBeVisible();
});


test("#917 공정 없이 설비 생성·재조회와 미지정 필터", async ({ page, isolatedApplication: origin, observeIsolatedApi }, testInfo) => {
  test.setTimeout(150_000);
  const f = await createTargetProject(page, origin, observeIsolatedApi, { noProcesses: true });
  expect((await f.snapshot()).data.logistics?.processes).toHaveLength(0);
  await openWorkspaceView(page, "equipment");
  let failContext = true;
  await page.route("**/logistics/process-context", async route => {
    if (failContext) await route.fulfill({ status: 503, json: { error: { code: "TEST_UNAVAILABLE" } } });
    else await route.continue();
  });
  const add = page.getByRole("button", { name: "+ 설비 추가", exact: true });
  await add.focus(); await add.press("Enter");
  const dialog = page.getByRole("dialog", { name: "설비 추가", exact: true });
  await expect(dialog.getByRole("alert")).toContainText("WorkArea 목록을 확인할 수 없어 저장할 수 없습니다");
  await expect(dialog.getByRole("button", { name: "저장", exact: true })).toBeDisabled();
  failContext = false;
  await dialog.getByRole("button", { name: "WorkArea 목록 다시 조회" }).click();
  await expect(dialog.getByText("등록된 WorkArea가 없습니다. 미연결 상태로 저장할 수 있습니다.")).toBeVisible();
  await page.unroute("**/logistics/process-context");
  const process = dialog.getByRole("combobox", { name: "주 관리 공정 (선택)" });
  await expect(process).toHaveValue("");
  await expect(process.locator("option").first()).toHaveText("공정 미지정");
  await dialog.getByRole("textbox", { name: "설비 코드", exact: false }).fill("NO-PROCESS");
  await dialog.getByRole("textbox", { name: "설비명", exact: false }).fill("미지정 설비 LongEquipmentNameWithoutWhitespaceLongEquipmentNameWithoutWhitespace");
  for (const width of [390, 768, 1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: 1000 });
    const geometry = await dialog.evaluate(element => ({ document: document.documentElement.scrollWidth, viewport: window.innerWidth, left: element.getBoundingClientRect().left, right: element.getBoundingClientRect().right }));
    expect(geometry.document).toBeLessThanOrEqual(geometry.viewport + 1);
    expect(geometry.left).toBeGreaterThanOrEqual(0);
    expect(geometry.right).toBeLessThanOrEqual(width + 1);
  }
  await dialog.getByRole("button", { name: "저장", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  const saved = (await f.snapshot()).data.logistics!;
  expect(saved.processes).toHaveLength(0);
  expect(saved.equipment).toHaveLength(1);
  expect(saved.equipment[0]).toMatchObject({ code: "NO-PROCESS", processId: null });
  await page.reload(); await openWorkspaceView(page, "equipment");
  const filter = page.getByRole("combobox", { name: "공정 필터" });
  await filter.selectOption("unassigned");
  const row = page.locator("#panel-equipment").getByRole("row").filter({ hasText: "미지정 설비 LongEquipmentNameWithoutWhitespaceLongEquipmentNameWithoutWhitespace" });
  await expect(row).toContainText("공정 미지정");
  await filter.selectOption("all"); await expect(row).toBeVisible();
  const selector = page.locator(".header-locale-selector select");
  for (const [locale, label] of [["en", "No process assigned"], ["vi", "Chưa chỉ định công đoạn"], ["ko", "공정 미지정"]]) {
    await selector.selectOption(locale);
    await expect(row).toContainText(label);
    for (const width of [390, 768, 1024, 1440, 1920]) {
      await page.setViewportSize({ width, height: 1000 });
      const facts = await page.locator("#panel-equipment table").evaluate(table => {
        const rect = (element: Element) => { const box = element.getBoundingClientRect(); return { left: box.left, right: box.right, top: box.top, bottom: box.bottom }; };
        const headers = Array.from(table.querySelectorAll("thead th"));
        const cells = Array.from(table.querySelectorAll("tbody tr:first-child td"));
        const owner = table.parentElement!;
        const actionCell = cells[cells.length - 1];
        const actions = Array.from(actionCell.querySelectorAll("button")).map(button => ({ ...rect(button), whiteSpace: getComputedStyle(button).whiteSpace, lineHeight: getComputedStyle(button).lineHeight, scrollWidth: button.scrollWidth, clientWidth: button.clientWidth }));
        return { document: document.documentElement.scrollWidth, viewport: innerWidth, owner: { clientWidth: owner.clientWidth, scrollWidth: owner.scrollWidth }, headers: headers.map(rect), cells: cells.map(rect), row: rect(actionCell.parentElement!), actions };
      });
      expect(facts.document).toBeLessThanOrEqual(width + 1);
      expect(facts.headers).toHaveLength(facts.cells.length);
      for (let i = 0; i < facts.cells.length; i++) {
        expect(Math.abs(facts.headers[i].left - facts.cells[i].left)).toBeLessThanOrEqual(1);
        expect(Math.abs(facts.headers[i].right - facts.cells[i].right)).toBeLessThanOrEqual(1);
        if (i) expect(facts.cells[i].left).toBeGreaterThanOrEqual(facts.cells[i - 1].right - 1);
      }
      expect(facts.owner.scrollWidth).toBeGreaterThanOrEqual(facts.owner.clientWidth);
      const actionCell = facts.cells.at(-1)!;
      expect(facts.actions).toHaveLength(4);
      expect(facts.row.bottom - facts.row.top).toBeLessThanOrEqual(160);
      for (const [index, action] of facts.actions.entries()) {
        expect(action.whiteSpace).toBe("nowrap");
        expect(action.bottom - action.top).toBeGreaterThanOrEqual(44);
        expect(action.scrollWidth).toBeLessThanOrEqual(action.clientWidth + 1);
        expect(Math.abs(action.top - facts.actions[0].top)).toBeLessThanOrEqual(1);
        expect(action.left).toBeGreaterThanOrEqual(actionCell.left - 1);
        expect(action.right).toBeLessThanOrEqual(actionCell.right + 1);
        expect(action.top).toBeGreaterThanOrEqual(actionCell.top - 1);
        expect(action.bottom).toBeLessThanOrEqual(actionCell.bottom + 1);
        for (const other of facts.actions.slice(index + 1)) expect(action.right <= other.left + 1 || other.right <= action.left + 1 || action.bottom <= other.top + 1 || other.bottom <= action.top + 1).toBe(true);
      }
      await writeFile(testInfo.outputPath(`geometry-${locale}-${width}.json`), JSON.stringify(facts));
      await page.screenshot({ path: testInfo.outputPath(`equipment-${locale}-${width}.png`) });
      const trigger = row.getByRole("button").first();
      const identity = row.locator("summary").first();
      await identity.focus();
      const scrollBefore = await row.locator("xpath=ancestor::table").evaluate(table => table.parentElement!.scrollLeft);
      await identity.press("Tab");
      await expect(trigger).toBeFocused();
      const focus = await trigger.evaluate(element => { const r = element.getBoundingClientRect(), owner = element.closest("table")!.parentElement!, o = owner.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: innerWidth, height: innerHeight, ownerLeft: o.left, ownerRight: o.right, scrollLeft: owner.scrollLeft, document: document.documentElement.scrollWidth }; });
      expect(focus.document).toBeLessThanOrEqual(width + 1);
      expect(focus.left).toBeGreaterThanOrEqual(focus.ownerLeft - 1); expect(focus.right).toBeLessThanOrEqual(focus.ownerRight + 1);
      if (width === 390) expect(focus.scrollLeft).toBeGreaterThan(scrollBefore);
      expect(focus.left).toBeGreaterThanOrEqual(0); expect(focus.right).toBeLessThanOrEqual(focus.width + 1);
      expect(focus.top).toBeGreaterThanOrEqual(0); expect(focus.bottom).toBeLessThanOrEqual(focus.height + 1);
      await trigger.press("Enter");
      const editor = page.getByRole("dialog");
      await expect(editor).toBeVisible();
      const dialogFacts = await editor.evaluate(element => {
        const bounds = element.getBoundingClientRect();
        const fields = Array.from(element.querySelectorAll("input, select, textarea, button")).filter(item => item.checkVisibility());
        return { left: bounds.left, right: bounds.right, viewport: innerWidth, fields: fields.map(item => { const r = item.getBoundingClientRect(); return { left: r.left, right: r.right }; }) };
      });
      expect(dialogFacts.left).toBeGreaterThanOrEqual(0);
      expect(dialogFacts.right).toBeLessThanOrEqual(width + 1);
      expect(dialogFacts.fields.every(field => field.left >= dialogFacts.left - 1 && field.right <= dialogFacts.right + 1)).toBe(true);
      await page.keyboard.press("Tab");
      expect(await editor.evaluate(element => element.contains(document.activeElement))).toBe(true);
      await writeFile(testInfo.outputPath(`dialog-${locale}-${width}.json`), JSON.stringify(dialogFacts));
      await editor.evaluate(element => { element.scrollTop = 0; });
      const primaryProcess = editor.locator("select").first();
      await primaryProcess.scrollIntoViewIfNeeded();
      await expect(primaryProcess).toBeInViewport();
      await page.screenshot({ path: testInfo.outputPath(`dialog-${locale}-${width}.png`) });
      await page.keyboard.press("Escape");
      await expect(editor).toHaveCount(0);
      await expect(trigger).toBeFocused();
    }
  }
  const created = await (await f.mutate("/logistics/processes", { name: "새 공정" })).json() as { data: { logistics: { processes: Array<{ id: string; name: string }> } } };
  const processId = created.data.logistics.processes.find(item => item.name === "새 공정")!.id;
  await page.reload(); await openWorkspaceView(page, "equipment");
  const editRow = page.locator("#panel-equipment").getByRole("row").filter({ hasText: "미지정 설비 LongEquipmentNameWithoutWhitespaceLongEquipmentNameWithoutWhitespace" });
  await editRow.getByRole("button", { name: "수정", exact: true }).click();
  const edit = page.getByRole("dialog", { name: "설비 수정" });
  const editProcess = edit.getByRole("combobox", { name: "주 관리 공정 (선택)" });
  await editProcess.selectOption(processId);
  await editProcess.press("Escape");
  await expect(edit.getByRole("button", { name: "계속 편집" })).toBeFocused();
  await edit.getByRole("button", { name: "계속 편집" }).click();
  await expect(editProcess).toHaveValue(processId);
  await edit.getByRole("button", { name: "저장", exact: true }).click();
  await page.getByRole("dialog", { name: "공유 인스턴스 변경 확인" }).getByRole("button", { name: "공유 사용처 확인 후 원본 저장" }).click();
  await expect(edit).toHaveCount(0);
  expect((await f.snapshot()).data.logistics!.equipment[0].processId).toBe(processId);
  await page.getByRole("combobox", { name: "공정 필터" }).selectOption("unassigned");
  await expect(editRow).toHaveCount(0);
  await page.getByRole("combobox", { name: "공정 필터" }).selectOption(processId);
  await expect(editRow).toBeVisible();
  await editRow.getByRole("button", { name: "수정", exact: true }).click();
  await edit.getByRole("combobox", { name: "주 관리 공정 (선택)" }).selectOption("");
  await edit.getByRole("button", { name: "저장", exact: true }).click();
  await page.getByRole("dialog", { name: "공유 인스턴스 변경 확인" }).getByRole("button", { name: "공유 사용처 확인 후 원본 저장" }).click();
  await expect(edit).toHaveCount(0);
  expect((await f.snapshot()).data.logistics!.equipment[0].processId).toBeNull();
});
