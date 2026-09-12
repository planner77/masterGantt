import Link from "next/link";

import { ProjectList } from "@/components/project-list";
import { getProjectService } from "@/server/projects/project-service";

export const dynamic = "force-dynamic";

export default function HomePage() {
  const projects = getProjectService().listProjects().data.projects;

  return (
    <section className="page-section" aria-labelledby="projects-heading">
      <div className="project-list-heading">
        <div className="page-heading">
          <p className="eyebrow">WORKSPACE</p>
          <h1 id="projects-heading">프로젝트</h1>
          <p className="page-description">
            프로젝트별 일정과 진행 상황을 한곳에서 확인합니다.
          </p>
        </div>
        <Link className="primary-button project-list-create" href="/projects/new">
          프로젝트 만들기
        </Link>
      </div>
      <ProjectList projects={projects} />
    </section>
  );
}
