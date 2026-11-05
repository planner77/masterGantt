"use client";

import { useI18n } from "../lib/i18n/provider";


import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: Readonly<{
  error: Error & { digest?: string };
  reset: () => void;
}>) {
  const { t } = useI18n();
  useEffect(() => {
    console.error(error);
    document.title = "masterGantt";
  }, [error]);

  return (
    <section className="status-page" aria-labelledby="error-heading">
      <p className="eyebrow">{t("문제가 발생했습니다")}</p>
      <h1 id="error-heading">{t("화면을 불러오지 못했습니다.")}</h1>
      <p>{t("잠시 후 다시 시도해 주세요.")}</p>
      <div className="standalone-actions">
        <button className="secondary-button" type="button" onClick={reset}>
          {t("다시 시도")}</button>
      </div>
    </section>
  );
}
