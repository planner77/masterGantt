import { describe, expect, it } from "vitest";

import { buildProjectTaskHoverTooltipData } from "../../../src/features/gantt/task-hover-tooltip";
import { formatLocaleDateOnly } from "../../../src/lib/date-display";

describe("Issue #492 task hover tooltip model", () => {
  it("uses canonical task dates with the shared locale formatter", () => {
    const data = buildProjectTaskHoverTooltipData({
      name: "Canonical task",
      start: "2026-09-16",
      end: "2026-09-18",
    }, "ko-KR");

    expect(data).toEqual({
      name: "Canonical task",
      start: formatLocaleDateOnly("2026-09-16", "ko-KR"),
      end: formatLocaleDateOnly("2026-09-18", "ko-KR"),
    });
  });

  it("keeps a date-less Summary visibly unset instead of exposing a Core anchor", () => {
    expect(buildProjectTaskHoverTooltipData({
      name: "Date-less summary",
      start: null,
      end: null,
    }, "en-CA")).toEqual({
      name: "Date-less summary",
      start: "—",
      end: "—",
    });
  });
});
