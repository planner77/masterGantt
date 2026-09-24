import type { Metadata } from "next";
import { cache } from "react";

import { ProjectPermissionRecheckBoundary } from "@/features/projects/project-permission-recheck-boundary";
import { ProjectReadonlyView } from "@/features/projects/project-readonly-view";
import { getProjectService } from "@/server/projects/project-service";
import { buildProjectShareUrl } from "@/server/projects/project-share-url-core";

export const dynamic = "force-dynamic";

const getReadonlySnapshot = cache((publicId: string) => getProjectService().getReadonlySnapshot(publicId));

export async function generateMetadata({ params }: Readonly<{ params: Promise<{ publicId: string }> }>): Promise<Metadata> {
  const { publicId } = await params;
  try {
    const name = getReadonlySnapshot(publicId)?.data.project.name;
    return { title: name?.trim() ? `masterGantt|${name}` : "masterGantt" };
  } catch {
    return { title: "masterGantt" };
  }
}

export default async function ProjectPage({
  params,
}: Readonly<{ params: Promise<{ publicId: string }> }>) {
  const { publicId } = await params;
  const projectUrl = buildProjectShareUrl(process.env.APP_BASE_URL, process.env.NODE_ENV, publicId, process.env.ALLOW_INSECURE_HTTP);
  const snapshot = getReadonlySnapshot(publicId);
  const ownerName = snapshot?.data.project.ownerName ?? "미지정";
  return <div className="project-page-shell">
    <ProjectPermissionRecheckBoundary publicId={publicId}>
      <ProjectReadonlyView key={publicId} publicId={publicId} projectUrl={projectUrl} ownerName={ownerName} />
    </ProjectPermissionRecheckBoundary>
  </div>;
}
