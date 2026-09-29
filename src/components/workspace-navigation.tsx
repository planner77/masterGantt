"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function WorkspaceNavigation() {
  const pathname = usePathname();
  const projectActive = pathname === "/" || pathname.startsWith("/projects");
  const resourceActive = pathname.startsWith("/resources");
  const projectMasterActive = pathname.startsWith("/project-master-admin");

  return (
    <nav aria-label="주요 메뉴">
      <Link className="nav-link" href="/" aria-current={projectActive ? "page" : undefined}>
        프로젝트
      </Link>
      <Link className="nav-link" href="/resources" aria-current={resourceActive ? "page" : undefined}>
        리소스
      </Link>
      <Link className="nav-link" href="/project-master-admin" aria-current={projectMasterActive ? "page" : undefined}>
        프로젝트 기준정보
      </Link>
    </nav>
  );
}
