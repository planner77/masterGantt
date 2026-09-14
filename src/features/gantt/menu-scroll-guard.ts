/** DOM의 스크롤 위치만 읽는다. 테스트에서는 같은 구조의 노드로 검증할 수 있다. */
export interface ScrollAncestor {
  readonly scrollLeft: number;
  readonly scrollTop: number;
  readonly parentElement: ScrollAncestor | null;
}

/**
 * 메뉴를 연 시점의 호출 대상과 조상 스크롤 위치를 보관한다.
 * 이미 끝난 scrollIntoView/동기화의 지연된 scroll 알림은 실제 이동이 아니므로
 * 새 메뉴를 닫지 않는다. 이후의 가로/세로/페이지 스크롤은 지연 없이 감지한다.
 */
export function captureMenuScrollChange(trigger: ScrollAncestor): () => boolean {
  const positions: Array<{ node: ScrollAncestor; left: number; top: number }> = [];
  for (let node: ScrollAncestor | null = trigger; node; node = node.parentElement) {
    positions.push({ node, left: node.scrollLeft, top: node.scrollTop });
  }
  return () => positions.some(({ node, left, top }) => node.scrollLeft !== left || node.scrollTop !== top);
}
