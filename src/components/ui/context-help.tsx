"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import styles from "./context-help.module.css";

/** Read-only help stays in the top layer, including inside a modal or scroll owner. */
export function ContextHelp({ label, children, disabled = false }: { label: string; children: ReactNode; disabled?: boolean }) {
  const id = useId();
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const pinned = useRef(false);
  const restoringFocus = useRef(false);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [open, setOpen] = useState(false);
  const [host, setHost] = useState<HTMLElement | null>(null);
  const name = label.endsWith("도움말") ? label : `${label} 도움말`;
  const cancelLeave = () => {
    if (leaveTimer.current) clearTimeout(leaveTimer.current);
  };
  const close = () => {
    cancelLeave();
    pinned.current = false;
    panel.current?.hidePopover();
    setOpen(false);
  };
  const show = () => {
    if (disabled) return;
    cancelLeave();
    setHost(button.current?.closest("dialog") ?? document.body);
    setOpen(true);
  };
  const leave = () => {
    cancelLeave();
    if (!pinned.current && document.activeElement !== button.current) leaveTimer.current = setTimeout(close, 180);
  };
  useLayoutEffect(() => {
    if (!open) return;
    const target = panel.current;
    const trigger = button.current;
    if (!target || !trigger) return;
    document.dispatchEvent(new CustomEvent("mastergantt:context-help-open", { detail: id }));
    target.showPopover();
    const anchor = trigger.getBoundingClientRect();
    const bounds = target.getBoundingClientRect();
    const gutter = 12;
    target.style.left = `${Math.max(gutter, Math.min(anchor.left, window.innerWidth - bounds.width - gutter))}px`;
    target.style.top = `${anchor.bottom + bounds.height + gutter <= window.innerHeight
      ? anchor.bottom + 6 : Math.max(gutter, anchor.top - bounds.height - 6)}px`;
  }, [open, id]);
  useEffect(() => () => {
    if (leaveTimer.current) clearTimeout(leaveTimer.current);
  }, []);
  useEffect(() => {
    if (!open) return;
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      panel.current?.hidePopover();
      pinned.current = false;
      setOpen(false);
      // Restoring a hover-only trigger must not reopen its focus help.
      restoringFocus.current = true;
      button.current?.focus({ preventScroll: true });
      restoringFocus.current = false;
    };
    const dismiss = () => {
      panel.current?.hidePopover();
      pinned.current = false;
      setOpen(false);
    };
    const scroll = (event: Event) => {
      if (event.target instanceof Node && panel.current?.contains(event.target)) return;
      dismiss();
    };
    const outside = (event: PointerEvent) => {
      if (!(event.target instanceof Node) || button.current?.contains(event.target) || panel.current?.contains(event.target)) return;
      dismiss();
    };
    const otherHelp = (event: Event) => {
      if ((event as CustomEvent<string>).detail !== id) dismiss();
    };
    document.addEventListener("pointerdown", outside, true);
    document.addEventListener("mastergantt:context-help-open", otherHelp);
    document.addEventListener("keydown", escape, true);
    document.addEventListener("scroll", scroll, true);
    window.addEventListener("resize", dismiss);
    return () => {
      document.removeEventListener("pointerdown", outside, true);
      document.removeEventListener("mastergantt:context-help-open", otherHelp);
      document.removeEventListener("keydown", escape, true);
      document.removeEventListener("scroll", scroll, true);
      window.removeEventListener("resize", dismiss);
    };
  }, [open, id]);
  return (
    <>
      <button
        ref={button}
        type="button"
        disabled={disabled}
        className={styles.trigger}
        aria-label={name}
        aria-expanded={open}
        aria-controls={id}
        aria-describedby={open ? id : undefined}
        onPointerEnter={event => { if (event.pointerType === "mouse") show(); }}
        onPointerLeave={leave}
        onFocus={() => { if (!restoringFocus.current) show(); }}
        onBlur={event => { if (!panel.current?.contains(event.relatedTarget)) close(); }}
        onClick={() => {
          if (open && pinned.current) close();
          else { show(); pinned.current = true; }
        }}
      >
        <span aria-hidden="true">ⓘ</span>
      </button>
      {open && host && createPortal(<div
        ref={panel}
        id={id}
        popover="manual"
        role="tooltip"
        className={styles.panel}
        onToggle={event => {
          const next = event.newState === "open";
          if (!next) pinned.current = false;
          setOpen(next);
        }}
        onPointerEnter={cancelLeave}
        onPointerLeave={leave}
      >
        {children}
      </div>, host)}
    </>
  );
}
