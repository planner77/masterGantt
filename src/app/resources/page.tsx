import { LocalizedText } from "@/components/localized-text";
import helpStyles from "@/components/ui/context-help.module.css";
import { ContextHelp } from "@/components/ui/context-help";
import { ResourceCatalogAdmin } from "@/features/resources/resource-catalog-admin";

export default function ResourcesPage() {
  return (
    <section className="workspace-section admin-page resources-page">
      <div className={`section-heading ${helpStyles.heading}`}>
        <div>
          <p className="eyebrow"><LocalizedText text="전역 카탈로그" /></p>
          <h1><LocalizedText text="리소스 관리" /></h1>
        </div>
        <ContextHelp label="리소스 관리 도움말"><p><LocalizedText text="프로젝트와 독립적인 리소스와 리소스 그룹을 관리합니다." /></p></ContextHelp>
      </div>
      <ResourceCatalogAdmin />
    </section>
  );
}
