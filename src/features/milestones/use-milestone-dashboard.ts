"use client";

import { useEffect, useRef, useState } from "react";
import type { MilestoneDashboardDto, MilestoneDashboardFilterInput } from "../../contracts/milestone-dashboard";
import { dashboardFilterError, dashboardFrom, dashboardMatches, dashboardQuery, projectDateAt } from "./milestone-dashboard-model";

type Outcome = { key: string; status: "loading" | "ready" | "error"; data: MilestoneDashboardDto | null; error?: string };
type Entry = { data: MilestoneDashboardDto; confirmedAt: number };
const CACHE_MAX_AGE = 30_000;

export function useMilestoneDashboard(publicId: string, revision: number, input: MilestoneDashboardFilterInput, active: boolean) {
  const query = dashboardQuery(input), validation = dashboardFilterError(input);
  const key = `${publicId}:${revision}:${query}`;
  const [outcome, setOutcome] = useState<Outcome>({ key: "", status: "loading", data: null });
  const [refresh, setRefresh] = useState(0);
  const cache = useRef(new Map<string, Entry>());
  const currentInput = useRef(input); currentInput.current = input;
  const generation = useRef(0), catalogs = useRef(new Map<string, number>()), lastAttempt = useRef(0);
  const force = useRef(false);
  const scheduled = useRef(false), inFlight = useRef(false), timerAttemptDays = useRef(new Map<string, string>());
  const current = useRef({ active, publicId, revision, key }); current.current = { active, publicId, revision, key };

  function reload() { force.current = true; setRefresh((value) => value + 1); }

  useEffect(() => {
    if (!active || validation) return;
    const id = ++generation.current, controller = new AbortController();
    scheduled.current = false;
    const expected = currentInput.current;
    const cached = cache.current.get(key);
    const minimumCatalog = catalogs.current.get(publicId) ?? 0;
    const automatic = !expected.asOfDate;
    const validCache = !force.current && cached && Date.now() - cached.confirmedAt < CACHE_MAX_AGE && cached.data.catalogRevision === minimumCatalog && (!automatic || cached.data.asOfDate === projectDateAt(cached.data.timezone));
    force.current = false;
    void (async () => {
      await Promise.resolve();
      if (controller.signal.aborted) return;
      if (validCache) { inFlight.current = false; setOutcome({ key, status: "ready", data: cached.data }); return; }
      lastAttempt.current = Date.now();
      inFlight.current = true;
      setOutcome((previous) => ({ key, status: "loading", data: previous.data?.projectPublicId === publicId ? previous.data : null }));
      try {
        const response = await fetch(`/api/projects/${encodeURIComponent(publicId)}/milestone-dashboard?${query}`, { signal: controller.signal, cache: "no-store", credentials: "same-origin" });
        if (!response.ok) throw new Error(`완료 단계 조회에 실패했습니다 (HTTP ${response.status}).`);
        const data = dashboardFrom(await response.json());
        if (!data || !dashboardMatches(data, publicId, revision, expected, catalogs.current.get(publicId) ?? 0)) throw new Error("현재 프로젝트 Revision·조회 조건과 응답이 다릅니다. 프로젝트 최신 정보를 조회한 뒤 다시 시도해 주세요.");
        if (controller.signal.aborted || generation.current !== id || current.current.key !== key) return;
        catalogs.current.set(publicId, data.catalogRevision);
        for (const [cacheKey, entry] of cache.current) if (entry.data.projectPublicId === publicId && (entry.data.projectRevision !== revision || entry.data.catalogRevision !== data.catalogRevision)) cache.current.delete(cacheKey);
        cache.current.set(key, { data, confirmedAt: Date.now() });
        if (cache.current.size > 8) cache.current.delete(cache.current.keys().next().value!);
        setOutcome({ key, status: "ready", data });
      } catch (error) {
        if (!controller.signal.aborted && generation.current === id) setOutcome((previous) => ({ key, status: "error", data: previous.data, error: error instanceof Error ? error.message : "완료 단계를 불러오지 못했습니다." }));
      } finally {
        if (generation.current === id) inFlight.current = false;
      }
    })();
    return () => { controller.abort(); if (generation.current === id) inFlight.current = false; };
  }, [publicId, revision, query, key, validation, active, refresh]);

  useEffect(() => {
    if (!active) return;
    function catchUp() {
      if (document.visibilityState !== "visible" || scheduled.current || inFlight.current) return;
      if (Date.now() - lastAttempt.current >= CACHE_MAX_AGE) { scheduled.current = true; force.current = true; setRefresh((value) => value + 1); }
    }
    window.addEventListener("focus", catchUp);
    document.addEventListener("visibilitychange", catchUp);
    // This clock check does not poll the API: only a changed project-local day
    // triggers a request. Focus/visibility also catch up catalog revisions.
    const clock = window.setInterval(() => {
      const data = cache.current.get(current.current.key)?.data;
      if (document.visibilityState !== "visible" || !data || currentInput.current.asOfDate || scheduled.current || inFlight.current) return;
      const day = projectDateAt(data.timezone);
      if (data.asOfDate !== day && timerAttemptDays.current.get(current.current.publicId) !== day) {
        // Server date is authoritative. Even a clock ahead of the server must
        // not turn an unchanged response or a failure into minute polling.
        timerAttemptDays.current.set(current.current.publicId, day);
        scheduled.current = true; force.current = true; setRefresh((value) => value + 1);
      }
    }, 60_000);
    return () => { window.clearInterval(clock); window.removeEventListener("focus", catchUp); document.removeEventListener("visibilitychange", catchUp); };
  }, [active]);

  const ready = active && !validation && outcome.key === key && outcome.status === "ready";
  return { data: outcome.data, ready, validation, loading: active && !validation && (outcome.key !== key || outcome.status === "loading"), error: validation ?? (outcome.key === key && outcome.status === "error" ? outcome.error : null), reload };
}
