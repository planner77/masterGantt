import { randomUUID } from "node:crypto";
import { E2E_PROJECT_OWNER, expect, test, isolatedApplicationOptions } from "./fixtures/isolated-application";

test.use(isolatedApplicationOptions);

// Both cases exhaust their own quota. Case 2 must still start with an empty
// database and five allowed attempts, regardless of prior cases in this suite.
for (const instance of [1, 2]) {
  test(`isolates server state while preserving the five-per-hour create limit (instance ${instance})`, async ({ page, playwright, baseURL }) => {
    // Never exhaust an externally managed application's quota as an incidental
    // side effect of running this infrastructure regression against that server.
    expect(process.env.PLAYWRIGHT_BASE_URL, "This isolation regression requires a fixture-owned server. Unset PLAYWRIGHT_BASE_URL; no external mutation was sent.").toBeUndefined();
    expect(baseURL).toBeTruthy();
    const before = await page.request.get("/api/projects");
    expect(before.status()).toBe(200);
    expect((await before.json()).data.projects).toHaveLength(0);
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      const response = await page.request.post("/api/projects", {
        headers: { Origin: baseURL! },
        data: { name: `Isolation ${instance}-${attempt}`, ownerName: E2E_PROJECT_OWNER, description: "E2E fixture only", editPassword: `test-${randomUUID()}` },
      });
      expect(response.status(), `Fresh server instance ${instance}, attempt ${attempt}`).toBe(201);
    }
    // A different HTTP client must not reset the same server's security budget.
    const otherClient = await playwright.request.newContext({ baseURL });
    try {
      const rejected = await otherClient.post("/api/projects", {
        headers: { Origin: baseURL! },
        data: { name: "Sixth attempt must fail", ownerName: E2E_PROJECT_OWNER, description: "E2E fixture only", editPassword: `test-${randomUUID()}` },
      });
      expect(rejected.status()).toBe(429);
      expect((await rejected.json()).error.code).toBe("RATE_LIMITED");
      const retryAfter = rejected.headers()["retry-after"];
      expect(retryAfter).toMatch(/^\d+$/);
      expect(Number(retryAfter)).toBeGreaterThan(0);
      expect(Number(retryAfter)).toBeLessThanOrEqual(3_600);
      const after = await otherClient.get("/api/projects");
      expect(after.status()).toBe(200);
      expect((await after.json()).data.projects).toHaveLength(5);
    } finally { await otherClient.dispose(); }
  });
}