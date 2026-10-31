import Link from "next/link";
import helpStyles from "@/components/ui/context-help.module.css";
import { ContextHelp } from "@/components/ui/context-help";
import { ProjectMasterAdmin } from "@/features/project-master/project-master-admin";

export default function ProjectMasterAdminPage() {
  return (
    <section className="workspace-section admin-page project-master-admin-page">
      <div className={`section-heading ${helpStyles.heading}`}>
        <div>
          <p className="eyebrow">Global master data</p>
          <h1>프로젝트 기준정보 관리</h1>
          <p>전 프로젝트 공통 기준정보</p>
        </div>
        <ContextHelp label="프로젝트 기준정보 관리 도움말">사업부, 제품, 사업장/법인을 전 프로젝트 공통 기준정보로 관리합니다.</ContextHelp>
      </div>
      <div><Link className="secondary-button" href="/country-calendar-admin">국가 캘린더 관리</Link></div>
      <ProjectMasterAdmin />
    </section>
  );
}
