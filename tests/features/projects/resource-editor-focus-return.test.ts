import { describe, expect, it } from "vitest";
import { resourceEditorFocusDecision, type ResourceEditorFocusReadiness } from "../../../src/features/projects/resource-editor-focus-return";

const ready: ResourceEditorFocusReadiness = {
  modal: "none",
  reportPending: false,
  reportConfirmed: true,
  detailOrigin: true,
  detailPresent: true,
  detailState: "ready",
  detailConfirmationId: "confirmed-canonical-revision",
};

describe("Issue #751/#622 Resource editor focus return readiness", () => {
  it("does not fall through an async stale or loading detail, regardless of elapsed RAF frames", () => {
    for (const detailState of ["stale", "loading", "error"]) {
      expect(resourceEditorFocusDecision({ ...ready, detailState })).toBe("WAIT");
    }
    expect(resourceEditorFocusDecision({ ...ready, reportPending: true })).toBe("WAIT");
    expect(resourceEditorFocusDecision({ ...ready, detailPresent: false, reportConfirmed: false })).toBe("WAIT");
    expect(resourceEditorFocusDecision({ ...ready, detailConfirmationId: "0" })).toBe("WAIT");
    expect(resourceEditorFocusDecision({ ...ready, detailConfirmationId: "" })).toBe("WAIT");
  });
  it("restores only after the original native modal closes and a current canonical receipt exists", () => {
    expect(resourceEditorFocusDecision({ ...ready, modal: "closing" })).toBe("WAIT");
    expect(resourceEditorFocusDecision({ ...ready })).toBe("READY");
    expect(resourceEditorFocusDecision({ ...ready, detailOrigin: false, detailPresent: false })).toBe("READY");
    expect(resourceEditorFocusDecision({ ...ready, detailPresent: false, reportConfirmed: true })).toBe("READY");
  });
  it("cancels when a newer modal takes focus and never steals it back", () => {
    expect(resourceEditorFocusDecision({ ...ready, modal: "foreign" })).toBe("CANCEL");
    expect(resourceEditorFocusDecision({
      ...ready, modal: "foreign", reportPending: true,
    })).toBe("CANCEL");
  });
});
