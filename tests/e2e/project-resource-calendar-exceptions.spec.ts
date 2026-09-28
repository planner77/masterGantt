import { expect, test, isolatedApplicationOptions } from "./fixtures/isolated-application";
import type { WorkCalendarCustomDateDto } from "../../src/contracts/work-calendar";

test.use(isolatedApplicationOptions);

// Mock calendar/catalog responses isolate the editor's DTO, focus and stale-state contracts.
// Domain precedence and persistence are covered by the calendar service integration tests.
test("리소스 근무일 예외의 효과·저장·재열기·충돌·프로젝트 전환을 표시한다", async ({ page, baseURL }, testInfo) => {
  const created=await page.request.post("/api/projects",{headers:{Origin:baseURL!},data:{name:"Calendar exceptions #261",ownerName:"E2E 자동화",description:"근무일 날짜 예외 검증",editPassword:"Calendar261!"}});
  expect(created.status()).toBe(201);
  const publicId=(await created.json()).data.project.publicId as string;
  const original=(await (await page.request.get(`/api/projects/${publicId}/work-calendar`)).json()).data;
  const resourceId="22222222-2222-4222-8222-222222222222";
  const groupId="11111111-1111-4111-8111-111111111111";
  let customDates:WorkCalendarCustomDateDto[]=[];
  let conflict=false;
  let rejectCanonical=false;
  let savedDayType:string|undefined;
  await page.route((url)=>url.pathname.endsWith("/assignment-targets") && url.searchParams.has("kind"),async(route)=>{
    const kind=new URL(route.request().url()).searchParams.get("kind");
    await route.fulfill({json:{data:{catalogRevision:1,targets:[{kind,id:kind==="group"?groupId:resourceId,name:kind==="group"?"설계팀":"홍길동",code:null,active:true}]}}});
  });
  await page.route(`**/api/projects/${publicId}/work-calendar`,async(route)=>{
    if(route.request().method()==="GET") {if(rejectCanonical){await route.fulfill({status:401,json:{error:{code:"EDIT_SESSION_INVALID"}}});return;}await route.fulfill({json:{data:{...original,customDates}}});return;}
    if(conflict){await route.fulfill({status:409,json:{error:{code:"RESOURCE_CALENDAR_EXCEPTION_CONFLICT",details:[{path:"date",message:"2026-10-02"},{path:"rules.rule-a",message:"2026-10-02 · 홍길동 · 설계팀 / 지원팀 · 근무일 규칙 / 휴무일 규칙"}]}}});return;}
    const request=route.request().postDataJSON();
    savedDayType=request.customDates[0].dayType;
    customDates=request.customDates.map((entry:WorkCalendarCustomDateDto,index:number)=>({...entry,name:entry.name.trim(),id:`exception-${index}`}));
    await route.fulfill({json:{data:{projectRevision:original.projectRevision,calendar:{...original,customDates},changedTasks:[],manualConflicts:[],resourceExceptionEffects:[]}}});
  });
  await page.route(`**/api/projects/${publicId}/work-calendar/preview`,async(route)=>{
    if(conflict) {await route.fulfill({status:409,json:{error:{code:"RESOURCE_CALENDAR_EXCEPTION_CONFLICT",details:[{path:"date",code:"RESOURCE_CALENDAR_EXCEPTION_CONFLICT",message:"2026-10-02"},{path:"resourceId",code:"RESOURCE_CALENDAR_EXCEPTION_CONFLICT",message:resourceId},{path:"groupIds",code:"RESOURCE_CALENDAR_EXCEPTION_CONFLICT",message:groupId},{path:"rules.rule-a",code:"RESOURCE_CALENDAR_EXCEPTION_CONFLICT",message:"2026-10-02 · 홍길동 · 설계팀 / 지원팀 · 근무일 규칙 / 휴무일 규칙"}]}}});return;}
    const request=route.request().postDataJSON();
    const entry=request.customDates[0];
    const noEffect=entry.date==="2026-10-02";
    await route.fulfill({json:{data:{projectRevision:original.projectRevision,calendar:{...original,customDates:[]},changedTasks:[],manualConflicts:[],resourceExceptionEffects:[{
      ruleId:"draft-rule",customDateIndex:0,...entry,effect:noEffect?"NO_EFFECT":"CHANGED",warningCode:noEffect?"REDUNDANT_WORKING_EXCEPTION":null,
      affectedResources:[{resourceId,resourceName:"홍길동",beforeDayType:noEffect?"WORKING":"NON_WORKING",effectiveDayType:entry.dayType,effect:noEffect?"NO_EFFECT":"CHANGED",winningLayer:entry.targetType,winningSources:[{ruleId:"draft-rule",ruleName:entry.name,kind:"CUSTOM",countryCode:null,targetType:entry.targetType,targetId:entry.targetId,sourceVersion:null}]}],
    }]}}});
  });
  await page.goto(`/projects/${publicId}`);
  const open=async()=>{
    await page.getByRole("button",{name:"프로젝트 설정",exact:true}).click();
    const dialog=page.getByRole("dialog",{name:"프로젝트 설정",exact:true});
    await dialog.getByRole("tab",{name:"작업 캘린더"}).click();
    await expect(dialog.getByRole("button",{name:"날짜 예외 추가"})).toBeVisible();
    return dialog;
  };
  let dialog=await open();
  await page.screenshot({path:testInfo.outputPath("calendar-exceptions-empty-current.png"),fullPage:true});
  await dialog.getByRole("button",{name:"날짜 예외 추가"}).click();
  await dialog.getByLabel("날짜 예외 1 이름").fill(" 토요일 특별 근무 ");
  await dialog.getByLabel("예외 날짜 1").fill("2026-10-03");
  await dialog.getByLabel("예외 대상 1").selectOption("RESOURCE_GROUP");
  await dialog.getByLabel("대상 선택 1").selectOption(groupId);
  await dialog.getByLabel("일 유형 1").selectOption("WORKING");
  const calculate=async()=>{
    await dialog.getByRole("button",{name:"미리보기 계산"}).focus();
    await page.keyboard.press("Enter");
    await expect(dialog.locator("p[aria-atomic='true']")).toContainText("미리보기 계산 완료");
    await expect(dialog.getByRole("button",{name:"미리보기 계산"})).toBeFocused();
  };
  await calculate();
  await expect(dialog.getByText(/2026-10-03 · 리소스 그룹 설계팀/)).toContainText("적용됨");
  await dialog.getByText("리소스별 최종 적용 확인 (1명)").click();
  await expect(dialog.getByText(/홍길동: 예외 효과/)).toContainText("최종 근무일");
  await expect(dialog.getByText(/홍길동: 예외 효과/)).toContainText("근거 토요일 특별 근무");
  await dialog.getByLabel("일 유형 1").selectOption("NON_WORKING");
  await expect(dialog.locator("p[aria-atomic='true']")).toContainText("입력이 변경");
  await expect(dialog.getByRole("heading",{name:"리소스 날짜 예외 영향"})).toHaveCount(0);
  await dialog.getByLabel("일 유형 1").selectOption("WORKING");
  await dialog.getByLabel("예외 날짜 1").fill("2026-10-02");
  await calculate();
  await expect(dialog.getByText(/2026-10-02 · 리소스 그룹/)).toContainText("현재 효과 없음");
  await expect(dialog.getByText(/상위 캘린더와 같은/)).toContainText("저장할 수 있으며");
  for(const width of [390,768,1024,1440]) {
    await page.setViewportSize({width,height:900});
    await dialog.getByLabel("일 유형 1").scrollIntoViewIfNeeded();
    await expect(dialog.getByLabel("일 유형 1")).toBeVisible();
    const box=await dialog.getByLabel("일 유형 1").boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x+box!.width).toBeLessThanOrEqual(width);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth)).toBe(false);
    await page.screenshot({path:testInfo.outputPath(`calendar-exceptions-after-${width}.png`),fullPage:true});
  }
  await dialog.getByRole("button",{name:"작업 캘린더 저장"}).click();
  await expect.poll(()=>savedDayType).toBe("WORKING");
  await expect(dialog.getByLabel("날짜 예외 1 이름")).toHaveValue("토요일 특별 근무");
  await expect(dialog.locator("p[aria-atomic='true']")).toContainText("입력이 변경");
  await page.keyboard.press("Escape");
  dialog=await open();
  await expect(dialog.getByLabel("일 유형 1")).toHaveValue("WORKING");
  await dialog.getByLabel("예외 대상 1").selectOption("RESOURCE");
  await dialog.getByLabel("대상 선택 1").selectOption(resourceId);
  await calculate();
  await expect(dialog.getByText(/리소스 홍길동 · 근무일/)).toBeVisible();
  conflict=true;
  await dialog.getByRole("button",{name:"작업 캘린더 저장"}).click();
  await expect(dialog.getByRole("heading",{name:"리소스 날짜 예외 영향"})).toHaveCount(0);
  const summary=dialog.locator("[role='alert'][tabindex='-1']").filter({hasText:"같은 날짜"});
  await expect(summary).toBeFocused();
  await expect(dialog.getByLabel("예외 날짜 1")).toHaveAttribute("aria-invalid","true");
  await expect(dialog.getByLabel("예외 날짜 1")).toHaveAttribute("aria-describedby","calendar-exception-conflict");
  await expect(dialog.getByRole("button",{name:"작업 캘린더 저장"})).toBeDisabled();
  await expect(summary).toContainText("2026-10-02 · 홍길동 · 설계팀 / 지원팀");
  await summary.getByRole("button",{name:/날짜 예외 1 수정/}).click();
  await expect(dialog.getByLabel("예외 날짜 1")).toBeFocused();
  await dialog.getByLabel("날짜 예외 1 이름").fill("토요일 특별 근무 수정");
  await expect(dialog.getByRole("button",{name:"작업 캘린더 저장"})).toBeEnabled();
  await dialog.getByRole("button",{name:"미리보기 계산"}).click();
  await expect(summary).toBeFocused();
  await dialog.getByLabel("예외 대상 1").selectOption("PROJECT");
  await expect(dialog.getByLabel("일 유형 1")).toHaveValue("NON_WORKING");
  await expect(dialog.getByLabel("일 유형 1").getByRole("option",{name:"근무일",exact:true})).toHaveCount(0);
  await expect(dialog.getByText("프로젝트 전체에는 근무일 예외를 지정할 수 없어 휴무일로 변경했습니다.")).toBeVisible();
  await expect(summary).toHaveCount(0);
  conflict=false;
  rejectCanonical=true;
  await dialog.getByRole("button",{name:"작업 캘린더 저장"}).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByText("읽기 전용",{exact:true})).toBeVisible();
});
