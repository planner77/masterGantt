import type { ReactNode } from "react";
import Link from "next/link";
import { WorkspaceNavigation } from "@/components/workspace-navigation";

export function WorkspaceShell({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">본문으로 바로가기</a>
      <header className="site-header">
        <div className="header-content">
          <Link className="brand" href="/" aria-label="masterGantt 홈">
            <span className="brand-mark" aria-hidden="true">
              M
            </span>
            <span className="brand-name">masterGantt</span>
          </Link>
          <WorkspaceNavigation />
          <div id="workspace-notification-slot" className="header-actions" />
        </div>
      </header>
      <main className="main-content" id="main-content" tabIndex={-1}>{children}</main>
    </div>
  );
}
