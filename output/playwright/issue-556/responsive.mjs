// One-off evidence, not another CI spec. Run with node --import tsx and a loopback server.
import { chromium, expect } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { installStatefulProjectFixture, publicId } from '../../../tests/fixtures/stateful-project.ts';

const baseURL = process.argv[2];
if (!baseURL?.startsWith('http://127.0.0.1:')) throw Error('Loopback server required');
const browser = await chromium.launch();
const page = await browser.newPage({ baseURL });
const state = await installStatefulProjectFixture(page);
state.tasks[0].name = '긴 Summary 이름 '.repeat(12);
state.tasks[3].name = '긴 Milestone 소속 이름 '.repeat(12);
state.tasks[0].membership = { explicitMilestoneTaskId: state.tasks[3].taskId };
const result = [];
for (const editable of [false, true]) {
  state.sessionEditable = editable;
  await page.goto(`/projects/${publicId}?rootTask=${state.tasks[0].taskId}`);
  const frame = page.locator('.project-gantt-frame');
  await expect(frame).toHaveAttribute('data-project-gantt-api-instance', /.+/);
  const instance = await frame.getAttribute('data-project-gantt-api-instance');
  const lookup = page.getByRole('button', { name: '담당자·공수 조회', exact: true });
  await expect(lookup).toBeDisabled();
  const checkbox = frame.locator(`input[data-copy-selection="${state.tasks[1].taskId}"]`);
  await checkbox.check();
  await expect(lookup).toBeEnabled();
  for (const width of [390, 768, 1024, 1440, 1920, 1152, 960, 720]) {
    await page.setViewportSize({ width, height: 900 });
    const toolbar = page.getByRole('toolbar', { name: '작업 검색과 필터' });
    const search = toolbar.getByRole('searchbox');
    await toolbar.locator('.project-stage-filter-trigger').click();
    await page.getByRole('option').filter({ hasText: state.tasks[3].name.trim() }).click();
    await expect(toolbar.locator('.project-stage-filter-trigger')).toHaveAccessibleName(`Milestone: ${state.tasks[3].name.trim()}`);
    await search.fill('Existing summary child');
    const filter = toolbar.locator('button[aria-controls="project-task-filter-panel"]');
    await filter.click();
    await page.getByLabel('작업 고급 필터').getByRole('textbox', { name: '작업명', exact: true }).focus();
    await page.keyboard.press('Escape');
    await expect(filter).toBeFocused();
    await expect(page.locator('#project-task-filter-panel')).toBeHidden();
    await expect(toolbar.getByRole('button', { name: '초기화', exact: true })).toBeVisible();
    await lookup.focus();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Summary 전체 담당자·공수', exact: true })).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(lookup).toBeFocused();
    if (!editable && [390, 1440].includes(width)) {
      await page.screenshot({ path: new URL(`./after/selected-${width}.png`, import.meta.url).pathname });
    }
    const geometry = await toolbar.evaluate(root => {
      const bounds = root.getBoundingClientRect();
      const controls = [...root.querySelectorAll('button,input,select')].filter(el => {
        const r = el.getBoundingClientRect();
        return el.checkVisibility() && r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden';
      }).map(el => { const r = el.getBoundingClientRect(); return { name: el.getAttribute('aria-label') ?? el.textContent.trim(), x:r.x, y:r.y, width:r.width, height:r.height, right:r.right, bottom:r.bottom }; });
      const overlaps = [];
      for (let i=0; i<controls.length; i++) for (let j=i+1; j<controls.length; j++) {
        const a=controls[i], b=controls[j];
        if (Math.min(a.right,b.right)-Math.max(a.x,b.x)>1 && Math.min(a.bottom,b.bottom)-Math.max(a.y,b.y)>1) overlaps.push([a.name,b.name]);
      }
      return { bounds:{left:bounds.left,right:bounds.right,width:bounds.width}, documentWidth:document.documentElement.scrollWidth, viewport:innerWidth, outside:controls.filter(r=>r.x<bounds.left-1 || r.right>bounds.right+1), overlaps, controls };
    });
    if (geometry.outside.length || geometry.overlaps.length) console.log(JSON.stringify({ width, mode:editable?'edit':'readonly', geometry },null,2));
    expect(geometry.documentWidth).toBeLessThanOrEqual(width+1);
    expect(geometry.controls.find(x=>x.name === '작업명, 설명, External ID 검색').width).toBeGreaterThanOrEqual(120);
    expect(geometry.outside).toEqual([]);
    expect(geometry.overlaps).toEqual([]);
    for (const control of geometry.controls.filter(x=>['담당자·공수 조회','Summary 전체 담당자·공수'].includes(x.name))) {
      expect(control.height).toBeGreaterThanOrEqual(44);
      expect(control.width).toBeGreaterThanOrEqual(44);
    }
    await expect(frame).toHaveAttribute('data-project-gantt-api-instance', instance);
    expect(state.project.revision).toBe(40);
    expect(state.posts).toHaveLength(0);
    expect(state.patchRequests).toHaveLength(0);
    result.push({ query:'Existing summary child', milestoneSelected:state.tasks[3].taskId, resetVisible:true, mode:editable?'edit':'readonly', width, height:900, effectiveZoom:({1152:125,960:150,720:200})[width] ?? null, nativeZoom:false, geometry, sameInstance:true, revision:40, writes:0 });
    await toolbar.getByRole('button', { name: '초기화', exact: true }).click();
    await expect(search).toBeFocused();
  }
}
const sources = Object.fromEntries(['src/features/projects/project-readonly-view.tsx','src/app/globals.css'].map(path=>[path,createHash('sha256').update(readFileSync(path)).digest('hex')]));
await writeFile(new URL('./responsive.json',import.meta.url),JSON.stringify({ sources, fixture:'stateful-project; long Summary and actually selected Milestone; inherited membership; selected child; query/reset visible at measurement; reset focus afterward', result },null,2)+'\n');
console.log(`${result.length} readonly/edit responsive and keyboard observations PASS; effective CSS widths are not native browser zoom`);
await browser.close();
