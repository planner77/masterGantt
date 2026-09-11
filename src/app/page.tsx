import { EmptyProjects } from "@/components/empty-projects";

export default function HomePage() {
  return (
    <section className="page-section" aria-labelledby="projects-heading">
      <div className="page-heading">
        <p className="eyebrow">WORKSPACE</p>
        <h1 id="projects-heading">프로젝트</h1>
        <p className="page-description">
          프로젝트별 일정과 진행 상황을 한곳에서 확인합니다.
        </p>
      </div>
      <EmptyProjects />
    </section>
  );
}
