"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { translateMarkdownToolbar } from "./description-translations";
import { EditorToolbarTooltips } from "./editor-toolbar-tooltips";
import { DescriptionHistory, DescriptionLists, DescriptionInsertTable } from "./description-toolbar";
import styles from "./description-field.module.css";
import {
  MDXEditor, BoldItalicUnderlineToggles, BlockTypeSelect, CodeToggle, CreateLink,
  DiffSourceToggleWrapper, InsertCodeBlock, InsertThematicBreak,
  codeBlockPlugin, codeMirrorPlugin, diffSourcePlugin, headingsPlugin, useTranslation,
  linkDialogPlugin, linkPlugin, listsPlugin, markdownShortcutPlugin, quotePlugin,
  tablePlugin, thematicBreakPlugin, toolbarPlugin,
} from "@mdxeditor/editor";
import "@mdxeditor/editor/style.css";

interface Props {
  markdown: string;
  disabled: boolean;
  onChange: (markdown: string) => void;
  onError: (message: string) => void;
}

function DescriptionBlockTypeSelect() {
  const t = useTranslation();
  const wrapper = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    // The built-in Select reuses placeholder as both visible text and aria-label.
    // Keep its compact visible fallback while exposing the full action description.
    wrapper.current?.querySelector("button")?.setAttribute("aria-label", t(
      "toolbar.blockTypeSelect.selectBlockTypeTooltip", "Select block type"));
  }, [t]);
  return <span ref={wrapper} className={styles.blockType}><BlockTypeSelect /></span>;
}

/** Loaded only in a client-only dynamic import. 'markdown' is an initial value, never a controlled value. */
export function MdxClientEditor({ markdown, disabled, onChange, onError }: Props) {
  const { locale } = useI18n();
  const [initialMarkdown] = useState(() => markdown);
  const last = useRef(markdown);
  const [overlay, setOverlay] = useState<HTMLElement | null>(null);
  const [apple] = useState(() => {
    const platform = (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform;
    return platform ? /mac/i.test(platform) : /Mac|iPod|iPhone|iPad/.test(navigator.userAgent);
  });
  const attachShell = useCallback((element: HTMLDivElement | null) => {
    if (!element) return;
    const host = document.createElement("div");
    host.className = styles.popupHost;
    // A body portal is inert and behind the native Task dialog's top layer.
    (element.closest("dialog") ?? document.body).appendChild(host);
    setOverlay(host);
    return () => host.remove();
  }, []);
  return <div ref={attachShell} className={styles.editorShell} onKeyDownCapture={event => {
    if (event.key !== "Tab" || event.ctrlKey || event.altKey || event.metaKey || event.nativeEvent.isComposing || !(event.target instanceof HTMLElement)) return;
    const editable = event.target.closest('[contenteditable="true"]');
    // The lists plugin indents plain paragraphs with Tab. Preserve native form
    // navigation here while leaving table, code and toolbar keymaps to their owners.
    if (editable?.classList.contains("mastergantt-markdown-contenteditable") && !event.target.closest("table, .cm-editor")) event.stopPropagation();
  }}>{overlay ? <EditorToolbarTooltips overlay={overlay}><MDXEditor
    markdown={initialMarkdown}
    contentEditableClassName="mastergantt-markdown-contenteditable"
    className="mdxeditor-full-height"
    readOnly={disabled}
    suppressHtmlProcessing
    overlayContainer={overlay}
    translation={(key, fallback, vars) => translateMarkdownToolbar(locale, key, fallback, vars, apple)}
    onChange={(next, initialMarkdownNormalize) => {
      if (initialMarkdownNormalize || next === last.current) return;
      last.current = next;
      onChange(next);
    }}
    onError={({ error }) => onError(error)}
    plugins={[
      // Autolinking can rewrite untouched source after initial normalization.
      headingsPlugin(), listsPlugin(), quotePlugin(), thematicBreakPlugin(), linkPlugin({ disableAutoLink: true }),
      linkDialogPlugin(), tablePlugin(), codeBlockPlugin({ defaultCodeBlockLanguage: "text" }),
      codeMirrorPlugin({ codeBlockLanguages: { text: "Plain text", js: "JavaScript", ts: "TypeScript", json: "JSON", sql: "SQL" } }),
      markdownShortcutPlugin(),
      diffSourcePlugin({ viewMode: "rich-text" }),
      toolbarPlugin({
        toolbarContents: () => <DiffSourceToggleWrapper options={["rich-text", "source"]}>
          <DescriptionHistory /><BoldItalicUnderlineToggles /><CodeToggle /><DescriptionBlockTypeSelect />
          <DescriptionLists /><CreateLink /><DescriptionInsertTable /><InsertCodeBlock /><InsertThematicBreak />
        </DiffSourceToggleWrapper>,
      }),
    ]}
  /></EditorToolbarTooltips> : null}</div>;
}
