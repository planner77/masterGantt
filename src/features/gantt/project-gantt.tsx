"use client";

import { Gantt, Willow, type IApi } from "@svar-ui/react-gantt";
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

  if (tasks.length === 0) {
    return <div className="schedule-empty"><p>작업을 추가하면 Gantt 차트에 표시됩니다.</p></div>;
  }

  return (
    <Willow>
      <div className="wx-theme gantt-widget project-gantt-widget" aria-label="프로젝트 일정">
        <Gantt
          end={visibleRange.end}
          init={(api) => { apiReference.current = api; }}
          links={svarLinks}
          onUpdateTask={onUpdateTask}
          readonly={!editable}
          start={visibleRange.start}
          tasks={svarTasks}
        />
      </div>
    </Willow>
  );
}
