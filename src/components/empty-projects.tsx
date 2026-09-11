export function EmptyProjects() {
  return (
    <div className="empty-state" role="status">
      <div className="empty-state-mark" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <h2>등록된 프로젝트가 없습니다.</h2>
      <p>프로젝트가 등록되면 일정과 진행 상황을 이곳에서 확인할 수 있습니다.</p>
    </div>
  );
}
