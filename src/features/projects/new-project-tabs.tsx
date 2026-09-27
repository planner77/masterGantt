"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import { useSearchParams } from "next/navigation";

import { CreateProjectForm } from "@/features/projects/create-project-form";
import { CreateFromTemplateForm } from "@/features/templates/create-from-template-form";

export function NewProjectTabs() {
  const searchParams = useSearchParams();
  const initialMode = searchParams.get("mode") === "template" ? "template" : "blank";
  const [mode, setMode] = useState<"blank" | "template">(initialMode);
  const blankTabRef = useRef<HTMLButtonElement | null>(null);
  const templateTabRef = useRef<HTMLButtonElement | null>(null);

  function selectTab(nextMode: "blank" | "template") {
    setMode(nextMode);
    const target = nextMode === "blank" ? blankTabRef.current : templateTabRef.current;
    target?.focus();
  }

  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      selectTab(mode === "blank" ? "template" : "blank");
      return;
    }
    if (event.key === "Home") {
      event.preventDefault();
      selectTab("blank");
      return;
    }
    if (event.key === "End") {
      event.preventDefault();
      selectTab("template");
    }
  }

  return (
    <div className="new-project-container">
      <div className="project-workspace-tabs" role="tablist" aria-label="프로젝트 생성 방식">
        <button
          ref={blankTabRef}
          type="button"
          role="tab"
          id="tab-blank"
          aria-selected={mode === "blank"}
          aria-controls="panel-blank"
          tabIndex={mode === "blank" ? 0 : -1}
          className={`tab-button ${mode === "blank" ? "active" : ""}`}
          onClick={() => setMode("blank")}
          onKeyDown={handleTabKeyDown}
        >
          빈 프로젝트 만들기
        </button>
        <button
          ref={templateTabRef}
          type="button"
          role="tab"
          id="tab-template"
          aria-selected={mode === "template"}
          aria-controls="panel-template"
          tabIndex={mode === "template" ? 0 : -1}
          className={`tab-button ${mode === "template" ? "active" : ""}`}
          onClick={() => setMode("template")}
          onKeyDown={handleTabKeyDown}
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
