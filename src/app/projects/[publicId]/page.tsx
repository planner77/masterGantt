import type { Metadata } from "next";

import { ProjectReadonlyView } from "@/features/projects/project-readonly-view";

export const metadata: Metadata = { title: "프로젝트" };

export default async function ProjectPage({
  params,
}: Readonly<{ params: Promise<{ publicId: string }> }>) {
  const { publicId } = await params;
  return <ProjectReadonlyView publicId={publicId} />;
}
