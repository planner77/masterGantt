"use client";

import Link from "next/link";
import { createPortal } from "react-dom";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";

import { ProjectLinkButton } from "@/components/project-link-button";
import type { ProjectListItemDto } from "@/contracts/projects";
import styles from "./project-row-actions.module.css";

type MenuPosition = { top: number; left: number };

function projectPath(publicId: string): string {
  return `/projects/${encodeURIComponent(publicId)}`;
}

export function ProjectRowActions({ project, projectUrl, disabled, onDelete }: Readonly<{
  project: ProjectListItemDto;
  projectUrl: string | null;
  disabled: boolean;
  onDelete: (project: ProjectListItemDto, restoreTarget: HTMLElement) => void | Promise<void>;
}>) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<MenuPosition>({ top: 0, left: 0 });

  function closeMenu(restoreFocus: boolean) {
    setOpen(false);
    if (restoreFocus) requestAnimationFrame(() => triggerRef.current?.focus());
  }

  function openMenu() {
    const trigger = triggerRef.current;
    if (!trigger || disabled) return;
    const rect = trigger.getBoundingClientRect();
    const menuWidth = 208;
    const menuHeight = 154;
    const gutter = 8;
    setPosition({
      top: Math.max(gutter, Math.min(rect.bottom + 6, window.innerHeight - menuHeight - gutter)),
      left: Math.max(gutter, Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - gutter)),
    });
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    const firstItem = menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"])');
    firstItem?.focus();

    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (menuRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      closeMenu(false);
    }
    function onViewportChange() {
      closeMenu(false);
    }
    document.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("resize", onViewportChange);
    window.addEventListener("scroll", onViewportChange, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("resize", onViewportChange);
      window.removeEventListener("scroll", onViewportChange, true);
    };
  }, [open]);

  function handleMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const items = Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"])') ?? []);
    if (event.key === "Escape") {
      event.preventDefault();
      closeMenu(true);
      return;
    }
    if (event.key === "Tab") {
      closeMenu(false);
      return;
    }
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key) || items.length === 0) return;
    event.preventDefault();
    const current = Math.max(0, items.indexOf(document.activeElement as HTMLElement));
    const next = event.key === "Home" ? 0
      : event.key === "End" ? items.length - 1
        : event.key === "ArrowDown" ? (current + 1) % items.length
          : (current - 1 + items.length) % items.length;
    items[next]?.focus();
  }

  return <div className={styles.root}>
    <button ref={triggerRef} type="button" className={styles.trigger}
      aria-label={`${project.name} 프로젝트 작업`}
      aria-haspopup="menu" aria-expanded={open} aria-controls={open ? menuId : undefined}
      disabled={disabled}
      onClick={() => open ? closeMenu(true) : openMenu()}>
      <span aria-hidden="true">•••</span>
    </button>
    {open ? createPortal(
      <div id={menuId} ref={menuRef} role="menu" aria-label={`${project.name} 프로젝트 작업`}
        className={styles.menu} style={{ top: position.top, left: position.left }}
        onKeyDown={handleMenuKeyDown}>
        <Link role="menuitem" tabIndex={-1} className={styles.menuItem}
          href={`${projectPath(project.publicId)}?copy=1`}
          onClick={() => closeMenu(false)}>프로젝트 복사</Link>
        <ProjectLinkButton projectName={project.name} projectUrl={projectUrl}
          className={styles.menuItem} role="menuitem" onActionComplete={() => closeMenu(false)} />
        <div className={styles.separator} role="separator" />
        <button role="menuitem" tabIndex={-1} type="button" className={`${styles.menuItem} ${styles.destructive}`}
          onClick={() => {
            const restoreTarget = triggerRef.current;
            closeMenu(false);
            if (restoreTarget) void onDelete(project, restoreTarget);
          }}>삭제</button>
      </div>,
      document.body,
    ) : null}
  </div>;
}
