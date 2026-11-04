"use client";

import { useI18n } from "@/lib/i18n/provider";
import { LocaleSelector } from "@/lib/i18n/locale-selector";
import type { ReactNode } from "react";
import Link from "next/link";
import { WorkspaceNavigation } from "@/components/workspace-navigation";
import appPackage from "../../package.json";

export function WorkspaceShell({ children }: Readonly<{ children: ReactNode }>) {
  const { t } = useI18n();
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">{t("본문으로 바로가기")}</a>
      <header className="site-header">
        <div className="header-content">
          <div className="brand-identity">
            <Link className="brand" href="/" aria-label={t("masterGantt 홈")}>
              <span className="brand-mark" aria-hidden="true">
                M
              </span>
              <span className="brand-name">masterGantt</span>
            </Link>
            <span className="brand-version">v{appPackage.version}</span>
          </div>
          <WorkspaceNavigation />
          <div className="header-actions">
            <LocaleSelector className="header-locale-selector" />
            <div id="workspace-notification-slot" className="header-notification-slot" />
          </div>
        </div>
      </header>
      <main className="main-content" id="main-content" tabIndex={-1}>{children}</main>
    </div>
  );
}
