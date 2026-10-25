import { describe, expect, it } from "vitest";
import { metadataViewportRestoreTarget } from "../../../src/features/gantt/metadata-viewport-restore";

describe("Issue #538 follow-up: metadata-only Gantt viewport continuity", () => {
  it("restores a nonzero horizontal scroll changed by Core without a user action", () => {
    expect(metadataViewportRestoreTarget({ left: 91, top: 38 }, { left: 120, top: 38 }))
      .toEqual({ left: 120, top: undefined });
  });

  it("restores both coordinates after native reset or partial shift", () => {
    expect(metadataViewportRestoreTarget({ left: 0, top: 12 }, { left: 120, top: 38 }))
      .toEqual({ left: 120, top: 38 });
  });

  it("does not dispatch redundant viewport mutations when state is unchanged", () => {
    expect(metadataViewportRestoreTarget({ left: 120, top: 38 }, { left: 120, top: 38 }))
      .toBeNull();
  });

  it("can preserve an intentional zero baseline and rejects invalid scroll values", () => {
    expect(metadataViewportRestoreTarget({ left: 91, top: 38 }, { left: 0, top: 38 }))
      .toEqual({ left: 0, top: undefined });
    expect(metadataViewportRestoreTarget({ left: NaN, top: 38 }, { left: 120, top: 38 }))
      .toBeNull();
    expect(metadataViewportRestoreTarget({ left: 91, top: -1 }, { left: 120, top: 38 }))
      .toBeNull();
  });
});
