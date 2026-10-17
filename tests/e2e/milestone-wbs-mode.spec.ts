import { expect, test } from "@playwright/test";
import { installStatefulProjectFixture, publicId, rowNamed, rememberGanttRoot, expectSameGanttRoot } from "../fixtures/stateful-project";

// The exact same probe runs in baseline and a separately started legacy server.
test("#552 explicit WBS mode rollback preserves canonical data with marker effects OFF", async ({ page }, info) => {
  await page.addInitScript(() => {
    const counts = { observers: 0, listeners: 0, frames: 0 };
    Reflect.set(window, "__issue552MarkerEffects", counts);
    const NativeObserver = window.ResizeObserver;
    window.ResizeObserver = class extends NativeObserver {
      constructor(callback: ResizeObserverCallback) {
        if (callback.name.includes("milestoneLaneSchedule")) counts.observers++;
        super(callback);
      }
    };
    const nativeListener = EventTarget.prototype.addEventListener;
    EventTarget.prototype.addEventListener = function(type, callback, options) {
      if (typeof callback === "function" && callback.name.includes("milestoneLaneSchedule")) counts.listeners++;
      return nativeListener.call(this, type, callback, options);
    };
    const nativeFrame = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = callback => {
      if (callback.name.includes("milestoneLaneMeasure")) counts.frames++;
      return nativeFrame(callback);
    };
  });
  const state = await installStatefulProjectFixture(page);
  const canonical = JSON.stringify([state.tasks, state.links]);
  await page.goto(`/projects/${publicId}`);
  await expect(rowNamed(page, "Stable leaf")).toBeVisible();
  const identity = await rememberGanttRoot(page), frame = page.locator(".project-gantt-frame");
  const legacy = process.env.NEXT_PUBLIC_GANTT_WBS_MODE === "legacy";
  const milestone = rowNamed(page, "Stable milestone");
  if (legacy) await expect(milestone).toBeVisible(); else await expect(milestone).toHaveCount(0);
  await expect(frame.locator(".project-milestone-lane,.project-milestone-lane-guide")).toHaveCount(0);
  await page.setViewportSize({ width: 1024, height: 900 });
  await page.getByRole("button", { name: "주", exact: true }).click();
  await page.getByRole("tab", { name: "Milestone 대시보드", exact: true }).click();
  await page.getByRole("tab", { name: "일정", exact: true }).click();
  await expectSameGanttRoot(page, identity);
  const effects = await page.evaluate(() => Reflect.get(window, "__issue552MarkerEffects"));
  expect(effects).toEqual({ observers: 0, listeners: 0, frames: 0 });
  expect(await frame.evaluate(node => Reflect.get(node, "__masterganttMilestoneTimeline").laneMeasurement())).toBeNull();
  if (legacy) {
    // Unsupported legacy + marker ON must remain OFF even in dev opt-in.
    await page.getByRole("button", { name: "Milestone Timeline 기술 미리보기", exact: true }).click();
    await expect(frame.locator(".project-milestone-lane")).toHaveCount(0);
    expect(await page.evaluate(() => Reflect.get(window, "__issue552MarkerEffects"))).toEqual(effects);
  } else {
    // Positive control proves instrumentation sees the optional lane owner.
    await page.getByRole("button", { name: "Milestone Timeline 기술 미리보기", exact: true }).click();
    await expect.poll(() => page.evaluate(() => Reflect.get(window, "__issue552MarkerEffects").observers)).toBeGreaterThan(0);
    const enabled = await page.evaluate(() => Reflect.get(window, "__issue552MarkerEffects"));
    expect(enabled.listeners).toBeGreaterThan(0); expect(enabled.frames).toBeGreaterThan(0);
    await page.getByRole("button", { name: "Milestone Timeline 기술 미리보기", exact: true }).click();
    await expect(frame.locator(".project-milestone-lane")).toHaveCount(0);
  }
  expect(JSON.stringify([state.tasks, state.links])).toBe(canonical);
  expect(state.posts).toHaveLength(0); expect(state.patchRequests).toHaveLength(0);
  await info.attach("marker-off-mode-evidence", { body: JSON.stringify({ legacy, effects, canonicalIds: state.tasks.map(task => task.taskId), instance: identity, mutationCount: 0, environment: "Next dev/Chromium/mocked HTTP" }), contentType: "application/json" });
});
