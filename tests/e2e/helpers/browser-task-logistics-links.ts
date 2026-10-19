import { expect, type Page } from "@playwright/test";
import type { TaskLogisticsLinksResponse } from "../../../src/contracts/logistics";
import type { ObserveIsolatedApi } from "../fixtures/isolated-application-diagnostics";

/** Post-editor persistence reads use the UI's real same-origin HTTP transport.
 * Independent authorization requests and writes keep their separate API client. */
export async function readBrowserTaskLogisticsLinks(page: Page, path: string, observeApi: ObserveIsolatedApi) {
  const uuid = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
  if (!new RegExp(`^/api/projects/${uuid}/tasks/${uuid}/logistics-links$`, "i").test(path))
    throw new Error("물류 연결 원본 조회에는 현재 origin의 상대 Task API 경로가 필요합니다.");
  const response = await observeApi(path, "GET", async () => {
    const read = await page.evaluate(async url => {
      const result = await fetch(url, { credentials: "same-origin", cache: "no-store", redirect: "error" });
      const text = await result.text();
      let body: unknown = null, validJson = true;
      try { body = JSON.parse(text); } catch { validJson = false; }
      return { status: result.status, requestId: result.headers.get("x-request-id"), body, validJson };
    }, path);
    return { status: () => read.status, headers: () => ({ "x-request-id": read.requestId ?? "" }), body: read.body, validJson: read.validJson };
  });
  expect(response.status(), "물류 연결 원본 조회 HTTP status").toBe(200);
  expect(response.validJson, "물류 연결 원본 JSON").toBe(true);
  const body = response.body as TaskLogisticsLinksResponse;
  expect(body).toHaveProperty("data.links");
  return body.data.links;
}
