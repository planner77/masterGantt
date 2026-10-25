import { expect, type Page } from "@playwright/test";
import type { ObserveIsolatedApi } from "../fixtures/isolated-application-diagnostics";

/** Inspect persisted Resource assignments and project registrations through the
 * same-origin transport used by the visible workspace. Independent setup,
 * authorization and mutation requests keep their separate API context. */
export async function readBrowserProjectResourceData<T>(
  page: Page, path: string, observeApi: ObserveIsolatedApi,
): Promise<T> {
  const match = /^\/api\/projects\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/(assigned-targets|resource-memberships)$/i.exec(path);
  if (!match) throw new Error("브라우저 리소스 원본 조회에는 현재 origin의 상대 Project API 경로가 필요합니다.");

  const response = await observeApi(path, "GET", async () => {
    const read = await page.evaluate(async url => {
      const result = await fetch(url, { credentials: "same-origin", cache: "no-store", redirect: "error" });
      const text = await result.text();
      let body: unknown = null, validJson = true;
      try { body = JSON.parse(text); } catch { validJson = false; }
      return { status: result.status, requestId: result.headers.get("x-request-id"), body, validJson };
    }, path);
    return {
      status: () => read.status,
      headers: () => ({ "x-request-id": read.requestId ?? "" }),
      body: read.body, validJson: read.validJson,
    };
  });

  expect(response.status(), "브라우저 리소스 원본 조회 HTTP status").toBe(200);
  expect(response.validJson, "브라우저 리소스 원본 조회 JSON").toBe(true);
  expect(response.body, "브라우저 리소스 원본의 data 객체").toHaveProperty("data");
  const data = (response.body as { data: unknown }).data;
  expect(data && typeof data === "object" && !Array.isArray(data), "리소스 원본 data 형식").toBe(true);
  const field = match[1].toLowerCase() === "assigned-targets" ? "assignments" : "resources";
  expect(Array.isArray((data as Record<string, unknown>)[field]), `리소스 원본 ${field} 배열`).toBe(true);
  return data as T;
}
