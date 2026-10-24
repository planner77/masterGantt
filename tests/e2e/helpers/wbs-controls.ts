import { expect, type Locator } from "@playwright/test";

/** Use the same disclosed route as a user before interacting with advanced controls. */
export async function openWbsViewControls(root: Locator) {
  const trigger = root.getByRole("button", { name: /^필터·조회 구성/ });
  if (await trigger.getAttribute("aria-expanded") !== "true") {
    await trigger.focus();
    await trigger.press("Enter");
  }
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  const panel = root.locator("[data-wbs-controls]");
  await expect(panel).toBeVisible();
  return panel;
}
