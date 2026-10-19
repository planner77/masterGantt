import { setTimeout as delay } from "node:timers/promises";

import { expect, isolatedApplicationOptions, test } from "./fixtures/isolated-application";

/**
 * Real disposable Next/SQLite process; only the synthetic browser API responses
 * are intercepted. The original #623 business assertions and mutation contract
 * are not changed by this test.
 */
test.use(isolatedApplicationOptions);

test("Issue #751 real isolated backend, browser slow/abort/error receipts and cleanup", async ({
  page, isolatedApplication, observedIsolatedPerformance, timeIsolatedStage,
}) => {
  // Warmed endpoints must be measurable before the 60s test-body interval.
  const warmup = observedIsolatedPerformance().stages;
  for (const stage of ["next_assigned_targets_warmup", "next_assignment_targets_warmup"]) {
    expect(warmup.some(item => item.stage === stage && item.outcome === "ok" &&
      Number.isFinite(item.durationMs) && item.durationMs >= 0)).toBe(true);
  }
  await timeIsolatedStage("test_body", async () => {
  await page.goto(isolatedApplication + "/");
  const ready = await page.evaluate(async () =>
    (await fetch("/api/health/ready", { cache: "no-store" })).status);
  expect(ready).toBe(200);

  const pattern = "**/api/projects/*/assignment-targets";
  const fakePath = "/api/projects/00000000-0000-4000-8000-000000000001/assignment-targets";

  await page.route(pattern, route => route.fulfill({
    status: 200, contentType: "application/json", body: '{"data":[]}',
  }));
  expect(await page.evaluate(async path => (await fetch(path)).status, fakePath)).toBe(200);
  await page.unrouteAll({ behavior: "wait" });

  await page.route(pattern, async route => {
    await delay(90);
    await route.fulfill({ status: 200, body: '{"data":[]}' });
  });
  expect(await page.evaluate(async path => (await fetch(path)).status, fakePath)).toBe(200);
  await page.unrouteAll({ behavior: "wait" });

  await page.route(pattern, route => route.fulfill({ status: 503, body: '{"error":"deliberate"}' }));
  expect(await page.evaluate(async path => (await fetch(path)).status, fakePath)).toBe(503);
  await page.unrouteAll({ behavior: "wait" });

  await page.route(pattern, route => route.abort("failed"));
  const network = await page.evaluate(async path => {
    try { await fetch(path); return "unexpected_success"; }
    catch { return "network_error"; }
  }, fakePath);
  expect(network).toBe("network_error");
  await page.unrouteAll({ behavior: "wait" });

  await page.route(pattern, route => route.abort("aborted"));
  const cancellation = await page.evaluate(async path => {
    try { await fetch(path); return "unexpected_success"; }
    catch { return "abort"; }
  }, fakePath);
  expect(cancellation).toBe("abort");
  await page.unrouteAll({ behavior: "wait" });

  const observations = observedIsolatedPerformance().requests.filter(x => x.route === "assignment-targets");
  expect(observations.filter(x => x.outcome === "complete").length).toBeGreaterThanOrEqual(2);
  expect(observations.some(x => x.outcome === "http_error" && x.status === 503)).toBe(true);
  expect(observations.some(x => x.outcome === "network")).toBe(true);
  expect(observations.some(x => x.outcome === "abort")).toBe(true);
  expect(observations.some(x => x.outcome === "complete" && x.durationMs >= 60)).toBe(true);

  // Real HTTP (no intercept), without mutating fixture data, exercises the SQL
  // instrumentation and server completion log in this same process.
  const collection = await page.evaluate(async () =>
    (await fetch("/api/projects", { cache: "no-store" })).status);
  expect(collection).toBeGreaterThanOrEqual(200);
  expect(collection).toBeLessThan(500);
  });
});
