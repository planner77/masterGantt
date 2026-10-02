import { describe, expect, it } from "vitest";

import { mergePendingProjectRevision, shouldRetireDurableProjectRevision } from "../../../src/features/projects/project-revision-sync";

describe("mergePendingProjectRevision", () => {
  it("captures a newer durable announcement that was missed as an event", () => {
    expect(mergePendingProjectRevision(0, 7, "8")).toBe(8);
  });

  it("preserves the highest pending revision across repeated announcements", () => {
    expect(mergePendingProjectRevision(12, 7, "9")).toBe(12);
    expect(mergePendingProjectRevision(12, 7, 15)).toBe(15);
  });

  it("ignores stale, absent, malformed, and fractional revisions", () => {
    expect(mergePendingProjectRevision(11, 11, "11")).toBe(11);
    expect(mergePendingProjectRevision(11, 11, null)).toBe(11);
    expect(mergePendingProjectRevision(11, 11, "not-a-number")).toBe(11);
    expect(mergePendingProjectRevision(11, 11, "12.5")).toBe(11);
  });
});

describe("shouldRetireDurableProjectRevision", () => {
  it("retires a durable target when an authoritative follow-up makes no progress", () => {
    expect(shouldRetireDurableProjectRevision(20, 20, 10, 10)).toBe(true);
  });

  it("keeps live or satisfied targets active", () => {
    expect(shouldRetireDurableProjectRevision(0, 20, 10, 10)).toBe(false);
    expect(shouldRetireDurableProjectRevision(20, 20, 10, 20)).toBe(false);
    expect(shouldRetireDurableProjectRevision(20, 21, 10, 10)).toBe(false);
  });
});
