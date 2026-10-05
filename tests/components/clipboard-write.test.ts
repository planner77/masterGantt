import { describe, expect, it, vi } from "vitest";

import { writeTextWithCompatibility } from "../../src/components/clipboard-write";

describe("writeTextWithCompatibility", () => {
  it("modern Clipboard API 성공을 우선하고 legacy 경로를 호출하지 않는다", async () => {
    const modern = vi.fn(async () => undefined);
    const legacy = vi.fn(() => true);
    await expect(writeTextWithCompatibility("https://example.test/projects/1", modern, legacy)).resolves.toBe("clipboard-api");
    expect(modern).toHaveBeenCalledWith("https://example.test/projects/1");
    expect(legacy).not.toHaveBeenCalled();
  });

  it("modern Clipboard API가 거부되면 legacy 경로로 권한 결정을 우회하지 않는다", async () => {
    const error = new DOMException("Denied", "NotAllowedError");
    const modern = vi.fn(async () => { throw error; });
    const legacy = vi.fn(() => true);
    await expect(writeTextWithCompatibility("https://example.test/projects/1", modern, legacy)).rejects.toBe(error);
    expect(legacy).not.toHaveBeenCalled();
  });

  it("modern Clipboard API가 없으면 legacy click-compatible copy를 사용한다", async () => {
    const legacy = vi.fn(() => true);
    await expect(writeTextWithCompatibility("http://intranet/projects/1", undefined, legacy)).resolves.toBe("legacy-command");
    expect(legacy).toHaveBeenCalledWith("http://intranet/projects/1");
  });

  it("modern/legacy 경로가 모두 불가능하면 실패하여 수동 fallback을 열 수 있게 한다", async () => {
    const legacy = vi.fn(() => false);
    await expect(writeTextWithCompatibility("http://intranet/projects/1", undefined, legacy)).rejects.toThrow("Clipboard unavailable");
  });
});
