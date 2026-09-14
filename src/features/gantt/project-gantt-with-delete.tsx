"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";

import type { ProjectCalendarDto, ProjectLinkDto, ProjectTaskDto } from "@/contracts/projects";
import { ProjectGantt, type ProjectGridColumnVisibility } from "./project-gantt";
import type { ProjectTaskCreateCommand, ProjectTaskUpdateCommand } from "./project-task-adapter";
import { taskIdFromElement, TASK_TARGET_SELECTOR } from "./task-context-target";
import "./task-context-menu.css";

interface ProjectGanttWithDeleteProps {
  readonly calendar: ProjectCalendarDto;
  readonly editable: boolean;
  readonly mutationLocked: boolean;
  readonly onCanonicalSyncFailure: () => void;
  readonly links: readonly ProjectLinkDto[];
  readonly onTaskAddRejected: () => void;
  readonly onTaskCreate: (command: ProjectTaskCreateCommand) => void;
  readonly onTaskCommand: (command: ProjectTaskUpdateCommand) => void;
  readonly onTaskEditorOpen: (taskId: string) => void;
  readonly onTaskDeleteRequest: (taskId: string) => void;
  readonly columnVisibility: ProjectGridColumnVisibility;
  readonly onColumnVisibilityChange: (columnId: keyof ProjectGridColumnVisibility) => void;
  readonly tasks: readonly ProjectTaskDto[];
}

type MenuState = Readonly<{ taskId: string; left: number; top: number }>;

function clamp(left: number, top: number, width = 192, height = 92) {
  const inset = 8;
  return {
    left: Math.max(inset, Math.min(left, window.innerWidth - width - inset)),
    top: Math.max(inset, Math.min(top, window.innerHeight - height - inset)),
  };
}

export function ProjectGanttWithDelete({ onTaskDeleteRequest, ...ganttProps }: ProjectGanttWithDeleteProps) {
  const wrapperReference = useRef<HTMLDivElement>(null);
  const menuReference = useRef<HTMLDivElement>(null);
  const triggerReference = useRef<HTMLElement | null>(null);
  const [menu, setMenu] = useState<MenuState | null>(null);
  const taskIds = useMemo(() => new Set(ganttProps.tasks.map((task) => task.taskId)), [ganttProps.tasks]);

  function taskTarget(target: EventTarget | null): { element: HTMLElement; taskId: string } | null {
    if (!(target instanceof Element)) return null;
    const root = wrapperReference.current;
    const element = target.closest(TASK_TARGET_SELECTOR);
    if (!root || !(element instanceof HTMLElement) || !root.contains(element)) return null;
    const taskId = taskIdFromElement(element);
    return taskId && taskIds.has(taskId) ? { element, taskId } : null;
  }

  function open(target: HTMLElement, taskId: string, left?: number, top?: number) {
    if (!target.hasAttribute("tabindex")) target.tabIndex = 0;
    target.focus({ preventScroll: true });
    triggerReference.current = target;
    const bounds = target.getBoundingClientRect();
    const position = clamp(
      left ?? bounds.left + Math.min(bounds.width / 2, 24),
      top ?? bounds.top + Math.min(bounds.height / 2, 24),
    );
    setMenu({ taskId, ...position });
  }

  function handleContextMenuCapture(event: ReactMouseEvent<HTMLDivElement>) {
    const match = taskTarget(event.target);
    if (!match) return;
    event.preventDefault();
    event.stopPropagation();
    open(match.element, match.taskId, event.clientX, event.clientY);
  }

  function handleKeyDownCapture(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key !== "ContextMenu" && !(event.key === "F10" && event.shiftKey)) return;
    const match = taskTarget(event.target);
    if (!match) return;
    event.preventDefault();
    event.stopPropagation();
    open(match.element, match.taskId);
  }

  function close(restoreFocus = true) {
    setMenu(null);
    if (restoreFocus) queueMicrotask(() => triggerReference.current?.focus({ preventScroll: true }));
  }

  useEffect(() => {
    if (!menu) return;
    menuReference.current?.querySelector<HTMLButtonElement>('[role="menuitem"]:not(:disabled)')?.focus({ preventScroll: true });
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && menuReference.current?.contains(event.target)) return;
      close();
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      close();
    };
    const viewportChanged = () => close(false);
    document.addEventListener("pointerdown", outside, true);
    document.addEventListener("keydown", escape, true);
    document.addEventListener("scroll", viewportChanged, true);
    window.addEventListener("resize", viewportChanged);
    return () => {
      document.removeEventListener("pointerdown", outside, true);
      document.removeEventListener("keydown", escape, true);
      document.removeEventListener("scroll", viewportChanged, true);
      window.removeEventListener("resize", viewportChanged);
    };
  }, [menu]);

  const canDelete = ganttProps.editable && !ganttProps.mutationLocked && ganttProps.links.length === 0;

  return <div ref={wrapperReference} onContextMenuCapture={handleContextMenuCapture} onKeyDownCapture={handleKeyDownCapture}>
    <ProjectGantt {...ganttProps} />
    {menu ? <div
      aria-label="작업 메뉴"
      className="project-task-context-menu"
      ref={menuReference}
      role="menu"
      style={{ left: menu.left, top: menu.top }}
    >
      <button onClick={() => { const id = menu.taskId; close(false); ganttProps.onTaskEditorOpen(id); }} role="menuitem" type="button">
        <span aria-hidden="true" className="project-task-context-menu-icon">i</span>
        <span>작업 정보</span>
      </button>
      <button
        className="project-task-context-menu-danger"
        disabled={!canDelete}
        onClick={() => { const id = menu.taskId; close(false); onTaskDeleteRequest(id); }}
        role="menuitem"
        type="button"
      >
        <span aria-hidden="true" className="project-task-context-menu-icon">×</span>
        <span>작업 삭제</span>
      </button>
    </div> : null}
  </div>;
}

export type { ProjectGridColumnVisibility };
