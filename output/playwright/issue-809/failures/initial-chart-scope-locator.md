# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: issue-736-resource-dashboard.spec.ts >> #809 차트3유형 동일원본·개인80/Project140·정확상세·지연명령취소·일정복귀
- Location: tests/e2e/issue-736-resource-dashboard.spec.ts:265:5

# Error details

```
Test timeout of 180000ms exceeded.
```

```
Error: locator.selectOption: Test timeout of 180000ms exceeded.
Call log:
  - waiting for getByRole('region', { name: '리소스 차트', exact: true }).getByLabel('차트 부하 범위', { exact: true })

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
                    - button "기간 투입" [pressed] [ref=f2e66] [cursor=pointer]
                    - button "업무 집중" [ref=f2e67] [cursor=pointer]
                    - button "기여 분포" [ref=f2e68] [cursor=pointer]
                - generic "차트 조회 조건" [ref=f2e69]:
                  - generic [ref=f2e70]:
                    - text: 차트 작업 검색
                    - searchbox "차트 작업 검색" [ref=f2e71]: 통합 시운전
                  - generic [ref=f2e72]:
                    - text: 차트 시작일
                    - textbox "차트 시작일" [ref=f2e73]: 2026-10-14
                  - generic [ref=f2e74]:
                    - text: 차트 종료일
                    - textbox "차트 종료일" [active] [ref=f2e75]: 2026-10-14
                  - generic [ref=f2e76]:
                    - text: 차트 기간
                    - combobox "차트 기간" [ref=f2e77]:
                      - option "주간" [selected]
                      - option "월간"
                  - generic [ref=f2e78]:
                    - text: 차트 단위
                    - combobox "차트 단위" [ref=f2e79]:
                      - option "M/D" [selected]
                      - option "M/M" [disabled]
                  - button "차트 필터·범위" [ref=f2e80] [cursor=pointer]
                  - button "차트 새로고침" [ref=f2e81] [cursor=pointer]
                - paragraph [ref=f2e82]: 조회 2026-10-14–2026-10-14 · 기준일 2026-10-26 · 1 고유 Task / 1 개인 Assignment · Project 범위 · M/D
                - generic "차트 요약 위험" [ref=f2e83]:
                  - generic [ref=f2e84]:
                    - term [ref=f2e85]: 선택 계획공수
                    - definition [ref=f2e86]:
                      - button "0.8 M/D" [ref=f2e87] [cursor=pointer]
                  - generic [ref=f2e88]:
                    - term [ref=f2e89]: 동일 개인 Project 과투입
                    - definition [ref=f2e90]: 1명 · 1 개인·일
                  - generic [ref=f2e91]:
                    - term [ref=f2e92]: 초과 M/D · 완료 / 지연
                    - definition [ref=f2e93]:
                      - text: 0.4 ·
                      - button "0" [ref=f2e94] [cursor=pointer]
                      - text: /
                      - button "1" [ref=f2e95] [cursor=pointer]
                      - text: 건
                  - generic [ref=f2e96]:
                    - term [ref=f2e97]: 선택 공수 미설정 / T0 개인 미배정
                    - definition [ref=f2e98]:
                      - button "0" [ref=f2e99] [cursor=pointer]
                      - text: /
                      - button "0" [ref=f2e100] [cursor=pointer]
                      - text: 건
                - paragraph [ref=f2e101]: Group·Role·Milestone·실물 분류는 중복될 수 있어 소계를 합산하지 않습니다. 등록만 된 인원은 Capacity·계획공수를 만들지 않습니다. 계획은 실제 수행 실적이 아닙니다.
                - generic [ref=f2e102]:
                  - heading "기간별 계획과 Capacity" [level=4] [ref=f2e103]
                  - generic [ref=f2e104]:
                    - text: 차트 부하 범위
                    - combobox "차트 부하 범위" [ref=f2e105]:
                      - option "선택 조건 기여" [selected]
                      - option "동일 개인 Project 전체 참고"
                - paragraph [ref=f2e106]: 계획은 굵은 막대, Capacity는 얇은 기준 막대입니다. Capacity 단위는 M/D. Load 100% 초과·Peak day·초과 개인·일을 수치로 표시합니다. Group 평균이 낮아도 개인 위험은 아래 각 개인에 남습니다.
                - region "기간 투입 차트·데이터 표" [ref=f2e107]:
                  - table [ref=f2e108]:
                    - caption [ref=f2e109]: 현재 선택 조건 기여 · 주별 계획 / Capacity · 0부터 1 M/D 동일 축
                    - rowgroup [ref=f2e110]:
                      - row [ref=f2e111]:
                        - columnheader "개인" [ref=f2e112]
                        - columnheader "2026-W42 2026-10-14–2026-10-14" [ref=f2e113]: 2026-W422026-10-14–2026-10-14
                    - rowgroup [ref=f2e114]:
                      - row [ref=f2e115]:
                        - rowheader [ref=f2e116]:
                          - text: 공동 담당 인력
                          - button "현재 기간 원본" [ref=f2e117] [cursor=pointer]
                        - cell [ref=f2e118]:
                          - button "공동 담당 인력 · 2026-W42 · 선택 조건 · 0.8 M/D · Capacity 1 M/D · Load 80% · Peak day 80% · 초과 0 개인·일 / 0 M/D" [ref=f2e119] [cursor=pointer]:
                            - generic [ref=f2e125]: 0.8 M/D · Capacity 1 M/D · Load 80% · Peak day 80% · 초과 0 개인·일 / 0 M/D
                            - generic [ref=f2e126]: "같은 개인 Project 참고: Load 140% · 초과 1 개인·일 / 0.4 M/D"
                - generic [ref=f2e127]:
                  - button "이전 개인" [disabled] [ref=f2e128]
                  - generic [ref=f2e129]: 1–1 / 1 개인
                  - button "다음 개인" [disabled] [ref=f2e130]
                  - button "이전 기간" [disabled] [ref=f2e131]
                  - generic [ref=f2e132]: 1–1 / 1 기간
                  - button "다음 기간" [disabled] [ref=f2e133]
                - group [ref=f2e134]:
                  - generic "전체 Milestone Gate · 선택 완료율과 별도" [ref=f2e135] [cursor=pointer]
                - region "현재 리소스 계층 Excel" [ref=f2e136]:
                  - generic [ref=f2e137]:
                    - generic [ref=f2e138]:
                      - text: Excel 범위
                      - combobox "Excel 범위" [ref=f2e139]:
                        - option "현재 선택 조건·계층" [selected]
                        - option "Project 전체 (기간·기준일·환산 유지)"
                    - button "계층 Excel 보고서" [ref=f2e140] [cursor=pointer]
                  - paragraph [ref=f2e141]: 현재 개인 배정 조건·동적 계층·snapshot과 같은 원시 Task/Assignment를 출력합니다. 반복 경로는 근거이며 합산하지 않습니다.
                - group [ref=f2e142]:
                  - generic "차트 snapshot·범위·출처" [ref=f2e143] [cursor=pointer]
        - status
  - button "Open Next.js Dev Tools" [ref=f2e149] [cursor=pointer]
  - alert [ref=f2e153]
```

# Test source

```ts
  181 |   const changed=reportResponse(readonly,{spec:defaultSpec,filters:{taskSearch:"없는 작업"}});await root(readonly).getByLabel("작업 검색",{exact:true}).fill("없는 작업");await changed;await expect(root(readonly)).toHaveAttribute("data-ready","true");
  182 |   exportRelease();await expect.poll(()=>exportFinished).toBe(true);await readonly.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))));await readonly.unroute(exportPattern);await expect(root(readonly)).toContainText("고유 Task");expect(downloads).toBe(0);
  183 |  }finally{await context.close();}
  184 | });
  185 |
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
> 281 |  await charts.getByLabel("차트 부하 범위",{exact:true}).selectOption("project");await expect(period).toContainText("Load 140%");
      |                                                   ^ Error: locator.selectOption: Test timeout of 180000ms exceeded.
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
  296 |  await page.getByRole("region",{name:"임시 조회 범위",exact:true}).getByRole("button",{name:/원래 보기/}).click();await expect(schedule).toBeFocused();await expect(charts.getByLabel("차트 작업 검색",{exact:true})).toHaveValue(f.task.name);
  297 |  await detail.getByRole("button",{name:"차트 상세 닫기",exact:true}).click();
  298 |  const distribution=analysisResponse();await charts.getByRole("group",{name:"차트 유형",exact:true}).getByRole("button",{name:"기여 분포",exact:true}).click();const distributed=(await(await distribution).json()).data as WbsViewReportDto;await expect(charts).toHaveAttribute("data-chart-state","ready");expect(distributed.analysis?.total.assignmentIds).toEqual(ranked.analysis?.total.assignmentIds);
  299 |  await charts.getByLabel("기여 분류",{exact:true}).selectOption("process");await expect(charts).toHaveAttribute("data-chart-state","ready");await expect(charts.getByRole("region",{name:"공수·업무 분포 데이터 표",exact:true})).toContainText("0.8 M/D");
  300 |  // A source read error clears the chart rather than retaining actionable stale bars.
  301 |  await page.route(pattern,route=>route.request().postDataJSON().analysis?route.fulfill({status:401,json:{error:{code:"UNAUTHORIZED",message:"조회 권한 검증"}}}):route.continue());await charts.getByRole("button",{name:"차트 새로고침",exact:true}).click();await expect(charts).toHaveAttribute("data-chart-state","error");await expect(charts.getByRole("region",{name:"공수·업무 분포 데이터 표",exact:true})).toHaveCount(0);await page.unroute(pattern);
  302 | });
  303 |
```