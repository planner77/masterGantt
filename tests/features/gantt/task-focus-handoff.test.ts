import { afterEach, describe, expect, it, vi } from "vitest";
import { handoffTaskRevealFocus } from "../../../src/features/gantt/viewport/task-focus-handoff";
import type { ViewportController, ViewportSample } from "../../../src/features/gantt/viewport/viewport-coordinator";

const taskId = "00000000-0000-4000-8000-000000000004";
function fixture() {
  const events = new EventTarget();
  const body = {}, other = {};
  let active: unknown = body, modal = false, current = true;
  let sample = { measurable: true, context: { visible: true, apiInstance: "api", revision: 2, projectionEpoch: 3 },
    core: { left: 120, top: 96 }, native: { left: 120, top: 96 } } as ViewportSample;
  const rect = { top: 100, bottom: 200, left: 0, right: 500 };
  const makeRow = () => { const node = { isConnected: true, tabIndex: 0, hidden: false,
    getAttribute: () => taskId, hasAttribute: () => false, closest: () => null,
    getClientRects: () => [rect], getBoundingClientRect: () => rect,
    focus: vi.fn(() => { active = node; }),
  }; return node; };
  let row: ReturnType<typeof makeRow> | null = makeRow();
  const grid = { querySelectorAll: () => row ? [row] : [], getBoundingClientRect: () => rect };
  const root = { isConnected: true, closest: () => null, querySelector: () => grid, getBoundingClientRect: () => rect };
  const frames: Array<FrameRequestCallback> = [];
  const doc = { body, get activeElement() { return active; }, querySelector: () => modal ? {} : null,
    addEventListener: vi.fn(events.addEventListener.bind(events)), removeEventListener: vi.fn(events.removeEventListener.bind(events)) };
  vi.stubGlobal("document", doc);
  vi.stubGlobal("window", { innerWidth: 1440, innerHeight: 900 });
  vi.stubGlobal("getComputedStyle", (node: { hidden: boolean }) => ({ visibility: node.hidden ? "hidden" : "visible", display: "block" }));
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { frames.push(callback); return frames.length; });
  let mutations!: MutationCallback;
  const disconnect = vi.fn();
  vi.stubGlobal("MutationObserver", class {
    constructor(callback: MutationCallback) { mutations = callback; }
    observe() {} disconnect = disconnect;
  });
  const controller = { capture: () => sample, isCurrent: () => current } as unknown as ViewportController;
  const pending = handoffTaskRevealFocus({ controller, stamp: { context: "scope", contextEpoch: 0, gesture: 0, intent: 1 }, taskId,
    current: () => current, root: () => root as unknown as HTMLElement });
  const advance = async (count = 1) => {
    for (let i = 0; i < count; i++) { frames.splice(0).forEach(callback => callback(i)); await Promise.resolve(); }
  };
  return { pending, advance, doc, root, events, disconnect,
    transientModal() { mutations([{ type: "attributes", attributeName: "open", oldValue: "", target: { tagName: "DIALOG" } } as unknown as MutationRecord], {} as MutationObserver); },
    get row() { return row!; }, get active() { return active; }, get sample() { return sample; },
    replaceRow() { row = makeRow(); active = body; }, clearRow() { row = null; },
    cancel() { current = false; }, modal() { modal = true; }, otherFocus() { active = other; },
    update(patch: Partial<ViewportSample>) { sample = { ...sample, ...patch }; },
  };
}
afterEach(() => vi.unstubAllGlobals());

describe("Task reveal DOM focus is separate from viewport settlement", () => {
  it("refocuses a replacement row and observes its actual identity for three frames", async () => {
    const f = fixture(), old = f.row;
    await f.advance(5);
    expect(f.active).toBe(old);
    f.replaceRow(); const replacement = f.row;
    await f.advance(2);
    let complete = false; void f.pending.then(() => { complete = true; }); await Promise.resolve();
    expect(complete).toBe(false);
    await f.advance();
    expect(await f.pending).toBe("SETTLED");
    expect(f.active).toBe(replacement);
    expect(replacement.focus).toHaveBeenCalledWith({ preventScroll: true });
    expect(f.doc.removeEventListener).toHaveBeenCalledTimes(4);
    expect(f.disconnect).toHaveBeenCalledTimes(1);
  });

  it("permanently cancels a dialog that opens and closes between animation frames", async () => {
    const f = fixture(); await f.advance();
    f.transientModal();
    const calls = f.row.focus.mock.calls.length; await f.advance();
    expect(await f.pending).toBe("SUPERSEDED");
    expect(f.row.focus).toHaveBeenCalledTimes(calls);
    expect(f.disconnect).toHaveBeenCalledTimes(1);
    expect(f.doc.removeEventListener).toHaveBeenCalledTimes(4);
  });

  it.each(["wheel", "keydown", "pointerdown", "touchstart"])("permanently cancels on %s even when coordinates and focus have not changed", async event => {
    const f = fixture(); await f.advance();
    const calls = f.row.focus.mock.calls.length;
    f.events.dispatchEvent(new Event(event));
    await f.advance();
    expect(await f.pending).toBe("SUPERSEDED");
    expect(f.row.focus).toHaveBeenCalledTimes(calls);
    expect(f.sample.core).toEqual({ left: 120, top: 96 });
  });

  it.each(["intent", "modal", "focus", "projection", "revision", "api", "hidden", "position"])("does not complete or resume after a newer %s", async change => {
    const f = fixture(); await f.advance();
    if (change === "intent") f.cancel();
    if (change === "modal") f.modal();
    if (change === "focus") f.otherFocus();
    if (change === "position") f.update({ core: { left: 120, top: 150 } });
    if (["projection", "revision", "api", "hidden"].includes(change)) f.update({ context: { ...f.sample.context,
      ...(change === "projection" ? { projectionEpoch: 4 } : change === "revision" ? { revision: 3 } : change === "api" ? { apiInstance: "new" } : { visible: false }) } });
    const calls = f.row.focus.mock.calls.length; await f.advance();
    expect(await f.pending).toBe("SUPERSEDED");
    expect(f.row.focus).toHaveBeenCalledTimes(calls);
  });

  it.each(["missing", "css-hidden", "offscreen"])("bounds observation without focusing a %s row", async state => {
    const f = fixture(), row = f.row;
    if (state === "missing") f.clearRow();
    if (state === "css-hidden") row.hidden = true;
    if (state === "offscreen") row.getBoundingClientRect = () => ({ top: -200, bottom: -100, left: 0, right: 500 });
    await f.advance(12);
    expect(await f.pending).toBe("TIMED_OUT");
    expect(row.focus).not.toHaveBeenCalled();
  });
});
