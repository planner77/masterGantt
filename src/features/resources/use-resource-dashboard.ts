"use client";
import { useResourceDrill } from "./resource-drill-context";
import { resourceProjectionFetch } from "./resource-drill-transport";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ResourceDashboardDto } from "@/contracts/resource-dashboard";
import { readDashboard } from "./resource-dashboard-model";

export type ReportState = {
  data: ResourceDashboardDto | null;
  phase: "loading" | "ready" | "error";
  error: string;
  queryKey: string;
  bindingKey: string;
  confirmedAt: string | null;
};
export function dashboardError(code: string): string {
  if (code === "REPORT_STALE")
    return "데이터가 변경되었습니다. 새로고침한 뒤 상세를 다시 열어 주세요.";
  if (code === "INVALID_SELECTION")
    return "선택 항목이 삭제되거나 프로젝트에서 해제되었습니다. 해당 조건을 해제하거나 초기화해 주세요.";
  if (code === "REPORT_LIMIT_EXCEEDED")
    return "조회 한도를 초과했습니다. 기간·선택 범위를 줄여 주세요. 프로젝트 전체 한도는 필터로 줄일 수 없습니다.";
  if (code === "PROJECT_NOT_FOUND")
    return "프로젝트를 찾을 수 없습니다. 프로젝트 목록에서 접근 상태를 확인해 주세요.";
  if (code === "FORBIDDEN" || code === "UNAUTHORIZED")
    return "조회 권한을 확인해 주세요. 프로젝트를 다시 열어 접근 상태를 확인할 수 있습니다.";
  return "리소스 공수 정보를 불러오지 못했습니다. 입력 조건을 유지한 채 다시 시도할 수 있습니다.";
}
export function useResourceDashboard(
  publicId: string,
  revision: number,
  active: boolean,
  queryKey: string,
) {
  const { binding, onReport } = useResourceDrill();
  const reportCallback = useRef(onReport);
  useEffect(() => { reportCallback.current = onReport; }, [onReport]);
  const bindingKey = JSON.stringify(binding);
  const [state, setState] = useState<ReportState>({
    data: null,
    phase: "loading",
    error: "",
    queryKey: "",
    bindingKey: "",
    confirmedAt: null,
  });
  const [planData, setPlanData] = useState<ResourceDashboardDto | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const latest = useRef({ publicId, revision, queryKey, bindingKey });
  const generation = useRef(0);
  const refresh = useCallback(() => {
    setState((previous) => ({ ...previous, phase: "loading" }));
    setRefreshTick((value) => value + 1);
  }, []);
  useEffect(() => {
    latest.current = { publicId, revision, queryKey, bindingKey };
  }, [publicId, revision, queryKey, bindingKey]);
  useEffect(() => {
    if (!active) return;
    let disposed = false;
    const current = ++generation.current;
    const controller = new AbortController();
    queueMicrotask(async () => {
      if (disposed) return;
      setState((previous) => ({
        ...previous,
        data:
          previous.data?.projectPublicId === publicId ? previous.data : null,
        phase: "loading",
        error: "",
      }));
      try {
        const response = await resourceProjectionFetch(
          binding,
          `/api/projects/${encodeURIComponent(publicId)}/resource-dashboard?${queryKey}`,
          {
            credentials: "same-origin",
            cache: "no-store",
            signal: controller.signal,
          },
        );
        const body = await response.json().catch(() => null);
        if (!response.ok)
          throw new Error(body?.error?.code ?? "REQUEST_FAILED");
        const data = readDashboard(
          body,
          publicId,
          new URLSearchParams(queryKey),
        );
        if (!data) throw new Error("INVALID_RESPONSE");
        if (
          disposed ||
          controller.signal.aborted ||
          generation.current !== current ||
          latest.current.publicId !== publicId ||
          latest.current.queryKey !== queryKey ||
          latest.current.revision !== revision ||
          latest.current.bindingKey !== bindingKey
        )
          return;
        if (data.projectRevision !== revision) throw new Error("REPORT_STALE");
        reportCallback.current?.(data);
        if (data.plan) setPlanData(data);
        setState((previous) =>
          previous.data?.projectPublicId === publicId &&
          previous.data.catalogRevision > data.catalogRevision
            ? {
                ...previous,
                phase: "error",
                error: dashboardError("REPORT_STALE"),
              }
            : {
                data,
                phase: "ready",
                error: "",
                queryKey,
                bindingKey,
                confirmedAt: new Date().toISOString(),
              },
        );
      } catch (error) {
        if (
          disposed ||
          controller.signal.aborted ||
          generation.current !== current
        )
          return;
        setState((previous) => ({
          ...previous,
          phase: "error",
          error: dashboardError(
            error instanceof Error ? error.message : "REQUEST_FAILED",
          ),
        }));
      }
    });
    return () => {
      disposed = true;
      controller.abort();
    };
  }, [publicId, revision, active, queryKey, refreshTick, bindingKey, binding]);
  useEffect(() => {
    if (!active) return;
    const catchUp = () => {
      if (document.visibilityState === "visible") refresh();
    };
    window.addEventListener("focus", catchUp);
    document.addEventListener("visibilitychange", catchUp);
    return () => {
      window.removeEventListener("focus", catchUp);
      document.removeEventListener("visibilitychange", catchUp);
    };
  }, [active, refresh]);
  const data = state.data?.projectPublicId === publicId ? state.data : null;
  const stale =
    !data ||
    !active ||
    state.phase !== "ready" ||
    state.queryKey !== queryKey ||
    state.bindingKey !== bindingKey ||
    data.projectRevision !== revision;
  return {
    ...state,
    data,
    planData: planData?.projectPublicId === publicId ? planData : null,
    stale,
    refresh,
  };
}
