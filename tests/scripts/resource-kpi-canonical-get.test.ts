import { describe, expect, it, vi } from "vitest";
import type { APIRequestContext, APIResponse } from "@playwright/test";
import { readResourceKpiSnapshot } from "../e2e/fixtures/resource-kpi-integration-ui";
import type { ObserveIsolatedApi } from "../e2e/fixtures/isolated-application-diagnostics";
const route = "/api/projects/00000000-0000-4000-8000-000000000001";
const snapshot = { data: { project: { revision: 17 }, tasks: [] } };
const reply = (status: number, json = async () => snapshot) =>
  ({ status: () => status, headers: () => ({}), json }) as unknown as APIResponse;
function harness(get: () => Promise<APIResponse>) {
  const calls: string[] = [];
  const request = { get: vi.fn(get) } as unknown as APIRequestContext;
  const observer: ObserveIsolatedApi = async (path, method, operation) => {
    calls.push(`${method} ${path}`);
    return operation();
  };
  return { request, observer, calls };
}
describe("#719 F-006: Resource KPI canonical GET follows the #703 observer contract", () => {
  it("uses exactly one GET, Connection close and unchanged canonical JSON", async () => {
    const h = harness(async () => reply(200));
    expect(await readResourceKpiSnapshot(h.request, route, h.observer)).toEqual(snapshot);
    expect(h.request.get).toHaveBeenCalledTimes(1);
    expect(h.request.get).toHaveBeenCalledWith(route, { headers: { Connection: "close" } });
    expect(h.calls).toEqual([`GET ${route}`]);
  });
  it("permits one observed retry for exactly ECONNRESET", async () => {
    let n = 0;
    const h = harness(async () => ++n === 1
      ? Promise.reject(new Error("apiRequestContext.get: read ECONNRESET")) : reply(200));
    expect(await readResourceKpiSnapshot(h.request, route, h.observer)).toEqual(snapshot);
    expect(h.request.get).toHaveBeenCalledTimes(2);
    expect(h.calls).toEqual([`GET ${route}`, `GET ${route}`]);
  });
  it("preserves a second reset failure and never makes a third request", async () => {
    const h = harness(async () => { throw new Error("apiRequestContext.get: read ECONNRESET"); });
    await expect(readResourceKpiSnapshot(h.request, route, h.observer)).rejects.toThrow("ECONNRESET");
    expect(h.request.get).toHaveBeenCalledTimes(2);
  });
  it("never retries HTTP errors, non-reset failures or malformed JSON", async () => {
    for (const status of [404, 409, 503]) {
      const h = harness(async () => reply(status));
      await expect(readResourceKpiSnapshot(h.request, route, h.observer)).rejects.toThrow(`HTTP ${status}`);
      expect(h.request.get).toHaveBeenCalledTimes(1);
    }
    const timeout = harness(async () => { throw new Error("ETIMEDOUT"); });
    await expect(readResourceKpiSnapshot(timeout.request, route, timeout.observer)).rejects.toThrow("ETIMEDOUT");
    expect(timeout.request.get).toHaveBeenCalledTimes(1);
    const malformed = harness(async () => reply(200, async () => { throw new SyntaxError("invalid JSON"); }));
    await expect(readResourceKpiSnapshot(malformed.request, route, malformed.observer)).rejects.toThrow("invalid JSON");
    expect(malformed.request.get).toHaveBeenCalledTimes(1);
  });
});
