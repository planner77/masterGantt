import type { Page } from "@playwright/test";
import { afterEach, describe, expect, it, vi } from "vitest";
import { readBrowserCanonicalSnapshot } from "../../e2e/helpers/browser-canonical-snapshot";
import type { ObserveIsolatedApi } from "../../e2e/fixtures/isolated-application-diagnostics";

const api = "/api/projects/11111111-1111-4111-8111-111111111111";
function fixture(response: Response | Error) {
  const fetchMock = vi.fn(async () => { if (response instanceof Error) throw response; return response; });
  vi.stubGlobal("fetch", fetchMock);
  const page = { evaluate: vi.fn((operation: (path: string) => Promise<unknown>, path: string) => operation(path)) } as unknown as Page;
  const observed: string[][] = [];
  const observer: ObserveIsolatedApi = (route, method, operation) => { observed.push([route, method]); return operation(); };
  return { page, fetchMock, observer, observed };
}
afterEach(() => vi.unstubAllGlobals());
describe("same-origin UI canonical verification", () => {
  it("observes exactly one browser GET with no-store and returns its unmodified JSON", async () => {
    const snapshot = { data: { project: { revision: 7 }, tasks: [], links: [] } };
    const f = fixture(new Response(JSON.stringify(snapshot), { status: 200 }));
    expect(await readBrowserCanonicalSnapshot(f.page, api, f.observer)).toEqual(snapshot);
    expect(f.observed).toEqual([[api, "GET"]]);
    expect(f.fetchMock).toHaveBeenCalledExactlyOnceWith(api, { credentials: "same-origin", cache: "no-store" });
  });
  it.each([
    [500, '{"error":{"code":"INTERNAL_ERROR"}}'],
    [200, "invalid JSON"],
  ])("rejects HTTP %s or invalid JSON without replaying the request", async (status, body) => {
    const f = fixture(new Response(body, { status }));
    await expect(readBrowserCanonicalSnapshot(f.page, api, f.observer)).rejects.toThrow();
    expect(f.fetchMock).toHaveBeenCalledTimes(1);
  });
  it("preserves transport failure and performs no retry", async () => {
    const error = new Error("synthetic transport failure"), f = fixture(error);
    await expect(readBrowserCanonicalSnapshot(f.page, api, f.observer)).rejects.toBe(error);
    expect(f.fetchMock).toHaveBeenCalledTimes(1);
  });
  it.each(["https://other.example/api/projects/11111111-1111-4111-8111-111111111111", `${api}?query=1`, "/api/resources"])("does not fetch a foreign or non-canonical path", async path => {
    const f = fixture(new Response("{}"));
    await expect(readBrowserCanonicalSnapshot(f.page, path, f.observer)).rejects.toThrow();
    expect(f.fetchMock).not.toHaveBeenCalled(); expect(f.observed).toEqual([]);
  });
});
