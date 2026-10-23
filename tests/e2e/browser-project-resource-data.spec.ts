import { expect, test } from "@playwright/test";
import { readBrowserProjectResourceData } from "./helpers/browser-project-resource-data";
import { IsolatedApplicationDiagnostics, observeIsolatedApi } from "./fixtures/isolated-application-diagnostics";

const project = "11111111-1111-4111-8111-111111111111";

test("Resource post-UI canonical readers preserve exact HTTP/JSON/transport failures without retries", async ({ page }) => {
  await page.goto("/");
  for (const suffix of ["assigned-targets", "resource-memberships"] as const) {
    const path = `/api/projects/${project}/${suffix}`;
    const field = suffix === "assigned-targets" ? "assignments" : "resources";

    // The actual same-origin GET must succeed with the endpoint's data shape.
    let successRequests = 0;
    await page.route(`**${path}`, async route => {
      successRequests++;
      expect(route.request().method()).toBe("GET");
      await route.fulfill({ status: 200, contentType: "application/json",
        body: JSON.stringify({ data: { [field]: [] } }) });
    });
    expect(await readBrowserProjectResourceData<Record<string, unknown>>(page, path, async (_route, _method, operation) => operation())).toMatchObject({ [field]: [] });
    expect(successRequests).toBe(1);
    await page.unroute(`**${path}`);

    for (const outcome of ["abort", "unauthorized", "server-error", "invalid-json", "invalid-shape"] as const) {
      const diagnostics = new IsolatedApplicationDiagnostics();
      let requests = 0, captures = 0;
      const observe = observeIsolatedApi(diagnostics, async () => { captures++; });
      await page.route(`**${path}`, async route => {
        requests++;
        expect(route.request().method()).toBe("GET");
        if (outcome === "abort") await route.abort("connectionreset");
        else await route.fulfill({
          status: outcome === "unauthorized" ? 401 : outcome === "server-error" ? 500 : 200,
          contentType: "application/json",
          body: outcome === "invalid-json" ? "{invalid-json" :
            JSON.stringify(outcome === "invalid-shape" ? { data: {} } : { error: { code: "TEST_ONLY" } }),
        });
      });
      await expect(readBrowserProjectResourceData(page, path, observe)).rejects.toThrow();
      expect(requests, `${suffix}/${outcome}: no retry`).toBe(1);
      expect(captures).toBe(outcome === "abort" ? 1 : 0);
      expect(diagnostics.snapshot().requests.at(-1)).toMatchObject({
        event: outcome === "abort" ? "transport_failure" : "completed",
        route: `/api/projects/[publicId]/${suffix}`,
      });
      await page.unroute(`**${path}`);
    }

    // Redirects must not access other same-origin or foreign endpoints.
    for (const location of [`${new URL(page.url()).origin}${path}/redirected`, "https://redirect.invalid/resource-data"]) {
      let requests = 0, destination = 0;
      await page.route(location, async route => {
        destination++; await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { [field]: [] } }) });
      });
      await page.route(`**${path}`, async route => {
        requests++; await route.fulfill({ status: 302, headers: { location }, body: "" });
      });
      await expect(readBrowserProjectResourceData(page, path, async (_route, _method, operation) => operation())).rejects.toThrow();
      expect(requests).toBe(1);
      expect(destination).toBe(0);
      await page.unroute(`**${path}`);
      await page.unroute(location);
    }
  }

  let observed = 0;
  for (const badPath of [
    `https://foreign.invalid/api/projects/${project}/assigned-targets`,
    `/api/projects/${project}/assigned-targets?token=PRIVATE_SECRET`,
    `/api/projects/${project}/resource-memberships/other`,
    `/api/projects/not-a-uuid/assigned-targets`,
  ]) {
    await expect(readBrowserProjectResourceData(page, badPath, async (_route, _method, operation) => {
      observed++; return operation();
    })).rejects.toThrow("상대 Project API");
  }
  expect(observed).toBe(0);
});
