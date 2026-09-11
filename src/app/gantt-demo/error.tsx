"use client";

export default function GanttDemoError({ reset }: Readonly<{ reset: () => void }>) {
  return (
    <section className="status-page" aria-labelledby="gantt-error-heading">
      <p className="eyebrow">GANTT DEMO</p>
      <h1 id="gantt-error-heading">Gantt를 표시할 수 없습니다</h1>
      <p>브라우저에서 Gantt 구성 요소를 다시 불러와 보세요.</p>
      <button className="secondary-button" onClick={reset} type="button">다시 시도</button>
    </section>
  );
}
