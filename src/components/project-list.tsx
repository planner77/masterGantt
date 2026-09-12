import Link from "next/link";

import { EmptyProjects } from "@/components/empty-projects";
import type { ProjectListItemDto } from "@/contracts/projects";

function formatProjectDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "날짜 정보 없음";

  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

export function ProjectList({
  projects,
}: Readonly<{ projects: readonly ProjectListItemDto[] }>) {
  if (projects.length === 0) return <EmptyProjects />;

  return (
    <div className="project-list" aria-label="프로젝트 목록">
      <p className="project-list-count">
        <strong>{projects.length}</strong>개의 프로젝트
      </p>
      <ul className="project-list-grid">
        {projects.map((project) => (
          <li key={project.publicId}>
            <Link
              className="project-list-card"
              href={`/projects/${encodeURIComponent(project.publicId)}`}
            >
              <span className="project-list-card-main">
                <span className="project-list-card-title">{project.name}</span>
                <span className="project-list-card-description">
                  {project.description || "설명이 없습니다."}
                </span>
              </span>
              <span className="project-list-card-meta">
                <span>최근 변경 {formatProjectDate(project.updatedAt)}</span>
                <span aria-hidden="true">열기 →</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
