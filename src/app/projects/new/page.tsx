import { CreateProjectForm } from "@/features/projects/create-project-form";

export default function NewProjectPage() {
  return (
    <section className="page-section" aria-labelledby="new-project-heading">
      <div className="page-heading">
        <p className="eyebrow">NEW PROJECT</p>
        <h1 id="new-project-heading">프로젝트 만들기</h1>
        <p className="page-description">프로젝트를 만든 뒤에는 공유 가능한 읽기 전용 주소로 이동합니다.</p>
      </div>
      <CreateProjectForm />
    </section>
  );
}
