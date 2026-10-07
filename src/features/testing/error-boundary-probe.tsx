"use client";

import { useEffect, useState } from "react";

export function ErrorBoundaryProbe({ probeId }: Readonly<{ probeId: string }>) {
  const [shouldThrow, setShouldThrow] = useState(false);
  const [recovered, setRecovered] = useState(false);
  const storageKey = `mastergantt:e2e-error-boundary:${probeId}`;

  useEffect(() => {
    if (window.sessionStorage.getItem(storageKey) !== "restore") return;
    const timer = window.setTimeout(() => {
      window.sessionStorage.removeItem(storageKey);
      setRecovered(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [storageKey]);

  if (shouldThrow) {
    throw new Error(`Controlled E2E error boundary probe: ${probeId}`);
  }

  return (
    <section
      aria-label="오류 경계 테스트 하니스"
      data-testid={`e2e-error-boundary-probe-${probeId}`}
    >
      <p>
        {recovered
          ? "오류 경계 복구 후 원래 포커스 지점을 복원했습니다."
          : "이 컨트롤은 E2E 환경에서만 실제 React 오류 경계를 검증합니다."}
      </p>
      <button
        key={recovered ? "recovered" : "initial"}
        autoFocus={recovered}
        className="secondary-button"
        data-testid={`e2e-error-boundary-trigger-${probeId}`}
        type="button"
        onClick={() => {
          window.sessionStorage.setItem(storageKey, "restore");
          setShouldThrow(true);
        }}
      >
        {recovered ? "오류 경계 테스트 복구 확인" : "오류 경계 테스트 시작"}
      </button>
    </section>
  );
}
