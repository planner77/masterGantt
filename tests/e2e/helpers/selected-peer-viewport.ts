import { expect, type Locator, type Page } from "@playwright/test";

type Entry = Readonly<{ kind?: string; outcome?: string }>;

/** #852: a correctly left-aligned Task may remain at X=0. Peer tests must
 * create their own nonzero viewport and wait for the actual Task reveal
 * before issuing the next vertical input. */
export async function prepareSelectedGanttPeerViewport(page: Page, frame: Locator, taskId: string): Promise<void> {
  await expect(frame).toHaveAttribute("data-gantt-scale-mode", "week");
  await frame.locator(`.wx-table-container .wx-row[data-id=":${taskId}"] [data-col-id=":projectDuration"]`).click();
  await expect(frame.locator(".wx-row.wx-selected")).toHaveCount(1);
  await expect.poll(async () => frame.evaluate(element => {
    const history = JSON.parse((element as HTMLElement).dataset.ganttViewportCoordinatorHistory ?? "[]") as Entry[];
    return history.filter(entry => entry.kind === "TASK_REVEAL").at(-1)?.outcome ?? null;
  })).toBe("SETTLED");
  const chart = frame.locator(".wx-chart");
  await expect.poll(() => chart.evaluate(element => element.scrollWidth - element.clientWidth)).toBeGreaterThan(120);
  if ((await chart.evaluate(element => element.scrollLeft)) <= 0) {
    await chart.hover();
    await page.mouse.wheel(120, 0);
    await expect.poll(() => chart.evaluate(element => element.scrollLeft)).toBeGreaterThan(0);
  }
}
