"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";

import { CreateProjectForm } from "@/features/projects/create-project-form";
import { CreateFromTemplateForm } from "@/features/templates/create-from-template-form";

export function NewProjectTabs() {
  const searchParams = useSearchParams();
  const initialMode = searchParams.get("mode") === "template" ? "template" : "blank";
  const [mode, setMode] = useState<"blank" | "template">(initialMode);

  return (
    <div className="new-project-container">
      <div className="project-workspace-tabs" role="tablist" aria-label="프로젝트 생성 방식">
        <button
          type="button"
          role="tab"
          id="tab-blank"
          aria-selected={mode === "blank"}
          aria-controls="panel-blank"
          tabIndex={mode === "blank" ? 0 : -1}
          className={`tab-button ${mode === "blank" ? "active" : ""}`}
          onClick={() => setMode("blank")}
        >
          빈 프로젝트 만들기
        </button>
        <button
          type="button"
          role="tab"
          id="tab-template"
          aria-selected={mode === "template"}
          aria-controls="panel-template"
          tabIndex={mode === "template" ? 0 : -1}
          className={`tab-button ${mode === "template" ? "active" : ""}`}
          onClick={() => setMode("template")}
        >
          템플릿에서 만들기
        </button>
      </div>

      <div
        id="panel-blank"
        role="tabpanel"
        aria-labelledby="tab-blank"
        hidden={mode !== "blank"}
      >
        {mode === "blank" && <CreateProjectForm />}
      </div>

      <div
        id="panel-template"
        role="tabpanel"
        aria-labelledby="tab-template"
        hidden={mode !== "template"}
      >
        {mode === "template" && <CreateFromTemplateForm />}
      </div>
    </div>
  );
}
