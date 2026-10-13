import { describe, expect, it } from "vitest";
import { stampInitializedGanttApiIdentity } from "../src/features/gantt/gantt-api-identity";

function fakeFrame(connected: boolean, initialId?: string) {
  const dataset = (initialId ? { projectGanttApiInstance: initialId } : {}) as DOMStringMap;
  return { isConnected: connected, dataset } satisfies Pick<HTMLDivElement, "isConnected" | "dataset">;
}

describe("SVAR init identity diagnostics (#674)", () => {
  it("publishes exact initialized API identity without waiting for React state commit", () => {
    const frame = fakeFrame(true);
    stampInitializedGanttApiIdentity(frame, "svar-api-1");
    expect(frame.dataset.projectGanttApiInstance).toBe("svar-api-1");
  });

  it("replaces stale ID on subsequent native API initialization", () => {
    const frame = fakeFrame(true, "svar-api-1");
    stampInitializedGanttApiIdentity(frame, "svar-api-2");
    expect(frame.dataset.projectGanttApiInstance).toBe("svar-api-2");
  });

  it("does not stamp a disconnected or unmounted frame", () => {
    const frame = fakeFrame(false, "svar-api-1");
    stampInitializedGanttApiIdentity(frame, "svar-api-2");
    expect(frame.dataset.projectGanttApiInstance).toBe("svar-api-1");
    const empty = fakeFrame(false);
    stampInitializedGanttApiIdentity(empty, "svar-api-3");
    expect(empty.dataset.projectGanttApiInstance).toBeUndefined();
  });
});
