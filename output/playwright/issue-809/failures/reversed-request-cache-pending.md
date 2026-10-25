# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: issue-736-resource-dashboard.spec.ts >> #809 chart interaction >> #809 차트3유형 동일원본·개인80/Project140·정확상세·지연명령취소·일정복귀
- Location: tests/e2e/issue-736-resource-dashboard.spec.ts:271:6

# Error details

```
TimeoutError: page.waitForResponse: Timeout 30000ms exceeded while waiting for event "response"
```

# Page snapshot

```yaml
- generic [ref=f2e1]:
  - generic [ref=f2e2]:
    - link "본문으로 바로가기" [ref=f2e3] [cursor=pointer]:
      - /url: "#main-content"
    - banner [ref=f2e4]:
      - generic [ref=f2e5]:
        - generic [ref=f2e6]:
          - link "masterGantt 홈" [ref=f2e7] [cursor=pointer]:
            - /url: /
            - generic [aria-hidden] [ref=f2e8]: M
            - generic [ref=f2e9]: masterGantt
          - generic [ref=f2e10]: v0.134.0
        - navigation "주요 메뉴" [ref=f2e11]:
          - link "프로젝트" [ref=f2e12] [cursor=pointer]:
            - /url: /
          - link "리소스" [ref=f2e13] [cursor=pointer]:
            - /url: /resources
          - link "물류 관리" [ref=f2e14] [cursor=pointer]:
            - /url: /logistics-admin
            - text: 물류
          - link "프로젝트 기준정보" [ref=f2e15] [cursor=pointer]:
            - /url: /project-master-admin
            - text: 기준정보
        - button "알림함" [ref=f2e17] [cursor=pointer]
    - main [ref=f2e20]:
      - generic [ref=f2e22]:
        - region [ref=f2e23]:
          - generic [ref=f2e24]:
            - generic [ref=f2e26]:
              - heading "실물 연결 실제 API 검증" [level=1] [ref=f2e27]
              - combobox "프로젝트 상태 변경" [ref=f2e28] [cursor=pointer]:
                - option "예정" [selected]
                - option "진행 중"
                - option "완료"
              - generic [ref=f2e29]: 편집 중
              - group [ref=f2e30]:
                - generic "프로젝트 정보 보기" [ref=f2e31] [cursor=pointer]: 정보
            - generic [ref=f2e32]:
              - button "실물 연결 실제 API 검증 프로젝트 링크 복사" [ref=f2e33] [cursor=pointer]: 링크 복사
              - button "내보내기" [ref=f2e34] [cursor=pointer]
              - button "프로젝트 설정" [ref=f2e35] [cursor=pointer]
              - group [ref=f2e36]:
                - generic "프로젝트 작업 더보기" [ref=f2e37] [cursor=pointer]: 더보기
          - tablist "프로젝트 작업공간" [ref=f2e38]:
            - tab "일정" [ref=f2e39] [cursor=pointer]
            - tab "대시보드" [selected] [ref=f2e40] [cursor=pointer]
            - tab "기준정보" [ref=f2e41] [cursor=pointer]
          - tabpanel "대시보드" [ref=f2e42]:
            - tablist "대시보드 보기" [ref=f2e43]:
              - tab "KPI" [ref=f2e44] [cursor=pointer]
              - tab "Milestone" [ref=f2e45] [cursor=pointer]
              - tab "공정&WorkArea" [ref=f2e46] [cursor=pointer]
              - tab "설비" [ref=f2e47] [cursor=pointer]
              - tab "물류 시스템" [ref=f2e48] [cursor=pointer]
              - tab "리소스" [selected] [ref=f2e49] [cursor=pointer]
          - tabpanel "리소스" [ref=f2e51]:
            - generic [ref=f2e52]:
              - group "리소스 분석 보기" [ref=f2e53]:
                - button "기본 현황" [ref=f2e54] [cursor=pointer]
                - button "차트" [pressed] [ref=f2e55] [cursor=pointer]
                - button "동적 계층 탐색" [ref=f2e56] [cursor=pointer]
                - button "Milestone 교차" [ref=f2e57] [cursor=pointer]
                - button "Resource Plan" [ref=f2e58] [cursor=pointer]
                - button "견적·Excel" [ref=f2e59] [cursor=pointer]
              - region "리소스 차트" [ref=f2e62]:
                - generic [ref=f2e63]:
                  - heading "리소스 차트" [level=3] [ref=f2e64]
                  - group "차트 유형" [ref=f2e65]:
                    - button "기간 투입" [ref=f2e66] [cursor=pointer]
                    - button "업무 집중" [ref=f2e67] [cursor=pointer]
                    - button "기여 분포" [pressed] [ref=f2e68] [cursor=pointer]
                - generic "차트 조회 조건" [ref=f2e69]:
                  - generic [ref=f2e70]:
                    - text: 차트 작업 검색
                    - searchbox "차트 작업 검색" [active] [ref=f2e71]: 통합 시운전
                  - generic [ref=f2e72]:
                    - text: 차트 시작일
                    - textbox "차트 시작일" [ref=f2e73]: 2026-10-14
                  - generic [ref=f2e74]:
                    - text: 차트 종료일
                    - textbox "차트 종료일" [ref=f2e75]: 2026-10-14
                  - generic [ref=f2e76]:
                    - text: 차트 기간
                    - combobox "차트 기간" [ref=f2e77]:
                      - option "주간" [selected]
                      - option "월간"
                  - generic [ref=f2e78]:
                    - text: 공수 표시 단위
                    - combobox "공수 표시 단위" [ref=f2e79]:
                      - option "M/D" [selected]
                      - option "M/M" [disabled]
                  - button "차트 필터·범위" [ref=f2e80] [cursor=pointer]
                  - button "차트 새로고침" [disabled] [ref=f2e81]
                - status [ref=f2e82]: 같은 원본의 차트·표를 조회 중…
        - status
  - button "Open Next.js Dev Tools" [ref=f2e88] [cursor=pointer]
  - alert [ref=f2e92]
```

# Test source

```ts
  186 | // Transport-observer regression: unrelated completed responses must not win the waiter.
  187 | test("#736 report 관측은 이전 필터·다른 spec·scope 응답을 제외한다",async({page})=>{
  188 |  const origin="http://issue736-observer.test";
  189 |  await page.route(`${origin}/**`,async route=>{
  190 |   if(route.request().method()!=="POST")return route.fulfill({contentType:"text/html",body:"<html><body>observer</body></html>"});
  191 |   const input=route.request().postDataJSON() as WbsViewQueryInput;
  192 |   await route.fulfill({json:{data:{projection:"report",spec:input.spec,filters:input.filters,sourceContext:{scope:input.scope},snapshotId:input.filters?.taskSearch}}});
  193 |  });
  194 |  await page.goto(`${origin}/projects/observer`);
  195 |  const condition:ReportCondition={spec:defaultSpec,filters:{taskSearch:"current",granularity:"week"}};
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
  262 |  await peers.getByRole("button",{name:"Resource Plan",exact:true}).click();await expect(report).toHaveAttribute("data-ready","true");
  263 |  const keptPlan=report.getByRole("region",{name:"Resource Plan",exact:true});await expect(keptPlan).toBeVisible();const planNode=await keptPlan.elementHandle();
  264 |  await peers.getByRole("button",{name:"차트",exact:true}).click();await expect(page.locator("[data-resource-charts]:visible")).toHaveAttribute("data-chart-state","ready");expect(await planNode!.evaluate(node=>node.isConnected)).toBe(true);
  265 |  await peers.getByRole("button",{name:"Resource Plan",exact:true}).click();await expect(report).toHaveAttribute("data-ready","true");await expect(keptPlan).toBeVisible();expect(await planNode!.evaluate(node=>node.isConnected)).toBe(true);await expect(page.locator("[data-resource-charts]")).toBeHidden();expect(await page.locator("[data-resource-charts]").boundingBox()).toBeNull();
  266 |  const after=await f.snapshot();expect(after.data).toEqual(before.data);
  267 | });
  268 |
  269 | test.describe("#809 chart interaction",()=>{
  270 |  test.use({hasTouch:true});
  271 |  test("#809 차트3유형 동일원본·개인80/Project140·정확상세·지연명령취소·일정복귀",async({page,isolatedApplication:origin,observeIsolatedApi})=>{
  272 |  test.setTimeout(180_000);
  273 |  const f=await seedWbsViewComposer(page,origin,observeIsolatedApi);
  274 |  const catalog=(await(await page.request.get(`${origin}/api/resources`)).json()).data;
  275 |  await f.mutate(`/tasks/${f.task.taskId}/assignments`,{catalogRevision:catalog.revision,targets:[{kind:"resource",id:f.resource.id,allocation:{start:"2026-10-14",end:"2026-10-14",percent:80}}]},"put");
  276 |  const added=await(await f.mutate("/tasks",{name:"차트 선택밖 원인",type:"task",start:"2026-10-14",duration:1,progress:0})).json();
  277 |  const outside=added.data.tasks.find((task:{name:string})=>task.name==="차트 선택밖 원인");
  278 |  await f.mutate(`/tasks/${outside.taskId}/assignments`,{catalogRevision:catalog.revision,targets:[{kind:"resource",id:f.resource.id,allocation:{start:"2026-10-14",end:"2026-10-14",percent:60}}]},"put");
  279 |  await page.reload();await openResource(page);
  280 |  const peer=page.getByRole("group",{name:"리소스 분석 보기",exact:true});
  281 |  await peer.getByRole("button",{name:"차트",exact:true}).click();
  282 |  const charts=page.getByRole("region",{name:"리소스 차트",exact:true});await expect(charts).toHaveAttribute("data-chart-state","ready");
  283 |  await page.emulateMedia({reducedMotion:"reduce"});await charts.getByRole("group",{name:"차트 유형",exact:true}).getByRole("button",{name:"기간 투입",exact:true}).tap();
  284 |  expect(await charts.getByRole("button",{name:"차트 새로고침",exact:true}).evaluate(element=>({reduced:matchMedia("(prefers-reduced-motion: reduce)").matches,animation:getComputedStyle(element).animationName,transition:getComputedStyle(element).transitionDuration}))).toEqual({reduced:true,animation:"none",transition:"0s"});
  285 |  let lastChartReport!:WbsViewReportDto;let chartReads=0;page.on("request",request=>{if(request.url().endsWith("/resource-dashboard/views")&&request.postDataJSON()?.analysis)chartReads++;});
> 286 |  const analysisResponse=()=>page.waitForResponse(response=>response.request().method()==="POST"&&response.url().endsWith("/resource-dashboard/views")&&!!response.request().postDataJSON().analysis&&response.status()===200,{timeout:30_000});
      |                                  ^ TimeoutError: page.waitForResponse: Timeout 30000ms exceeded while waiting for event "response"
  287 |  for(const [label,value] of [["차트 작업 검색",f.task.name],["차트 시작일","2026-10-14"],["차트 종료일","2026-10-14"]]){const next=analysisResponse();await charts.getByLabel(label,{exact:true}).fill(value);lastChartReport=(await(await next).json()).data;await expect(charts).toHaveAttribute("data-chart-state","ready");}
  288 |  const period=charts.getByRole("region",{name:"기간 투입 차트·데이터 표",exact:true});
  289 |  await expect(period).toContainText("Load 80%");await expect(period).toContainText("같은 개인 Project 참고: Load 140%");
  290 |  await charts.getByRole("combobox",{name:"차트 부하 범위",exact:true}).selectOption("project");await expect(period).toContainText("Load 140%");
  291 |  await charts.getByRole("button",{name:"현재 기간 원본",exact:true}).click();
  292 |  const detail=charts.getByRole("region",{name:"차트 원본 상세",exact:true});
  293 |  await expect(detail).toHaveAttribute("data-chart-detail-state","ready");await expect(detail.locator("[data-canonical-task-id]")).toHaveCount(2);
  294 |  await detail.getByRole("button",{name:"차트 상세 닫기",exact:true}).click();await expect(charts.getByRole("button",{name:"현재 기간 원본",exact:true})).toBeFocused();
  295 |  const equivalentReads=chartReads;await charts.getByRole("group",{name:"차트 유형",exact:true}).getByRole("button",{name:"업무 집중",exact:true}).click();const ranked=lastChartReport;expect(chartReads).toBe(equivalentReads);
  296 |  await expect(charts).toHaveAttribute("data-chart-state","ready");expect(ranked.analysis?.total.taskIds).toEqual([f.task.taskId]);expect(ranked.analysis?.total.assignmentIds).toHaveLength(1);
  297 |  await page.setViewportSize({width:390,height:900});
  298 |  const source=charts.getByRole("region",{name:"공수·업무 분포 데이터 표",exact:true}).getByRole("button",{name:`${f.resource.name} 원본`,exact:true});await source.focus();const selectedScroll=await charts.evaluate(element=>element.closest(".project-resource-panel")!.scrollTop);await source.press("Enter");await expect(detail.locator(`[data-canonical-task-id="${f.task.taskId}"]`)).toBeVisible();
  299 |  const original=detail.getByRole("button",{name:"Task 원본",exact:true});await original.click();const editor=page.getByRole("dialog",{name:"작업 정보",exact:true});await expect(editor).toBeVisible();await editor.getByRole("button",{name:"작업 편집기 닫기",exact:true}).click();await expect(original).toBeFocused();
  300 |  // Closing a detail invalidates an in-flight source confirmation before it can open an editor.
  301 |  const pattern=`**/api/projects/${f.publicId}/resource-dashboard/views`;
  302 |  let release!:()=>void,started!:()=>void;const gate=new Promise<void>(resolve=>release=resolve),captured=new Promise<void>(resolve=>started=resolve);let finished=false;
  303 |  await page.route(pattern,async route=>{if(route.request().postDataJSON().projection?.kind!=="scope")return route.continue();const response=await route.fetch();started();await gate;try{await route.fulfill({response});}catch{}finally{finished=true;}});
  304 |  await original.click();await captured;await detail.getByRole("button",{name:"차트 상세 닫기",exact:true}).click();release();await expect.poll(()=>finished).toBe(true);await page.unroute(pattern);await expect(editor).toHaveCount(0);await expect(source).toBeFocused();expect(await charts.evaluate(element=>element.closest(".project-resource-panel")!.scrollTop)).toBe(selectedScroll);
  305 |  const restored=await source.evaluate(element=>{const r=element.getBoundingClientRect(),p=element.closest(".project-resource-panel")!.getBoundingClientRect();return{top:r.top,bottom:r.bottom,panelTop:p.top,panelBottom:p.bottom};});expect(restored.top).toBeGreaterThanOrEqual(restored.panelTop);expect(restored.bottom).toBeLessThanOrEqual(restored.panelBottom);await page.setViewportSize({width:1440,height:1000});
  306 |  await source.click();const schedule=detail.getByRole("button",{name:"차트 선택 범위 일정 보기",exact:true});await schedule.click();await expect(page.getByRole("tablist",{name:"프로젝트 작업공간",exact:true}).getByRole("tab",{name:"일정",exact:true})).toHaveAttribute("aria-selected","true");
  307 |  await page.getByRole("region",{name:"임시 조회 범위",exact:true}).getByRole("button",{name:/원래 보기/}).click();await expect(schedule).toBeFocused();await expect(charts.getByLabel("차트 작업 검색",{exact:true})).toHaveValue(f.task.name);
  308 |  await detail.getByRole("button",{name:"차트 상세 닫기",exact:true}).click();
  309 |  const distribution=analysisResponse();await charts.getByRole("group",{name:"차트 유형",exact:true}).getByRole("button",{name:"기여 분포",exact:true}).click();const distributed=(await(await distribution).json()).data as WbsViewReportDto;await expect(charts).toHaveAttribute("data-chart-state","ready");expect(distributed.analysis?.total.assignmentIds).toEqual(ranked.analysis?.total.assignmentIds);
  310 |  await charts.getByRole("combobox",{name:"기여 분류",exact:true}).selectOption("process");await expect(charts).toHaveAttribute("data-chart-state","ready");await expect(charts.getByRole("region",{name:"공수·업무 분포 데이터 표",exact:true})).toContainText("0.8 M/D");
  311 |  // An older successful empty reply cannot replace a newer chart query.
  312 |  let oldRelease!:()=>void,oldStarted!:()=>void;const oldGate=new Promise<void>(resolve=>oldRelease=resolve),oldCaptured=new Promise<void>(resolve=>oldStarted=resolve);let oldFinished=false;
  313 |  await page.route(pattern,async route=>{const input=route.request().postDataJSON();if(!input.analysis||input.filters?.taskSearch!=="차트 없는 작업")return route.continue();const response=await route.fetch();oldStarted();await oldGate;try{await route.fulfill({response});}catch{}finally{oldFinished=true;}});
  314 |  await charts.getByLabel("차트 작업 검색",{exact:true}).fill("차트 없는 작업");await oldCaptured;
  315 |  const latest=analysisResponse();await charts.getByLabel("차트 작업 검색",{exact:true}).fill(f.task.name);await latest;await expect(charts).toHaveAttribute("data-chart-state","ready");oldRelease();await expect.poll(()=>oldFinished).toBe(true);await page.unroute(pattern);await expect(charts.getByRole("region",{name:"공수·업무 분포 데이터 표",exact:true})).toContainText("0.8 M/D");
  316 |  // A failed read-only source confirmation must not issue an original command.
  317 |  await charts.getByRole("region",{name:"공수·업무 분포 데이터 표",exact:true}).getByRole("button",{name:/공동 담당 인력.*원본/}).first().click();
  318 |  await page.route(pattern,route=>route.request().postDataJSON().projection?.kind==="scope"?route.fulfill({status:412,json:{error:{code:"REVISION_CONFLICT",message:"원본 충돌 검증"}}}):route.continue());
  319 |  await detail.getByRole("button",{name:"Task 원본",exact:true}).click();await expect(charts).toHaveAttribute("data-chart-state","stale");await expect(editor).toHaveCount(0);await page.unroute(pattern);
  320 |  // A source read error clears the chart rather than retaining actionable stale bars.
  321 |  await page.route(pattern,route=>route.request().postDataJSON().analysis?route.fulfill({status:401,json:{error:{code:"UNAUTHORIZED",message:"조회 권한 검증"}}}):route.continue());await charts.getByRole("button",{name:"차트 새로고침",exact:true}).click();await expect(charts).toHaveAttribute("data-chart-state","error");await expect(charts.getByRole("region",{name:"공수·업무 분포 데이터 표",exact:true})).toHaveCount(0);await page.unroute(pattern);
  322 | });
  323 | });
  324 |
```