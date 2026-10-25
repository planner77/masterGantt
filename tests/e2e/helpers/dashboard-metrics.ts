import { expect, type Locator } from "@playwright/test";

/** Metric values stay readable independently of the table's horizontal scroll. */
export async function expectDashboardMetricsReadable(summary: Locator, viewportWidth: number) {
  const groups = summary.locator(":scope > dl");
  expect(await groups.count()).toBeGreaterThan(0);
  for (const group of await groups.all()) {
    await expect(group).toHaveAccessibleName(/\S/);
    const measurements = await group.evaluate(element => Array.from(element.children).map(item => {
      const term = item.querySelector("dt")!, value = item.querySelector("dd")!;
      const label = term.getBoundingClientRect(), box = value.getBoundingClientRect();
      const range = document.createRange(); range.selectNodeContents(value);
      const textNodes: Text[] = [];
      const walker = document.createTreeWalker(value, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) textNodes.push(walker.currentNode as Text);
      const position = (offset: number): [Text, number] => {
        for (const node of textNodes) {
          if (offset <= node.length) return [node, offset];
          offset -= node.length;
        }
        throw Error("Metric text offset missing");
      };
      const units = Array.from(value.textContent!.matchAll(/\d+(?:\.\d+)?\s*(?:M\/D|M\/M|대|개|식|명|건|%)/g)).map(match => {
        const token = document.createRange();
        token.setStart(...position(match.index!)); token.setEnd(...position(match.index! + match[0].length));
        return {text: match[0], lineCount: new Set(Array.from(token.getClientRects()).map(box => Math.round(box.y))).size};
      });
      return {
        label: term.textContent, value: value.textContent,
        left: Math.min(label.left, box.left), right: Math.max(label.right, box.right),
        labelBottom: label.bottom, valueTop: box.top,
        contentLeft: range.getBoundingClientRect().left, contentRight: range.getBoundingClientRect().right,
        valueLeft: box.left, valueRight: box.right,
        numeric: getComputedStyle(value).fontVariantNumeric, units,
        contentTop: range.getBoundingClientRect().top, contentBottom: range.getBoundingClientRect().bottom,
        valueTopEdge: box.top, valueBottom: box.bottom,
      };
    }));
    for (const metric of measurements) {
      expect(metric.label).toMatch(/\S/); expect(metric.value).toMatch(/\S/);
      expect(metric.left, metric.label!).toBeGreaterThanOrEqual(0);
      expect(metric.right, metric.label!).toBeLessThanOrEqual(viewportWidth + 1);
      expect(metric.valueTop, metric.label!).toBeGreaterThanOrEqual(metric.labelBottom - 1);
      expect(metric.contentLeft, metric.value!).toBeGreaterThanOrEqual(metric.valueLeft - 1);
      expect(metric.contentRight, metric.value!).toBeLessThanOrEqual(metric.valueRight + 1);
      expect(metric.numeric).toContain("tabular-nums");
      expect(metric.contentTop, metric.value!).toBeGreaterThanOrEqual(metric.valueTopEdge - 1);
      expect(metric.contentBottom, metric.value!).toBeLessThanOrEqual(metric.valueBottom + 1);
      for (const token of metric.units) expect(token.lineCount, token.text).toBe(1);
    }
  }
}
