"use client";

import { useI18n } from "../../lib/i18n/provider";


export default function GanttDemoError({ reset }: Readonly<{ reset: () => void }>) {
  const { t } = useI18n();
  return (
    <section className="status-page" aria-labelledby="gantt-error-heading">
      <p className="eyebrow">GANTT DEMO</p>
      <h1 id="gantt-error-heading">{t("Gantt를 표시할 수 없습니다")}</h1>
      <p>{t("브라우저에서 Gantt 구성 요소를 다시 불러와 보세요.")}</p>
      <div className="standalone-actions">
        <button className="secondary-button" onClick={reset} type="button">{t("다시 시도")}</button>
      </div>
    </section>
  );
}
