"use client";

import { useSearchParams } from "next/navigation";

import { WorkspaceNotifications } from "@/components/workspace-notifications";

import { ProjectCopyButton } from "./project-copy-button";

export function ProjectCopyEntry({ publicId }: Readonly<{ publicId: string }>) {
  const searchParams = useSearchParams();
  const autoOpen = searchParams.get("copy") === "1";

  return (
    <WorkspaceNotifications scope={`프로젝트 ${publicId} 복사`}>
      <div className="project-copy-entry">
        <ProjectCopyButton publicId={publicId} autoOpen={autoOpen} />
      </div>
    </WorkspaceNotifications>
  );
}
