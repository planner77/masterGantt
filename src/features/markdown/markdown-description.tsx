"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { DescriptionFormat } from "@/contracts/description-format";
import styles from "./description-field.module.css";

const allowed = ["p", "br", "strong", "em", "del", "h1", "h2", "h3", "h4", "h5", "h6",
  "blockquote", "ul", "ol", "li", "input", "a", "table", "thead", "tbody", "tr", "th", "td",
  "code", "pre", "hr"];

/** No raw HTML, MDX execution, HTML injection or network-loaded images. */
function allowLink(value: string | undefined): boolean {
  if (!value) return false;
  try { const url = new URL(value); return (url.protocol === "http:" || url.protocol === "https:") && !!url.hostname; }
  catch { return false; }
}

export function MarkdownDescription({ value, format }: { value: string; format: DescriptionFormat }) {
  if (format === "plain") return <div className={styles.plain}>{value || "—"}</div>;
  return <div className={styles.preview}><ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml allowedElements={allowed}
    components={{
      a: ({ href, children }) => allowLink(href)
        ? <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>
        : <span>{children}</span>,
      img: () => null,
    }}>{value}</ReactMarkdown></div>;
}
