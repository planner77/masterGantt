import { expect, test } from "@playwright/test";
import { readBrowserTaskLogisticsLinks } from "./helpers/browser-task-logistics-links";
import { IsolatedApplicationDiagnostics, observeIsolatedApi } from "./fixtures/isolated-application-diagnostics";

const path = "/api/projects/11111111-1111-4111-8111-111111111111/tasks/22222222-2222-4222-8222-222222222222/logistics-links";

test("Task logistics browser read preserves HTTP/JSON/transport failures without retry", async ({ page }) => {
  await page.goto("/");
  for (const outcome of ["abort", "unauthorized", "server-error", "invalid-json"] as const) {
    const diagnostics = new IsolatedApplicationDiagnostics();
    let requests = 0, captures = 0;
    const observer = observeIsolatedApi(diagnostics, async () => { captures++; });
    await page.route(`**${path}`, async route => {
      requests++;
      expect(route.request().method()).toBe("GET");
      if (outcome === "abort") await route.abort("connectionreset");
      else await route.fulfill({ status: outcome === "unauthorized" ? 401 : outcome === "server-error" ? 500 : 200,
        contentType: "application/json", body: outcome === "invalid-json" ? "invalid JSON" : '{"error":{"code":"TEST_ERROR"}}' });
    });
    await expect(readBrowserTaskLogisticsLinks(page, path, observer)).rejects.toThrow();
    expect(requests).toBe(1);
    expect(captures).toBe(outcome === "abort" ? 1 : 0);
    expect(diagnostics.snapshot().requests.at(-1)).toMatchObject({ event: outcome === "abort" ? "transport_failure" : "completed",
      route: "/api/projects/[publicId]/tasks/[taskId]/logistics-links" });
    await page.unroute(`**${path}`);
  }
  for (const location of [`${new URL(page.url()).origin}${path}/redirected`, "https://redirect.invalid/api/links"]) {
    let sourceRequests = 0, destinationRequests = 0;
    await page.route(location, async route => {
      destinationRequests++;
      await route.fulfill({ status: 200, contentType: "application/json", headers: { "Access-Control-Allow-Origin": "*" }, body: '{"data":{"links":{"directEquipmentLinks":[]}}}' });
    });
    await page.route(`**${path}`, async route => {
      sourceRequests++;
      await route.fulfill({ status: 302, headers: { location }, body: "" });
    });
    await expect(readBrowserTaskLogisticsLinks(page, path, async (_route, _method, operation) => operation())).rejects.toThrow();
    expect(sourceRequests).toBe(1);
    expect(destinationRequests).toBe(0);
    await page.unroute(`**${path}`);
    await page.unroute(location);
  }
  let observed = 0;
  await expect(readBrowserTaskLogisticsLinks(page, `https://foreign.invalid${path}`, async (_route, _method, operation) => {
    observed++; return operation();
  })).rejects.toThrow("상대 Task API");
  expect(observed).toBe(0);
});
