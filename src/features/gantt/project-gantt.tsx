"use client";

import {
  Gantt,
  Willow,
  type IApi,
  type IColumnConfig,
  type ITask,
} from "@svar-ui/react-gantt";
import "@svar-ui/react-gantt/all.css";
import { useEffect, useMemo, useRef, useState } from "react";

import type {
  ProjectCalendarDto,
  ProjectLinkDto,
  ProjectTaskDto,
} from "@/contracts/projects";
import {
  browserLocales,
  formatLocaleDateOnly,
  todayLocalDateString,
} from "@/lib/date-display";

import {
  createTaskAddGateway,
  createTaskUpdateGateway,
  type LocalTaskAddCommand,
} from "./command-gateway";
import {
  projectLinksToSvarLinks,
  projectTasksToSvarTasks,
  translateProjectTaskUpdate,
  type ProjectTaskCreateCommand,
  type ProjectTaskUpdateCommand,
} from "./project-task-adapter";
import { dateOnlyFromLocalDate } from "./date-adapter";

interface ProjectGanttProps {
  readonly calendar: ProjectCalendarDto;
  readonly editable: boolean;
  readonly links: readonly ProjectLinkDto[];
  readonly onTaskAddRejected: () => void;
  readonly onTaskCreate: (command: ProjectTaskCreateCommand) => void;
  readonly onTaskCommand: (command: ProjectTaskUpdateCommand) => void;
  readonly onExternalIdVisibilityChange: () => void;
  readonly showExternalId: boolean;
  readonly tasks: readonly ProjectTaskDto[];
}

const baseProjectColumns: IColumnConfig[] = [
  { id: "text", header: "작업", width: 224, flexgrow: 1, sort: true },
  { id: "externalId", header: "외부 ID", width: 128, getter: (task) => task.externalId ?? "—" },
  // Do not use Core's `start`/`duration` IDs here: they install their own
  // calendar-day templates. These display-only IDs preserve the project's
  // localized local-date and canonical working-day duration contract.
  { id: "projectStart", header: "시작", width: 128, align: "center" },
  { id: "projectDuration", header: "기간", width: 84, align: "center" },
  // The Core recognizes this documented ID and renders its native header/row
  // plus controls. Their `add-task` event is intercepted below.
  { id: "add-task", header: "작업 추가", width: 37, align: "center" },
];

function emptyWorkspaceRange(): { start: Date; end: Date } {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 14);
  return { start, end };
}

function todayDateOnly(): string {
  return todayLocalDateString();
}

function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

/** Browser-only renderer. The caller keys it by aggregate revision after writes. */
export function ProjectGantt({
  calendar,
  editable,
  links,
  onTaskAddRejected,
  onTaskCreate,
  onTaskCommand,
  onExternalIdVisibilityChange,
  showExternalId,
  tasks,
}: ProjectGanttProps) {
  const apiReference = useRef<IApi | null>(null);
  const onTaskCreateReference = useRef(onTaskCreate);
  const onTaskAddRejectedReference = useRef(onTaskAddRejected);
  const canCreateReference = useRef(editable);
  const tasksByIdReference = useRef(new Map<string, ProjectTaskDto>());
  const [nativeAddReady, setNativeAddReady] = useState(false);
  // This browser-only component is dynamically imported with SSR disabled.
  const [locales] = useState<Intl.LocalesArgument>(() => browserLocales());
  const tasksById = useMemo(
    () => new Map(tasks.map((task) => [task.taskId, task])),
    [tasks],
  );
  useEffect(() => {
    onTaskCreateReference.current = onTaskCreate;
    onTaskAddRejectedReference.current = onTaskAddRejected;
    canCreateReference.current = editable;
    tasksByIdReference.current = tasksById;
  }, [editable, onTaskAddRejected, onTaskCreate, tasksById]);
  const svarTasks = useMemo(() => projectTasksToSvarTasks(tasks), [tasks]);
  const svarLinks = useMemo(() => projectLinksToSvarLinks(links, tasks), [links, tasks]);
  const visibleRange = useMemo(() => {
    const starts = svarTasks.flatMap((task) => task.start instanceof Date ? [task.start] : []);
    const ends = svarTasks.flatMap((task) => task.end instanceof Date ? [task.end] : []);
    if (starts.length === 0 || ends.length === 0) return emptyWorkspaceRange();
    return {
      start: new Date(Math.min(...starts.map((date) => date.getTime()))),
      end: new Date(Math.max(...ends.map((date) => date.getTime()))),
    };
  }, [svarTasks]);
  const onUpdateTask = useMemo(
    () => createTaskUpdateGateway((local) => {
      const task = typeof local.taskId === "string" ? tasksById.get(local.taskId) : undefined;
      if (!task) return;
      const command = translateProjectTaskUpdate(local, task, calendar);
      if (command) onTaskCommand(command);
    }),
    [calendar, onTaskCommand, tasksById],
  );
  const columns = useMemo(
    () => baseProjectColumns
      // Do not expose a Core '+' until its protected interceptor is attached.
      // This avoids a post-remount click being ignored or creating a transient
      // local task before the canonical API boundary is ready.
      .filter((column) => column.id !== "add-task" || (editable && nativeAddReady))
      .map((column) => (
      column.id === "externalId"
        ? { ...column, hidden: !showExternalId }
        : column.id === "projectStart"
          ? {
            ...column,
            sort: (first: ITask, second: ITask) => {
              const difference = (first.start?.getTime() ?? 0) - (second.start?.getTime() ?? 0);
              return difference === 0 ? 0 : difference < 0 ? -1 : 1;
            },
            getter: (task: ITask) => task.start instanceof Date
              ? formatLocaleDateOnly(dateOnlyFromLocalDate(task.start), locales)
              : "—",
          }
          : column.id === "projectDuration"
            ? {
              ...column,
              getter: (task: ITask) => (
                // Core renders elapsed calendar duration for its bar. Keep
                // the Grid contract truthful by reading the scheduler's
                // canonical working-day duration from the snapshot instead.
                typeof task.id === "string" && typeof tasksById.get(task.id)?.duration === "number"
                  ? `${tasksById.get(task.id)!.duration} 근무일`
                  : "—"
              ),
            }
          : column
    )),
    [editable, locales, nativeAddReady, showExternalId, tasksById],
  );
  const scales = useMemo(() => [
    {
      unit: "month",
      step: 1,
      format: (date: Date) => new Intl.DateTimeFormat(locales, {
        year: "numeric",
        month: "long",
      }).format(date),
    },
    {
      unit: "day",
      step: 1,
      format: (date: Date) => new Intl.DateTimeFormat(locales, {
        day: "numeric",
        weekday: "narrow",
      }).format(date),
    },
  ], [locales]);

  function interceptNativeTaskAdd(local: LocalTaskAddCommand): void {
    if (!canCreateReference.current) {
      onTaskAddRejectedReference.current();
      return;
    }
    const target = typeof local.targetTaskId === "string"
      ? tasksByIdReference.current.get(local.targetTaskId)
      : undefined;
    if ((typeof local.targetTaskId === "string" && !target) ||
      (local.mode !== undefined && local.mode !== "child")) {
      onTaskAddRejectedReference.current();
      return;
    }
    onTaskCreateReference.current({
      name: "새 작업",
      type: "task",
      start: todayDateOnly(),
      duration: 1,
      progress: 0,
      ...(target ? { parentTaskId: target.taskId } : {}),
    });
  }

  const initialize = useMemo(() => (api: IApi) => {
    apiReference.current = api;
    api.detach("project-native-add");
    api.intercept(
      "add-task",
      createTaskAddGateway(interceptNativeTaskAdd),
      { tag: "project-native-add" },
    );
    api.detach("project-summary-update");
    api.intercept(
      "update-task",
      (event) => {
        const task = typeof event.id === "string"
          ? tasksByIdReference.current.get(event.id)
          : undefined;
        return task?.type === "summary" ? false : undefined;
      },
      { tag: "project-summary-update" },
    );
    setNativeAddReady(true);
  // SVAR retains this initializer for the mounted instance. Refs keep the
  // revision and callback current without re-registering EventBus handlers.
  }, []);

  return (
    <div className="project-gantt-frame">
      <Willow>
        <div className="project-gantt-tools">
          <button
            aria-pressed={showExternalId}
            className="secondary-button gantt-column-toggle"
            onClick={onExternalIdVisibilityChange}
            type="button"
          >
            외부 ID {showExternalId ? "숨기기" : "표시"}
          </button>
        </div>
        <div
          aria-label="프로젝트 일정 Grid와 Gantt 차트"
          className="project-gantt-scroll"
          role="region"
          tabIndex={0}
        >
          <div className="wx-theme gantt-widget project-gantt-widget">
            <Gantt
              columns={columns}
              displayMode="all"
              gridWidth={620}
              highlightTime={(date, unit) => unit === "day" && isWeekend(date) ? "wx-weekend" : ""}
              init={initialize}
              links={svarLinks}
              onUpdateTask={onUpdateTask}
              readonly={!editable}
              scales={scales}
              end={visibleRange.end}
              start={visibleRange.start}
              tasks={svarTasks}
            />
          </div>
        </div>
      </Willow>
    </div>
  );
}
