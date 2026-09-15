import type { Metadata } from "next";

import { ResourceCatalogAdmin } from "@/features/resources/resource-catalog-admin";

export const metadata: Metadata = {
  title: "리소스 관리",
};

export default function ResourcesPage() {
  return (
    <section className="workspace-section">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Global catalog</p>
          <h1>리소스 관리</h1>
          <p>프로젝트와 독립적인 리소스와 리소스 그룹을 관리합니다.</p>
        </div>
      </div>
      <ResourceCatalogAdmin />
    </section>
  );
}
