import helpStyles from "@/components/ui/context-help.module.css";
import { ContextHelp } from "@/components/ui/context-help";
import { LogisticsTypeCatalogAdmin } from "@/features/logistics/logistics-type-catalog-admin";

export default function LogisticsAdminPage() {
  return (
    <section className="workspace-section admin-page">
      <div className={`section-heading ${helpStyles.heading}`}>
        <div>
          <p className="eyebrow">Global catalog</p>
          <h1>물류 유형 관리</h1>
          <p>전 프로젝트 공통 유형</p>
        </div>
        <ContextHelp label="물류 유형 관리 도움말">설비 유형과 시스템 유형을 전 프로젝트 공통 기준정보로 관리합니다.</ContextHelp>
      </div>
      <LogisticsTypeCatalogAdmin />
    </section>
  );
}
