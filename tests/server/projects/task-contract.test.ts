import { describe, expect, it } from "vitest";

import {
  parseCreateTaskInput,
  parseUpdateTaskInput,
} from "../../../src/server/projects/task-contract";

const valid = {
  name: " Foundation ",
  type: "task" as const,
  start: "2026-09-12",
  duration: 3,
  progress: 25,
};

describe("W07 task input contract", () => {
  it("normalizes only the name and preserves an opaque Unicode external ID", () => {
    const parsed = parseCreateTaskInput({
      ...valid,
      externalId: "설비-Á",
      parentExternalId: null,
    });
    expect(parsed).toEqual({
      success: true,
      data: { ...valid, name: "Foundation", externalId: "설비-Á", parentExternalId: null },
    });
  });

  it.each([
    { ...valid, type: "summary" },
    { ...valid, siblingOrder: 0 },
    { ...valid, parentExternalId: "SUM-1" },
    { ...valid, externalId: " leading" },
    { ...valid, externalId: "trailing\u00a0" },
    { ...valid, externalId: "control\u0000" },
    { ...valid, externalId: "format\u200b" },
    { ...valid, externalId: "x".repeat(129) },
    { ...valid, name: "" },
    { ...valid, name: "x".repeat(201) },
    { ...valid, progress: Number.NaN },
    { ...valid, progress: Number.POSITIVE_INFINITY },
    { ...valid, progress: 101 },
  ])("rejects invalid create input %#", (input) => {
    expect(parseCreateTaskInput(input).success).toBe(false);
  });

  it("rejects malformed Unicode without echoing the input", () => {
    const parsed = parseCreateTaskInput({ ...valid, externalId: "bad\ud800" });
    expect(parsed.success).toBe(false);
    if (!parsed.success) expect(JSON.stringify(parsed.details)).not.toContain("bad");
  });

  it("accepts a strict nonempty patch and requires end to accompany start or duration", () => {
    expect(parseUpdateTaskInput({ name: " Updated " })).toEqual({
      success: true,
      data: { name: "Updated" },
    });
    expect(parseUpdateTaskInput({ end: "2026-09-16" }).success).toBe(false);
    expect(parseUpdateTaskInput({ start: "2026-09-12", end: "2026-09-16" }).success).toBe(true);
    expect(parseUpdateTaskInput({}).success).toBe(false);
    expect(parseUpdateTaskInput({ externalId: "NEW" }).success).toBe(false);
    expect(parseUpdateTaskInput({ type: "milestone" }).success).toBe(false);
  });
});
