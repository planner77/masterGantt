"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useI18n } from "@/lib/i18n/provider";
import styles from "./description-field.module.css";

/** MDXEditor's icon tooltip trigger is inside its button, so it cannot receive button focus. */
export function EditorToolbarTooltips({ children, overlay }: { children: ReactNode; overlay: HTMLElement }) {
  const { locale } = useI18n();
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const tooltipElement = useRef<HTMLDivElement>(null);
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [tooltip, setTooltip] = useState<{ title: string; left: number; top: number; below: boolean } | null>(null);

  useLayoutEffect(() => {
    const element = tooltipElement.current;
    if (!element || !target) return;
    const owner = target.getBoundingClientRect();
    const size = element.getBoundingClientRect();
    const left = Math.max(8, Math.min(innerWidth - size.width - 8, owner.left + owner.width / 2 - size.width / 2));
    const top = owner.top >= size.height + 8 ? owner.top - size.height - 8 : owner.bottom + 8;
    element.style.left = `${left}px`;
    element.style.top = `${Math.max(8, Math.min(innerHeight - size.height - 8, top))}px`;
    element.style.transform = "none";
  });

  useEffect(() => {
    if (!target) return;
    const refresh = () => {
      const rect = target.getBoundingClientRect();
      const title = target.getAttribute("aria-label");
      if (!title || !target.isConnected || rect.width === 0) { setTooltip(null); return; }
      setTooltip({ title, left: Math.max(12, Math.min(innerWidth - 12, rect.left + rect.width / 2)),
        top: rect.top >= 54 ? rect.top - 8 : rect.bottom + 8, below: rect.top < 54 });
    };
    const describedBy = target.getAttribute("aria-describedby");
    target.setAttribute("aria-describedby", [describedBy, id].filter(Boolean).join(" "));
    overlay.setAttribute("data-keyboard-tooltip", "true");
    refresh();
    const observer = new MutationObserver(refresh);
    observer.observe(target, { attributes: true, attributeFilter: ["aria-label"] });
    window.addEventListener("resize", refresh);
    window.addEventListener("scroll", refresh, true);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", refresh);
      window.removeEventListener("scroll", refresh, true);
      if (describedBy) target.setAttribute("aria-describedby", describedBy);
      else target.removeAttribute("aria-describedby");
      setTooltip(null);
    };
  }, [target, id, overlay, locale]);

  return <div ref={root} className={styles.editorShell}
    onFocusCapture={event => {
      const button = event.target instanceof Element ? event.target.closest<HTMLElement>(".mdxeditor-toolbar button") : null;
      setTarget(button);
    }}
    onBlurCapture={event => {
      if (!event.currentTarget.contains(event.relatedTarget)) setTarget(null);
    }}
    onPointerMoveCapture={() => { overlay.removeAttribute("data-keyboard-tooltip"); setTarget(null); }}
    onPointerDownCapture={() => { overlay.removeAttribute("data-keyboard-tooltip"); setTarget(null); }}
    onKeyDownCapture={event => {
      if (event.key === "Escape" && target) {
        setTarget(null);
        event.preventDefault();
        event.stopPropagation();
      }
    }}>
    {children}
    {target && tooltip ? createPortal(<div ref={tooltipElement} id={id} role="tooltip" className={styles.focusTooltip}
      style={{ left: tooltip.left, top: tooltip.top, transform: `translate(-50%, ${tooltip.below ? "0" : "-100%"})` }}>
      {tooltip.title}
    </div>, overlay) : null}
  </div>;
}
