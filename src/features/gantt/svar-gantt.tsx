"use client";

import { Gantt, Willow, type IApi, type ILink, type ITask } from "@svar-ui/react-gantt";
import "@svar-ui/react-gantt/all.css";
import { useEffect, useMemo, useRef } from "react";

import { createTaskUpdateGateway, type LocalTaskUpdateCommand } from "./command-gateway";
import { domainDatesToSvarDates, localDateFromDateOnly } from "./date-adapter";

const release = domainDatesToSvarDates({ start: "2026-09-14", end: "2026-09-25" });
const design = domainDatesToSvarDates({ start: "2026-09-14", end: "2026-09-18" });
const build = domainDatesToSvarDates({ start: "2026-09-21", end: "2026-09-25" });

const fixtureTasks: ITask[] = [
  { id: "release", text: "Release preparation", ...release, type: "summary", parent: 0, open: true },
  { id: "design", text: "Design review", ...design, progress: 100, type: "task", parent: "release" },
  { id: "build", text: "Build implementation", ...build, progress: 45, type: "task", parent: "release" },
  {
    id: "gate",
    text: "Release gate",
    start: localDateFromDateOnly("2026-09-25"),
    type: "milestone",
    parent: "release",
  },
];

const fixtureLinks: ILink[] = [
  { id: "design-to-build", source: "design", target: "build", type: "e2s" },
];

interface SvarGanttProps {
  editablePreview: boolean;
  previewUpdateRequest: number;
  onLocalCommand: (command: LocalTaskUpdateCommand) => void;
}

export function SvarGantt({
  editablePreview,
  previewUpdateRequest,
  onLocalCommand,
}: SvarGanttProps) {
  const apiRef = useRef<IApi | null>(null);
  const handledPreviewRequests = useRef(new Set<number>());
  const onUpdateTask = useMemo(
    () => createTaskUpdateGateway(onLocalCommand),
    [onLocalCommand],
  );

  useEffect(() => {
    if (!editablePreview || previewUpdateRequest === 0) return;
    if (handledPreviewRequests.current.has(previewUpdateRequest)) return;
    handledPreviewRequests.current.add(previewUpdateRequest);
    void apiRef.current?.exec("update-task", {
      id: "build",
      task: { progress: 50 },
    });
  }, [editablePreview, previewUpdateRequest]);

  return (
    <Willow>
      <div className="wx-theme gantt-widget" aria-label="SVAR Gantt 데모 일정">
        <Gantt
          tasks={fixtureTasks}
          links={fixtureLinks}
          readonly={!editablePreview}
          start={domainDatesToSvarDates({ start: "2026-09-14", end: "2026-09-14" }).start}
          end={domainDatesToSvarDates({ start: "2026-10-02", end: "2026-10-02" }).end}
          init={(api) => {
            apiRef.current = api;
          }}
          onUpdateTask={onUpdateTask}
        />
      </div>
    </Willow>
  );
}
