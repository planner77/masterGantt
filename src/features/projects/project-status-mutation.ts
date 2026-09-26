import type { ProjectMetadataMutationResponse, ProjectSnapshotResponse, ProjectStatus } from "@/contracts/projects";

export type ProjectStatusTarget = Readonly<{
  revision: number;
  status: ProjectStatus;
}>;

function isProjectStatus(value: unknown): value is ProjectStatus {
  return value === "planned" || value === "in_progress" || value === "completed";
}

export async function readProjectStatusTarget(publicId: string): Promise<ProjectStatusTarget | null> {
  const response = await fetch(`/api/projects/${encodeURIComponent(publicId)}`, {
    cache: "no-store",
    credentials: "same-origin",
  });
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok || typeof body !== "object" || body === null || !("data" in body)) return null;
  const data = body.data;
  if (typeof data !== "object" || data === null || !("project" in data)) return null;
  const project = data.project;
  if (typeof project !== "object" || project === null ||
    !("revision" in project) || typeof project.revision !== "number" || !Number.isSafeInteger(project.revision) ||
    !("status" in project) || !isProjectStatus(project.status)) return null;
  return { revision: project.revision, status: project.status };
}

export async function hasCurrentProjectEditSession(publicId: string): Promise<boolean> {
  const response = await fetch(`/api/projects/${encodeURIComponent(publicId)}/edit-sessions/current`, {
    cache: "no-store",
    credentials: "same-origin",
  });
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok || typeof body !== "object" || body === null || !("data" in body)) return false;
  const data = body.data;
  return typeof data === "object" && data !== null && "permission" in data && data.permission === "edit";
}

export async function unlockProjectEditSession(publicId: string, editPassword: string): Promise<Response> {
  return fetch(`/api/projects/${encodeURIComponent(publicId)}/edit-sessions`, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ editPassword }),
  });
}

export async function patchProjectStatus(
  publicId: string,
  revision: number,
  status: ProjectStatus,
): Promise<Readonly<{ response: Response; body: unknown; mutation: ProjectMetadataMutationResponse | null }>> {
  const response = await fetch(`/api/projects/${encodeURIComponent(publicId)}`, {
    method: "PATCH",
    cache: "no-store",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      "If-Match": `"${revision}"`,
    },
    body: JSON.stringify({ status }),
  });
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok || typeof body !== "object" || body === null || !("data" in body)) {
    return { response, body, mutation: null };
  }
  const data = body.data as ProjectMetadataMutationResponse["data"];
  const valid = typeof data === "object" && data !== null &&
    typeof data.project === "object" && data.project !== null &&
    isProjectStatus(data.project.status) &&
    Array.isArray(data.tasks) && Array.isArray(data.links) &&
    typeof data.operation === "object" && data.operation !== null &&
    data.operation.kind === "projectMetadata" &&
    Array.isArray(data.operation.changedFields) &&
    data.operation.changedFields.includes("status");
  return { response, body, mutation: valid ? { data } : null };
}

export function projectSnapshotFromStatusMutation(
  mutation: ProjectMetadataMutationResponse,
): ProjectSnapshotResponse {
  return {
    data: {
      project: mutation.data.project,
      tasks: mutation.data.tasks,
      links: mutation.data.links,
      assignments: mutation.data.assignments,
      permission: "readonly",
    },
  };
}
