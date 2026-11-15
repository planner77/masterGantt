import { describe, expect, it } from "vitest";
import { translateMarkdownToolbar } from "../../../src/features/markdown/description-translations";

describe("installed MDX toolbar shortcut descriptions", () => {
  it("corrects the upstream Mac redo hint to the actual Lexical binding", () => {
    expect(translateMarkdownToolbar("en", "toolbar.redo", "Redo {{shortcut}}", { shortcut: "⌘Y" }, true)).toBe("Redo (⌘⇧Z)");
    expect(translateMarkdownToolbar("en", "toolbar.redo", "Redo {{shortcut}}", { shortcut: "Ctrl+Y" }, false)).toBe("Redo (Ctrl+Y / Ctrl+Shift+Z)");
    expect(translateMarkdownToolbar("ko", "toolbar.undo", "Undo {{shortcut}}", { shortcut: "wrong" }, true)).toBe("실행 취소 (⌘Z)");
  });
  it("uses the same binding when removing a format and does not advertise typing shortcuts as hotkeys", () => {
    for (const [locale, absent] of [["ko", "단축키 없음"], ["en", "No keyboard shortcut"], ["vi", "Không có phím tắt"]] as const) {
      expect(translateMarkdownToolbar(locale, "toolbar.bold", "Bold")).toMatch(/ \(Ctrl\+B\)$/);
      expect(translateMarkdownToolbar(locale, "toolbar.removeBold", "Remove bold", undefined, true)).toMatch(/ \(⌘B\)$/);
      expect(translateMarkdownToolbar(locale, "toolbar.inlineCode", "Inline code")).toContain(`(${absent})`);
      expect(translateMarkdownToolbar(locale, "toolbar.link", "Create link")).toMatch(/ \(Ctrl\+K\)$/);
      expect(translateMarkdownToolbar(locale, "toolbar.source", "Source mode")).toContain(`(${absent})`);
    }
  });
  it("keeps compact select values, interpolation and unrelated plugin messages intact", () => {
    expect(translateMarkdownToolbar("ko", "toolbar.blockTypeSelect.placeholder", "Block type")).toBe("블록 유형");
    expect(translateMarkdownToolbar("vi", "toolbar.blockTypes.heading", "Heading {{level}}", { level: 3 })).toBe("Tiêu đề 3");
    expect(translateMarkdownToolbar("en", "unrelated.message", "Value {{value}}", { value: "raw" })).toBe("Value raw");
  });
});
