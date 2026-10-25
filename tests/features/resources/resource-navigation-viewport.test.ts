import { describe, expect, it } from "vitest";
import { captureResourceNavigationViewport, cloneResourceNavigationViewport, canRestoreResourceNavigationViewport } from "../../../src/features/resources/resource-navigation-viewport";
import type { PublicGanttViewportReader } from "../../../src/features/gantt/peer-viewport-capture";

function fixture() {
  const snapshot = {}, positions = [{ selector: ".wx-chart", left: 119, top: 96 }];
  const value = { left: 120, top: 97, continuity: { apiInstanceId: "api-1", syncVersion: 5, filter: "null", scale: "day", gridWidth: 480, columns: "columns", viewportWidth: 1440 } };
  const reader: PublicGanttViewportReader = () => value;
  const saved = captureResourceNavigationViewport(snapshot, 2, reader, "project:all", positions)!;
  return { snapshot, positions, value, reader, saved };
}
describe("Resource navigation frame viewport", () => {
  it("owns immutable, independent Core and native coordinates across nested captures", () => {
    const f = fixture();
    f.positions[0].left = 300; f.value.left = 301; f.value.continuity.syncVersion = 6;
    const next = captureResourceNavigationViewport(f.snapshot, 2, f.reader, "project:all", f.positions)!;
    expect(f.saved.request.left).toBe(120);
    expect(f.saved.request.positions?.[0]).toEqual({ selector: ".wx-chart", left: 119, top: 96 });
    expect(f.saved.request.continuity?.syncVersion).toBe(5);
    expect(next.request.left).toBe(301);
    expect(Object.isFrozen(f.saved.request.positions?.[0])).toBe(true);
  });
  it("allows a new explicit return request after a newer canonical queue, retaining the source epoch", () => {
    const f = fixture(); f.value.continuity.syncVersion = 8;
    expect(canRestoreResourceNavigationViewport(f.saved, f.snapshot, 2, f.reader, "project:all")).toBe(true);
    expect(f.saved.request.continuity?.syncVersion).toBe(5);
  });
  it.each(["apiInstanceId", "scale", "gridWidth", "columns", "viewportWidth", "syncVersion"] as const)("rejects changed %s before staging restoration", field => {
    const f = fixture();
    Object.assign(f.value.continuity, { [field]: field === "syncVersion" ? 4 : typeof f.value.continuity[field] === "number" ? 999 : "changed" });
    expect(canRestoreResourceNavigationViewport(f.saved, f.snapshot, 2, f.reader, "project:all")).toBe(false);
  });
  it("rejects snapshot, reset, reader identity and unrelated scope changes", () => {
    const f = fixture();
    for (const [snapshot, generation, reader, key] of [[{}, 2, f.reader, "project:all"], [f.snapshot, 3, f.reader, "project:all"], [f.snapshot, 2, () => f.value, "project:all"], [f.snapshot, 2, f.reader, "other:all"]] as const)
      expect(canRestoreResourceNavigationViewport(f.saved, snapshot, generation, reader, key)).toBe(false);
  });
  it("clones source and destination baseline mementos without sharing mutable observations", () => {
    const f = fixture(), copy = cloneResourceNavigationViewport(f.saved)!;
    expect(copy).not.toBe(f.saved);
    expect(copy.request.continuity).not.toBe(f.saved.request.continuity);
    expect(copy.request.positions?.[0]).not.toBe(f.saved.request.positions?.[0]);
    expect(copy.request).toEqual(f.saved.request);
  });
  it("rejects capture while canonical commands are pending", () => {
    const f = fixture();
    Object.assign(f.value.continuity, {syncDepth:1});
    expect(captureResourceNavigationViewport(f.snapshot,2,f.reader,"project:all",f.positions)).toBeNull();
  });
  it("never invents public coordinates from a native-only reader", () => {
    expect(captureResourceNavigationViewport({}, 0, () => ({left: 1, top: 2}), "key", [])).toBeNull();
  });
});
