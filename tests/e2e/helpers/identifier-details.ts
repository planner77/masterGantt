import { expect, type Locator } from "@playwright/test";

/** Assert the complete raw identifier through the user-visible disclosure. */
export async function expectRawIdentifier(scope: Locator, label: string, value: string) {
  const disclosures = scope.locator("details");
  const matchingIndex = async () => disclosures.evaluateAll((nodes, expected) => nodes.findIndex(node => Array.from(node.querySelectorAll("textarea")).some(field => field.closest("details") === node && field.value === expected)), value);
  await expect.poll(matchingIndex).toBeGreaterThanOrEqual(0);
  const disclosure = disclosures.nth(await matchingIndex());
  const wasOpen = await disclosure.evaluate(node => (node as HTMLDetailsElement).open);
  if (!wasOpen) await disclosure.locator("summary").first().click();
  const fields = disclosure.getByLabel(label, { exact: true });
  const fieldIndex = await fields.evaluateAll((nodes, expected) => nodes.findIndex(node => (node as HTMLTextAreaElement).value === expected), value);
  expect(fieldIndex).toBeGreaterThanOrEqual(0);
  const field = fields.nth(fieldIndex);
  await expect(field).toBeVisible();
  await expect(field).toHaveValue(value);
  if (!wasOpen) await disclosure.locator("summary").first().click();
}
