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
  const matchingRequest = (request: { url(): string; method(): string }) =>
    request.method() === "GET" && new URL(request.url()).pathname === fakePath;

  // A resolved fetch(status) and page.unrouteAll() do NOT mean that
  // Playwright emitted requestfinished. Register the terminal-event waiter
  // before triggering each request, then consume the response body.
  const expectHttpCompleted = async (expectedStatus: number) => {
    const finished = page.waitForEvent("requestfinished", { predicate: matchingRequest });
    const status = await page.evaluate(async path => {
      const response = await fetch(path, { cache: "no-store" });
      await response.arrayBuffer();
      return response.status;
    }, fakePath);
    await finished;
    expect(status).toBe(expectedStatus);
  };
  const expectNetworkFailed = async () => {
    const failed = page.waitForEvent("requestfailed", { predicate: matchingRequest });
    const result = await page.evaluate(async path => {
      try {
        const response = await fetch(path, { cache: "no-store" });
        await response.arrayBuffer();
        return "unexpected_success";
      } catch {
        return "request_failed";
      }
    }, fakePath);
    await failed;
    expect(result).toBe("request_failed");
  };

  await page.route(pattern, route => route.fulfill({
    status: 200, contentType: "application/json", body: '{"data":[]}',
  }));
  await expectHttpCompleted(200);
  await page.unrouteAll({ behavior: "wait" });

  await page.route(pattern, async route => {
    await delay(90);
    await route.fulfill({ status: 200, body: '{"data":[]}' });
  });
  await expectHttpCompleted(200);
  await page.unrouteAll({ behavior: "wait" });

  await page.route(pattern, route => route.fulfill({ status: 503, body: '{"error":"deliberate"}' }));
  await expectHttpCompleted(503);
  await page.unrouteAll({ behavior: "wait" });

  await page.route(pattern, route => route.abort("failed"));
  await expectNetworkFailed();
  await page.unrouteAll({ behavior: "wait" });

  await page.route(pattern, route => route.abort("aborted"));
  await expectNetworkFailed();
  await page.unrouteAll({ behavior: "wait" });

  const observations = observedIsolatedPerformance().requests.filter(x => x.route === "assignment-targets");
  // One authoritative browser terminal event for each of the five requests;
  // no incomplete/other record is accepted as an observed outcome.
  expect(observations.filter(x => x.source === "browser")).toHaveLength(5);
  expect(observations.filter(x => x.outcome === "complete")).toHaveLength(2);
  expect(observations.filter(x => x.outcome === "http_error" && x.status === 503)).toHaveLength(1);
  expect(observations.filter(x => x.outcome === "network")).toHaveLength(1);
  expect(observations.filter(x => x.outcome === "abort")).toHaveLength(1);
  expect(observations.some(x => x.outcome === "incomplete" || x.outcome === "other")).toBe(false);
  expect(observations.some(x => x.outcome === "complete" && x.durationMs >= 60)).toBe(true);

  // Real HTTP (no intercept), without mutating fixture data, exercises the SQL
  // instrumentation and server completion log in this same process.
  const collection = await page.evaluate(async () =>
    (await fetch("/api/projects", { cache: "no-store" })).status);
  expect(collection).toBeGreaterThanOrEqual(200);
  expect(collection).toBeLessThan(500);
  });
});
