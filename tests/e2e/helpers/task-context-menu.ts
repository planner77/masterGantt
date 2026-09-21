import { expect, type Page } from "@playwright/test";

export const taskContextMenu = (page: Page) => page.getByRole("menu", { name: "작업 메뉴", exact: true });
export const taskInformationDialog = (page: Page) => page.getByRole("dialog", { name: "작업 정보", exact: true });

/** 우클릭/키보드로 열린 메뉴를 실제 사용자가 선택한다. 편집기 직접 호출은 금지한다. */
export async function chooseTaskInformation(page: Page, viaKeyboard = false): Promise<void> {
  const menu = taskContextMenu(page);
  await expect(menu).toBeVisible();
  await expect(menu).toHaveCount(1);
  // Issue #22/#72: 메뉴를 여는 것만으로 편집기가 열려서는 안 된다.
  await expect(taskInformationDialog(page)).toHaveCount(0);

  const edit = menu.getByRole("menuitem", { name: "Edit", exact: true });
  await expect(edit).toBeEnabled();

  if (viaKeyboard) {
    // Issue #77: opening the menu focuses the root container first so no
    // submenu is implicitly activated. Explicit arrow navigation then moves
    // focus through enabled menu items.
    await expect(menu).toBeFocused();
    for (let step = 0; step < 12; step += 1) {
      if (await edit.evaluate((element) => element === document.activeElement)) break;
      await page.keyboard.press("ArrowDown");
    }
    await expect(edit).toBeFocused();
    await page.keyboard.press("Enter");
  } else {
    await edit.click();
  }

  await expect(menu).toHaveCount(0);
  await expect(taskInformationDialog(page)).toBeVisible();
  await expect(taskInformationDialog(page)).toHaveCount(1);
}
