import { describe, expect, it } from "vitest";
import { EventEmitter } from "node:events";
import type { Page, TestInfo } from "@playwright/test";
import { IsolatedPerformanceReceipt, safeRoute } from "../e2e/fixtures/isolated-performance-receipt";

function fixture() {
  const bodies: Buffer[] = [];
  const info = { testId: "fixture-timing", project: {name:"chromium"}, retry:0, workerIndex:0, timeout:60000,
    attach: async (_name: string, item: {body:Buffer}) => {bodies.push(item.body);} } as unknown as TestInfo;
  const observer = new IsolatedPerformanceReceipt(info);
  return { observer, data: () => JSON.parse(bodies[0].toString("utf8")) };
}
describe("Issue 751: sanitized monotonic observation", () => {
  it("keeps URL and identifier secrets out of receipts", async () => {
    const {observer,data} = fixture();
    expect(safeRoute("/api/projects/secret123/tasks/secret456/logistics-links?token=private")).toBe("task-logistics-links");
    expect(safeRoute("/private?token=private")).toBeNull();
    await observer.api("/api/projects/secret123/tasks/secret456/logistics-links?token=private","PUT",async()=>({status:()=>200}));
    await observer.attach("ok");
    expect(data().requests[0]).toMatchObject({status:200,route:"task-logistics-links",outcome:"complete"});
    expect(JSON.stringify(data())).not.toMatch(/secret123|secret456|private/);
  });
  it("retains setup/seed timing separately and classifies timeout without masking original error",async()=>{
    const {observer,data}=fixture();
    await observer.measure("fixture_setup",async()=>observer.measure("seed_issue_623",async()=>undefined));
    await expect(observer.measure("server_restart",async()=>{throw new Error("operation timed out")})).rejects.toThrow();
    await observer.attach("error");
    expect(data().stages.map((s:{stage:string})=>s.stage)).toContain("seed_issue_623");
    expect(data().stages.find((s:{stage:string})=>s.stage==="server_restart")).toMatchObject({outcome:"error",errorClass:"timeout"});
  });
  it("distinguishes HTTP error and aborted browser request",async()=>{
    const {observer,data}=fixture();
    const events=new EventEmitter(),stop=observer.listen(events as unknown as Page);
    const first={url:()=>"/api/resource-dashboard",method:()=>"GET",failure:()=>null};
    const second={url:()=>"/api/projects/x/tasks/y/logistics-links",method:()=>"GET",failure:()=>"net::ERR_ABORTED"};
    events.emit("request",first);events.emit("response",{request:()=>first,status:()=>503});events.emit("requestfinished",first);
    events.emit("request",second);events.emit("requestfailed",second);stop();
    await observer.attach("error");
    expect(data().requests.map((x:{outcome:string})=>x.outcome)).toEqual(["http_error","abort"]);
  });
  it("records SQL and server durations without exposing request IDs or raw SQL", async () => {
    const { observer, data } = fixture();
    observer.captureServerEvents([
      { event: "http_request_completed", method: "GET",
        route: "/api/projects/[publicId]/assignment-targets",
        status: 200, durationMs: 235, sqlStatementCount: 8, sqlExecutionMs: 17.8,
        requestId: "12345678-1234-4123-8123-123456789abc", query: "SELECT private" },
      { event: "http_request_completed", method: "GET", route: "/api/projects/private-uuid",
        sqlStatementCount: 100 },
    ], 2);
    await observer.attach("ok");
    // The unknown API is deliberately retained as a sanitized "other-api"
    // category; never invent raw URL/identifier details or silently drop it.
    expect(data().serverRequests).toHaveLength(2);
    expect(data().serverRequests[0]).toMatchObject({
      route: "assignment-targets", status: 200, serverMs: 235,
      sqlStatementCount: 8, sqlExecutionMs: 17.8,
    });
    expect(data().serverRequests[1]).toMatchObject({
      route: "other-api", status: null, serverMs: null,
      sqlStatementCount: 100, sqlExecutionMs: null,
    });
    expect(data().serverEventsDiscarded).toBe(2);
    expect(JSON.stringify(data())).not.toMatch(/12345678|SELECT private|private-uuid/);
  });
  it("classifies actual Playwright failure() objects and never emits raw errorText", async () => {
    const { observer, data } = fixture();
    const events = new EventEmitter();
    const stop = observer.listen(events as unknown as Page);
    const aborted = {
      url: () => "/api/projects/secret123/assignment-targets?token=hidden",
      method: () => "GET",
      failure: () => ({ errorText: "net::ERR_ABORTED cookie=private" }),
    };
    const network = {
      url: () => "/api/projects/secret123/assignment-targets",
      method: () => "GET",
      failure: () => ({ errorText: "net::ERR_FAILED credential=secret" }),
    };
    events.emit("request", aborted);
    events.emit("requestfailed", aborted);
    events.emit("request", network);
    events.emit("requestfailed", network);
    stop();
    await observer.attach("error");
    expect(data().requests).toMatchObject([
      { source: "browser", route: "assignment-targets", status: null, outcome: "abort" },
      { source: "browser", route: "assignment-targets", status: null, outcome: "network" },
    ]);
    expect(JSON.stringify(data())).not.toMatch(/ERR_ABORTED|ERR_FAILED|secret123|token=|credential=|private/);
  });

  it("does not treat HTTP response headers or route fulfillment as a finished request", async () => {
    const { observer, data } = fixture();
    const events = new EventEmitter();
    const stop = observer.listen(events as unknown as Page);
    const pending = {
      url: () => "/api/projects/uuid/assignment-targets",
      method: () => "GET",
      failure: () => null,
    };
    events.emit("request", pending);
    events.emit("response", { request: () => pending, status: () => 503 });
    stop();
    await observer.attach("error");
    expect(data().requests).toMatchObject([
      { source: "browser", route: "assignment-targets", status: 503, outcome: "incomplete" },
    ]);
  });

  it("keeps complete and HTTP error outcomes only for terminal requestfinished events", async () => {
    const { observer, data } = fixture();
    const events = new EventEmitter();
    const stop = observer.listen(events as unknown as Page);
    for (const status of [200, 503]) {
      const request = {
        url: () => "/api/projects/uuid/assignment-targets",
        method: () => "GET",
        failure: () => null,
      };
      events.emit("request", request);
      events.emit("response", { request: () => request, status: () => status });
      events.emit("requestfinished", request);
    }
    stop();
    await observer.attach("ok");
    expect(data().requests.map((record: { outcome: string }) => record.outcome))
      .toEqual(["complete", "http_error"]);
  });

});
