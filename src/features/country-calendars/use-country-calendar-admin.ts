"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CountryCalendarAdminResponse, CountryCalendarImportEnvelope, CountryCalendarImportPreviewResponse, UpdateCountryCalendarMetadataRequest } from "@/contracts/country-calendar-admin";
import { COUNTRY_CALENDAR_IMPORT_LIMIT_BYTES } from "@/contracts/country-calendar-admin";
import type { WorkCalendarCountryCode } from "@/contracts/work-calendar";

export type CalendarTarget = { countryCode: WorkCalendarCountryCode; year: number };
export type MetadataDraft = { status: "OFFICIAL" | "UNAVAILABLE" | "SUPERSEDED"; sourceVersion: string; sourceUrl: string };
export const targetKey = (target: CalendarTarget) => `${target.countryCode}:${target.year}`;
export const datasetPath = (target: CalendarTarget) => `/api/admin/work-calendars/countries/${target.countryCode}/years/${target.year}`;
const draftFrom = (value: CountryCalendarAdminResponse): MetadataDraft => ({ status: value.data.dataset.status, sourceVersion: value.data.dataset.sourceVersion ?? "", sourceUrl: value.data.dataset.sourceUrl ?? "" });
function validDataset(value: unknown, target: CalendarTarget): value is CountryCalendarAdminResponse {
  if (!value || typeof value !== "object" || !("data" in value)) return false;
  const data = (value as CountryCalendarAdminResponse).data;
  return !!data && Number.isSafeInteger(data.revision) && data.revision > 0 && data.dataset?.countryCode === target.countryCode && data.dataset?.year === target.year && ["OFFICIAL", "UNAVAILABLE", "SUPERSEDED"].includes(data.dataset.status) && Array.isArray(data.dates);
}
function serverMessage(body: unknown, fallback: string): string {
  const error = (body as { error?: { message?: string; details?: Array<{ path?: string; message?: string }> } } | null)?.error;
  return [error?.message ?? fallback, ...(error?.details ?? []).map((detail) => `${detail.path ?? "입력"}: ${detail.message ?? "확인해 주세요."}`)].join("\n");
}

export function useCountryCalendarAdmin() {
  const [authenticated, setAuthenticated] = useState(false);
  const [checking, setChecking] = useState(true);
  const [target, setTarget] = useState<CalendarTarget>({ countryCode: "KR", year: 2026 });
  const [snapshot, setSnapshot] = useState<CountryCalendarAdminResponse | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [metadata, setMetadata] = useState<MetadataDraft>({ status: "UNAVAILABLE", sourceVersion: "", sourceUrl: "" });
  const [metadataDirty, setMetadataDirty] = useState(false);
  const [comparison, setComparison] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [fileName, setFileName] = useState("");
  const [envelope, setEnvelope] = useState<CountryCalendarImportEnvelope | null>(null);
  const [preview, setPreview] = useState<CountryCalendarImportPreviewResponse | null>(null);
  const [previewExpired, setPreviewExpired] = useState(false);
  const [fileReading, setFileReading] = useState(false);
  const mounted = useRef(false), requestEpoch = useRef(0), authEpoch = useRef(0), fileEpoch = useRef(0), pending = useRef(false);
  const targetRef = useRef(target), snapshotRef = useRef(snapshot), draftDirty = useRef(false);
  const needsReview = useRef(false);
  const readController = useRef<AbortController | null>(null);
  const operationController = useRef<AbortController | null>(null);
  const invalidateImport = useCallback(() => {
    fileEpoch.current += 1; setEnvelope(null); setPreview(null); setPreviewExpired(false); setFileName(""); setFileReading(false);
  }, []);
  const invalidateAuth = useCallback(() => {
    needsReview.current = snapshotRef.current !== null;
    authEpoch.current += 1; requestEpoch.current += 1;
    readController.current?.abort(); operationController.current?.abort();
    setAuthenticated(false); setChecking(false); setLoadState("error"); setBusy(false); pending.current = false;
    invalidateImport();
    setError("관리자 세션이 만료되었습니다. 다시 로그인해 주세요.");
  }, [invalidateImport]);
  const accept = useCallback((value: CountryCalendarAdminResponse, preserveDraft: boolean) => {
    snapshotRef.current = value; setSnapshot(value); setLoadState("ready");
    if (!preserveDraft || !draftDirty.current) {
      setMetadata(draftFrom(value)); setMetadataDirty(false); draftDirty.current = false; setComparison(needsReview.current);
    } else setComparison(true);
  }, []);
  const load = useCallback(async (selected: CalendarTarget, preserveDraft = true) => {
    readController.current?.abort();
    const controller = new AbortController(); readController.current = controller;
    const epoch = ++requestEpoch.current, authentication = authEpoch.current;
    const current = () => mounted.current && epoch === requestEpoch.current && authentication === authEpoch.current && targetKey(selected) === targetKey(targetRef.current) && !controller.signal.aborted;
    setLoadState("loading"); setError("");
    try {
      const response = await fetch(datasetPath(selected), { credentials: "same-origin", cache: "no-store", signal: controller.signal });
      const value: unknown = await response.json().catch(() => null);
      if (!current()) return false;
      if (response.status === 401) { invalidateAuth(); return false; }
      if (!response.ok || !validDataset(value, selected)) { setLoadState("error"); setError(serverMessage(value, "최신 국가 캘린더를 불러오지 못했습니다.")); return false; }
      setAuthenticated(true); accept(value, preserveDraft); return true;
    } catch {
      if (current()) { setLoadState("error"); setError("국가 캘린더 서버에 연결할 수 없습니다."); }
      return false;
    } finally { if (current()) setChecking(false); }
  }, [accept, invalidateAuth]);
  useEffect(() => {
    mounted.current = true; void load(targetRef.current);
    return () => { mounted.current = false; requestEpoch.current += 1; authEpoch.current += 1; fileEpoch.current += 1; readController.current?.abort(); operationController.current?.abort(); };
  }, [load]);
  const selectTarget = (next: CalendarTarget) => {
    if (pending.current || targetKey(next) === targetKey(targetRef.current)) return;
    targetRef.current = next; setTarget(next); snapshotRef.current = null; setSnapshot(null);
    draftDirty.current = false; setMetadataDirty(false); needsReview.current = false; setComparison(false);
    setMetadata({ status: "UNAVAILABLE", sourceVersion: "", sourceUrl: "" }); invalidateImport(); setNotice("");
    void load(next, false);
  };
  const editMetadata = (next: MetadataDraft) => { draftDirty.current = true; setMetadataDirty(true); setMetadata(next); setPreview(null); };
  const restoreMetadata = () => { if (snapshotRef.current) { setMetadata(draftFrom(snapshotRef.current)); draftDirty.current = false; setMetadataDirty(false); setComparison(false); } };
  async function login(password: string) {
    if (pending.current || !password) return;
    pending.current = true; setBusy(true); setError("");
    const authentication = ++authEpoch.current;
    try {
      const response = await fetch("/api/project-master/admin-sessions", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
      const body: unknown = await response.json().catch(() => null);
      if (!mounted.current || authentication !== authEpoch.current) return;
      if (!response.ok) { setError(serverMessage(body, "관리자 인증에 실패했습니다.")); return; }
      setAuthenticated(true); void load(targetRef.current);
    } catch { if (mounted.current && authentication === authEpoch.current) setError("관리자 인증 서버에 연결할 수 없습니다."); }
    finally { if (mounted.current && authentication === authEpoch.current) { pending.current = false; setBusy(false); } }
  }
  async function logout() {
    if (pending.current) return;
    pending.current = true; setBusy(true);
    let failed = false;
    try { const response = await fetch("/api/project-master/admin-sessions/current", { method: "DELETE", credentials: "same-origin" }); failed = !response.ok && response.status !== 401; }
    catch { failed = true; }
    finally { if (mounted.current) { invalidateAuth(); setError(failed ? "서버의 로그아웃 결과를 확인할 수 없습니다. 화면 편집은 잠겼습니다." : ""); } }
  }
  async function mutate(path: string, method: "POST" | "PATCH" | "DELETE", payload?: unknown) {
    const baseline = snapshotRef.current;
    if (!authenticated || comparison || loadState !== "ready" || !baseline || pending.current) return false;
    pending.current = true; setBusy(true); setError(""); setNotice(""); setPreview(null);
    const selected = { ...targetRef.current }, authentication = authEpoch.current;
    const controller = new AbortController(); operationController.current = controller;
    const current = () => mounted.current && authentication === authEpoch.current && targetKey(selected) === targetKey(targetRef.current) && !controller.signal.aborted;
    try {
      const response = await fetch(path, { method, credentials: "same-origin", signal: controller.signal, headers: { "Content-Type": "application/json", "If-Match": `"${baseline.data.revision}"` }, ...(payload === undefined ? {} : { body: JSON.stringify(payload) }) });
      const value: unknown = await response.json().catch(() => null);
      if (!current()) return false;
      if (response.status === 401) { invalidateAuth(); return false; }
      if (response.status === 412) { invalidateImport(); await load(selected, true); if (current()) { setComparison(true); setError("다른 변경이 먼저 저장되었습니다. 최신 데이터와 초안을 비교한 뒤 다시 저장하세요."); } return false; }
      if (!response.ok || !validDataset(value, selected)) {
        setError(serverMessage(value, "변경을 저장하지 못했습니다."));
        if (response.status >= 500 || response.ok) setLoadState("error");
        return false;
      }
      accept(value, false); invalidateImport(); setNotice("변경을 저장했습니다. 기존 프로젝트는 자동 변경되지 않습니다."); return true;
    } catch { if (current()) { setLoadState("error"); setError("저장 결과를 확인할 수 없습니다. 최신 데이터를 다시 조회하세요."); } return false; }
    finally { if (current()) { pending.current = false; setBusy(false); } }
  }
  async function saveMetadata() {
    const payload: UpdateCountryCalendarMetadataRequest = { status: metadata.status, sourceVersion: metadata.sourceVersion || null, sourceUrl: metadata.sourceUrl || null };
    return mutate(datasetPath(targetRef.current), "PATCH", payload);
  }
  async function readFile(file: File | undefined, format: "json" | "csv") {
    if (pending.current) return;
    const epoch = ++fileEpoch.current, authentication = authEpoch.current, selected = { ...targetRef.current };
    setPreview(null); setPreviewExpired(false); setEnvelope(null); setFileName(file?.name ?? ""); setError("");
    if (!file || pending.current) return;
    setFileReading(true);
    const current = () => mounted.current && epoch === fileEpoch.current && authentication === authEpoch.current && targetKey(selected) === targetKey(targetRef.current);
    try {
      if (file.size > COUNTRY_CALENDAR_IMPORT_LIMIT_BYTES) throw new Error("파일은 UTF-8 기준 1 MiB 이하여야 합니다.");
      const bytes = await file.arrayBuffer();
      const content = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes);
      if (current()) setEnvelope({ ...selected, format, content });
    } catch { if (current()) setError("UTF-8 파일을 읽을 수 없습니다. 인코딩과 1 MiB 제한을 확인하세요."); }
    finally { if (current()) setFileReading(false); }
  }
  async function calculatePreview() {
    if (comparison || !envelope || !snapshotRef.current || pending.current || loadState !== "ready" || !authenticated) return;
    pending.current = true; setBusy(true); setPreview(null); setPreviewExpired(false); setError("");
    const selected = { ...targetRef.current }, authentication = authEpoch.current, file = fileEpoch.current, baseline = snapshotRef.current;
    const controller = new AbortController(); operationController.current = controller;
    const current = () => mounted.current && authentication === authEpoch.current && file === fileEpoch.current && targetKey(selected) === targetKey(targetRef.current) && !controller.signal.aborted;
    try {
      const response = await fetch("/api/admin/work-calendars/import/preview", { method: "POST", credentials: "same-origin", signal: controller.signal, headers: { "Content-Type": "application/json", "If-Match": `"${baseline.data.revision}"` }, body: JSON.stringify(envelope) });
      const value = await response.json().catch(() => null) as CountryCalendarImportPreviewResponse | null;
      if (!current()) return;
      if (response.status === 401) { invalidateAuth(); return; }
      if (response.status === 412) { setPreview(null); await load(selected, true); if (current()) setError("최신 데이터로 갱신했습니다. 내용을 확인하고 새 미리보기를 계산하세요."); return; }
      if (!response.ok || !value?.data || value.data.revision !== baseline.data.revision || value.data.importDataset.countryCode !== selected.countryCode || value.data.importDataset.year !== selected.year || !Number.isFinite(Date.parse(value.data.expiresAt))) { setError(serverMessage(value, "파일 검증에 실패했습니다.")); return; }
      setPreview(value); setPreviewExpired(Date.parse(value.data.expiresAt) <= Date.now());
    } catch { if (current()) setError("파일 검증 서버에 연결할 수 없습니다."); }
    finally { if (current()) { pending.current = false; setBusy(false); } }
  }
  useEffect(() => {
    if (!preview) return;
    const milliseconds = Date.parse(preview.data.expiresAt) - Date.now();
    if (milliseconds <= 0) return;
    const timer = window.setTimeout(() => setPreviewExpired(true), milliseconds);
    return () => window.clearTimeout(timer);
  }, [preview]);
  async function applyImport() {
    if (!preview || !envelope || previewExpired || Date.parse(preview.data.expiresAt) <= Date.now() || preview.data.revision !== snapshotRef.current?.data.revision) { setPreviewExpired(true); return false; }
    return mutate("/api/admin/work-calendars/import/apply", "POST", { envelope, previewToken: preview.data.previewToken });
  }
  return { authenticated, checking, target, snapshot, loadState, metadata, metadataDirty, comparison, busy, error, notice, fileName, envelope, preview, previewExpired, fileReading, selectTarget, editMetadata, restoreMetadata, reviewLatest: () => { if (loadState === "ready") { needsReview.current = false; setComparison(false); } }, login, logout, reload: () => load(targetRef.current, true), mutate, saveMetadata, readFile, calculatePreview, applyImport, invalidateImport };
}
