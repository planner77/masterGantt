import { expect, type Page } from "@playwright/test";
import type { ProjectSnapshotResponse } from "../../../src/contracts/projects";
import type { ObserveIsolatedApi } from "../fixtures/isolated-application-diagnostics";

/** UI persistence checks use its same-origin transport. Seed, independent API
 * authorization and deliberately bypassed fault routes retain their API client. */
export async function readBrowserCanonicalSnapshot(page: Page, api: string, observeApi: ObserveIsolatedApi): Promise<ProjectSnapshotResponse> {
  if (!/^\/api\/projects\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(api))
    throw new Error("브라우저 canonical 조회에는 현재 origin의 상대 Project API 경로가 필요합니다.");
  const response = await observeApi(api, "GET", async () => {
    const read = await page.evaluate(async path => {
      const result = await fetch(path, { credentials: "same-origin", cache: "no-store" });
      const text = await result.text();
      let body: unknown = null, validJson = true;
      try { body = JSON.parse(text); } catch { validJson = false; }
      return { status: result.status, requestId: result.headers.get("x-request-id"), body, validJson };
    }, api);
    return { status: () => read.status, headers: () => ({ "x-request-id": read.requestId ?? "" }), body: read.body, validJson: read.validJson };
  });
  expect(response.status(), "브라우저 canonical 조회는 HTTP 200이어야 합니다.").toBe(200);
  expect(response.validJson, "브라우저 canonical 조회는 유효한 JSON을 반환해야 합니다.").toBe(true);
  return response.body as ProjectSnapshotResponse;
}
