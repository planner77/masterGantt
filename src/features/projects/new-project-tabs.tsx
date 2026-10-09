"use client";

import { useEffect, useRef, useState, type FocusEvent, type KeyboardEvent } from "react";
import { useSearchParams } from "next/navigation";

import { CreateProjectForm } from "@/features/projects/create-project-form";
import { CreateFromTemplateForm } from "@/features/templates/create-from-template-form";

export function NewProjectTabs() {
  const searchParams = useSearchParams();
  const initialMode = searchParams.get("mode") === "template" ? "template" : "blank";
  const [mode, setMode] = useState<"blank" | "template">(initialMode);
  const [visited, setVisited] = useState({ blank: initialMode === "blank", template: initialMode === "template" });
  const [pending, setPending] = useState(false);
  const pendingRef = useRef(false);
  const [skipNavigationActive, setSkipNavigationActive] = useState(false);
  const skipNavigationActiveRef = useRef(false);
  const [skipLinkReady, setSkipLinkReady] = useState(false);
  const blankTabRef = useRef<HTMLButtonElement | null>(null);
  const templateTabRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const skipLink = document.querySelector<HTMLAnchorElement>('a.skip-link[href="#main-content"]');
    if (!skipLink) return;

    const handleSkipNavigation = () => {
      skipNavigationActiveRef.current = true;
      // The native anchor focuses main immediately. Update the browser tab order
      // before the next keypress; React's state commit can occur afterward.
      blankTabRef.current?.setAttribute("tabindex", "-1");
      templateTabRef.current?.setAttribute("tabindex", "-1");
      setSkipNavigationActive(true);
    };
    skipLink.addEventListener("click", handleSkipNavigation);
    setSkipLinkReady(true);
    return () => skipLink.removeEventListener("click", handleSkipNavigation);
  }, []);

  function handleContainerFocus(event: FocusEvent<HTMLDivElement>) {
    if (!skipNavigationActiveRef.current || !(event.target instanceof HTMLElement)) return;
    const activePanel = event.target.closest<HTMLElement>('[role="tabpanel"]');
    if (activePanel?.id === `panel-${mode}`) {
      skipNavigationActiveRef.current = false;
      // Restore the selected tab's roving focus after entering the active panel.
      (mode === "blank" ? blankTabRef.current : templateTabRef.current)?.setAttribute("tabindex", "0");
      setSkipNavigationActive(false);
    }
  }

  function selectTab(nextMode: "blank" | "template") {
    if (pendingRef.current) return;
    setVisited((current) => ({ ...current, [nextMode]: true }));
    setMode(nextMode);
    const target = nextMode === "blank" ? blankTabRef.current : templateTabRef.current;
    target?.focus();
  }

  function beginSubmission(): boolean {
    if (pendingRef.current) return false;
    pendingRef.current = true;
    setPending(true);
    return true;
  }
  function endSubmission() {
    pendingRef.current = false;
    setPending(false);
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
    <div className="new-project-container" data-skip-link-ready={skipLinkReady} onFocusCapture={handleContainerFocus}>
      <div className="project-workspace-tabs" role="tablist" aria-label="프로젝트 생성 방식">
        <button
          ref={blankTabRef}
          type="button"
          role="tab"
          id="tab-blank"
          aria-selected={mode === "blank"}
          aria-controls="panel-blank"
          tabIndex={!skipNavigationActive && mode === "blank" ? 0 : -1}
          className={`tab-button ${mode === "blank" ? "active" : ""}`}
          disabled={pending}
          onClick={() => selectTab("blank")}
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
          tabIndex={!skipNavigationActive && mode === "template" ? 0 : -1}
          className={`tab-button ${mode === "template" ? "active" : ""}`}
          disabled={pending}
          onClick={() => selectTab("template")}
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
        {visited.blank && <CreateProjectForm onBeginSubmission={beginSubmission} onEndSubmission={endSubmission} />}
      </div>

      <div
        id="panel-template"
        role="tabpanel"
        aria-labelledby="tab-template"
        hidden={mode !== "template"}
      >
        {visited.template && <CreateFromTemplateForm onBeginSubmission={beginSubmission} onEndSubmission={endSubmission} />}
      </div>
    </div>
  );
}
