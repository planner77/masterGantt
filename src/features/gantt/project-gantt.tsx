"use client";

import { Gantt, Willow, type IApi, type IColumnConfig } from "@svar-ui/react-gantt";
import "@svar-ui/react-gantt/all.css";
import { useMemo, useRef } from "react";

import type {
  ProjectCalendarDto,
  ProjectLinkDto,
  ProjectTaskDto,
} from "@/contracts/projects";

import { createTaskUpdateGateway } from "./command-gateway";
import {
  projectLinksToSvarLinks,
  projectTasksToSvarTasks,
  translateProjectTaskUpdate,
  type ProjectTaskUpdateCommand,
} from "./project-task-adapter";

interface ProjectGanttProps {
  readonly calendar: ProjectCalendarDto;
  readonly editable: boolean;
  readonly links: readonly ProjectLinkDto[];
  readonly onTaskCommand: (command: ProjectTaskUpdateCommand) => void;
  readonly tasks: readonly ProjectTaskDto[];
}

// Omit SVAR's native `add-task` column: every project write must retain the
// form's If-Match and canonical-snapshot recovery path.
const projectColumns: IColumnConfig[] = [
  { id: "text", header: "작업", width: 224, flexgrow: 1, sort: true },
  { id: "externalId", header: "외부 ID", width: 128, getter: (task) => task.externalId ?? "—" },
  { id: "start", header: "시작", width: 112, align: "center", sort: true },
  { id: "duration", header: "기간", width: 76, align: "center", sort: true },
];

function emptyWorkspaceRange(): { start: Date; end: Date } {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 14);
  return { start, end };
}

/** Browser-only renderer. The caller keys it by aggregate revision after writes. */
export function ProjectGantt({
  calendar,
  editable,
  links,
  onTaskCommand,
  tasks,
}: ProjectGanttProps) {
  const apiReference = useRef<IApi | null>(null);
  const tasksById = useMemo(
    () => new Map(tasks.map((task) => [task.taskId, task])),
    [tasks],
  );
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

  return (
    <Willow>
      <div
        aria-label="프로젝트 일정 Grid와 Gantt 차트"
        className="project-gantt-scroll"
        role="region"
        tabIndex={0}
      >
        <div className="wx-theme gantt-widget project-gantt-widget">
          <Gantt
            columns={projectColumns}
            displayMode="all"
            gridWidth={440}
            init={(api) => { apiReference.current = api; }}
            links={svarLinks}
            onUpdateTask={onUpdateTask}
            readonly={!editable}
            end={visibleRange.end}
            start={visibleRange.start}
            tasks={svarTasks}
          />
        </div>
      </div>
    </Willow>
  );
}
