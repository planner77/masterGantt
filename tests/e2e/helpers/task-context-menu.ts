import { expect, type Page } from "@playwright/test";

export const taskContextMenu = (page: Page) => page.getByRole("menu", { name: "작업 메뉴", exact: true });
export const taskInformationDialog = (page: Page) => page.getByRole("dialog", { name: "작업 정보", exact: true });

/** 우클릭/키보드로 열린 메뉴를 실제 사용자가 선택한다. 편집기 직접 호출은 금지한다. */
export async function chooseTaskInformation(page: Page, viaKeyboard = false): Promise<void> {
  const menu = taskContextMenu(page);
  await expect(menu).toBeVisible();
  await expect(menu).toHaveCount(1);
  // Issue #22: 메뉴를 여는 것만으로 편집기가 열려서는 안 된다.
  await expect(taskInformationDialog(page)).toHaveCount(0);
  await expect(menu.getByRole("menuitem")).toHaveCount(2);
  const information = menu.getByRole("menuitem", { name: "작업 정보", exact: true });
  await expect(information).toBeEnabled();
  if (viaKeyboard) {
    await expect(information).toBeFocused();
    await page.keyboard.press("Enter");
  } else {
    await information.click();
  }
  await expect(menu).toHaveCount(0);
  await expect(taskInformationDialog(page)).toBeVisible();
  await expect(taskInformationDialog(page)).toHaveCount(1);
}
