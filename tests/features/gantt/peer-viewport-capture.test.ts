import { describe, expect, it } from "vitest";
import { capturePeerViewportCoordinates } from "../../../src/features/gantt/peer-viewport-capture";

describe("SVAR public/DOM peer viewport restoration", () => {
  it("preserves a one-pixel Core/DOM difference without rewriting either coordinate", () => {
    const read = () => ({ left: 120, top: 96 });
    const captured = capturePeerViewportCoordinates(read, { left: 119, top: 95 });
    expect(captured).toEqual({ public: { left: 120, top: 96 }, dom: { left: 119, top: 95 } });
    expect(captured?.public.left).not.toBe(captured?.dom.left);
  });

  it("rejects absent/stale Core readers and non-finite scroll readings instead of applying a DOM fallback", () => {
    expect(capturePeerViewportCoordinates(null, { left: 119, top: 95 })).toBeNull();
    expect(capturePeerViewportCoordinates(() => ({ left: Number.NaN, top: 0 }), { left: 119, top: 95 })).toBeNull();
    expect(capturePeerViewportCoordinates(() => ({ left: 120, top: 0 }), { left: Infinity, top: 0 })).toBeNull();
  });

  it("retains ordinary matched Core and DOM coordinates", () => {
    expect(capturePeerViewportCoordinates(() => ({ left: 120, top: 0 }), { left: 120, top: 0 }))
      .toEqual({ public: { left: 120, top: 0 }, dom: { left: 120, top: 0 } });
  });
});
