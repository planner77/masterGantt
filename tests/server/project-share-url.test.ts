import { describe, expect, it } from "vitest";

import { buildProjectShareUrl } from "../../src/server/projects/project-share-url-core";

const publicId = "778b21ba-56ac-4aa8-b5a9-456fee185d38";

describe("project share URL", () => {
  it("uses the configured development origin and port", () => {
    expect(buildProjectShareUrl("http://localhost:3101", "development", publicId))
      .toBe(`http://localhost:3101/projects/${publicId}`);
  });

  it("uses the configured production HTTPS origin", () => {
    expect(buildProjectShareUrl("https://gantt.example.invalid:8443", "production", publicId))
      .toBe(`https://gantt.example.invalid:8443/projects/${publicId}`);
  });

  it("preserves the existing production transport policy", () => {
    expect(buildProjectShareUrl("http://gantt.example.invalid", "production", publicId))
      .toBeNull();
  });

  it.each([
    undefined,
    "",
    "not a URL",
    "https://gantt.example.invalid/",
    "https://gantt.example.invalid/subpath",
    "https://gantt.example.invalid?editPassword=example",
    "https://gantt.example.invalid#session",
    "https://example:example@gantt.example.invalid",
    " https://gantt.example.invalid",
    "javascript:alert(1)",
  ])("rejects invalid or non-canonical configuration %s", (base) => {
    expect(buildProjectShareUrl(base, "development", publicId)).toBeNull();
  });

  it.each(["", "..", "../other", "//example.invalid", "internal-id-1", `${publicId}?token=example`, `${publicId}#editor`, "%2e%2e"])(
    "rejects invalid public identifiers %s",
    (id) => {
      expect(buildProjectShareUrl("https://gantt.example.invalid", "production", id)).toBeNull();
    },
  );

  it("creates a URL with no credentials, search or fragment", () => {
    const link = buildProjectShareUrl("https://gantt.example.invalid", "production", publicId);
    expect(link).not.toBeNull();
    const url = new URL(link!);
    expect(url.username).toBe("");
    expect(url.password).toBe("");
    expect(url.search).toBe("");
    expect(url.hash).toBe("");
    expect(url.pathname).toBe(`/projects/${publicId}`);
  });
});
