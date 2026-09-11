export default function Loading() {
  return (
    <section className="loading-state" aria-live="polite" aria-busy="true">
      <span className="loading-indicator" aria-hidden="true" />
      <p>프로젝트 정보를 불러오는 중입니다.</p>
    </section>
  );
}
