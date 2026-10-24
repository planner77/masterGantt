import type { Metadata } from "next";
import { headers } from "next/headers";

import { PrivateProjectUnlock } from "@/features/projects/private-project-unlock";
import { ProjectPermissionRecheckBoundary } from "@/features/projects/project-permission-recheck-boundary";
import { ProjectReadonlyView } from "@/features/projects/project-readonly-view";
import { getProjectService } from "@/server/projects/project-service";
import { buildProjectShareUrl } from "@/server/projects/project-share-url-core";
import { projectSessionFromCookie } from "@/server/security/project-read-access-core";

export const dynamic = "force-dynamic";

async function readPageState(publicId: string) {
  const cookie = (await headers()).get("cookie");
  const rawToken = projectSessionFromCookie(cookie);
  const service = getProjectService();
  const access = service.projectReadAccess(publicId, rawToken);
  const snapshot = access === "allowed" ? service.getAuthorizedReadonlySnapshot(publicId, rawToken) : undefined;
  return { access, snapshot };
}

export async function generateMetadata({ params }: Readonly<{ params: Promise<{ publicId: string }> }>): Promise<Metadata> {
  const { publicId } = await params;
  try {
    const { snapshot } = await readPageState(publicId);
    const name = snapshot?.data.project.name;
    return { title: name?.trim() ? `masterGantt|${name}` : "masterGantt" };
  } catch {
    return { title: "masterGantt" };
  }
}

export default async function ProjectPage({ params }: Readonly<{ params: Promise<{ publicId: string }> }>) {
  const { publicId } = await params;
  const { access, snapshot } = await readPageState(publicId);
  if (access === "locked") {
    return <div className="project-page-shell"><PrivateProjectUnlock publicId={publicId} /></div>;
  }
  const projectUrl = buildProjectShareUrl(process.env.APP_BASE_URL, process.env.NODE_ENV, publicId, process.env.ALLOW_INSECURE_HTTP);
  const ownerName = snapshot?.data.project.ownerName ?? "미지정";
  return <div className="project-page-shell">
    <ProjectPermissionRecheckBoundary publicId={publicId}>
      <ProjectReadonlyView key={publicId} publicId={publicId} projectUrl={projectUrl} ownerName={ownerName} />
    </ProjectPermissionRecheckBoundary>
  </div>;
}
