import { deepStrictEqual, equal } from "node:assert/strict";
import { isDeepStrictEqual } from "node:util";
import type { Page, Request } from "@playwright/test";
import type { WbsViewQueryInput, WbsViewReportDto } from "../../../src/contracts/wbs-dashboard-views";

export type WbsReportCondition = Pick<WbsViewQueryInput, "spec" | "filters" | "scope">;
type ReportRequest = Pick<Request, "method" | "url" | "postDataJSON">;
const wire = (value: unknown): unknown => JSON.parse(JSON.stringify(value));

export function matchesWbsReportRequest(request: ReportRequest, pathname: string, condition: WbsReportCondition): boolean {
  if (request.method() !== "POST" || new URL(request.url()).pathname !== pathname) return false;
  try {
    return isDeepStrictEqual(request.postDataJSON(), wire({ ...condition, projection: { kind: "report" } }));
  } catch {
    return false;
  }
}

export type WbsReportEcho = Pick<WbsViewReportDto, "projection" | "spec" | "filters"> & { sourceContext: Pick<WbsViewReportDto["sourceContext"], "scope"> };

export function assertWbsReportEcho(report: WbsReportEcho, condition: WbsReportCondition): void {
  equal(report.projection, "report", "실제 응답은 report여야 합니다.");
  deepStrictEqual(report.spec, condition.spec, "응답 spec은 실제 요청과 같아야 합니다.");
  // The public transport compares the complete normalized filter set, not a subset.
  const canonicalFilters = (filters: Record<string, unknown>) => Object.fromEntries(
    Object.entries(filters)
      .filter(([, value]) => value !== undefined && !(Array.isArray(value) && value.length === 0))
      .map(([key, value]) => [key, Array.isArray(value)
        ? [...new Set(value.map(item => typeof item === "string" ? item.trim() : item))].sort()
        : typeof value === "string" && (key === "search" || key === "taskSearch") ? value.trim() : value]),
  );
  deepStrictEqual(canonicalFilters({ ...report.filters }), canonicalFilters({ ...condition.filters }), "응답 filters는 전체 요청과 같아야 합니다.");
  deepStrictEqual(report.sourceContext.scope, condition.scope, "응답 scope는 요청과 같아야 합니다.");
}

/** Capture the actual body immediately: navigation can discard a browser Response later. */
export async function waitForWbsReport(page: Page, condition: WbsReportCondition) {
  const pathname = `/api${new URL(page.url()).pathname}/resource-dashboard/views`;
  const futureRequests = new Set<Request>();
  const remember = (request: Request) => { futureRequests.add(request); };
  page.on("request", remember);
  try {
    type Capture = { text: string; body: { data: WbsViewReportDto } };
    let capture: Promise<Capture> | undefined;
    const response = await page.waitForResponse(async response => {
      const request = response.request();
      if (capture || !futureRequests.has(request) || !matchesWbsReportRequest(request, pathname, condition)) return false;
      // Reserve the first matching response before any await. A faster overlapping
      // body must neither replace it nor conceal a failed status/echo validation.
      capture = (async () => {
        equal(response.status(), 200, "실제 WBS report 응답 상태");
        const text = await response.text();
        const body = JSON.parse(text) as { data: WbsViewReportDto };
        assertWbsReportEcho(body.data, condition);
        return Object.freeze({ text, body });
      })();
      await capture;
      return true;
    });
    const selected = await capture!;
    return {
      response,
      request: () => response.request(),
      status: () => response.status(),
      text: async () => selected.text,
      json: async () => selected.body,
    };
  } finally {
    page.off("request", remember);
  }
}
