"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function WorkspaceNavigation() {
  const pathname = usePathname();
  const projectActive = pathname === "/" || pathname.startsWith("/projects");
  const resourceActive = pathname.startsWith("/resources");

  return (
    <nav aria-label="주요 메뉴">
      <Link className="nav-link" href="/" aria-current={projectActive ? "page" : undefined}>
        프로젝트
      </Link>
      <Link className="nav-link" href="/resources" aria-current={resourceActive ? "page" : undefined}>
        리소스
      </Link>
    </nav>
  );
}
