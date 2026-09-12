import Link from "next/link";

export function EmptyProjects() {
  return (
    <div className="empty-state">
      <div className="empty-state-mark" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <h2>아직 프로젝트가 없습니다.</h2>
      <p>새 프로젝트를 만들면 이 목록에서 일정 현황을 바로 확인할 수 있습니다.</p>
      <Link className="secondary-button" href="/projects/new">
        프로젝트 만들기
      </Link>
    </div>
  );
}
