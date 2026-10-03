export type ClipboardWriteMethod = (text: string) => Promise<void>;
export type LegacyCopyMethod = (text: string) => boolean;

export type ClipboardWriteResult = "clipboard-api" | "legacy-command";

export async function writeTextWithCompatibility(
  text: string,
  modernWrite: ClipboardWriteMethod | undefined,
  legacyWrite: LegacyCopyMethod,
): Promise<ClipboardWriteResult> {
  if (modernWrite) {
    // An exposed modern Clipboard API owns its own permission result. If it rejects,
    // do not bypass that explicit browser/user decision through the legacy command.
    await modernWrite(text);
    return "clipboard-api";
  }

  if (legacyWrite(text)) return "legacy-command";
  throw new Error("Clipboard unavailable");
}

export function copyTextWithLegacyCommand(text: string): boolean {
  if (typeof document === "undefined" || !document.body || typeof document.execCommand !== "function") return false;

  const activeElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const selection = typeof window !== "undefined" ? window.getSelection() : null;
  const savedRanges: Range[] = [];
  if (selection) {
    for (let index = 0; index < selection.rangeCount; index += 1) {
      savedRanges.push(selection.getRangeAt(index).cloneRange());
    }
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.readOnly = true;
  textarea.tabIndex = -1;
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  textarea.style.top = "0";
  textarea.style.width = "1px";
  textarea.style.height = "1px";
  textarea.style.opacity = "0";
  textarea.style.pointerEvents = "none";
  document.body.appendChild(textarea);

  let copied = false;
  try {
    textarea.focus({ preventScroll: true });
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);
    copied = document.execCommand("copy");
  } catch {
    copied = false;
  } finally {
    textarea.remove();
    if (selection) {
      try {
        selection.removeAllRanges();
        for (const range of savedRanges) selection.addRange(range);
      } catch {
        // Selection restoration is best-effort and must not change the copy result.
      }
    }
    if (activeElement?.isConnected) {
      try {
        activeElement.focus({ preventScroll: true });
      } catch {
        // Focus restoration is best-effort; callers keep their existing dialog fallback.
      }
    }
  }
  return copied;
}
