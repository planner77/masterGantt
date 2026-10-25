// Run from the repository root against its isolated development server:
// node --import tsx output/playwright/issue-556/capture.mjs before http://127.0.0.1:3116
import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { installStatefulProjectFixture, publicId } from '../../../tests/fixtures/stateful-project.ts';

const [phase, baseURL] = process.argv.slice(2);
if (!['before', 'after'].includes(phase) || !baseURL?.startsWith('http://127.0.0.1:')) throw Error('Use before|after and a loopback server URL');
const out = new URL(`./${phase}/`, import.meta.url);
await mkdir(out, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ baseURL, viewport: { width: 1440, height: 900 } });
const fixture = await installStatefulProjectFixture(page);
fixture.sessionEditable = false;
const measurements = [];
for (const scope of ['full', 'summary']) {
  await page.goto(`/projects/${publicId}${scope === 'summary' ? `?rootTask=${fixture.tasks[0].taskId}` : ''}`);
  const frame = page.locator('.project-gantt-frame');
  await expect(frame).toHaveAttribute('data-project-gantt-api-instance', /.+/);
  await expect(frame.locator('.wx-chart')).toBeVisible();
  for (const width of [390, 768, 1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    measurements.push(await page.evaluate(({ scope, width }) => {
      const rect = selector => {
        const element = document.querySelector(selector);
        if (!element) return null;
        const box = element.getBoundingClientRect();
        return { x: box.x, y: box.y, width: box.width, height: box.height, bottom: box.bottom };
      };
      const nav = rect('.project-scope-navigation');
      const headingRow = rect('.schedule-heading-row');
      const panel = rect('#project-panel-schedule');
      const gantt = rect('.project-gantt-frame');
      return { scope, width, height: 900, nav, headingRow, panel, filter: rect('.project-schedule-filter-toolbar'), gantt,
        chart: rect('.project-gantt-frame .wx-chart'), grid: rect('.project-gantt-frame .wx-grid'),
        topArea: gantt.y - panel.y, documentWidth: document.documentElement.scrollWidth,
        sourceRevision: 40, mode: 'readonly', selection: [], filterQuery: '' };
    }, { scope, width }));
    if ([390, 1440].includes(width)) await page.screenshot({ path: new URL(`${scope}-${width}.png`, out).pathname });
  }
}
const sources = Object.fromEntries(['src/features/projects/project-readonly-view.tsx', 'src/app/globals.css', 'src/features/gantt/project-gantt.tsx', 'tests/fixtures/stateful-project.ts'].map(path => [path, createHash('sha256').update(readFileSync(path)).digest('hex')]));
await writeFile(new URL('geometry.json', out), JSON.stringify({ phase, sources, measurements }, null, 2) + '\n');
console.log(JSON.stringify({ phase, measurements: measurements.filter(x => x.width === 1440) }, null, 2));
await browser.close();
