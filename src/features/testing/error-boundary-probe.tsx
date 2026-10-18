"use client";

import { useEffect, useRef, useState } from "react";

export function ErrorBoundaryProbe({ probeId }: Readonly<{ probeId: string }>) {
  const triggerReference = useRef<HTMLButtonElement>(null);
  const [shouldThrow, setShouldThrow] = useState(false);
  const [recovered, setRecovered] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const storageKey = `mastergantt:e2e-error-boundary:${probeId}`;

  // Server-rendered button text can appear before React attaches its event handler.
  // Expose a test-only readiness signal after the client commit/effect runs.
  useEffect(() => {
    triggerReference.current?.setAttribute("data-e2e-hydrated", "true");
  }, []);

  useEffect(() => {
    if (window.sessionStorage.getItem(storageKey) !== "restore") return;
    const timer = window.setTimeout(() => {
      window.sessionStorage.removeItem(storageKey);
      setRecovered(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [storageKey]);

  // An SSR-visible button is not necessarily hydrated. The marker is set
  // from a committed client effect, after React has attached the event handler.
  // This probe is gated to non-production E2E runs only.
  useEffect(() => {
    const button = triggerRef.current;
    if (!button) return;
    button.dataset.e2eHydrated = "true";
    return () => { delete button.dataset.e2eHydrated; };
  }, []);

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
        ref={triggerRef}
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
