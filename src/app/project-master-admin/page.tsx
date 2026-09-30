import { ProjectMasterAdmin } from "@/features/project-master/project-master-admin";

export default function ProjectMasterAdminPage() {
  return (
    <section className="workspace-section project-master-admin-page">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Global master data</p>
          <h1>프로젝트 기준정보 관리</h1>
          <p>사업부, 제품, 사업장/법인을 전 프로젝트 공통 기준정보로 관리합니다.</p>
        </div>
      </div>
      <ProjectMasterAdmin />
    </section>
  );
}
