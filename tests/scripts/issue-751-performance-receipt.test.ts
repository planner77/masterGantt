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
});
