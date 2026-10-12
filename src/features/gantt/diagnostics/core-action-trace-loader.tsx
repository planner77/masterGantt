"use client";

import dynamic from "next/dynamic";

const Fixture = dynamic(() => import("./core-action-trace-fixture").then(module => module.CoreActionTraceFixture), {
  ssr: false, loading: () => <p role="status">Core 진단 fixture를 불러오는 중입니다.</p>,
});

export function CoreActionTraceLoader() { return <Fixture />; }
