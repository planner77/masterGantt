"use client";

import { useI18n } from "../lib/i18n/provider";


import Link from "next/link";
import { usePathname } from "next/navigation";

export function WorkspaceNavigation() {
  const { t } = useI18n();
  const pathname = usePathname();
  const projectActive = pathname === "/" || pathname.startsWith("/projects");
  const resourceActive = pathname.startsWith("/resources");
  const logisticsAdminActive = pathname.startsWith("/logistics-admin");
  const projectMasterActive = pathname.startsWith("/project-master-admin") || pathname.startsWith("/country-calendar-admin");

  return (
    <nav aria-label={t("주요 메뉴")}>
      <Link className="nav-link" href="/" aria-current={projectActive ? "page" : undefined}>
        {t("프로젝트")}</Link>
      <Link className="nav-link" href="/resources" aria-current={resourceActive ? "page" : undefined}>
        {t("리소스")}</Link>
      <Link className="nav-link" href="/logistics-admin" aria-label={t("물류 관리")} aria-current={logisticsAdminActive ? "page" : undefined}>
        {t("물류")}</Link>
      <Link className="nav-link" href="/project-master-admin" aria-label={t("프로젝트 기준정보")} aria-current={projectMasterActive ? "page" : undefined}>
        {t("기준정보")}</Link>
    </nav>
  );
}
