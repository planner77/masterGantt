import { expect, type Page, type TestInfo } from "@playwright/test";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { observeUi, assertUi, assertFocusVisible, assertIdentifiableInput } from "./ui-geometry";

export const widths491 = [390, 768, 1024, 1440, 1920];
export const name491 = "긴 한국어 프로젝트 생성·복사·템플릿 — InternationalEngineeringTransferWorkspace".repeat(2);
export const description491 = "승인된 일정과 명시 단계 소속을 보존하는 긴 설명입니다. LongUnbrokenTransferDescription ".repeat(18);
export const fixturePassword491 = "Transfer491!";
const root = resolve(__dirname, "../../..");
export const evidenceDirectory491 = (info: TestInfo) => process.env.ISSUE_491_EVIDENCE_DIR ? resolve(root, process.env.ISSUE_491_EVIDENCE_DIR) : info.outputPath("issue-491-evidence");

export async function writeSafe491(info: TestInfo, key: string, data: unknown) {
  const directory = evidenceDirectory491(info); await mkdir(directory, { recursive: true });
  await writeFile(resolve(directory, `${key}.json`), JSON.stringify(data, null, 2) + "\n");
}

/** Record before defects without suppressing operational keyboard/API/state assertions. */
export async function capture491(page: Page, info: TestInfo, key: string, selector = "dialog[open]", responseKind = "actual application", widths = widths491) {
  const directory = evidenceDirectory491(info); await mkdir(directory, { recursive: true });
  const hashFiles = async (paths: string[]) => Promise.all(paths.map(async path => ({ path, sha256: createHash("sha256").update(await readFile(resolve(root, path))).digest("hex") })));
  const sourceFiles = await hashFiles(execFileSync("rg", ["--files", "src"], { cwd: root, encoding: "utf8" }).trim().split("\n").sort());
  const provenance = {
    capturedAt: new Date().toISOString(), sourceSha: execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim(),
    sourceFiles, sourceAggregateSha256: createHash("sha256").update(JSON.stringify(sourceFiles)).digest("hex"),
    tests: await hashFiles(["tests/e2e/project-transfer-layout-491.spec.ts", "tests/e2e/helpers/issue491-transfer-fixture.ts", "tests/e2e/helpers/ui-geometry.ts", "tests/e2e/fixtures/isolated-application.ts", "tests/e2e/fixtures/task-editor-density.ts", "tests/config/playwright.config.ts"]),
    version: JSON.parse(await readFile(resolve(root, "package.json"), "utf8")).version,
    browserVersion: page.context().browser()?.version(), nodeVersion: process.version,
    phase: process.env.ISSUE_491_PHASE ?? "after", command: process.env.ISSUE_491_COMMAND ?? "NOT RECORDED",
    responseKind, report: process.env.PLAYWRIGHT_HTML_OUTPUT_DIR ?? "playwright-report",
  };
  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 });
    if(key.endsWith("native-focus")){await page.keyboard.press("Shift+Tab");await page.keyboard.press("Tab");}
    const facts = await observeUi(page, selector);
    const owner = await page.locator(selector).evaluate(node => {
      const rect = node.getBoundingClientRect();
      const groups = Array.from(node.querySelectorAll("fieldset,form,[role=group],[role=toolbar],[role=tablist]")).filter(n => n.checkVisibility()).map(n => {
        const r = n.getBoundingClientRect(); return { tag: n.tagName, role: n.getAttribute("role"), legend: n.querySelector("legend")?.textContent, rect: { x:r.x,y:r.y,width:r.width,height:r.height }, clientWidth:n.clientWidth, scrollWidth:n.scrollWidth };
      });
      return { native:node instanceof HTMLDialogElement, modal:node.matches(":modal"), open:node.hasAttribute("open"), rect:{x:rect.x,y:rect.y,right:rect.right,bottom:rect.bottom,width:rect.width,height:rect.height}, clientWidth:node.clientWidth,scrollWidth:node.scrollWidth,clientHeight:node.clientHeight,scrollHeight:node.scrollHeight,groups };
    });
    const focus = facts.controls.find(c => c.focused);
    const focusOutset = focus ? Math.max(0, parseFloat(focus.style.outlineWidth) + parseFloat(focus.style.outlineOffset)) : 0;
    const focusClips = focus?.clipOwners.filter(o => ((["hidden","clip","auto","scroll"].includes(o.overflowX) && (focus.rect.x-focusOutset < o.rect.x-1 || focus.rect.right+focusOutset > o.rect.right+1)) || (["hidden","clip","auto","scroll"].includes(o.overflowY) && (focus.rect.y-focusOutset < o.rect.y-1 || focus.rect.bottom+focusOutset > o.rect.bottom+1)))) ?? [];
    const buttons = facts.controls.filter(c => c.tag === "BUTTON");
    const sameRowActions = buttons.flatMap((a,i) => buttons.slice(i+1).filter(b => Math.abs(a.rect.y-b.rect.y)<=1 && a.rect.x!==b.rect.x).map(b => ({ labels:[a.label,b.label], topDelta:Math.abs(a.rect.y-b.rect.y), heightDelta:Math.abs(a.rect.height-b.rect.height), gap:b.rect.x-a.rect.right, widths:[a.rect.width,b.rect.width] })));
    const focusedRegion=await page.locator(selector).evaluate(n=>{const active=document.activeElement;if(!active||!n.contains(active)||active.getAttribute("role")!=="region")return null;const r=active.getBoundingClientRect(),s=getComputedStyle(active);const clipOwners=[];for(let parent=active.parentElement;parent;parent=parent.parentElement){const ps=getComputedStyle(parent);if([ps.overflowX,ps.overflowY].some(v=>["hidden","clip","auto","scroll"].includes(v))){const pr=parent.getBoundingClientRect();clipOwners.push({rect:{x:pr.x,y:pr.y,right:pr.right,bottom:pr.bottom},overflowX:ps.overflowX,overflowY:ps.overflowY});}}return {clipOwners,label:active.getAttribute("aria-label"),rect:{x:r.x,y:r.y,right:r.right,bottom:r.bottom},outlineWidth:s.outlineWidth,outlineOffset:s.outlineOffset,focusVisible:active.matches(":focus-visible"),clientWidth:active.clientWidth,scrollWidth:active.scrollWidth};});
    const footers=await page.locator(selector).evaluate(n=>Array.from(n.querySelectorAll(".dialog-actions,.form-actions")).filter(e=>e.checkVisibility()).map(e=>{const rect=(el:Element)=>{const r=el.getBoundingClientRect();return{x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};const buttons=Array.from(e.querySelectorAll(":scope > button")).filter(b=>b.checkVisibility()).map(b=>({label:b.textContent?.trim(),rect:rect(b)}));const fields=Array.from(e.parentElement!.querySelectorAll(":scope > .form-field")).filter(f=>f.checkVisibility());const lastField=fields.at(-1);const peers=buttons.slice(1).map((b,i)=>{const a=buttons[i],sameRow=Math.abs(a.rect.y-b.rect.y)<=1;return{sameRow,topDelta:Math.abs(a.rect.y-b.rect.y),heightDelta:Math.abs(a.rect.height-b.rect.height),gap:sameRow?b.rect.x-a.rect.right:b.rect.y-a.rect.bottom};});return{hook:e.classList.contains("dialog-actions")?"dialog-actions":"form-actions",rect:rect(e),buttons,peers,fieldToFooterGap:lastField?rect(e).y-rect(lastField).bottom:null};}));
    const regionOutset=focusedRegion?parseFloat(focusedRegion.outlineWidth)+parseFloat(focusedRegion.outlineOffset):0;
    const regionClips=focusedRegion?.clipOwners.filter(o=>((["hidden","clip","auto","scroll"].includes(o.overflowX)&&(focusedRegion.rect.x-regionOutset<o.rect.x-1||focusedRegion.rect.right+regionOutset>o.rect.right+1))||(["hidden","clip","auto","scroll"].includes(o.overflowY)&&(focusedRegion.rect.y-regionOutset<o.rect.y-1||focusedRegion.rect.bottom+regionOutset>o.rect.bottom+1))))??[];
    const record = { provenance, facts, owner,focusedRegion,footers,regionClips, observations:{documentOverflowPx:Math.max(0,facts.document.scrollWidth-facts.document.clientWidth),ownerOverflowPx:Math.max(0,owner.scrollWidth-owner.clientWidth),focusedControlVisible:focus ? focus.rect.y>=0 && focus.rect.bottom<=900 : null,focusClipOwners:focusClips,sameRowActions} };
    await page.screenshot({ path:resolve(directory,`${key}-${width}.png`),fullPage:true });
    await writeFile(resolve(directory,`${key}-${width}.json`),JSON.stringify(record,null,2)+"\n");
    if (process.env.ISSUE_491_PHASE !== "before") {
      assertUi(facts);
      if(key.startsWith("template-save-")||key.startsWith("export-")){for(const footer of footers){for(const peer of footer.peers){expect(peer.gap,"footer peer gap must preserve 12px budget").toBeGreaterThanOrEqual(11);if(peer.sameRow){expect(peer.topDelta).toBeLessThanOrEqual(1);expect(peer.heightDelta).toBeLessThanOrEqual(1);}}if(key.startsWith("template-save-")&&footer.fieldToFooterGap!==null)expect(footer.fieldToFooterGap,"last visible field must not touch footer").toBeGreaterThanOrEqual(11);}}
      if(key.endsWith("native-focus")&&focusedRegion)expect(regionClips,"native region focus ring must fit clipping owners").toHaveLength(0);
      // Native choices are drawn by the browser; the text-field border/padding contract does not apply.
      for (const c of facts.controls.filter(c=>["INPUT","SELECT","TEXTAREA"].includes(c.tag)&&!["checkbox","radio"].includes(c.type??""))) assertIdentifiableInput(c);
      for(const c of facts.controls.filter(c=>["checkbox","radio"].includes(c.type??""))){expect(c.labels.length>0||Boolean(c.label),"native choice label association").toBe(true);expect(c.rect.width).toBeGreaterThan(0);expect(c.rect.height).toBeGreaterThan(0);}
      for(const appearance of await page.locator(selector).locator('input[type="checkbox"],input[type="radio"]').evaluateAll(nodes=>nodes.filter(n=>n.checkVisibility()).map(n=>getComputedStyle(n).appearance)))expect(appearance,"browser native choice appearance").not.toBe("none");
      if (key.endsWith("native-focus")&&!focusedRegion) { expect(focus).toBeDefined(); assertFocusVisible(focus!); }
    }
    if(key.endsWith("native-focus")){if(focusedRegion){expect(focusedRegion.focusVisible).toBe(true);expect(focusedRegion.rect.y).toBeGreaterThanOrEqual(0);expect(focusedRegion.rect.bottom).toBeLessThanOrEqual(901);}else{expect(focus).toBeDefined();expect(focus!.rect.y).toBeGreaterThanOrEqual(0);expect(focus!.rect.bottom).toBeLessThanOrEqual(901);assertFocusVisible(focus!);}}
  }
}

export async function createSource491(page: Page, origin: string, longList = false) {
  const created = await page.request.post("/api/projects", { headers:{Origin:origin},data:{name:name491,ownerName:"E2E 자동화 담당자",description:description491,editPassword:fixturePassword491} });
  expect(created.status()).toBe(201); const project=(await created.json()).data.project; const path=`/api/projects/${project.publicId}`;
  let revision=project.revision as number; let summaryId="",nestedId="";
  for (let i=0;i<(longList?33:3);i++) {
    const response=await page.request.post(`${path}/tasks`,{headers:{Origin:origin,"If-Match":`"${revision}"`},data:longList&&i===4?{externalId:"NESTED",name:"접을 중첩 Summary",type:"summary",parentTaskId:summaryId}:i===0?{externalId:"TRANSFER-S",name:"보존할 Summary",type:"summary"}:{externalId:`TRANSFER-${i}`,name:`=안전한 사용자 텍스트 ${i} — ${name491}`,type:"task",parentTaskId:longList&&i===5?nestedId:summaryId,start:"2026-10-06",duration:90,progress:25}});
    expect(response.status()).toBe(201); const data=(await response.json()).data;revision=data.project.revision;if(longList&&i===4)nestedId=data.tasks.find((t:{externalId:string})=>t.externalId==="NESTED").taskId;if(i===0)summaryId=data.tasks.find((t:{externalId:string})=>t.externalId==="TRANSFER-S").taskId;
  }
  await page.goto(`/projects/${project.publicId}`);await expect(page.getByText("편집 중",{exact:true})).toBeVisible();
  return {id:project.publicId as string,path,revision,summaryId,nestedId,snapshot:(await (await page.request.get(path)).json()).data};
}

export async function openMore491(page: Page, name: string) {
  const more=page.locator('summary[aria-label="프로젝트 작업 더보기"]');if(!await more.evaluate(n=>n.parentElement!.hasAttribute("open")))await more.click();
  await page.getByRole("button",{name,exact:true}).click();
}

export const importFile491 = (suffix: string) => ({name:`승인된-긴-일정-가져오기-${suffix}.json`,mimeType:"application/json",buffer:Buffer.from(JSON.stringify({schemaVersion:"1.0",project:{name:name491,description:description491},tasks:[{externalId:`IMPORT-${suffix}`,name:name491,type:"task",scheduleMode:"auto",start:"2026-10-06",duration:9999,progress:99.99,parentExternalId:null,predecessors:[]}]}))});
