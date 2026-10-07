"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { AdminAuth, adminAuthStyles } from "@/components/admin-auth";
import { WorkspaceDialog } from "@/components/workspace-dialog";
import { COUNTRY_CALENDAR_MANAGED_YEARS, type CountryCalendarAdminDateDto } from "@/contracts/country-calendar-admin";
import { WORK_CALENDAR_COUNTRY_CODES, type CountryCalendarDescriptorDto, type WorkCalendarCountryCode } from "@/contracts/work-calendar";
import { datasetPath, targetKey, useCountryCalendarAdmin, type CalendarTarget } from "./use-country-calendar-admin";
import styles from "./country-calendar-admin.module.css";

const names: Record<WorkCalendarCountryCode, string> = { KR: "대한민국", CN: "중국", VN: "베트남", PH: "필리핀", TH: "태국", MX: "멕시코", US: "미국" };
const scopes: Record<WorkCalendarCountryCode, string> = { KR: "관공서 공휴일 기준", CN: "국무원 연간 일정", VN: "주5일 공공기관 직원", PH: "전국 공식 휴일", TH: "전국 금융기관 공통", MX: "연방노동법 일반 의무휴무일", US: "연방직원" };
const statusNames = { OFFICIAL: "공식 자료 확보", UNAVAILABLE: "미확보", SUPERSEDED: "기존 자료 대체 필요" };
type DateDialog = { originalDate: string | null; draft: CountryCalendarAdminDateDto; deleting: boolean };

export function CountryCalendarAdmin() {
  const model = useCountryCalendarAdmin();
  const [password, setPassword] = useState("");
  const [countries, setCountries] = useState<CountryCalendarDescriptorDto[]>([]);
  const [dateDialog, setDateDialog] = useState<DateDialog | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [format, setFormat] = useState<"json" | "csv">("json");
  const [confirmedPreview, setConfirmedPreview] = useState<typeof model.preview>(null);
  const confirmed = model.preview !== null && confirmedPreview === model.preview;
  const [switchTarget, setSwitchTarget] = useState<CalendarTarget | null>(null);
  const loginInput = useRef<HTMLInputElement | null>(null);
  const countrySelect = useRef<HTMLSelectElement | null>(null);
  const yearSelect = useRef<HTMLSelectElement | null>(null);
  const switchTrigger = useRef<HTMLElement | null>(null);
  const dialogTrigger = useRef<HTMLElement | null>(null);
  const importTrigger = useRef<HTMLButtonElement | null>(null);
  const addTrigger = useRef<HTMLButtonElement | null>(null);
  const listHeading = useRef<HTMLHeadingElement | null>(null);
  const focusDate = useRef<string | null>(null);
  const formDirty = model.metadataDirty || dateDialog !== null || model.envelope !== null;
  const locked = model.busy || model.loadState !== "ready" || !model.snapshot || model.comparison;
  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/work-calendars/countries", { cache: "no-store", signal: controller.signal }).then((response) => response.json()).then((body) => {
      if (!controller.signal.aborted && Array.isArray(body?.data?.countries)) setCountries(body.data.countries);
    }).catch(() => {});
    return () => controller.abort();
  }, [model.snapshot?.data.revision]);
  useEffect(() => {
    if (!model.authenticated && !model.checking && !model.busy) loginInput.current?.focus({ preventScroll: true });
  }, [model.authenticated, model.checking, model.busy]);
  useEffect(() => {
    if (dateDialog || !focusDate.current) return;
    const date = focusDate.current; focusDate.current = null;
    const trigger = document.getElementById(`country-date-edit-${date}`);
    (trigger ?? addTrigger.current ?? listHeading.current)?.focus({ preventScroll: true });
  }, [dateDialog, model.snapshot]);
  async function login(event: FormEvent) {
    event.preventDefault(); const candidate = password; setPassword(""); await model.login(candidate);
  }
  function changeTarget(next: CalendarTarget, trigger: HTMLElement) {
    if (model.busy || targetKey(next) === targetKey(model.target)) return;
    if (formDirty) { switchTrigger.current = trigger; setSwitchTarget(next); }
    else model.selectTarget(next);
  }
  function openDate(original: CountryCalendarAdminDateDto | null, trigger: HTMLElement, deleting = false) {
    dialogTrigger.current = trigger;
    setDateDialog({ originalDate: original?.date ?? null, draft: original ?? { date: `${model.target.year}-01-01`, name: "", dayType: "NON_WORKING", sourceKey: "admin" }, deleting });
  }
  async function saveDate(event: FormEvent) {
    event.preventDefault(); if (!dateDialog || locked) return;
    const { originalDate, draft, deleting } = dateDialog;
    const path = `${datasetPath(model.target)}/dates${originalDate ? `/${encodeURIComponent(originalDate)}` : ""}`;
    if (await model.mutate(path, deleting ? "DELETE" : originalDate ? "PATCH" : "POST", deleting ? undefined : draft)) {
      // A renamed/deleted row no longer owns a connected trigger. Restore to
      // its canonical replacement or the surviving add action after commit.
      focusDate.current = deleting ? "deleted" : draft.date;
      dialogTrigger.current = null; setDateDialog(null);
    }
  }
  function closeImport() { if (!model.busy) { setImportOpen(false); model.invalidateImport(); setConfirmedPreview(null); } }
  const descriptor = countries.find((entry) => entry.code === model.target.countryCode);
  const snapshot = model.snapshot?.data;
  const targetLabel = `${names[model.target.countryCode]} ${model.target.year}년`;

  return <div className={styles.panel}>
    <p className={styles.note}>국가 원본을 변경해도 기존 프로젝트의 캘린더·작업 일정은 자동으로 변경되지 않습니다.</p>
    {model.checking ? <p role="status">관리자 인증 상태를 확인하는 중…</p> : null}
    {!model.authenticated && !model.checking ? <AdminAuth title="국가 캘린더 관리자 로그인" titleId="country-calendar-auth-title" description="프로젝트 기준정보 관리자 권한을 함께 사용합니다. 프로젝트 편집 비밀번호와는 별개입니다.">
      <form className={adminAuthStyles.form} onSubmit={(event) => void login(event)}>
        {model.error ? <p className={adminAuthStyles.error} id="country-calendar-login-error" role="alert">{model.error}</p> : null}
        <div className={adminAuthStyles.controls}>
          <label className={adminAuthStyles.field}>관리자 비밀번호<input ref={loginInput} autoComplete="current-password" type="password" value={password} disabled={model.busy} aria-describedby={model.error ? "country-calendar-login-error" : undefined} onChange={(event) => setPassword(event.target.value)} /></label>
          <button className={`primary-button ${adminAuthStyles.submit}`} type="submit" disabled={model.busy || !password}>{model.busy ? "확인 중…" : "로그인"}</button>
        </div>
      </form>
    </AdminAuth> : null}
    <section className={styles.workspace} hidden={!model.authenticated} aria-label="국가 캘린더 관리">
      <div className={styles.toolbar}>
        <div className={styles.field}><label htmlFor="country-calendar-country">국가</label><select id="country-calendar-country" ref={countrySelect} value={model.target.countryCode} disabled={model.busy} onChange={(event) => changeTarget({ ...model.target, countryCode: event.target.value as WorkCalendarCountryCode }, event.currentTarget)}>{WORK_CALENDAR_COUNTRY_CODES.map((code) => <option key={code} value={code}>{names[code]} ({code})</option>)}</select></div>
        <div className={styles.field}><label htmlFor="country-calendar-year">연도</label><select id="country-calendar-year" ref={yearSelect} value={model.target.year} disabled={model.busy} onChange={(event) => changeTarget({ ...model.target, year: Number(event.target.value) }, event.currentTarget)}>{COUNTRY_CALENDAR_MANAGED_YEARS.map((year) => <option key={year} value={year}>{year}{descriptor?.datasets?.find((entry) => entry.year === year)?.status === "SUPERSEDED" ? " · 대체 필요" : descriptor && !descriptor.supportedYears.includes(year) ? " · 미확보" : ""}</option>)}</select></div>
        <div className={styles.actions}><button className="secondary-button" type="button" disabled={model.busy || model.loadState === "loading"} onClick={() => void model.reload()}>새로고침</button><button className="secondary-button" type="button" disabled={model.busy} onClick={() => void model.logout()}>로그아웃</button></div>
      </div>
      <p className={styles.note}>자료 적용 범위: {scopes[model.target.countryCode]}. 실제 프로젝트의 업종·근무 조건은 프로젝트 날짜 예외로 확인하세요.</p>
      <div className={styles.feedback}>
        <p role="status" aria-live="polite" aria-atomic="true">{model.loadState === "loading" ? `${targetLabel} 최신 데이터를 불러오는 중…` : model.loadState === "error" ? "최신 데이터를 확인하기 전에는 변경할 수 없습니다." : snapshot ? `${targetLabel} · ${statusNames[snapshot.dataset.status]} · 날짜 ${snapshot.dates.length}개` : "선택한 국가·연도 데이터를 확인하세요."}</p>
        {model.error ? <p className={styles.error} role="alert">{model.error}</p> : null}
        {model.loadState === "error" ? <button className="secondary-button" type="button" disabled={model.busy} onClick={() => void model.reload()}>다시 조회</button> : null}
        {model.notice ? <p role="status">{model.notice}</p> : null}
        {model.comparison ? <div className={styles.comparison}><p>최신 데이터와 보존된 초안을 비교하세요. 검토 확인 전에는 저장할 수 없습니다.</p><p>서버 상태: {snapshot ? statusNames[snapshot.dataset.status] : "미확인"} · 출처 버전: {snapshot?.dataset.sourceVersion ?? "없음"} · 출처 URL: {snapshot?.dataset.sourceUrl ?? "없음"}</p><div className={styles.actions}><button className="secondary-button" disabled={model.busy || model.loadState !== "ready"} type="button" onClick={model.restoreMetadata}>서버 값으로 초안 복원</button><button className="secondary-button" disabled={model.busy || model.loadState !== "ready"} type="button" onClick={model.reviewLatest}>최신 데이터 검토 완료</button></div></div> : null}
      </div>
      <form onSubmit={(event) => { event.preventDefault(); if (!locked) void model.saveMetadata(); }}>
        <fieldset className={styles.metadata} disabled={locked}>
          <legend>국가·연도 출처 정보</legend>
          <div className={styles.field}><label htmlFor="country-calendar-status">자료 상태</label><select id="country-calendar-status" value={model.metadata.status} onChange={(event) => model.editMetadata({ ...model.metadata, status: event.target.value as typeof model.metadata.status })}><option value="OFFICIAL">공식 자료 확보</option><option value="UNAVAILABLE">미확보</option><option value="SUPERSEDED">기존 자료 대체 필요</option></select></div>
          <label className={styles.field}>출처 버전<input maxLength={200} value={model.metadata.sourceVersion} onChange={(event) => model.editMetadata({ ...model.metadata, sourceVersion: event.target.value })} /></label>
          <label className={`${styles.field} ${styles.url}`}>출처 URL<input type="url" maxLength={2048} value={model.metadata.sourceUrl} onChange={(event) => model.editMetadata({ ...model.metadata, sourceUrl: event.target.value })} /></label>
          <button className="primary-button" type="submit" disabled={locked}>{model.busy ? "저장 중…" : "출처 정보 저장"}</button>
        </fieldset>
        <p className={styles.note}>공식 자료 확보는 출처와 날짜가 있는 경우에만 확인할 수 있습니다. 날짜를 직접 변경하면 출처 확인 상태가 미확보로 바뀝니다.</p>
      </form>
      <section aria-labelledby="country-calendar-dates-title">
        <div className={styles.listHeading}><h2 id="country-calendar-dates-title" ref={listHeading} tabIndex={-1}>날짜 목록</h2><div className={styles.actions}>
          <button ref={addTrigger} className="secondary-button" type="button" disabled={locked} onClick={(event) => openDate(null, event.currentTarget)}>날짜 추가</button>
          <button ref={importTrigger} className="secondary-button" type="button" disabled={locked} onClick={() => { model.invalidateImport(); setImportOpen(true); }}>JSON/CSV 가져오기</button>
        </div></div>
        {snapshot?.dataset.status !== "OFFICIAL" && snapshot ? <p className={styles.note}>이 연도는 공식 자료가 확보되지 않았습니다. 보존된 날짜는 관리 목적으로 표시하며 새 프로젝트 국가 규칙으로 적용할 수 없습니다.</p> : null}
        <div className={styles.tableScroll} tabIndex={0} role="region" aria-label={`${targetLabel} 날짜 표`}>
          <table className={styles.table}><thead><tr><th scope="col">날짜</th><th scope="col">유형</th><th scope="col">이름</th><th scope="col">출처 키</th><th scope="col">관리</th></tr></thead><tbody>
            {(snapshot?.dates ?? []).map((date) => <tr key={date.date}><td>{date.date}</td><td>{date.dayType === "NON_WORKING" ? "휴무" : "근무 예외"}</td><td>{date.name}</td><td>{date.sourceKey}</td><td><div className={styles.actions}><button id={`country-date-edit-${date.date}`} className="secondary-button" type="button" aria-label={`${date.date} 수정`} disabled={locked} onClick={(event) => openDate(date, event.currentTarget)}>수정</button><button className="secondary-button" type="button" aria-label={`${date.date} 삭제`} disabled={locked} onClick={(event) => openDate(date, event.currentTarget, true)}>삭제</button></div></td></tr>)}
            {snapshot?.dates.length === 0 && model.loadState === "ready" ? <tr><td colSpan={5}>{snapshot.dataset.status === "OFFICIAL" ? "등록된 날짜가 없습니다." : "이 연도 자료는 미확보입니다. 날짜 등록 또는 공식 자료 가져오기로 시작하세요."}</td></tr> : null}
          </tbody></table>
        </div>
      </section>
    </section>
    {model.authenticated && dateDialog ? <WorkspaceDialog title={dateDialog.deleting ? "날짜 삭제 확인" : dateDialog.originalDate ? "국가 캘린더 날짜 수정" : "국가 캘린더 날짜 추가"} restoreFocusRef={dialogTrigger} busy={model.busy} onClose={() => { if (!model.busy) setDateDialog(null); }}>
      <form className={styles.dialogBody} onSubmit={(event) => void saveDate(event)}>
        <p>{targetLabel}</p>{model.error ? <p className={styles.error} role="alert">{model.error}</p> : null}
        {model.comparison ? <div className={styles.comparison}><p>최신 목록과 보존된 날짜 초안을 비교하세요. 서버 날짜: {snapshot?.dates.find((entry) => entry.date === dateDialog.originalDate)?.name ?? "해당 날짜 없음"}. 현재 초안: {dateDialog.draft.date} · {dateDialog.draft.name}</p><button className="secondary-button" type="button" disabled={model.busy || model.loadState !== "ready"} onClick={model.reviewLatest}>최신 데이터 검토 완료</button></div> : null}
        {dateDialog.deleting ? <p>{dateDialog.draft.date} · {dateDialog.draft.name} 날짜를 삭제하시겠습니까? 공식 출처 확인 상태도 미확보로 바뀝니다.</p> : <fieldset className={styles.dateForm} disabled={model.busy || model.comparison || model.loadState !== "ready"}>
          <legend>날짜 정보</legend>
          <label className={styles.field}>날짜<input autoFocus required type="date" min={`${model.target.year}-01-01`} max={`${model.target.year}-12-31`} value={dateDialog.draft.date} onChange={(event) => setDateDialog({ ...dateDialog, draft: { ...dateDialog.draft, date: event.target.value } })} /></label>
          <div className={styles.field}><label htmlFor="country-calendar-date-type">날짜 유형</label><select id="country-calendar-date-type" value={dateDialog.draft.dayType} onChange={(event) => setDateDialog({ ...dateDialog, draft: { ...dateDialog.draft, dayType: event.target.value as CountryCalendarAdminDateDto["dayType"] } })}><option value="NON_WORKING">휴무</option><option value="WORKING">근무 예외</option></select></div>
          <label className={styles.field}>날짜 이름<input required maxLength={200} value={dateDialog.draft.name} onChange={(event) => setDateDialog({ ...dateDialog, draft: { ...dateDialog.draft, name: event.target.value } })} /></label>
          <label className={styles.field}>출처 키<input required maxLength={120} value={dateDialog.draft.sourceKey} onChange={(event) => setDateDialog({ ...dateDialog, draft: { ...dateDialog.draft, sourceKey: event.target.value } })} /></label>
        </fieldset>}
        <div className={styles.dialogActions}><button className="secondary-button" disabled={model.busy} type="button" onClick={() => setDateDialog(null)}>취소</button><button className="primary-button" disabled={locked} type="submit">{model.busy ? "저장 중…" : dateDialog.deleting ? "날짜 삭제" : "날짜 저장"}</button></div>
      </form>
    </WorkspaceDialog> : null}
    {model.authenticated && importOpen ? <WorkspaceDialog title="국가 캘린더 JSON/CSV 가져오기" size="wide" restoreFocusRef={importTrigger} busy={model.busy} onClose={closeImport}>
      <div className={styles.dialogBody}>
        <p>{targetLabel} 날짜 전체를 원자적으로 교체합니다. 기존 프로젝트는 자동 변경되지 않습니다.</p>
        <div className={styles.fileControls}><div className={styles.field}><label htmlFor="country-calendar-file-format">파일 형식</label><select id="country-calendar-file-format" value={format} disabled={model.busy} onChange={(event) => { setFormat(event.target.value as "json" | "csv"); model.invalidateImport(); }}><option value="json">JSON</option><option value="csv">CSV</option></select></div>
          <label className={styles.field}>UTF-8 파일<input key={`${format}:${targetKey(model.target)}`} type="file" accept={format === "json" ? ".json,application/json" : ".csv,text/csv"} disabled={model.busy} onChange={(event) => void model.readFile(event.target.files?.[0], format)} /></label></div>
        <p className={styles.note}>최대 1 MiB, 날짜 1~366개. JSON에는 countryCode/year/status(OFFICIAL)/sourceVersion/sourceUrl/dates가 필요합니다. CSV header: countryCode,year,date,name,dayType,sourceKey,sourceVersion,sourceUrl.</p>
        <p role="status">{model.fileReading ? "파일을 읽는 중…" : model.fileName || "파일을 선택하세요."}</p>
        {model.error ? <p className={styles.error} role="alert">{model.error}</p> : null}
        <button className="secondary-button" type="button" disabled={locked || !model.envelope || model.fileReading} onClick={() => void model.calculatePreview()}>{model.busy ? "확인 중…" : "가져오기 미리보기"}</button>
        {model.preview ? <section aria-label="가져오기 미리보기 결과"><h3>전체 교체 미리보기</h3><dl className={styles.counts}>{Object.entries({ 추가: model.preview.data.summary.additions, 변경: model.preview.data.summary.changes, 삭제: model.preview.data.summary.deletions, 동일: model.preview.data.summary.unchanged }).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl><p>기준 revision: {model.preview.data.revision} · 출처 정보 변경: {model.preview.data.summary.metadataChanged ? "있음" : "없음"}</p><p>출처 버전: {model.preview.data.importDataset.sourceVersion} · 날짜 {model.preview.data.importDataset.dateCount}개</p><p className={styles.urlText}>출처 URL: {model.preview.data.importDataset.sourceUrl}</p>
          {model.previewExpired ? <p role="alert">미리보기가 만료되었습니다. 다시 확인하세요.</p> : <label className={styles.confirm}><input type="checkbox" checked={confirmed} disabled={model.busy} onChange={(event) => setConfirmedPreview(event.target.checked ? model.preview : null)} />삭제 {model.preview.data.summary.deletions}개를 포함한 전체 교체와 공식 출처를 확인했습니다.</label>}
        </section> : null}
        <div className={styles.dialogActions}><button className="secondary-button" type="button" disabled={model.busy} onClick={closeImport}>취소</button><button className="primary-button" type="button" disabled={locked || !confirmed || !model.preview || model.previewExpired} onClick={() => void model.applyImport().then((saved) => { if (saved) setImportOpen(false); })}>{model.busy ? "적용 중…" : "확인한 자료 적용"}</button></div>
      </div>
    </WorkspaceDialog> : null}
    {switchTarget ? <WorkspaceDialog title="작성 중인 초안 버리기" restoreFocusRef={switchTrigger} onClose={() => setSwitchTarget(null)}><div className={styles.dialogBody}><p>국가·연도를 바꾸면 현재 초안과 가져오기 미리보기를 버립니다.</p><div className={styles.dialogActions}><button className="secondary-button" type="button" onClick={() => setSwitchTarget(null)}>계속 작성</button><button className="primary-button" type="button" onClick={() => { model.selectTarget(switchTarget); setDateDialog(null); setImportOpen(false); setSwitchTarget(null); }}>초안 버리고 이동</button></div></div></WorkspaceDialog> : null}
  </div>;
}
