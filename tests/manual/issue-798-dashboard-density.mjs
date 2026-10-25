/** Opt-in Issue #798 before/after observation; no test discovery, CI hook, or product mutation. */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir, unlink } from "node:fs/promises";
import { resolve, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const repository = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const phase = process.argv[2] ?? "capture";
if (!["seed", "capture", "dashboards", "representatives"].includes(phase)) throw new Error("Allowed phases: seed, capture, dashboards, representatives");
const directory = resolve(repository, "output/playwright/issue-798", phase === "seed" ? "" : (process.env.DENSITY_CAPTURE ?? "before"));
const cli = process.env.UI_AUDIT_CLI ?? "/home/planner/.codex/skills/playwright/scripts/playwright_cli.sh";
const session = process.env.UI_AUDIT_SESSION ?? "issue798density";
const origin = "http://127.0.0.1:3198"; // Refuse accidental operational-server mutation.
const captureRunId = `${phase}-${new Date().toISOString().replaceAll(":", "-")}`;
const sha256 = bytes => createHash("sha256").update(bytes).digest("hex");
const collectorHashAtStart = sha256(await readFile(fileURLToPath(import.meta.url)));
const read = path => readFile(resolve(repository, path), "utf8");
const save = (name, value) => writeFile(resolve(directory, name), JSON.stringify(value, null, 2) + "\n");
const pinned = JSON.parse(await read("package.json"));
const installedNextVersion = JSON.parse(await read("node_modules/next/package.json")).version;
if (installedNextVersion !== pinned.dependencies.next) throw new Error("Installed Next differs from the pinned manifest; run npm ci before baseline capture");
await mkdir(directory, { recursive: true });
function cliCommand(args) {
  try { return execFileSync("bash", [cli, `-s=${session}`, ...args], { cwd: repository, encoding: "utf8", maxBuffer: 32 * 1024 * 1024, timeout: 600_000 }); }
  catch (error) { throw new Error(`CLI failed: ${String(error.stdout ?? "").slice(0, 600)}`); }
}
async function run(name, body) {
  const filename = resolve(directory, `${name}.cli.js`);
  await writeFile(filename, `async page => {\n${body}\n}`);
  try {
    const raw = cliCommand(["run-code", "--filename", filename, "--raw"]);
    try { return JSON.parse(raw); } catch { throw new Error(`CLI ${name} returned no JSON: ${raw.slice(0, 600)}`); }
  } finally { await unlink(filename); }
}
function declarations(source, names) {
  const file = ts.createSourceFile("fixture.ts", source, ts.ScriptTarget.Latest, true);
  const body = file.statements.filter(statement => {
    if (ts.isImportDeclaration(statement) || ts.isInterfaceDeclaration(statement) || ts.isTypeAliasDeclaration(statement)) return false;
    return !names || (ts.isFunctionDeclaration(statement) && names.includes(statement.name.text));
  }).map(statement => statement.getText(file).replace(/^export\s+/, "")).join("\n");
  return ts.transpileModule(body, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText.replace(/export \{\};?\s*$/, "");
}
if (phase === "seed") {
  // Real fixture bodies are reused. Only the test-runner assertions/attachment
  // adapter changes; archived direct SQLite fixture seeding is unavailable.
  const adapter = `function expect(actual,message){return {toBe(expected){if(actual!==expected)throw new Error(message??('fixture expected '+expected+'; got '+actual));},toBeTruthy(){if(!actual)throw new Error('fixture expected truthy');},async toBeVisible(options={}){await actual.waitFor({state:'visible',timeout:options.timeout??15000});}};} const playwrightTest={info:()=>({attach:async()=>{}})}; const seedLegacyLogistics=()=>{throw new Error('archived SQLite seeding unavailable in audit');};`;
  const target = declarations(await read("tests/e2e/fixtures/target-project.ts"));
  const wbs = declarations(await read("tests/e2e/fixtures/wbs-view-composer.ts"));
  const observedGet = declarations(await read("tests/e2e/fixtures/isolated-application-diagnostics.ts"), ["observedReadOnlyGet"]);
  const result = await run("seed", `${adapter}\n${observedGet}\n${target}\n${wbs}\nconst f=await seedWbsViewComposer(page,${JSON.stringify(origin)},async(_route,_method,operation)=>operation());return {publicId:f.publicId,taskId:f.task.taskId,milestoneId:f.milestone.taskId,equipmentId:f.equipment.id,systemId:f.system.id,resourceId:f.resource.id,revision:(await f.snapshot()).data.project.revision};`);
  await save("fixture.json", result);
  console.log(JSON.stringify({ phase, result: "PASS", revision: result.revision }));
  process.exit(0);
}
const fixture = JSON.parse(await read("output/playwright/issue-798/fixture.json"));
const projectUrl = `${origin}/projects/${fixture.publicId}`;
const helper = declarations(await read("tests/e2e/helpers/ui-geometry.ts"), ["observeUi"]);
const readQuery = declarations(await read("tests/e2e/helpers/read-only-requests.ts"), ["isWbsViewReadQuery"]);
const snapshot = `const response=await page.request.get(${JSON.stringify(`${origin}/api/projects/${fixture.publicId}`)});if(response.status()!==200)throw new Error('canonical read failed');const data=(await response.json()).data;const fingerprint=Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(data)))).toString('hex');`;
const beforeSnapshot = await run("before", `${readQuery}\nif(page.__audit797Listener)page.off('request',page.__audit797Listener);page.__audit797Writes=[];page.__audit797Queries=0;page.__audit797Listener=request=>{const path=new URL(request.url()).pathname;if(!path.startsWith('/api/projects/'))return;if(isWbsViewReadQuery(request)){page.__audit797Queries++;return;}if(!['GET','HEAD','OPTIONS'].includes(request.method()))page.__audit797Writes.push({method:request.method(),route:'/api/projects/[publicId]/…'});};page.on('request',page.__audit797Listener);${snapshot}return {revision:data.project.revision,tasks:data.tasks.length,assignments:data.assignments?.length??0,fingerprint};`);
const observations = [], faults = [];
let plannedSamples = 0;
const labels = { kpi: "KPI", milestone: "Milestone", process: "공정&WorkArea", equipment: "설비", system: "물류 시스템", resource: "리소스" };
const navigate = width => `await page.setViewportSize({width:${width},height:900});await page.goto(${JSON.stringify(projectUrl)});await page.getByText('편집 중',{exact:true}).waitFor({state:'visible',timeout:30000});await page.getByRole('tablist',{name:'프로젝트 작업공간',exact:true}).getByRole('tab',{name:'일정',exact:true}).click();`;
const openRoot = root => `await page.getByRole('tablist',{name:'프로젝트 작업공간',exact:true}).getByRole('tab',{name:'대시보드',exact:true}).click();await page.getByRole('tablist',{name:'대시보드 보기',exact:true}).getByRole('tab',{name:${JSON.stringify(labels[root])},exact:true}).click();${root === "kpi" ? `await page.getByTestId('logistics-dashboard-view').filter({visible:true}).locator('[class*="kpiGrid"]').waitFor({timeout:30000});` : `await page.locator('[data-wbs-view="${root}"][data-ready="true"]').filter({visible:true}).waitFor({timeout:30000});`}`;
async function capture(key, preparation, { selector = "main", dashboard = false, keyboard = false, cleanup = "" } = {}) {
  plannedSamples++;
  const expectedWidth = Number(key.split("-").at(-1));
  const screenshot = resolve(directory, `${key}.png`), viewportScreenshot = resolve(directory, `${key}-viewport.png`);
  try {
    const result = await run(key, `${helper}\nconst originalPage=page;let releasePending;try{${key.startsWith("readonly-") ? "" : `page=await (await originalPage.context().browser().newContext({storageState:{cookies:await originalPage.context().cookies(),origins:[]},viewport:{width:${expectedWidth},height:900},locale:'ko-KR',timezoneId:'Asia/Seoul',deviceScaleFactor:1})).newPage();page.on('request',originalPage.__audit797Listener);page.__densityReports=[];page.on('response',async response=>{if(response.url().endsWith('/resource-dashboard/views')&&response.request().postDataJSON()?.projection?.kind==='report'&&response.status()===200){const data=(await response.json()).data;page.__densityReports.push({snapshotId:data.snapshotId,spec:data.spec,filters:data.filters,totals:data.totals,range:data.range,asOfDate:data.asOfDate});}});`}${preparation}\nawait page.evaluate(async()=>{await document.fonts.ready;await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));window.scrollTo(0,0);});const facts=await observeUi(page,${JSON.stringify(selector)});if(facts.viewport.width!==${expectedWidth}||facts.viewport.height!==900)throw new Error('Actual viewport differs from expected '+${expectedWidth}+'x900');const metrics=await page.locator(${JSON.stringify(selector)}).evaluate(root=>{
      const visible=n=>n.checkVisibility({checkVisibilityCSS:true})&&!n.closest('[inert],[aria-hidden="true"],details:not([open]) > :not(summary)');const rect=n=>{if(!n)return null;const r=n.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom};};const nodes=s=>Array.from(root.querySelectorAll(s)).filter(visible);
      const active=Array.from(document.querySelectorAll('[data-testid="logistics-dashboard-view"],[data-wbs-view]')).find(visible);const kind=active?.getAttribute('data-wbs-view')??(active?'kpi':null);const summaries=active?Array.from(active.querySelectorAll(kind==='kpi'?'[class*="kpiGrid"]':'dl')).filter(visible):[];const values=active?Array.from(active.querySelectorAll(kind==='kpi'?'[class*="kpiValueRow"]':'dl dd')).filter(visible):[];const table=active?Array.from(active.querySelectorAll('table')).find(visible):null;const rows=table?Array.from(table.querySelectorAll('tbody tr')).filter(visible):[];
      const fullyVisible=n=>{const r=n.getBoundingClientRect();if(r.y<0||r.bottom>innerHeight||r.x<0||r.right>innerWidth)return false;for(let p=n.parentElement;p;p=p.parentElement){const s=getComputedStyle(p),b=p.getBoundingClientRect();if(['auto','scroll','hidden','clip'].includes(s.overflowY)&&(r.y<b.y||r.bottom>b.bottom))return false;if(['auto','scroll','hidden','clip'].includes(s.overflowX)&&(r.x<b.x||r.right>b.right))return false;}return true;};
      return {primary:active?{kind,root:rect(active),firstSummary:rect(summaries[0]),summaryCount:summaries.length,valueCount:values.length,values:values.map(n=>({text:n.textContent.trim(),...rect(n)})),fullyVisibleValues:values.filter(fullyVisible).length,table:rect(table),rowCount:rows.length,fullyVisibleRows:rows.filter(fullyVisible).length,ready:active.getAttribute('data-ready')}:null,headings:nodes('h1,h2,h3,h4').map(n=>({text:n.textContent.trim(),...rect(n)})),regions:nodes('[role="region"]').map(n=>({name:n.getAttribute('aria-label'),...rect(n),clientWidth:n.clientWidth,scrollWidth:n.scrollWidth,clientHeight:n.clientHeight,scrollHeight:n.scrollHeight,scrollTop:n.scrollTop,scrollLeft:n.scrollLeft,overflowX:getComputedStyle(n).overflowX})),summaries:nodes('dl,[class*="kpiGrid"],[class*="kpiCard"],[class*="filterBar"],[class*="summary"],[class*="controls"]').map(n=>({class:n.className,...rect(n)})),filters:nodes('label').map(n=>({text:n.textContent.trim(),...rect(n)})),states:nodes('[role="status"],[role="alert"]').map(n=>({role:n.getAttribute('role'),text:n.textContent.trim(),...rect(n)})),focus:{tag:document.activeElement?.tagName,name:document.activeElement?.getAttribute('aria-label')??document.activeElement?.textContent?.trim().slice(0,100),focusVisible:document.activeElement?.matches(':focus-visible'),outlineStyle:document.activeElement?getComputedStyle(document.activeElement).outlineStyle:null,rect:rect(document.activeElement)}};
    });await page.screenshot({path:${JSON.stringify(screenshot)},fullPage:true});${key.endsWith("-390") || key.endsWith("-1440") ? `await page.screenshot({path:${JSON.stringify(viewportScreenshot)},fullPage:false});` : ""}const version=await page.locator('.brand-version').textContent();return {facts,metrics,reports:page.__densityReports??[],domAppVersion:version?.trim(),browserVersion:page.context().browser().version()};}finally{releasePending?.();${cleanup}await page.unrouteAll({behavior:'wait'});if(page!==originalPage)await page.context().close();}`);
    const fullPng = await readFile(screenshot);
    if (fullPng.readUInt32BE(16) !== expectedWidth) throw new Error("Full-page screenshot width differs from expected viewport");
    const screenshotDimensions = {width:fullPng.readUInt32BE(16),height:fullPng.readUInt32BE(20)};
    if (key.endsWith("-390") || key.endsWith("-1440")) { const png = await readFile(viewportScreenshot); if (png.readUInt32BE(16) !== expectedWidth || png.readUInt32BE(20) !== 900) throw new Error("Viewport screenshot dimensions differ from expected size"); }
    if (result.domAppVersion !== `v${pinned.version}`) throw new Error("DOM app version differs from manifest");
    if (dashboard && (!result.metrics.primary || result.metrics.primary.valueCount < 1 || (result.metrics.primary.kind !== "kpi" && result.metrics.primary.rowCount < 1))) throw new Error("Normal dashboard ready but populated summary/table missing");
    const record = { key, expectedViewport:{width:expectedWidth,height:900}, screenshotDimensions, captureRunId, collectorHashAtStart, capturedAt: new Date().toISOString(), result: "OBSERVATION", dashboardNormal: dashboard, keyboardObserved: keyboard, screenshot: relative(repository, screenshot), viewportScreenshot: key.endsWith("-390") || key.endsWith("-1440") ? relative(repository, viewportScreenshot) : null, ...result };
    await save(`${key}.json`, record);
    observations.push({ key, file: `${key}.json`, primary: result.metrics.primary, documentOverflow: result.facts.document.scrollWidth - result.facts.document.clientWidth, tables: result.facts.tables.map(table => ({ y: table.rect.y, partiallyVisibleRows: table.visibleRows, totalRows: table.rows.length, owner: table.owner })) });
    console.log(JSON.stringify({ key, result: "OBSERVATION", documentOverflow: observations.at(-1).documentOverflow }));
  } catch (error) { faults.push({ key, result: "FAIL", reason: error.message.slice(0, 1000) }); console.log(JSON.stringify({ key, result: "FAIL", reason: error.message.slice(0, 300) })); }
}
if (phase === "capture" || phase === "dashboards") {
  for (const width of [390, 768, 1024, 1440, 1920]) for (const root of Object.keys(labels)) await capture(`${root}-${width}`, `${navigate(width)}${openRoot(root)}`, { dashboard: true });
}
const afterSnapshot = await run("after", `${snapshot}page.off('request',page.__audit797Listener);return {revision:data.project.revision,tasks:data.tasks.length,assignments:data.assignments?.length??0,fingerprint,writes:page.__audit797Writes,readOnlyPostQueries:page.__audit797Queries};`);
const collectorHashAtEnd = sha256(await readFile(fileURLToPath(import.meta.url)));
const preservationPassed = beforeSnapshot.fingerprint === afterSnapshot.fingerprint && afterSnapshot.writes.length === 0;
if (!preservationPassed) faults.push({key:"canonical-preservation",result:"FAIL",reason:"canonical changed or project mutation observed"});
if (collectorHashAtStart !== collectorHashAtEnd) faults.push({key:"collector-integrity",result:"FAIL",reason:"collector changed during capture"});
if (observations.length !== plannedSamples || plannedSamples === 0) faults.push({key:"sample-completeness",result:"FAIL",reason:`planned ${plannedSamples}; recorded ${observations.length}`});
const files = ["package.json","package-lock.json","tests/manual/issue-798-dashboard-density.mjs","tests/e2e/helpers/ui-geometry.ts","tests/e2e/fixtures/target-project.ts","tests/e2e/fixtures/wbs-view-composer.ts","tests/e2e/fixtures/isolated-application-diagnostics.ts","tests/e2e/helpers/read-only-requests.ts","node_modules/next/package.json","node_modules/@playwright/test/package.json"];
const tracked = execFileSync("git",["ls-files","src"],{cwd:repository,encoding:"utf8"}).trim().split("\n");
const hashes = async paths => Object.fromEntries(await Promise.all(paths.map(async path=>[path,sha256(await read(path))])));
await save(`${phase}-manifest.json`,{schemaVersion:2,captureRunId,collectorHashAtStart,collectorHashAtEnd,baselineComparable:true,sourceSha:execFileSync("git",["rev-parse","HEAD"],{cwd:repository,encoding:"utf8"}).trim(),capturedAt:new Date().toISOString(),phase,appVersion:pinned.version,installedNextVersion,installedPlaywrightVersion:JSON.parse(await read("node_modules/@playwright/test/package.json")).version,command:`node tests/manual/issue-798-dashboard-density.mjs ${phase}`,server:"npm run dev -- --hostname 127.0.0.1 --port 3198 --webpack",fixture:{source:"seedWbsViewComposer; real local HTTP/isolated SQLite",revision:fixture.revision,assertionAdapter:"minimal fail-closed status/truthiness/visibility; no runner attachments; archived SQLite seed unavailable",browserContextIsolation:"fresh cookie-only context for each sample; cookies copied in memory only; localStorage/sessionStorage empty; readonly sample has no cookies"},environment:{viewportHeight:900,widths:[390,768,1024,1440,1920],locale:"ko-KR",timezone:"Asia/Seoul",zoom:"100%; native125% NOT TESTED",browserExecutable:"existing chromium-1243; actual browser version in each observation; runner browser equivalence NOT TESTED",runtime:"Next dev webpack; production/remote NOT TESTED",screenshots:"*.png fullPage may include document extension with main-owned scroll clipping; *-viewport.png exactly viewport900; scroll owner coordinates in JSON"},hashes:await hashes(files),sourceHashes:await hashes(tracked),beforeSnapshot,afterSnapshot,preservationPassed,plannedSamples,observations,faults,notTested:["production build","remote PR CI","native125%","screen reader","real device","all state × all viewport combinations","import file chooser/preview","copy/export commit","complete keyboard navigation on every screen"]});
console.log(JSON.stringify({phase,observations:observations.length,faults:faults.length,result:faults.length?"PARTIAL":"CAPTURED"}));
if(faults.length)process.exitCode=1;
