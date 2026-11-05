"use client";

import { useI18n } from "../lib/i18n/provider";
export default function Loading() {
  const { t } = useI18n();
  return (
    <section className="loading-state" aria-live="polite" aria-busy="true">
      <span className="loading-indicator" aria-hidden="true" />
      <p>{t("프로젝트 정보를 불러오는 중입니다.")}</p>
    </section>
  );
}
