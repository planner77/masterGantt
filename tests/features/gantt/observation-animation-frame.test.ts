import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { observationAnimationFrame } from "../../../src/features/gantt/viewport/observation-animation-frame";

describe("U3 actual animation frame", () => {
  let documentStub: EventTarget & { visibilityState: string };
  let callback: FrameRequestCallback;
  let cancel: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    vi.useFakeTimers();
    documentStub = Object.assign(new EventTarget(), { visibilityState: "visible" });
    cancel = vi.fn();
    vi.stubGlobal("document", documentStub);
    vi.stubGlobal("requestAnimationFrame", vi.fn((value: FrameRequestCallback) => { callback = value; return 7; }));
    vi.stubGlobal("cancelAnimationFrame", cancel);
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
  it("keeps waiting beyond a viewport 50ms tick and succeeds only on an actual RAF", async () => {
    const controller = new AbortController(), completed = vi.fn();
    const result = observationAnimationFrame(controller.signal);
    void result.then(completed);
    await vi.advanceTimersByTimeAsync(90);
    expect(completed).not.toHaveBeenCalled();
    callback(90);
    expect(await result).toBe(true);
    expect(cancel).toHaveBeenCalledExactlyOnceWith(7);
  });
  it("lets the caller's unchanged deadline abort a stalled frame and cleans up listeners", async () => {
    const controller = new AbortController();
    const removeSignal = vi.spyOn(controller.signal, "removeEventListener"), removeVisibility = vi.spyOn(documentStub, "removeEventListener");
    const result = observationAnimationFrame(controller.signal);
    setTimeout(() => controller.abort(), 1500);
    await vi.advanceTimersByTimeAsync(1499);
    expect(cancel).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(await result).toBe(false);
    expect(cancel).toHaveBeenCalledExactlyOnceWith(7);
    expect(removeSignal).toHaveBeenCalledWith("abort", expect.any(Function));
    expect(removeVisibility).toHaveBeenCalledWith("visibilitychange", expect.any(Function));
    callback(1600);
    expect(cancel).toHaveBeenCalledTimes(1);
  });
  it("cancels a pending actual frame when the document becomes hidden", async () => {
    const result = observationAnimationFrame(new AbortController().signal);
    documentStub.visibilityState = "hidden"; documentStub.dispatchEvent(new Event("visibilitychange"));
    expect(await result).toBe(false);
    expect(cancel).toHaveBeenCalledExactlyOnceWith(7);
  });
  it.each(["aborted", "hidden"])("does not schedule a frame for an initially %s source", async mode => {
    const controller = new AbortController();
    if (mode === "aborted") controller.abort(); else documentStub.visibilityState = "hidden";
    expect(await observationAnimationFrame(controller.signal)).toBe(false);
    expect(requestAnimationFrame).not.toHaveBeenCalled();
  });
});
