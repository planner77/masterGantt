import { describe, expect, it } from "vitest";
import { matchesWbsReportRequest } from "../e2e/helpers/wbs-report";
const pathname = "/api/projects/project-a/resource-dashboard/views";
const condition = { spec: { version: "wbs-view:v1" as const, contextSourceVersion: "explicit-task-context:v1" as const, root: "equipment" as const, levels: [] }, filters: {} };
const request = (change: Record<string, unknown> = {}, path = pathname, method = "POST") => ({ method: () => method, url: () => `https://example.invalid${path}`, postDataJSON: () => ({ ...condition, projection: { kind: "report" }, ...change }) });
describe("WBS report response attribution", () => {
  it("selects equipment after a concurrent process response (CI #3208 event order)", () => {
    const events = [request({ spec: { ...condition.spec, root: "process" } }), request()];
    expect(events.find(event => matchesWbsReportRequest(event, pathname, condition))?.postDataJSON().spec).toEqual(condition.spec);
  });
  it("rejects another project or HTTP method", () => {
    expect(matchesWbsReportRequest(request({}, pathname.replace("project-a", "project-b")), pathname, condition)).toBe(false);
    expect(matchesWbsReportRequest(request({}, pathname, "GET"), pathname, condition)).toBe(false);
  });
  it("distinguishes full levels, filters, scope and projection", () => {
    for (const change of [{ spec: { ...condition.spec, levels: ["process"] } }, { filters: { equipmentIds: ["eq-b"] } }, { scope: { taskIds: ["task-b"] } }, { projection: { kind: "scope" } }]) {
      expect(matchesWbsReportRequest(request(change), pathname, condition)).toBe(false);
    }
  });
});

import { EventEmitter } from "node:events";
import type { Page, Response } from "@playwright/test";
import type { WbsReportEcho } from "../e2e/helpers/wbs-report";
import { assertWbsReportEcho, waitForWbsReport } from "../e2e/helpers/wbs-report";
function report(change: Record<string, unknown> = {}) {
  return { projection: "report", spec: condition.spec, filters: {}, sourceContext: {}, ...change } as WbsReportEcho;
}
function harness() {
  const emitter = new EventEmitter();
  const page = Object.assign(emitter, {
    url: () => "https://example.invalid/projects/project-a",
    waitForResponse: (predicate: (response: Response) => Promise<boolean>) => new Promise<Response>((resolve, reject) => {
      const handle = async (response: Response) => {
        try { if (await predicate(response)) { emitter.off("response", handle); resolve(response); } }
        catch (error) { emitter.off("response", handle); reject(error); }
      };
      emitter.on("response", handle);
    }),
  }) as unknown as Page;
  const response = (req: ReturnType<typeof request>, data = report(), status = 200) => ({ request: () => req, status: () => status, text: async () => JSON.stringify({ data }) }) as unknown as Response;
  return { emitter, page, response };
}
it("ignores an already in-flight matching request and consumes only a future matching request", async () => {
  const { emitter, page, response } = harness();
  const old = request();
  emitter.emit("request", old);
  const waiting = waitForWbsReport(page, condition);
  emitter.emit("response", response(old));
  const process = request({ spec: { ...condition.spec, root: "process" } });
  emitter.emit("request", process); emitter.emit("response", response(process, report({ spec: process.postDataJSON().spec })));
  const next = request(); emitter.emit("request", next); emitter.emit("response", response(next));
  const captured = await waiting;
  expect(captured.request()).toBe(next);
  expect(emitter.listenerCount("request")).toBe(0);
});
it("rejects wrong response echo rather than waiting for a later preferred body, and removes its listener", async () => {
  const { emitter, page, response } = harness();
  const waiting = waitForWbsReport(page, condition);
  const req = request(); emitter.emit("request", req);
  emitter.emit("response", response(req, report({ spec: { ...condition.spec, root: "process" } })));
  await expect(waiting).rejects.toThrow("응답 spec");
  expect(emitter.listenerCount("request")).toBe(0);
});
it("rejects a non-200 selected response without accepting it as data", async () => {
  const { emitter, page, response } = harness();
  const waiting = waitForWbsReport(page, condition);
  const req = request(); emitter.emit("request", req); emitter.emit("response", response(req, report(), 503));
  await expect(waiting).rejects.toThrow("실제 WBS report 응답 상태");
  expect(emitter.listenerCount("request")).toBe(0);
});
it("rejects wrong filter/scope/projection echoes", () => {
  expect(() => assertWbsReportEcho(report({ filters: { taskSearch: "other" } }), { ...condition, filters: { taskSearch: "wanted" } })).toThrow("filter");
  expect(() => assertWbsReportEcho(report({ sourceContext: { scope: { taskIds: ["other"] } } }), condition)).toThrow("scope");
  expect(() => assertWbsReportEcho(report({ projection: "details" }), condition)).toThrow("report");
});
it("reserves the first exact response before reading its body; a faster second body cannot hide its bad echo", async () => {
  const { emitter, page, response } = harness();
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const first = request(), second = request();
  const badFirst = response(first, report({ spec: { ...condition.spec, root: "process" } }));
  badFirst.text = async () => { await gate; return JSON.stringify({ data: report({ spec: { ...condition.spec, root: "process" } }) }); };
  const waiting = waitForWbsReport(page, condition);
  let acceptedEarly = false;
  const outcome = waiting.then(value => { acceptedEarly = true; return value; }, error => error);
  emitter.emit("request", first); emitter.emit("response", badFirst);
  emitter.emit("request", second); emitter.emit("response", response(second));
  await new Promise<void>(resolve => setImmediate(resolve));
  const acceptedBeforeFirstEcho = acceptedEarly;
  release();
  const result = await outcome;
  expect(acceptedBeforeFirstEcho).toBe(false);
  expect(result).toBeInstanceOf(Error);
  expect(result.message).toContain("응답 spec");
  expect(emitter.listenerCount("request")).toBe(0);
});
it("keeps the selected response identity and cached body together under overlapping identical queries", async () => {
  const { emitter, page, response } = harness();
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const first = request(), second = request();
  const slow = response(first);
  slow.text = async () => { await gate; return JSON.stringify({ data: report({ snapshotId: "first" }) }); };
  const waiting = waitForWbsReport(page, condition);
  emitter.emit("request", first); emitter.emit("response", slow);
  emitter.emit("request", second); emitter.emit("response", response(second, report({ snapshotId: "second" })));
  await new Promise<void>(resolve => setImmediate(resolve));
  release();
  const selected = await waiting;
  expect(selected.response).toBe(slow);
  expect(selected.request()).toBe(first);
  expect((await selected.json()).data.snapshotId).toBe("first");
  expect((await selected.json()).data.snapshotId).toBe("first");
});
it("rejects unexpected response filters even when the requested filter set is empty", () => {
  expect(() => assertWbsReportEcho(report({ filters: { taskSearch: "another Task" } }), condition)).toThrow("응답 filters");
});
it("accepts full filter echoes after wire normalization of empty arrays, trimming, deduplication and ordering", () => {
  const expected = { ...condition, filters: { taskIds: [" b ", "a", "a"], resourceIds: [], taskSearch: " wanted ", search: " terms ", mdPerMm: 20 } };
  const actual = report({ filters: { taskIds: ["a", "b"], taskSearch: "wanted", search: "terms", mdPerMm: 20 } });
  expect(() => assertWbsReportEcho(actual, expected)).not.toThrow();
});
