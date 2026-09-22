"use client";

import { useSearchParams } from "next/navigation";

import { ProjectCopyButton } from "./project-copy-button";

export function ProjectCopyEntry({
  publicId,
  busy = false,
  onAutoOpen,
}: Readonly<{ publicId: string; busy?: boolean; onAutoOpen?: () => void }>) {
  const searchParams = useSearchParams();
  const autoOpen = searchParams.get("copy") === "1";

  return <ProjectCopyButton publicId={publicId} autoOpen={autoOpen} busy={busy} onAutoOpen={onAutoOpen} />;
}
