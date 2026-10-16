import { describe, expect, it, vi } from "vitest";
import type { IApi } from "@svar-ui/react-gantt";
import { createProductConsistency } from "../../../src/features/gantt/product-consistency";
import { canonicalFixture, proofContextFixture } from "../../fixtures/gantt-state-consistency/synthetic";

function product() {
  const canonical = canonicalFixture(), identity = proofContextFixture().desired;
  let blocked = false;
  const api = { exec: vi.fn(), getTask: vi.fn(), serialize: vi.fn(({ data }: { data: string }) => data === "links" ? canonical.links : canonical.tasks) } as unknown as IApi;
  const runtime = createProductConsistency({ api, apiInstance: "api-product", root: {} as HTMLElement,
    identity: () => identity, projection: () => ({ ...canonical, revision: identity.revision, keys: identity.keys, membershipIds: ["A", "B", "C"], logicalVisibleIds: ["A", "B", "C"] }),
    visible: () => true, blocked: () => blocked,
    intent: () => ({ stamp: { context: "product", contextEpoch: 0, gesture: 0, intent: 0 }, priority: 1 }), frame: async () => true,
  });
  return { runtime, api, block: () => { blocked = true; } };
}

describe("U5 mounted product canonical authority", () => {
  it("proves an unchanged server snapshot from actual public Core without any command", async () => {
    const { runtime, api } = product();
    expect(await runtime.recovery.recover()).toMatchObject({ outcome: "SETTLED", changed: false });
    expect(api.serialize).toHaveBeenCalledWith({ data: "tree" });
    expect(api.serialize).toHaveBeenCalledWith({ data: "links" });
    expect(api.exec).not.toHaveBeenCalled();
    expect(runtime.dataReady()).toBe(true);
    runtime.dispose();
  });
  it("cannot consume previously confirmed props while the HTTP result remains unknown", async () => {
    const { runtime, api, block } = product();
    block();
    expect(await runtime.recovery.recover()).toMatchObject({ outcome: "FAILED", reason: "CANONICAL_UNCONFIRMED" });
    expect(runtime.recovery.canWrite()).toBe(false);
    expect(runtime.dataReady()).toBe(false);
    expect(api.exec).not.toHaveBeenCalled();
    runtime.dispose();
  });
  it("holds a request ticket pending without reverting Core, then invalidates its old evidence", async () => {
    const { runtime, api } = product();
    const ticket = runtime.recovery.beginMutation("request-1", ["B"])!;
    expect(await runtime.recovery.recover()).toMatchObject({ outcome: "BLOCKED" });
    expect(api.serialize).not.toHaveBeenCalled();
    runtime.invalidate();
    expect(runtime.recovery.completeMutation(ticket, "NETWORK")).toBe(true);
    expect(runtime.recovery.state().recovery.phase).toBe("UNCERTAIN");
    expect(runtime.recovery.canWrite()).toBe(false);
    expect(runtime.dataReady()).toBe(false);
    expect(api.exec).not.toHaveBeenCalled();
    runtime.dispose();
  });
});
