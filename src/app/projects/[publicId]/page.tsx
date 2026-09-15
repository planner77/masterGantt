import type { Metadata } from "next";

import { ProjectPermissionRecheckBoundary } from "@/features/projects/project-permission-recheck-boundary";
import { ProjectReadonlyView } from "@/features/projects/project-readonly-view";
import { buildProjectShareUrl } from "@/server/projects/project-share-url-core";

export const metadata: Metadata = { title: "프로젝트" };
export const dynamic = "force-dynamic";

export default async function ProjectPage({
  params,
}: Readonly<{ params: Promise<{ publicId: string }> }>) {
  const { publicId } = await params;
  const projectUrl = buildProjectShareUrl(process.env.APP_BASE_URL, process.env.NODE_ENV, publicId, process.env.ALLOW_INSECURE_HTTP);
  return <div className="project-page-shell">
    <ProjectPermissionRecheckBoundary publicId={publicId}>
      <ProjectReadonlyView key={publicId} publicId={publicId} projectUrl={projectUrl} />
    </ProjectPermissionRecheckBoundary>
  </div>;
}
