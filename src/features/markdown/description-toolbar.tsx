"use client";

import { useCallback, useSyncExternalStore } from "react";
import { useCellValues, usePublisher } from "@mdxeditor/gurx";
import { getPeerDependencyFromEditor } from "@lexical/extension";
import { HistoryExtension } from "@lexical/history";
import { CAN_UNDO_COMMAND, CAN_REDO_COMMAND, COMMAND_PRIORITY_CRITICAL, UNDO_COMMAND, REDO_COMMAND } from "lexical";
import {
  activeEditor$, iconComponentFor$, editorInTable$, currentListType$, applyListType$, insertTable$, readOnly$,
  ButtonWithTooltip, useTranslation,
} from "@mdxeditor/editor";

/** Public command adapters keep unavailable actions focusable without ever dispatching them. */
export function DescriptionHistory() {
  const [editor, icon, readOnly] = useCellValues(activeEditor$, iconComponentFor$, readOnly$);
  const t = useTranslation();
  const subscribe = useCallback((notify: () => void) => {
    if (!editor) return () => {};
    const undo = editor.registerCommand(CAN_UNDO_COMMAND, () => { notify(); return false; }, COMMAND_PRIORITY_CRITICAL);
    const redo = editor.registerCommand(CAN_REDO_COMMAND, () => { notify(); return false; }, COMMAND_PRIORITY_CRITICAL);
    return () => { undo(); redo(); };
  }, [editor]);
  const snapshot = useCallback(() => {
    const history = editor ? getPeerDependencyFromEditor<typeof HistoryExtension>(editor, HistoryExtension.name)?.output : undefined;
    const state = history?.disabled.value ? undefined : history?.historyState.value;
    return (state?.undoStack.length ? 1 : 0) | (state?.redoStack.length ? 2 : 0);
  }, [editor]);
  const history = useSyncExternalStore(subscribe, snapshot, () => 0);
  return <>
    <ButtonWithTooltip title={t("toolbar.undo", "Undo {{shortcut}}", { shortcut: "" })}
      aria-disabled={readOnly || !(history & 1)} data-disabled={readOnly || !(history & 1) || undefined}
      onPointerDown={event => event.preventDefault()}
      onClick={() => { if (!readOnly && (history & 1)) editor?.dispatchCommand(UNDO_COMMAND, undefined); }}>
      {icon("undo")}
    </ButtonWithTooltip>
    <ButtonWithTooltip title={t("toolbar.redo", "Redo {{shortcut}}", { shortcut: "" })}
      aria-disabled={readOnly || !(history & 2)} data-disabled={readOnly || !(history & 2) || undefined}
      onPointerDown={event => event.preventDefault()}
      onClick={() => { if (!readOnly && (history & 2)) editor?.dispatchCommand(REDO_COMMAND, undefined); }}>
      {icon("redo")}
    </ButtonWithTooltip>
  </>;
}

export function DescriptionLists() {
  const [current, inTable, icon, readOnly] = useCellValues(currentListType$, editorInTable$, iconComponentFor$, readOnly$);
  const unavailable = inTable || readOnly;
  const apply = usePublisher(applyListType$);
  const t = useTranslation();
  return <>
    {([
      ["bullet", "toolbar.bulletedList", "Bulleted list", "format_list_bulleted"],
      ["number", "toolbar.numberedList", "Numbered list", "format_list_numbered"],
      ["check", "toolbar.checkList", "Check list", "format_list_checked"],
    ] as const).map(([type, key, fallback, image]) => <ButtonWithTooltip key={type} title={t(key, fallback)}
      aria-pressed={current === type} aria-disabled={unavailable} data-disabled={unavailable || undefined}
      onPointerDown={event => event.preventDefault()}
      onClick={() => { if (!unavailable) apply(current === type ? "" : type); }}>
      {icon(image)}
    </ButtonWithTooltip>)}
  </>;
}

export function DescriptionInsertTable() {
  const [inTable, icon, readOnly] = useCellValues(editorInTable$, iconComponentFor$, readOnly$);
  const unavailable = inTable || readOnly;
  const insert = usePublisher(insertTable$);
  const t = useTranslation();
  return <ButtonWithTooltip title={t("toolbar.table", "Insert Table")}
    aria-disabled={unavailable} data-disabled={unavailable || undefined}
    onPointerDown={event => event.preventDefault()}
    onClick={() => { if (!unavailable) insert({ rows: 3, columns: 3 }); }}>
    {icon("table")}
  </ButtonWithTooltip>;
}
