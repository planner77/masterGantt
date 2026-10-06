"use client";
import type { ProjectImportPreviewDto, ImportPreviewScheduleDto } from "@/contracts/project-import";
import styles from "./project-import-preview.module.css";
function scheduleLabel(s: ImportPreviewScheduleDto): string { return `요청 ${s.requestedStart ?? "—"} · 일정 ${s.start ?? "—"}~${s.end ?? "—"} · ${s.duration ?? "—"}일 · 진척 ${s.progress ?? "—"}% · 상태 ${s.status ?? "—"} · Baseline ${s.baselineStart ?? "—"}~${s.baselineEnd ?? "—"} / ${s.baselineDuration ?? "—"}일`; }
export function ProjectImportPreview({ preview }: Readonly<{ preview: ProjectImportPreviewDto }>) {
  const names = new Map(preview.normalizedTasks.map((task) => [task.externalId, task.name]));
  const identity = (id: string | null) => id ? `${names.get(id) ?? "이름 확인 불가"} · 외부 ID: ${id}` : "미지정";
  return <div className={styles.preview}>
    <p>JSON {preview.schemaVersion} · 원본 {preview.sourceProject.name} · 대상 revision {preview.baseRevision}</p>
    <p>추가 Task {preview.summary.taskCreates}개 · 일정 Dependency {preview.summary.linkCreates}개 · 명시 단계 소속 {preview.summary.explicitMembershipCreates}개</p>
    <p>기존 작업·연결·소속을 수정하거나 삭제하지 않습니다. 원본 작업 ID는 참고 정보이며 대상 Task UUID는 새로 생성합니다. Resource·Logistics는 이 JSON 가져오기에 포함하지 않습니다.</p>
    <p>대상 Calendar {preview.targetCalendar.timezone} · 휴일 {preview.targetCalendar.holidays.length}개를 적용합니다. 원본 metadata가 대상 Project 설정을 바꾸지 않습니다.</p>
    <details><summary>검증 파일 digest 확인</summary><p className={styles.code}>{preview.previewDigest}</p></details>
    {preview.warnings.length ? <section aria-label="가져오기 경고"><h3>경고 {preview.warnings.length}개</h3><ul>{preview.warnings.map((w,i) => <li key={`${w.path}:${w.code}:${i}`}>{w.message}<small>{w.externalId ? `외부 ID: ${w.externalId} · ` : ""}{w.path} · {w.code}</small></li>)}</ul></section> : null}
    {!preview.canCommit ? <p role="alert">추가할 작업이 없어 저장할 수 없습니다. 파일을 다시 선택해 주세요.</p> : null}
    <details open><summary>추가 작업과 유효 단계 · {preview.normalizedTasks.length}개</summary>
      <div className={styles.tableOwner} role="region" aria-label="가져오기 작업 미리보기 가로 스크롤" tabIndex={0}><table><colgroup><col /><col style={{width:88}} /><col style={{width:176}} /><col style={{width:176}} /><col style={{width:160}} /><col style={{width:140}} /></colgroup><thead><tr><th scope="col">작업 · 외부 ID</th><th scope="col">유형</th><th scope="col">명시 단계</th><th scope="col">유효 단계</th><th scope="col">상속 출처</th><th scope="col">대상 일정</th></tr></thead><tbody>{preview.normalizedTasks.map((t) => <tr key={t.externalId}><td>{t.name}<small>외부 ID: {t.externalId}</small>{t.sourceTaskId ? <small>참고 원본 작업 ID: {t.sourceTaskId}</small> : null}</td><td>{t.type}</td><td>{identity(t.membership.explicitMilestoneExternalId)}</td><td>{identity(t.membership.effectiveMilestoneExternalId)}</td><td>{t.membership.inheritedFromExternalId ? identity(t.membership.inheritedFromExternalId) : "직접 지정 또는 미지정"}</td><td title={scheduleLabel(t)}>{t.start ?? "—"}<br />{t.end ?? "—"}<small>{t.duration ?? "—"}일 · {t.progress ?? "—"}%</small></td></tr>)}</tbody></table></div>
    </details>
    {preview.changedTasks.length ? <details><summary>대상 Calendar·관계에 따른 일정 차이 · {preview.changedTasks.length}개</summary><div className={styles.tableOwner} role="region" aria-label="가져오기 일정 차이 가로 스크롤" tabIndex={0}><table className={styles.changes}><colgroup><col /><col style={{width:280}} /><col style={{width:280}} /><col style={{width:200}} /></colgroup><thead><tr><th scope="col">작업</th><th scope="col">원본 입력</th><th scope="col">대상 일정</th><th scope="col">이유</th></tr></thead><tbody>{preview.changedTasks.map((c) => <tr key={c.externalId}><td>{identity(c.externalId)}</td><td>{scheduleLabel(c.before)}</td><td>{scheduleLabel(c.after)}</td><td>{c.reasonCodes.join(" · ")}</td></tr>)}</tbody></table></div></details> : null}
  </div>;
}
