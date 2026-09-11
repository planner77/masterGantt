import type { ReactNode } from "react";
import Link from "next/link";

export function WorkspaceShell({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="header-content">
          <Link className="brand" href="/" aria-label="masterGantt 홈">
            <span className="brand-mark" aria-hidden="true">
              M
            </span>
            <span>masterGantt</span>
          </Link>
          <nav aria-label="주요 메뉴">
            <Link className="nav-link" href="/" aria-current="page">
              프로젝트
            </Link>
          </nav>
        </div>
      </header>
      <main className="main-content">{children}</main>
    </div>
  );
}
