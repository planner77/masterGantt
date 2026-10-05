import type { ProjectSnapshotResponse } from "@/contracts/projects";

/** Confirmed server revisions may advance, but recovery must never undo them. */
export function canAcceptCanonicalSnapshot(
  current: ProjectSnapshotResponse | null,
  incoming: ProjectSnapshotResponse,
  publicId: string,
): boolean {
  return incoming.data.project.publicId === publicId &&
    (!current || current.data.project.publicId !== publicId ||
      incoming.data.project.revision >= current.data.project.revision);
}

/** New adapter inputs discard a failed native edit in the existing Gantt instance. */
export function replayConfirmedSnapshot(snapshot: ProjectSnapshotResponse): ProjectSnapshotResponse {
  return { ...snapshot, data: { ...snapshot.data, tasks: [...snapshot.data.tasks], links: [...snapshot.data.links] } };
}
