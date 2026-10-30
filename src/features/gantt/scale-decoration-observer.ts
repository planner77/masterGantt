/** Row virtualization must not redecorate the unchanged date axis. */
export function observeScaleDecoration(root: HTMLElement, selector: string, decorate: () => void, observeClass = false): () => void {
  const containsScale = (node: Node) => node instanceof Element && (node.matches(selector) || node.querySelector(selector) !== null);
  const observer = new MutationObserver(function onScaleMutation(records) {
    const relevant = records.some(record => {
      if (record.target instanceof Element && record.target.closest(selector)) return true;
      return record.type === "childList" && [...record.addedNodes].some(containsScale);
    });
    if (relevant) decorate();
  });
  decorate();
  observer.observe(root, { childList: true, subtree: true,
    ...(observeClass ? { attributes: true, attributeFilter: ["class"] } : {}) });
  return () => observer.disconnect();
}
