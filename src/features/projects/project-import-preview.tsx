"use client";

import { useI18n } from "../../lib/i18n/provider";

import type { ProjectImportPreviewDto, ImportPreviewScheduleDto } from "@/contracts/project-import";
import { IdentifierDetails } from "../../components/identifier-details";
import styles from "./project-import-preview.module.css";
function scheduleLabel(s: ImportPreviewScheduleDto, t: (key: string) => string): string { return `${t("요청")} ${s.requestedStart ?? "—"} · ${t("일정")} ${s.start ?? "—"}~${s.end ?? "—"} · ${s.duration ?? "—"}${t("일")} · ${t("진척")} ${s.progress ?? "—"}% · ${t("상태")} ${s.status ?? "—"} · Baseline ${s.baselineStart ?? "—"}~${s.baselineEnd ?? "—"} / ${s.baselineDuration ?? "—"}${t("일")}`; }
const IMPORT_WARNING_LABELS: Readonly<Record<string, string>> = {
  SOURCE_SCHEDULE_UNAVAILABLE: "원본 캘린더 일정을 복원할 수 없어 입력값으로 비교합니다.",
  SOURCE_CALENDAR_IGNORED: "대상 프로젝트 캘린더로 일정과 Baseline 종료일을 계산합니다.",
  EMPTY_IMPORT: "파일에 작업이 없어 저장할 수 없습니다.",
  SOURCE_BASELINE_UNAVAILABLE: "원본 Baseline 종료일을 계산할 수 없어 대상 캘린더를 적용합니다.",
  SCHEDULE_RECALCULATED: "캘린더 또는 관계에 따라 일정이 재계산되었습니다.",
};
export function ProjectImportPreview({ preview }: Readonly<{ preview: ProjectImportPreviewDto }>) {
  const { t } = useI18n();
  const names = new Map(preview.normalizedTasks.map((task) => [task.externalId, task.name]));
  const identity = (id: string | null) => id ? <>{names.get(id) || t("이름 확인 불가")}<IdentifierDetails identifiers={[{ label: t("외부 ID"), value: id }]} /></> : "미지정";
  return <div className={styles.preview}>
    <p>JSON {preview.schemaVersion} {t(" · 원본 ")}{preview.sourceProject.name} {t(" · 대상 revision ")}{preview.baseRevision}</p>
    <p>{t("추가 Task ")}{preview.summary.taskCreates}{t("개 · 일정 Dependency ")}{preview.summary.linkCreates}{t("개 · 명시 Milestone 소속 ")}{preview.summary.explicitMembershipCreates}{t("개")}</p>
    <p>{t("기존 작업·연결·소속을 수정하거나 삭제하지 않습니다. 원본 작업 ID는 참고 정보이며 대상 Task UUID는 새로 생성합니다. Resource·Logistics는 이 JSON 가져오기에 포함하지 않습니다.")}</p>
    <p>{t("대상 Calendar ")}{preview.targetCalendar.timezone} {t(" · 휴일 ")}{preview.targetCalendar.holidays.length}{t("개를 적용합니다. 원본 metadata가 대상 Project 설정을 바꾸지 않습니다.")}</p>
    <details><summary>{t("검증 파일 digest 확인")}</summary><p className={styles.code}>{preview.previewDigest}</p></details>
    {preview.warnings.length ? <section aria-label={t("가져오기 경고")}><h3>{t("경고 ")}{preview.warnings.length}{t("개")}</h3><ul>{preview.warnings.map((w,i) => <li key={`${w.path}:${w.code}:${i}`}>{t(IMPORT_WARNING_LABELS[w.code] ?? "가져오기 경고")}<small>{w.externalId ? t("외부 ID: {value0} · ", { value0: w.externalId }) : ""}{w.path} · {w.code}</small></li>)}</ul></section> : null}
    {!preview.canCommit ? <p role="alert">{t("추가할 작업이 없어 저장할 수 없습니다. 파일을 다시 선택해 주세요.")}</p> : null}
    <details open><summary>{t("추가 작업과 유효 Milestone · ")}{preview.normalizedTasks.length}{t("개")}</summary>
      <div className={styles.tableOwner} role="region" aria-label={t("가져오기 작업 미리보기 가로 스크롤")} tabIndex={0}><table><colgroup><col /><col style={{width:88}} /><col style={{width:176}} /><col style={{width:176}} /><col style={{width:160}} /><col style={{width:140}} /></colgroup><thead><tr><th scope="col">{t("작업")}</th><th scope="col">{t("유형")}</th><th scope="col">{t("명시 Milestone")}</th><th scope="col">{t("유효 Milestone")}</th><th scope="col">{t("상속 출처")}</th><th scope="col">{t("대상 일정")}</th></tr></thead><tbody>{preview.normalizedTasks.map((task) => <tr key={task.externalId}><td>{task.name || t("이름 확인 불가")}<IdentifierDetails identifiers={[{ label: t("외부 ID"), value: task.externalId }, ...(task.sourceTaskId ? [{ label: t("참고 원본 작업 ID"), value: task.sourceTaskId }] : [])]} /></td><td>{task.type}</td><td>{identity(task.membership.explicitMilestoneExternalId)}</td><td>{identity(task.membership.effectiveMilestoneExternalId)}</td><td>{task.membership.inheritedFromExternalId ? identity(task.membership.inheritedFromExternalId) : t("직접 지정 또는 미지정")}</td><td title={scheduleLabel(task, t)}>{task.start ?? "—"}<br />{task.end ?? "—"}<small>{task.duration ?? "—"}{t("일 · ")}{task.progress ?? "—"}%</small></td></tr>)}</tbody></table></div>
    </details>
    {preview.changedTasks.length ? <details><summary>{t("대상 Calendar·관계에 따른 일정 차이 · ")}{preview.changedTasks.length}{t("개")}</summary><div className={styles.tableOwner} role="region" aria-label={t("가져오기 일정 차이 가로 스크롤")} tabIndex={0}><table className={styles.changes}><colgroup><col /><col style={{width:280}} /><col style={{width:280}} /><col style={{width:200}} /></colgroup><thead><tr><th scope="col">{t("작업")}</th><th scope="col">{t("원본 입력")}</th><th scope="col">{t("대상 일정")}</th><th scope="col">{t("이유")}</th></tr></thead><tbody>{preview.changedTasks.map((c) => <tr key={c.externalId}><td>{identity(c.externalId)}</td><td>{scheduleLabel(c.before, t)}</td><td>{scheduleLabel(c.after, t)}</td><td>{c.reasonCodes.join(" · ")}</td></tr>)}</tbody></table></div></details> : null}
  </div>;
}
