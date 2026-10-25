# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: issue-736-resource-dashboard.spec.ts >> #809 차트3유형 동일원본·개인80/Project140·정확상세·지연명령취소·일정복귀
- Location: tests/e2e/issue-736-resource-dashboard.spec.ts:265:5

# Error details

```
Error: expect(locator).toBeFocused() failed

Locator:  getByRole('region', { name: '리소스 차트', exact: true }).getByRole('region', { name: '차트 원본 상세', exact: true }).getByRole('button', { name: '차트 선택 범위 일정 보기', exact: true })
Expected: focused
Received: inactive
Timeout:  5000ms

Call log:
  - Expect "toBeFocused" getByRole('region', { name: '리소스 차트', exact: true }).getByRole('region', { name: '차트 원본 상세', exact: true }).getByRole('button', { name: '차트 선택 범위 일정 보기', exact: true }) with timeout 5000ms
  - waiting for getByRole('region', { name: '리소스 차트', exact: true }).getByRole('region', { name: '차트 원본 상세', exact: true }).getByRole('button', { name: '차트 선택 범위 일정 보기', exact: true })
    12 × locator resolved to <button disabled type="button">차트 선택 범위 일정 보기</button>
       - unexpected value "inactive"

```

```yaml
- button "차트 선택 범위 일정 보기" [disabled]
```

# Test source

```ts
  196 |  const observed=reportResponse(page,condition);
  197 |  const send=async(input:WbsViewQueryInput)=>page.evaluate(async input=>{
  198 |   const response=await fetch("/api/projects/observer/resource-dashboard/views",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...input,projection:{kind:"report"}})});
  199 |   await response.json();
  200 |  },input);
  201 |  await send({spec:defaultSpec,filters:{taskSearch:"previous",granularity:"week"}});
  202 |  await send({...condition,spec:{...defaultSpec,levels:["process"]}});
  203 |  await send({...condition,scope:{kind:"exactAssignments",assignmentIds:["other-assignment"]}});
  204 |  await send(condition);
  205 |  const report=await observed;
  206 |  expect(report.snapshotId).toBe("current");expect(report.spec).toEqual(defaultSpec);expect(report.filters).toEqual(condition.filters);
  207 | });
  208 |
  209 | test("#807 단일 기본 작업면·독립 조건·명시적 기간 인계·숨은 조회 중단·peer 복원",async({page,isolatedApplication:origin,observeIsolatedApi},info)=>{
  210 |  test.setTimeout(180_000);
  211 |  const f=await seedWbsViewComposer(page,origin,observeIsolatedApi);
  212 |  const before=await f.snapshot();let dynamicReads=0,reportReads=0;
  213 |  page.on("request",request=>{const path=new URL(request.url()).pathname;if(path.endsWith("/resource-dashboard/views")&&request.postDataJSON()?.projection?.kind==="report")dynamicReads++;if(path.endsWith("/resource-dashboard"))reportReads++;});
  214 |  await page.getByRole("tablist",{name:"프로젝트 작업공간",exact:true}).getByRole("tab",{name:"대시보드",exact:true}).click();
  215 |  await page.getByRole("tablist",{name:"대시보드 보기",exact:true}).getByRole("tab",{name:"리소스",exact:true}).click();
  216 |  const report=page.locator('[data-resource-dashboard="true"]:visible');
  217 |  const peers=page.getByRole("group",{name:"리소스 분석 보기",exact:true});
  218 |  await expect(report).toHaveAttribute("data-ready","true");expect(dynamicReads).toBe(0);
  219 |  await expect(peers.getByRole("button",{name:"기본 현황",exact:true})).toHaveAttribute("aria-pressed","true");
  220 |  await expect(page.locator('[data-wbs-view="resource"]')).toBeHidden();
  221 |  await report.getByLabel("리소스·그룹·Task 이름과 코드 검색",{exact:true}).fill("공동");await expect(report).toHaveAttribute("data-ready","true");
  222 |  await report.getByLabel("기간 시작",{exact:true}).fill("2026-10-14");await expect(report).toHaveAttribute("data-ready","true");
  223 |  await report.getByLabel("기간 종료",{exact:true}).fill("2026-10-16");await expect(report).toHaveAttribute("data-ready","true");
  224 |  await report.getByRole("button",{name:/^필터/}).click();await report.getByLabel("Global Role",{exact:true}).selectOption("DEVELOPER");await expect(report).toHaveAttribute("data-ready","true");
  225 |  await report.getByLabel("Global Role",{exact:true}).press("Escape");
  226 |  const reportNode=await report.elementHandle();const reportRequests=reportReads;
  227 |  await peers.getByRole("button",{name:"동적 계층 탐색",exact:true}).focus();await page.keyboard.press("Space");
  228 |  await expect(root(page)).toHaveAttribute("data-ready","true");await expect(report).toHaveCount(0);
  229 |  await expect(root(page).getByLabel("조회 시작일",{exact:true})).toHaveValue("");await expect(root(page).getByLabel("작업 검색",{exact:true})).toHaveValue("");
  230 |  const activeReads=dynamicReads;
  231 |  const reentry=await openResourceDynamicView(page,{navigate:false});
  232 |  expect(reentry.request).toBeNull();expect(dynamicReads).toBe(activeReads);
  233 |  await openWbsViewControls(root(page));
  234 |  await expect(root(page).getByRole("combobox",{name:"Global Role",exact:true})).toHaveValue("");
  235 |  await expect(root(page)).toContainText("보고서 마지막 확정: 2026-10-14 ~ 2026-10-16");
  236 |  const imported=page.waitForResponse(response=>response.url().endsWith("/resource-dashboard/views")&&response.request().postDataJSON()?.projection?.kind==="report"&&response.request().postDataJSON().filters?.from==="2026-10-14"&&response.request().postDataJSON().filters?.to==="2026-10-16");
  237 |  await root(page).getByRole("button",{name:"보고서 기간·기준일 가져오기",exact:true}).click();expect((await imported).status()).toBe(200);await expect(root(page)).toHaveAttribute("data-ready","true");
  238 |  await expect(root(page).getByRole("combobox",{name:"Global Role",exact:true})).toHaveValue("");
  239 |  await root(page).getByLabel("작업 검색",{exact:true}).fill(f.task.name);await expect(root(page)).toHaveAttribute("data-ready","true");
  240 |  await page.evaluate(()=>window.dispatchEvent(new Event("focus")));await expect(root(page)).toHaveAttribute("data-ready","true");expect(reportReads).toBe(reportRequests);
  241 |  const dynamicNode=await root(page).elementHandle();
  242 |  const evidence=[];
  243 |  for(const width of [390,768,1024,1440,1920]){
  244 |   await page.setViewportSize({width,height:900});
  245 |   await peers.getByRole("button",{name:"기본 현황",exact:true}).focus();await page.keyboard.press("Enter");
  246 |   await expect(report).toHaveAttribute("data-ready","true");
  247 |   expect(await reportNode!.evaluate(node=>node.isConnected)).toBe(true);
  248 |   await expect(report.getByLabel("리소스·그룹·Task 이름과 코드 검색",{exact:true})).toHaveValue("공동");
  249 |   await report.getByRole("button",{name:/^필터/}).click();await expect(report.getByLabel("Global Role",{exact:true})).toHaveValue("DEVELOPER");await report.getByLabel("Global Role",{exact:true}).press("Escape");
  250 |   const controls=await report.locator('.resource-dashboard-filters input,.resource-dashboard-filters select,.resource-dashboard-filters > button').evaluateAll(nodes=>nodes.map(node=>{const r=node.getBoundingClientRect();return{top:r.top,height:r.height,width:r.width};}));
  251 |   expect(controls.every(control=>control.height>=44)).toBe(true);
  252 |   expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  253 |   evidence.push({width,controls});
  254 |   const hiddenDynamic=dynamicReads;
  255 |   await page.evaluate(()=>window.dispatchEvent(new Event("focus")));await expect(report).toHaveAttribute("data-ready","true");expect(dynamicReads).toBe(hiddenDynamic);
  256 |   await peers.getByRole("button",{name:"동적 계층 탐색",exact:true}).click();await expect(root(page)).toHaveAttribute("data-ready","true");
  257 |   expect(await dynamicNode!.evaluate(node=>node.isConnected)).toBe(true);
  258 |   await expect(root(page).getByLabel("작업 검색",{exact:true})).toHaveValue(f.task.name);
  259 |   await expect(root(page).getByLabel("조회 시작일",{exact:true})).toHaveValue("2026-10-14");
  260 |  }
  261 |  await info.attach("issue807-peer-controls",{body:JSON.stringify(evidence,null,2),contentType:"application/json"});
  262 |  const after=await f.snapshot();expect(after.data).toEqual(before.data);
  263 | });
  264 |
  265 | test("#809 차트3유형 동일원본·개인80/Project140·정확상세·지연명령취소·일정복귀",async({page,isolatedApplication:origin,observeIsolatedApi})=>{
  266 |  test.setTimeout(180_000);
  267 |  const f=await seedWbsViewComposer(page,origin,observeIsolatedApi);
  268 |  const catalog=(await(await page.request.get(`${origin}/api/resources`)).json()).data;
  269 |  await f.mutate(`/tasks/${f.task.taskId}/assignments`,{catalogRevision:catalog.revision,targets:[{kind:"resource",id:f.resource.id,allocation:{start:"2026-10-14",end:"2026-10-14",percent:80}}]},"put");
  270 |  const added=await(await f.mutate("/tasks",{name:"차트 선택밖 원인",type:"task",start:"2026-10-14",duration:1,progress:0})).json();
  271 |  const outside=added.data.tasks.find((task:{name:string})=>task.name==="차트 선택밖 원인");
  272 |  await f.mutate(`/tasks/${outside.taskId}/assignments`,{catalogRevision:catalog.revision,targets:[{kind:"resource",id:f.resource.id,allocation:{start:"2026-10-14",end:"2026-10-14",percent:60}}]},"put");
  273 |  await page.reload();await openResource(page);
  274 |  const peer=page.getByRole("group",{name:"리소스 분석 보기",exact:true});
  275 |  await peer.getByRole("button",{name:"차트",exact:true}).click();
  276 |  const charts=page.getByRole("region",{name:"리소스 차트",exact:true});await expect(charts).toHaveAttribute("data-chart-state","ready");
  277 |  const analysisResponse=()=>page.waitForResponse(response=>response.request().method()==="POST"&&response.url().endsWith("/resource-dashboard/views")&&!!response.request().postDataJSON().analysis&&response.status()===200);
  278 |  for(const [label,value] of [["차트 작업 검색",f.task.name],["차트 시작일","2026-10-14"],["차트 종료일","2026-10-14"]]){const next=analysisResponse();await charts.getByLabel(label,{exact:true}).fill(value);await next;await expect(charts).toHaveAttribute("data-chart-state","ready");}
  279 |  const period=charts.getByRole("region",{name:"기간 투입 차트·데이터 표",exact:true});
  280 |  await expect(period).toContainText("Load 80%");await expect(period).toContainText("같은 개인 Project 참고: Load 140%");
  281 |  await charts.getByRole("combobox",{name:"차트 부하 범위",exact:true}).selectOption("project");await expect(period).toContainText("Load 140%");
  282 |  await charts.getByRole("button",{name:"현재 기간 원본",exact:true}).click();
  283 |  const detail=charts.getByRole("region",{name:"차트 원본 상세",exact:true});
  284 |  await expect(detail).toHaveAttribute("data-chart-detail-state","ready");await expect(detail.locator("[data-canonical-task-id]")).toHaveCount(2);
  285 |  await detail.getByRole("button",{name:"차트 상세 닫기",exact:true}).click();await expect(charts.getByRole("button",{name:"현재 기간 원본",exact:true})).toBeFocused();
  286 |  const concentration=analysisResponse();await charts.getByRole("group",{name:"차트 유형",exact:true}).getByRole("button",{name:"업무 집중",exact:true}).click();const ranked=(await(await concentration).json()).data as WbsViewReportDto;
  287 |  await expect(charts).toHaveAttribute("data-chart-state","ready");expect(ranked.analysis?.total.taskIds).toEqual([f.task.taskId]);expect(ranked.analysis?.total.assignmentIds).toHaveLength(1);
  288 |  const source=charts.getByRole("region",{name:"공수·업무 분포 데이터 표",exact:true}).getByRole("button",{name:`${f.resource.name} 원본`,exact:true});await source.focus();await source.press("Enter");await expect(detail.locator(`[data-canonical-task-id="${f.task.taskId}"]`)).toBeVisible();
  289 |  const original=detail.getByRole("button",{name:"Task 원본",exact:true});await original.click();const editor=page.getByRole("dialog",{name:"작업 정보",exact:true});await expect(editor).toBeVisible();await editor.getByRole("button",{name:"작업 편집기 닫기",exact:true}).click();await expect(original).toBeFocused();
  290 |  // Closing a detail invalidates an in-flight source confirmation before it can open an editor.
  291 |  const pattern=`**/api/projects/${f.publicId}/resource-dashboard/views`;
  292 |  let release!:()=>void,started!:()=>void;const gate=new Promise<void>(resolve=>release=resolve),captured=new Promise<void>(resolve=>started=resolve);let finished=false;
  293 |  await page.route(pattern,async route=>{if(route.request().postDataJSON().projection?.kind!=="scope")return route.continue();const response=await route.fetch();started();await gate;try{await route.fulfill({response});}catch{}finally{finished=true;}});
  294 |  await original.click();await captured;await detail.getByRole("button",{name:"차트 상세 닫기",exact:true}).click();release();await expect.poll(()=>finished).toBe(true);await page.unroute(pattern);await expect(editor).toHaveCount(0);await expect(source).toBeFocused();
  295 |  await source.click();const schedule=detail.getByRole("button",{name:"차트 선택 범위 일정 보기",exact:true});await schedule.click();await expect(page.getByRole("tablist",{name:"프로젝트 작업공간",exact:true}).getByRole("tab",{name:"일정",exact:true})).toHaveAttribute("aria-selected","true");
> 296 |  await page.getByRole("region",{name:"임시 조회 범위",exact:true}).getByRole("button",{name:/원래 보기/}).click();await expect(schedule).toBeFocused();await expect(charts.getByLabel("차트 작업 검색",{exact:true})).toHaveValue(f.task.name);
      |                                                                                                                                ^ Error: expect(locator).toBeFocused() failed
  297 |  await detail.getByRole("button",{name:"차트 상세 닫기",exact:true}).click();
  298 |  const distribution=analysisResponse();await charts.getByRole("group",{name:"차트 유형",exact:true}).getByRole("button",{name:"기여 분포",exact:true}).click();const distributed=(await(await distribution).json()).data as WbsViewReportDto;await expect(charts).toHaveAttribute("data-chart-state","ready");expect(distributed.analysis?.total.assignmentIds).toEqual(ranked.analysis?.total.assignmentIds);
  299 |  await charts.getByRole("combobox",{name:"기여 분류",exact:true}).selectOption("process");await expect(charts).toHaveAttribute("data-chart-state","ready");await expect(charts.getByRole("region",{name:"공수·업무 분포 데이터 표",exact:true})).toContainText("0.8 M/D");
  300 |  // A source read error clears the chart rather than retaining actionable stale bars.
  301 |  await page.route(pattern,route=>route.request().postDataJSON().analysis?route.fulfill({status:401,json:{error:{code:"UNAUTHORIZED",message:"조회 권한 검증"}}}):route.continue());await charts.getByRole("button",{name:"차트 새로고침",exact:true}).click();await expect(charts).toHaveAttribute("data-chart-state","error");await expect(charts.getByRole("region",{name:"공수·업무 분포 데이터 표",exact:true})).toHaveCount(0);await page.unroute(pattern);
  302 | });
  303 |
```