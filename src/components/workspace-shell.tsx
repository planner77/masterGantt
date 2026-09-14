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
            <span className="brand-name">masterGantt</span>
          </Link>
          <nav aria-label="주요 메뉴">
            <Link className="nav-link" href="/">
              프로젝트
            </Link>
          </nav>
          <div id="workspace-notification-slot" className="header-actions" />
        </div>
      </header>
      <main className="main-content">{children}</main>
    </div>
  );
}
