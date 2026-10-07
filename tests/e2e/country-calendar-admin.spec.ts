import { expect, test, type Page, type Route } from "@playwright/test";

type DateRow={date:string;name:string;dayType:"NON_WORKING"|"WORKING";sourceKey:string};

async function installCalendarMocks(page:Page){
  let loggedIn=false;
  let revision=1;
  let dates:DateRow[]=[
    {date:"2026-01-01",name:"신정",dayType:"NON_WORKING",sourceKey:"new-year"},
    {date:"2026-02-14",name:"보충 근무",dayType:"WORKING",sourceKey:"working-swap"},
  ];
  let status:"OFFICIAL"|"UNAVAILABLE"="OFFICIAL";
  let sourceVersion:string|null="KR-2026-official-1";
  let sourceUrl:string|null="https://example.go.kr/2026";

  const response=()=>({
    data:{
      revision,
      dataset:{
        countryCode:"KR",countryName:"대한민국",year:2026,status,origin:"OVERRIDE" as const,
        sourceVersion,sourceUrl,dateCount:dates.length,updatedAt:"2026-09-30T09:00:00.000Z",
      },
      dates,
    },
  });

  await page.route("**/api/project-master/admin-sessions",async(route)=>{
    if(route.request().method()==="POST"){loggedIn=true;await route.fulfill({status:201,json:{data:{permission:"project_master_admin",expiresAt:"2026-10-01T00:00:00.000Z"}}});return;}
    await route.fulfill({status:204});
  });

  await page.route("**/api/admin/work-calendars/import/preview",async(route)=>{
    const envelope=route.request().postDataJSON() as {content:string};
    const imported=JSON.parse(envelope.content) as {countryCode:"KR";year:2026;sourceVersion:string;sourceUrl:string;dates:DateRow[]};
    await route.fulfill({status:200,headers:{ETag:`"${revision}"`},json:{
      data:{
        revision,previewToken:`preview-${revision}-${imported.sourceVersion}`,dataset:response().data.dataset,
        importDataset:{countryCode:imported.countryCode,year:imported.year,status:"OFFICIAL",sourceVersion:imported.sourceVersion,sourceUrl:imported.sourceUrl,dateCount:imported.dates.length},
        summary:{additions:imported.dates.length,changes:0,deletions:dates.length,unchanged:0},
      },
    }});
  });
  await page.route("**/api/admin/work-calendars/import/apply",async(route)=>{
    const body=route.request().postDataJSON() as {previewToken:string;envelope:{content:string}};
    const imported=JSON.parse(body.envelope.content) as {sourceVersion:string;sourceUrl:string;dates:DateRow[]};
    if(body.previewToken!==`preview-${revision}-${imported.sourceVersion}`){
      await route.fulfill({status:409,json:{error:{code:"COUNTRY_CALENDAR_IMPORT_PREVIEW_MISMATCH"}}});return;
    }
    revision+=1;dates=imported.dates;status="OFFICIAL";
    sourceVersion=imported.sourceVersion;sourceUrl=imported.sourceUrl;
    await route.fulfill({status:200,headers:{ETag:`"${revision}"`},json:response()});
  });
  await page.route("**/api/admin/work-calendars/countries/**",async(route:Route)=>{
    if(!loggedIn){await route.fulfill({status:401,json:{error:{code:"PROJECT_MASTER_ADMIN_REQUIRED"}}});return;}
    const request=route.request();
    const url=new URL(request.url());
    const method=request.method();
    const isDate=/\/dates(?:\/([^/]+))?$/.exec(url.pathname);
    if(method==="GET"){await route.fulfill({status:200,headers:{ETag:`"${revision}"`},json:response()});return;}
    if(method==="POST"&&isDate){
      const body=JSON.parse(request.postData()??"{}") as DateRow;
      dates=[...dates,body].sort((a,b)=>a.date.localeCompare(b.date));status="UNAVAILABLE";sourceVersion=null;sourceUrl=null;revision+=1;
    }else if(method==="PATCH"&&isDate?.[1]){
      const original=decodeURIComponent(isDate[1]);
      const body=JSON.parse(request.postData()??"{}") as Partial<DateRow>;
      const current=dates.find(item=>item.date===original);
      const merged=current?{...current,...body}:undefined;
      const unchanged=!!current&&!!merged&&current.date===merged.date&&current.name===merged.name&&current.dayType===merged.dayType&&current.sourceKey===merged.sourceKey;
      if(!unchanged){
        dates=dates.map(item=>item.date===original?{...item,...body} as DateRow:item).sort((a,b)=>a.date.localeCompare(b.date));
        status="UNAVAILABLE";sourceVersion=null;sourceUrl=null;revision+=1;
      }
    }else if(method==="DELETE"&&isDate?.[1]){
      const original=decodeURIComponent(isDate[1]);dates=dates.filter(item=>item.date!==original);status="UNAVAILABLE";sourceVersion=null;sourceUrl=null;revision+=1;
    }else if(method==="PATCH"){
      const body=JSON.parse(request.postData()??"{}") as {status?:"OFFICIAL"|"UNAVAILABLE";sourceVersion?:string|null;sourceUrl?:string|null};
      status=body.status??status;sourceVersion=body.sourceVersion===undefined?sourceVersion:body.sourceVersion;sourceUrl=body.sourceUrl===undefined?sourceUrl:body.sourceUrl;revision+=1;
    }
    await route.fulfill({status:200,headers:{ETag:`"${revision}"`},json:response()});
  });
}

test("Issue #342: 관리자에서 Import Preview/Apply와 휴일 CRUD를 완료한다",async({page})=>{
  await installCalendarMocks(page);
  await page.goto("/calendar-admin");
  await page.getByLabel("관리자 비밀번호",{exact:true}).fill("admin");
  await page.getByRole("button",{name:"로그인",exact:true}).click();

  await expect(page.getByRole("heading",{name:"대한민국 2026"})).toBeVisible();
  await expect(page.getByText("근무",{exact:true})).toBeVisible();

  const upload={
    countryCode:"KR",year:2026,sourceVersion:"KR-2026-upload-2",sourceUrl:"https://example.go.kr/upload",
    dates:[{date:"2026-12-25",name:"기독탄신일",dayType:"NON_WORKING",sourceKey:"christmas"}],
  };
  const fileInput=page.getByLabel("파일",{exact:true});
  await fileInput.setInputFiles({
    name:"kr-2026.json",mimeType:"application/json",buffer:Buffer.from(JSON.stringify(upload)),
  });
  await page.getByRole("button",{name:"업로드 전 검증"}).click();
  await expect(page.getByText("추가 1")).toBeVisible();
  await page.getByRole("button",{name:"검증 결과 적용"}).click();
  await expect(page.getByLabel("Source version")).toHaveValue("KR-2026-upload-2");
  await expect(page.getByText("기독탄신일")).toBeVisible();
  await expect(fileInput).toHaveValue("");
  await fileInput.setInputFiles({
    name:"kr-2026.json",mimeType:"application/json",buffer:Buffer.from(JSON.stringify(upload)),
  });
  await expect(page.getByRole("button",{name:"업로드 전 검증"})).toBeEnabled();

  await page.getByLabel("날짜",{exact:true}).first().fill("2026-12-31");
  await page.getByLabel("이름",{exact:true}).first().fill("연말 휴일");
  await page.getByLabel("sourceKey",{exact:true}).first().fill("year-end");
  await page.getByRole("button",{name:"추가",exact:true}).click();
  await expect(page.getByText("연말 휴일")).toBeVisible();
  await expect(page.getByRole("status",{name:"Dataset 상태: 미확보"})).toBeVisible();
  await expect(page.getByLabel("Source version")).toHaveValue("");
  await expect(page.getByText("수동 날짜 변경으로 공식 상태와 출처 정보가 해제되었습니다. 검증 후 메타데이터를 다시 저장해 주세요.",{exact:true})).toBeVisible();

  const row=page.getByRole("row").filter({hasText:"연말 휴일"});
  await row.getByRole("button",{name:"편집"}).click();
  await page.getByRole("dialog").getByLabel("이름",{exact:true}).fill("연말 휴일 수정");
  await page.getByRole("dialog").getByRole("button",{name:"저장"}).click();
  await expect(page.getByText("연말 휴일 수정")).toBeVisible();

  const edited=page.getByRole("row").filter({hasText:"연말 휴일 수정"});
  await edited.getByRole("button",{name:"삭제"}).click();
  await expect(page.getByRole("dialog",{name:"캘린더 날짜 삭제"})).toBeVisible();
  await page.getByRole("dialog").getByRole("button",{name:"삭제",exact:true}).click();
  await expect(page.getByText("연말 휴일 수정")).toHaveCount(0);
});

test("Issue #342: 390/768/1024/1440px에서 관리자 화면에 document overflow가 없다",async({page})=>{
  await installCalendarMocks(page);
  await page.goto("/calendar-admin");
  await page.getByLabel("관리자 비밀번호",{exact:true}).fill("admin");
  await page.getByRole("button",{name:"로그인",exact:true}).click();

  for(const width of [390,768,1024,1440]){
    await page.setViewportSize({width,height:900});
    await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1)).toBe(true);
    await expect(page.getByRole("heading",{name:"국가 캘린더 관리"})).toBeVisible();
  }
});

test("Issue #342: 빠른 파일 재선택은 마지막 파일 내용만 Preview/Apply에 사용한다",async({page})=>{
  await installCalendarMocks(page);
  await page.goto("/calendar-admin");
  await page.getByLabel("관리자 비밀번호",{exact:true}).fill("admin");
  await page.getByRole("button",{name:"로그인",exact:true}).click();

  await page.evaluate(()=>{
    const original=File.prototype.text;
    let calls=0;
    File.prototype.text=function(){
      calls+=1;
      const pending=original.call(this);
      if(calls!==1)return pending;
      return pending.then((value)=>new Promise<string>((resolve)=>setTimeout(()=>resolve(value),200)));
    };
  });

  const first={countryCode:"KR",year:2026,sourceVersion:"KR-2026-A",sourceUrl:"https://example.go.kr/a",dates:[{date:"2026-11-01",name:"A",dayType:"NON_WORKING",sourceKey:"a"}]};
  const second={countryCode:"KR",year:2026,sourceVersion:"KR-2026-B",sourceUrl:"https://example.go.kr/b",dates:[{date:"2026-11-02",name:"B",dayType:"NON_WORKING",sourceKey:"b"}]};
  const input=page.getByLabel("파일",{exact:true});
  await input.setInputFiles({name:"a.json",mimeType:"application/json",buffer:Buffer.from(JSON.stringify(first))});
  await input.setInputFiles({name:"b.json",mimeType:"application/json",buffer:Buffer.from(JSON.stringify(second))});
  await page.waitForTimeout(300);

  await page.getByRole("button",{name:"업로드 전 검증"}).click();
  await page.getByRole("button",{name:"검증 결과 적용"}).click();
  await expect(page.getByLabel("Source version")).toHaveValue("KR-2026-B");
  await expect(page.getByText("B",{exact:true})).toBeVisible();
  await expect(page.getByText("A",{exact:true})).toHaveCount(0);
});

test("Issue #342: 조회 실패는 선택 target과 이전 snapshot을 섞지 않는다",async({page})=>{
  await installCalendarMocks(page);
  await page.goto("/calendar-admin");
  await page.getByLabel("관리자 비밀번호",{exact:true}).fill("admin");
  await page.getByRole("button",{name:"로그인",exact:true}).click();
  await expect(page.getByRole("heading",{name:"대한민국 2026"})).toBeVisible();

  const failGet=async(route:Route)=>{
    if(route.request().method()==="GET"){await route.fulfill({status:500,json:{error:{code:"TEST_ERROR"}}});return;}
    await route.fallback();
  };
  await page.route("**/api/admin/work-calendars/countries/CN/years/2026",failGet);
  await page.getByLabel("국가",{exact:true}).selectOption("CN");
  await expect(page.getByRole("heading",{name:"대한민국 2026"})).toHaveCount(0);
  await expect(page.getByText("국가 캘린더 데이터를 불러오지 못했습니다.",{exact:true})).toBeVisible();
  await expect(page.getByRole("button",{name:"메타데이터 저장"})).toBeDisabled();
  await page.unroute("**/api/admin/work-calendars/countries/CN/years/2026",failGet);
});

test("Issue #342: 412 reload 뒤 stale 날짜 편집 초안을 폐기한다",async({page})=>{
  await installCalendarMocks(page);
  await page.goto("/calendar-admin");
  await page.getByLabel("관리자 비밀번호",{exact:true}).fill("admin");
  await page.getByRole("button",{name:"로그인",exact:true}).click();

  const row=page.getByRole("row").filter({hasText:"신정"});
  await row.getByRole("button",{name:"편집"}).click();
  const dialog=page.getByRole("dialog",{name:"캘린더 날짜 편집"});
  await dialog.getByLabel("이름",{exact:true}).fill("stale draft");

  const conflict=async(route:Route)=>{
    if(route.request().method()==="PATCH"){await route.fulfill({status:412,json:{error:{code:"COUNTRY_CALENDAR_REVISION_MISMATCH"}}});return;}
    await route.fallback();
  };
  await page.route("**/api/admin/work-calendars/countries/KR/years/2026/dates/2026-01-01",conflict);
  await dialog.getByRole("button",{name:"저장",exact:true}).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByText("다른 관리 변경이 먼저 저장되어 최신 데이터를 다시 불러왔습니다. 열린 편집 초안은 폐기되었습니다.",{exact:true})).toBeVisible();
  await page.unroute("**/api/admin/work-calendars/countries/KR/years/2026/dates/2026-01-01",conflict);
});

test("Issue #342: 변경 없는 날짜 저장은 OFFICIAL provenance를 유지한다",async({page})=>{
  await installCalendarMocks(page);
  await page.goto("/calendar-admin");
  await page.getByLabel("관리자 비밀번호",{exact:true}).fill("admin");
  await page.getByRole("button",{name:"로그인",exact:true}).click();

  const before=await page.getByLabel("Source version").inputValue();
  const row=page.getByRole("row").filter({hasText:"신정"});
  await row.getByRole("button",{name:"편집"}).click();
  const dialog=page.getByRole("dialog",{name:"캘린더 날짜 편집"});
  await dialog.getByRole("button",{name:"저장",exact:true}).click();

  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("status",{name:"Dataset 상태: 공식"})).toBeVisible();
  await expect(page.getByLabel("Source version")).toHaveValue(before);
});

test("Issue #342: 국가 전환은 신규 날짜와 파일 draft를 폐기한다",async({page})=>{
  await installCalendarMocks(page);
  await page.goto("/calendar-admin");
  await page.getByLabel("관리자 비밀번호",{exact:true}).fill("admin");
  await page.getByRole("button",{name:"로그인",exact:true}).click();

  await page.getByLabel("날짜",{exact:true}).first().fill("2026-12-30");
  await page.getByLabel("이름",{exact:true}).first().fill("KR draft");
  await page.getByLabel("sourceKey",{exact:true}).first().fill("kr-draft");
  const fileInput=page.getByLabel("파일",{exact:true});
  await fileInput.setInputFiles({
    name:"draft.json",mimeType:"application/json",buffer:Buffer.from(JSON.stringify({
      countryCode:"KR",year:2026,sourceVersion:"draft",sourceUrl:"https://example.go.kr/draft",
      dates:[{date:"2026-12-30",name:"draft",dayType:"NON_WORKING",sourceKey:"draft"}],
    })),
  });
  await expect(page.getByRole("button",{name:"업로드 전 검증"})).toBeEnabled();

  await page.getByLabel("국가",{exact:true}).selectOption("CN");
  await expect(page.getByLabel("날짜",{exact:true}).first()).toHaveValue("");
  await expect(page.getByLabel("이름",{exact:true}).first()).toHaveValue("");
  await expect(page.getByLabel("sourceKey",{exact:true}).first()).toHaveValue("");
  await expect(fileInput).toHaveValue("");
  await expect(page.getByRole("button",{name:"업로드 전 검증"})).toBeDisabled();
});

test("Issue #342: DELETE pending 중 취소 버튼은 동작하지 않는다",async({page})=>{
  await installCalendarMocks(page);
  await page.goto("/calendar-admin");
  await page.getByLabel("관리자 비밀번호",{exact:true}).fill("admin");
  await page.getByRole("button",{name:"로그인",exact:true}).click();

  let releaseDelete!:()=>void;
  const gate=new Promise<void>((resolve)=>{releaseDelete=resolve;});
  const delayedDelete=async(route:Route)=>{
    if(route.request().method()!=="DELETE"){await route.fallback();return;}
    await gate;
    await route.fallback();
  };
  await page.route("**/api/admin/work-calendars/countries/KR/years/2026/dates/2026-01-01",delayedDelete);

  const row=page.getByRole("row").filter({hasText:"신정"});
  await row.getByRole("button",{name:"삭제"}).click();
  const dialog=page.getByRole("dialog",{name:"캘린더 날짜 삭제"});
  await dialog.getByRole("button",{name:"삭제",exact:true}).click();
  await expect(dialog.getByRole("button",{name:"취소",exact:true})).toBeDisabled();
  await expect(dialog).toBeVisible();

  releaseDelete();
  await expect(dialog).toHaveCount(0);
  await page.unroute("**/api/admin/work-calendars/countries/KR/years/2026/dates/2026-01-01",delayedDelete);
});

test("Issue #342: PATCH pending 중 편집 취소는 비활성화된다",async({page})=>{
  await installCalendarMocks(page);
  await page.goto("/calendar-admin");
  await page.getByLabel("관리자 비밀번호",{exact:true}).fill("admin");
  await page.getByRole("button",{name:"로그인",exact:true}).click();

  let releasePatch!:()=>void;
  const gate=new Promise<void>((resolve)=>{releasePatch=resolve;});
  const delayedPatch=async(route:Route)=>{
    if(route.request().method()!=="PATCH"){await route.fallback();return;}
    await gate;
    await route.fallback();
  };
  await page.route("**/api/admin/work-calendars/countries/KR/years/2026/dates/2026-01-01",delayedPatch);

  const row=page.getByRole("row").filter({hasText:"신정"});
  await row.getByRole("button",{name:"편집"}).click();
  const dialog=page.getByRole("dialog",{name:"캘린더 날짜 편집"});
  await dialog.getByLabel("이름",{exact:true}).fill("pending edit");
  await dialog.getByRole("button",{name:"저장",exact:true}).click();
  await expect(dialog.getByRole("button",{name:"취소",exact:true})).toBeDisabled();
  await expect(dialog).toBeVisible();

  releasePatch();
  await expect(dialog).toHaveCount(0);
  await page.unroute("**/api/admin/work-calendars/countries/KR/years/2026/dates/2026-01-01",delayedPatch);
});

test("Issue #342: 401 재인증은 stale edit/delete draft를 폐기한다",async({page})=>{
  await installCalendarMocks(page);
  await page.goto("/calendar-admin");
  await page.getByLabel("관리자 비밀번호",{exact:true}).fill("admin");
  await page.getByRole("button",{name:"로그인",exact:true}).click();

  const row=page.getByRole("row").filter({hasText:"신정"});
  await row.getByRole("button",{name:"편집"}).click();
  const dialog=page.getByRole("dialog",{name:"캘린더 날짜 편집"});
  await dialog.getByLabel("이름",{exact:true}).fill("stale after 401");

  const unauthorized=async(route:Route)=>{
    if(route.request().method()==="PATCH"){await route.fulfill({status:401,json:{error:{code:"PROJECT_MASTER_ADMIN_REQUIRED"}}});return;}
    await route.fallback();
  };
  await page.route("**/api/admin/work-calendars/countries/KR/years/2026/dates/2026-01-01",unauthorized);
  await dialog.getByRole("button",{name:"저장",exact:true}).click();

  await expect(page.getByRole("heading",{name:"국가 캘린더 관리자 로그인"})).toBeVisible();
  await expect(page.getByRole("dialog",{name:"캘린더 날짜 편집"})).toHaveCount(0);
  await page.unroute("**/api/admin/work-calendars/countries/KR/years/2026/dates/2026-01-01",unauthorized);

  await page.getByLabel("관리자 비밀번호",{exact:true}).fill("admin");
  await page.getByRole("button",{name:"로그인",exact:true}).click();
  await expect(page.getByRole("heading",{name:"대한민국 2026"})).toBeVisible();
  await expect(page.getByRole("dialog",{name:"캘린더 날짜 편집"})).toHaveCount(0);
});

test("Issue #342: 삭제 후 focus는 남아 있는 날짜 section으로 복원된다",async({page})=>{
  await installCalendarMocks(page);
  await page.goto("/calendar-admin");
  await page.getByLabel("관리자 비밀번호",{exact:true}).fill("admin");
  await page.getByRole("button",{name:"로그인",exact:true}).click();

  const row=page.getByRole("row").filter({hasText:"신정"});
  await row.getByRole("button",{name:"삭제"}).click();
  const dialog=page.getByRole("dialog",{name:"캘린더 날짜 삭제"});
  await dialog.getByRole("button",{name:"삭제",exact:true}).click();

  const datesRegion=page.getByRole("region",{name:"휴일·보충 근무일"});
  await expect(dialog).toHaveCount(0);
  await expect(datesRegion).toBeFocused();
});

