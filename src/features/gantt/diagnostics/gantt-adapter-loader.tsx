"use client";
import dynamic from "next/dynamic";
const Fixture = dynamic(() => import("./gantt-adapter-fixture").then(module => module.GanttAdapterFixture), { ssr: false, loading: () => <p role="status">Adapter PoC를 불러오는 중입니다.</p> });
export function GanttAdapterLoader(props: { mode: "A" | "B" | "C"; scale: "day" | "week" }) { return <Fixture {...props} />; }
