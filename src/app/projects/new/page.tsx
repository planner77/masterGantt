import { Suspense } from "react";
import { NewProjectTabs } from "@/features/projects/new-project-tabs";

export default function NewProjectPage() {
  return (
    <section className="page-section" aria-labelledby="new-project-heading">
      <div className="page-heading">
        <p className="eyebrow">NEW PROJECT</p>
        <h1 id="new-project-heading">프로젝트 만들기</h1>
        <p className="page-description">
          빈 프로젝트를 만들거나, 기존 템플릿을 기반으로 자동 재계산된 일정을 생성할 수 있습니다.
        </p>
      </div>
      <Suspense fallback={<div className="card-empty-state">불러오는 중…</div>}>
        <NewProjectTabs />
      </Suspense>
    </section>
  );
}
