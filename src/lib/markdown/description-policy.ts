import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";

/** Only explicit HTTP(S) links; no relative/fragment, javascript:, mailto:, data:, etc. */
export function safeDescriptionUrl(value: string | null | undefined): boolean {
  if (!value) return false;
  try { const url = new URL(value); return (url.protocol === "http:" || url.protocol === "https:") && !!url.hostname; }
  catch { return false; }
}

/** Validate AST rather than removing user text or trusting an editor's HTML handling. */
export function isSafeMarkdownDescription(value: string): boolean {
  try {
    const ast = unified().use(remarkParse).use(remarkGfm).parse(value);
    const stack: unknown[] = [ast];
    while (stack.length) {
      const node = stack.pop();
      if (!node || typeof node !== "object") return false;
      const item = node as { type?: string; url?: string; children?: unknown[] };
      if (!item.type || item.type === "html" || item.type === "image" || item.type === "imageReference" || item.type.startsWith("mdx")) return false;
      if ((item.type === "link" || item.type === "definition") && !safeDescriptionUrl(item.url)) return false;
      if (item.children) stack.push(...item.children);
    }
    return true;
  } catch { return false; }
}

