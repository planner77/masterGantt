"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: Readonly<{
  error: Error & { digest?: string };
  reset: () => void;
}>) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <section className="status-page" aria-labelledby="error-heading">
      <p className="eyebrow">문제가 발생했습니다</p>
      <h1 id="error-heading">화면을 불러오지 못했습니다.</h1>
      <p>잠시 후 다시 시도해 주세요.</p>
      <button className="secondary-button" type="button" onClick={reset}>
        다시 시도
      </button>
    </section>
  );
}
