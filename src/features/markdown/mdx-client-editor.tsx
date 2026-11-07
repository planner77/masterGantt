"use client";

import { useRef, useState } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { translateMarkdownToolbar } from "./description-translations";
import {
  MDXEditor, BoldItalicUnderlineToggles, BlockTypeSelect, CodeToggle, CreateLink,
  DiffSourceToggleWrapper, InsertCodeBlock, InsertTable, InsertThematicBreak, ListsToggle,
  UndoRedo, codeBlockPlugin, codeMirrorPlugin, diffSourcePlugin, headingsPlugin,
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

/** Loaded only in a client-only dynamic import. 'markdown' is an initial value, never a controlled value. */
export function MdxClientEditor({ markdown, disabled, onChange, onError }: Props) {
  const { locale } = useI18n();
  const [initialMarkdown] = useState(() => markdown);
  const last = useRef(markdown);
  return <MDXEditor
    markdown={initialMarkdown}
    contentEditableClassName="mastergantt-markdown-contenteditable"
    readOnly={disabled}
    suppressHtmlProcessing
    translation={(key, fallback, vars) => translateMarkdownToolbar(locale, key, fallback, vars)}
    onChange={(next, initialMarkdownNormalize) => {
      if (initialMarkdownNormalize || next === last.current) return;
      last.current = next;
      onChange(next);
    }}
    onError={({ error }) => onError(error)}
    plugins={[
      headingsPlugin(), listsPlugin(), quotePlugin(), thematicBreakPlugin(), linkPlugin(),
      linkDialogPlugin(), tablePlugin(), codeBlockPlugin({ defaultCodeBlockLanguage: "text" }),
      codeMirrorPlugin({ codeBlockLanguages: { text: "Plain text", js: "JavaScript", ts: "TypeScript", json: "JSON", sql: "SQL" } }),
      markdownShortcutPlugin(),
      diffSourcePlugin({ viewMode: "rich-text" }),
      toolbarPlugin({
        toolbarContents: () => <DiffSourceToggleWrapper options={["rich-text", "source"]}>
          <UndoRedo /><BoldItalicUnderlineToggles /><CodeToggle /><BlockTypeSelect />
          <ListsToggle /><CreateLink /><InsertTable /><InsertCodeBlock /><InsertThematicBreak />
        </DiffSourceToggleWrapper>,
      }),
    ]}
  />;
}
