import Link from "next/link";

export function EmptyProjects() {
  return (
    <div className="empty-state">
      <div className="empty-state-mark" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <h2>프로젝트 목록은 아직 표시하지 않습니다.</h2>
      <p>공유받은 직접 주소로 접근하거나 새 프로젝트를 만들어 시작하세요.</p>
      <Link className="secondary-button" href="/projects/new">
        프로젝트 만들기
      </Link>
    </div>
  );
}
