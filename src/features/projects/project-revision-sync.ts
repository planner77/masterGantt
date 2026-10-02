export function mergePendingProjectRevision(
  pendingRevision: number,
  currentRevision: number,
  announcedValue: unknown,
): number {
  const announcedRevision = typeof announcedValue === "number"
    ? announcedValue
    : Number(announcedValue);
  if (!Number.isSafeInteger(announcedRevision) || announcedRevision <= currentRevision) {
    return pendingRevision;
  }
  return Math.max(pendingRevision, announcedRevision);
}

export function shouldRetireDurableProjectRevision(
  durableRevision: number,
  targetRevision: number,
  currentRevision: number,
  fetchedRevision: number,
): boolean {
  return durableRevision >= targetRevision &&
    targetRevision > fetchedRevision &&
    fetchedRevision <= currentRevision;
}
