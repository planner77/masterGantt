import { afterEach, describe, expect, it, vi } from "vitest";
import { observeScaleDecoration } from "../../src/features/gantt/scale-decoration-observer";

// A browser-independent DOM boundary fixture keeps callback/cleanup tests exact;
// the actual native mutation/scroll boundary is exercised by Chromium #507.
class FixtureElement {
  constructor(readonly scale = false, readonly nested = false, readonly inScale = false) {}
  matches() { return this.scale; }
  querySelector() { return this.nested ? this : null; }
  closest() { return this.scale || this.inScale ? this : null; }
}
class FixtureObserver {
  static current: FixtureObserver;
  observe = vi.fn();
  disconnect = vi.fn();
  constructor(readonly callback: MutationCallback) { FixtureObserver.current = this; }
  deliver(type: MutationRecord["type"], target: FixtureElement, addedNodes: FixtureElement[] = []) {
    this.callback([{ type, target, addedNodes } as unknown as MutationRecord], this as unknown as MutationObserver);
  }
}

afterEach(() => vi.unstubAllGlobals());

describe("#507 scale decoration mutation boundary", () => {
  it("ignores virtual rows and unrelated class changes but decorates added/recycled scale cells", () => {
    vi.stubGlobal("Element", FixtureElement);
    vi.stubGlobal("MutationObserver", FixtureObserver);
    const decorate = vi.fn(), root = new FixtureElement();
    const stop = observeScaleDecoration(root as unknown as HTMLElement, ".scale", decorate, true);
    expect(decorate).toHaveBeenCalledTimes(1);
    const observer = FixtureObserver.current;
    observer.deliver("childList", root, [new FixtureElement()]);
    observer.deliver("attributes", new FixtureElement());
    expect(decorate).toHaveBeenCalledTimes(1);
    observer.deliver("childList", root, [new FixtureElement(true)]);
    observer.deliver("childList", root, [new FixtureElement(false, true)]);
    observer.deliver("attributes", new FixtureElement(true));
    observer.deliver("childList", new FixtureElement(false, false, true));
    expect(decorate).toHaveBeenCalledTimes(5);
    expect(observer.observe).toHaveBeenCalledWith(root, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
    stop();
    expect(observer.disconnect).toHaveBeenCalledOnce();
  });

  it("keeps Day observation child-list-only and releases its observer on cleanup", () => {
    vi.stubGlobal("Element", FixtureElement);
    vi.stubGlobal("MutationObserver", FixtureObserver);
    const root = new FixtureElement(), decorate = vi.fn();
    const stop = observeScaleDecoration(root as unknown as HTMLElement, ".day", decorate);
    expect(FixtureObserver.current.observe).toHaveBeenCalledWith(root, { childList: true, subtree: true });
    stop();
    expect(FixtureObserver.current.disconnect).toHaveBeenCalledOnce();
    expect(decorate).toHaveBeenCalledOnce();
  });
});
