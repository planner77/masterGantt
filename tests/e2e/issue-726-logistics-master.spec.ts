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
  expect(targets.ok()).toBe(true);
  expect((await targets.json()).data.total).toBe(0);
  await page.reload();
  await openWorkspaceView(page, "equipment");
  await expect(page.getByText("A 운반로봇", { exact: true })).toBeVisible();
  await openWorkspaceView(page, "systems");
  await expect(page.locator("#panel-systems").getByRole("cell", { name: "MCS 원본", exact: true })).toBeVisible();
});
