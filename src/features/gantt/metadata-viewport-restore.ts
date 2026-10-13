/**
 * Return the exact pre-sync viewport for a metadata-only canonical update.
 *
 * This helper is called ONLY after the caller has verified that the Gantt
 * instance, visible scope, task geometry, columns, scale and user input
 * have not changed. Native SVAR can move a nonzero scroll offset during
 * metadata reconciliation, so testing only for a reset to zero is unsafe.
 */
export function metadataViewportRestoreTarget(
  current: Readonly<{ left: number; top: number }>,
  preserved: Readonly<{ left: number; top: number }>,
): { left?: number; top?: number } | null {
  const valid = (n: number) => Number.isFinite(n) && n >= 0;
  if (![current.left, current.top, preserved.left, preserved.top].every(valid)) return null;
  const left = current.left !== preserved.left ? preserved.left : undefined;
  const top = current.top !== preserved.top ? preserved.top : undefined;
  return left === undefined && top === undefined ? null : { left, top };
}
