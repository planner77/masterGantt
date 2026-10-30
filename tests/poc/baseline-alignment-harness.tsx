import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { Gantt, Willow, type IApi } from "@svar-ui/react-gantt";
import "@svar-ui/react-gantt/all.css";

// Isolated test fixture. No product hook, PRO feature, or private coordinates.
let api: IApi;
let resize: { width: number; height: number; scrollSize: number } | null = null;
let initCount = 0;
const date = (day: number) => new Date(2026, 8, day);
const tasks = [
  { id: "summary", text: "Summary", type: "summary", start: date(14), end: date(30), open: true },
  ...Array.from({ length: 24 }, (_, index) => ({ id: `task-${index}`, parent: "summary", text: `Alignment task ${index}`, start: date(14 + index % 7), end: date(18 + index % 7), type: "task" })),
];
function Fixture() {
  const [unit, setUnit] = useState<"day" | "week">("day");
  const [readonly, setReadonly] = useState(true);
  const [gridWidth, setGridWidth] = useState(620);
  const [autoScale, setAutoScale] = useState(true);
  return <>
    <button onClick={() => setUnit(unit === "day" ? "week" : "day")}>Scale</button>
    <button onClick={() => setReadonly(!readonly)}>Permission</button>
    <button onClick={() => setGridWidth(gridWidth === 620 ? 400 : 620)}>Grid width</button>
    <button onClick={() => setAutoScale(!autoScale)}>Auto scale</button>
    <Willow><div id="owned-host" className="wx-theme" style={{ height: 480, minWidth: 720, position: "relative" }}>
      <Gantt tasks={tasks} links={[]} gridWidth={gridWidth} autoScale={autoScale} start={date(14)} end={new Date(2026, 9, 12)} readonly={readonly}
        scales={[{ unit: "month", step: 1, format: "%F %Y" }, { unit, step: 1, format: unit === "day" ? "%j" : "%W" }]}
        init={(value) => { api = value; initCount++; value.on("resize-chart", (event) => { resize = { width: event.width, height: event.height, scrollSize: event.scrollSize }; }); }} />
    </div></Willow>
  </>;
}
Object.assign(window, {
  baselinePoc: {
    state() {
      const state = api.getState();
      return { start: state.start?.toISOString(), end: state.end?.toISOString(), autoScale: state.autoScale, scales: state.scales?.map(({ unit, step }) => ({ unit, step })), gridWidth: state.gridWidth, cellWidth: state.cellWidth, cellHeight: state.cellHeight, scaleHeight: state.scaleHeight, scrollLeft: state.scrollLeft, scrollTop: state.scrollTop, area: state.area, resize, initCount };
    },
    scroll(left: number, top: number) { return api.exec("scroll-chart", { left, top }); },
    collapse() { return api.exec("open-task", { id: "summary", mode: false }); },
  },
});
createRoot(document.getElementById("root")!).render(<Fixture />);
