import { describe, expect, it } from "vitest";
import { activeResourceEditorReceipts, resourceEditorFocusDecision, type ResourceEditorFocusReadiness } from "../../../src/features/projects/resource-editor-focus-return";

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

describe("Issue #807 inactive workspace peers must not delay Resource editor focus", () => {
  const node = (hidden: boolean, dataset: Record<string, string>, detailState = "ready") => ({
    dataset,
    closest: () => hidden ? ({} as Element) : null,
    getAttribute: (name: string) => name === "data-detail-state" ? detailState : null,
  }) as unknown as HTMLElement;

  it("requires current visible receipts, not hidden dynamic/old visit stale receipts", () => {
    const inactiveDynamic = node(true, { reportConfirmationId: "0" });
    const inactiveVisit = node(true, { reportConfirmationId: "outdated" });
    const activeReport = node(false, { reportConfirmationId: "canonical-new" });
    const inactiveDetail = node(true, { projectionDetailKey: "assignment", detailConfirmationId: "old-detail" });
    const activeDetail = node(false, { projectionDetailKey: "assignment", detailConfirmationId: "canonical-detail" });
    const activePending = node(false, {});
    let pendingVisible = false;
    const panel = {
      querySelectorAll: (selector: string) => {
        if (selector === '[data-ready="false"]') return pendingVisible ? [inactiveDynamic, inactiveVisit, activePending] : [inactiveDynamic, inactiveVisit];
        if (selector === '[data-resource-dashboard="true"][data-ready="true"], [data-wbs-view="resource"][data-ready="true"]')
          return [inactiveVisit, activeReport];
        if (selector === "[data-projection-detail-key]") return [inactiveDetail, activeDetail];
        return [];
      },
    } as unknown as HTMLElement;
    const receipts = activeResourceEditorReceipts(panel, "assignment");
    expect(receipts).toEqual({ reportPending: false, reportConfirmed: true, detailRoot: activeDetail });
    expect(resourceEditorFocusDecision({
      ...ready,
      reportPending: receipts.reportPending,
      reportConfirmed: receipts.reportConfirmed,
      detailPresent: Boolean(receipts.detailRoot),
      detailState: receipts.detailRoot?.getAttribute("data-detail-state") ?? null,
      detailConfirmationId: receipts.detailRoot?.dataset.detailConfirmationId,
    })).toBe("READY");
    expect(activeResourceEditorReceipts(panel, "not-this-visit").detailRoot).toBeNull();
    pendingVisible = true;
    expect(activeResourceEditorReceipts(panel, "assignment").reportPending).toBe(true);
    activeReport.dataset.reportConfirmationId = "0";
    expect(activeResourceEditorReceipts(panel, "assignment").reportConfirmed).toBe(false);
  });
});
