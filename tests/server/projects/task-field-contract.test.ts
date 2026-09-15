import { describe, expect, it } from "vitest";

import { parseUpdateTaskInput } from "../../../src/server/projects/task-contract";

describe("Issue #36 task detail contract", () => {
  it("preserves multiline descriptions and trims supported URLs", () => {
    expect(parseUpdateTaskInput({
      description: "첫 줄\n둘째 줄",
      url: "  http://10.10.20.30:8080/redmine/issues/123  ",
    })).toEqual({
      success: true,
      data: {
        description: "첫 줄\n둘째 줄",
        url: "http://10.10.20.30:8080/redmine/issues/123",
      },
    });
  });

  it("normalizes blank description and URL to null", () => {
    expect(parseUpdateTaskInput({ description: "  \n ", url: "   " })).toEqual({
      success: true,
      data: { description: null, url: null },
    });
  });

  it.each([
    "javascript:alert(1)",
    "data:text/html,unsafe",
    "vbscript:msgbox(1)",
    "file:///tmp/a",
    "not-a-url",
  ])("rejects unsafe or unsupported URL %s", (url) => {
    expect(parseUpdateTaskInput({ url }).success).toBe(false);
  });

  it("accepts external HTTPS URLs", () => {
    expect(parseUpdateTaskInput({ url: "https://example.com/spec/123" })).toEqual({
      success: true,
      data: { url: "https://example.com/spec/123" },
    });
  });
});
