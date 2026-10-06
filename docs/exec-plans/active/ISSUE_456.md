# Issue #456 Task Editor 폼 밀도 실행 계획

## 현재 후보 상태

A 구현과 관련 Local Fast Feedback는 PASS이며 frontend writer를 동결했다. 최종 source3 SHA256은 `98f77ddcc1d05c6e84ec4f559b6de4ae06f2295469b03312a0147b17ab637233`이다. 현재 소스에서 전용6사례와 scale/column/scope 대표2사례가8/8 PASS(session37066/chunk796c82,51.1초), typecheck49261/chunk40ffc7 PASS다. 이전 관련 실행을 영향 근거로 재사용해27 unique scenario이며 최종 계열52 PASS 실행/중복25회로 구분한다. 이를 단일 최종 전체 회귀 PASS로 표시하지 않는다.

게시 증거는 before71+after86=157파일이다. after는 최신 source에서5폭7표면,progress100%와 keyboard/error/pending/Gantt 및 active-filter negative 상태를 다시 수집했다. 원래before71 hash drift0. owned9와 합친 frontend handoff166파일을 검토하고 Manager 문서3개와 infra version2를 더한 정확한171파일 후보를 별도 manifest로 동결한다. source/test/fixture 수정과 owned Next 실행은 끝났고 generated2를 정확히 복원했다. 중간 진단·원래raw26·다른Issue screenshots·실제DB/runtime log/raw trace는 게시하지 않는다.

독립 중간 QA가 찾은 visible filter membership guard 누락을 보완했다. 같은 raw 필터라도 metadata로 표시 ID 집합이 달라지면 metadata-only에서 제외하고 snapshot/소비에서도 현재 semantic filter signature를 확인한다. 실제 active name filter에서 rename PATCH1→visible 빈집합→public/DOM0으로 이전120px를 복원하지 않는 경우와 같은 집합 metadata120/38 보존을 함께 확인했다. unmount ref=null과 DOM 연결 조건은 종료 뒤 오래된 요청을 보호한다.

TASK_EDITOR/PROJECT_UX/UI_UX_GUIDELINES/TEST_PLAN 갱신 및 Manager Packet/PLAN/CHANGELOG와 항목별 N/A 근거를 최종 확인한다. TASK_EDITOR의 C 후속 범위 및 DOM 순서 표현 두 곳은 frontend freeze 이후 Manager가 작성 소유권을 인수해 계약과 일치하도록 정정했다. frontend handoff hash를 소급 변경하지 않고 최종 후보 manifest에 문서 변경을 명시한다. 독립 최종 UIX/PRE_QA와 게시·PR·CI 등록은 현재 NOT TESTED다. 공식 quality/e2e/docker·최종 ACCEPT는 CI 결과를 모니터링하지 않아 NOT TESTED로 유지한다.

## Issue Work Packet

- Repository: planner77/masterGantt; [Issue #456](https://github.com/planner77/masterGantt/issues/456).
- Phase: DOCUMENTATION_SYNC / PRE_QA 준비. 요청 종료점은 구현·문서 동기화·독립 사전 검토·원격 PR 게시와 exact head의 PR CI 실행 등록이다. CI 결과 모니터링은 수행하지 않는다.
- Baseline: main `05fe212060ed4a935510dc2f7a692bb9113c55e8`, version `0.92.0`.
- Branch: `fix/issue-456-task-editor-form-density`; worktree `/home/planner/Dev/masterGantt-worktrees/issue-456`.
- Version: 호환성을 유지하는 UI 수정이므로 PATCH `0.92.1`. package.json/lockfile은 infra가 반영한다. release_required=true, release_authorized=false. 사용자 요청은 정식 GHCR 게시 승인이 아니다.
- 원래 root #464와 raw 26파일, #453–#455 worktree는 보존한다. 기존 #456 branch와 준비 문서를 재사용한다.

## 목표·범위·인수 기준

기존 Task Editor의 정보 구조를 유지하면서 의미별 필드 배치와 과대한 action 폭·간격을 정돈한다. 변경 전 실제 화면을 측정한 뒤 각 표면을 FIX/KEEP/FOLLOW-UP으로 분류한다. 새 필드나 기능, DB/API/auth/revision/scheduling/canonical/SVAR 내부 구현을 변경하지 않는다.

- A Task Editor를 첫 소단위 PR로 수행한다. 작업 정보·리소스·관계 및 현재 소속/물류 탭, nested relation, baseline, 저장/취소/재조회가 범위다. 기존 탭 수와 저장 단위를 축소하지 않는다.
- 기존 44px hit-area를 축소하지 않는다. 더 구체적인 relation/baseline 규칙의 실제32px 여부는 before computed 값으로 확인하고 문서 의도와 구분한다.
- 작업명·상태/진척·날짜/기간/일정 모드·설명/URL의 의미 그룹과 label/error 연결을 유지한다. intrinsic 버튼 폭과 부모 간격을 사용하며 같은 행 동급 action top/height 차이는1 CSS px 이하다. 긴 loading label도 측정한다.
- 390/768/1024/1440/1920px에서 같은 유효 fixture로 before/after PNG와 geometry를 제공한다. 긴 이름/URL/설명, 큰 기간/수치, 역할 다수, validation/readonly/loading/saving/stale/401/412를 위험 기반 조합으로 확인한다. 실행한 상태와 폭을 구분하며 모든 조합을 검사했다고 확대하지 않는다.
- 날짜 상호 계산, 상태/진척, Assignment 역할/공수, 관계 및 baseline command·revision을 유지한다. body scroll, 고정 header/tab/footer, 실제 keyboard/focus/Escape/nested 복원 및 실패 초안 보존을 확인한다.
- Gantt instance/scroll/tree/columns/scale/selection/fullscreen/scope tabs를 불필요하게 초기화하지 않는다. screenshot만으로 상태 보존을 판정하지 않는다.
- B/C를 별도 후속 Issue로 연결한다. 실제 확인하지 않은 표면은 KEEP/PASS로 처리하지 않는다.

## A/B/C 처리 추적

| 표면 | 현재 판단 | 파일·근거·연결 |
| --- | --- | --- |
| A Task/Resource/Relation 및 소속/물류, nested relation, baseline/footer | before 후 FIX/KEEP 결정 예정 | project-task-editor.tsx/module.css 및 관련 native dialog 실제 browser 측정. #456 첫 PR 예정 |
| B 설정·편집/보안·근무 규칙·인증/password | FOLLOW-UP / NOT TESTED | project-settings-dialog, project-work-calendar-editor 및 실제 인증 소비자 inventory·before를 [#490](https://github.com/planner77/masterGantt/issues/490)에서 확정 |
| C 생성·복사·template·Import/Export·견적 option | FOLLOW-UP / NOT TESTED | 생성/복사/template·Import preview·Excel/이미지/견적 실제 소비자 inventory·before를 [#491](https://github.com/planner77/masterGantt/issues/491)에서 확정 |

한 PR에 A/B/C를 모두 restyle하지 않는다. B/C 등록은 제품 구현·검증 완료나 해당 후속 자동 실행을 뜻하지 않는다. 이번 요청 경계와 Issue 전체 Lifecycle 종료를 구분한다.

## 파일 소유권·실제 Agent

- Manager: 이 Packet, PLAN.md, CHANGELOG.md, 버전·범위·단계 판단과 공식 Issue 댓글.
- issue456_design(ui_ux): read-only 설계 및 구현 증거 비교. 소스/문서/GitHub 쓰기 금지.
- issue456_frontend(frontend): `src/features/gantt/project-task-editor.tsx`, `project-task-editor.module.css`, `project-gantt.tsx`의 기존 filter-tasks effect·visible ID 의미 비교와 metadata canonical sync의 snapshot 기록 및 set-columns 완료 후 viewport 보존 구간, 전용 density E2E/fixture/helper 및 필요한 관련 E2E. PROJECT_UX/UI_UX_GUIDELINES/TEST_PLAN 문서 작성자다. TASK_EDITOR는 구현 후 최종 표현 정정 단계에서 Manager에게 이관했다. 새 기존 spec 소유 확대는 Manager에게 먼저 반환한다.
- issue456_infra(infra): branch/worktree, 승인된 package/lockfile 버전, allowlist commit·원격 branch 게시·PR·CI 등록. Manager 승인 전에 원격 쓰기를 하지 않는다.
- 구현하지 않은 qa_docs Agent를 별도로 실행해 독립 사전 QA와 게시 후 동등성을 검토한다. 현재 최종 사전 QA는 NOT TESTED다.
- 동일 파일 동시 쓰기와 임의 재귀 위임을 금지한다. 구현 Agent는 version/tag/PR/merge/GHCR/Issue 종료를 독자 수행하지 않는다.
- issue_comment_writer=manager; 허용 유형 PLAN/STATUS/EXCEPTION/RESUME. Sub-Agent는 댓글을 쓰지 않고 후보와 증거를 반환한다.

## 검증·문서·게시 계약

관련 최소 Local Fast Feedback(typecheck/scoped lint/관련 E2E 및 필요한 unit)을 수행한다. 전체 로컬 Vitest/Playwright/Docker를 반복하지 않는다. source/test/fixture 수정은 owned Next 종료 후 수행하고 생성된 next-env.d.ts/tsconfig.json을 정확히 복원한다. 실행 전후 해시를 동결하고 실패 원인·조치·재검증을 보존한다. 다른 사용자의 process는 종료하지 않는다.

before/after에 실제 source SHA, viewport 높이, locale/timezone/browser/기본 zoom을 기록한다. native125% 확대를 실행할 수 없으면 NOT TESTED와 사유를 남기고 DSF/CSS zoom으로 대체하지 않는다. mock browser·실제 server·실기기·스크린리더·운영 환경 판정을 구분한다.

Required docs는 TASK_EDITOR.md, PROJECT_UX.md, UI_UX_GUIDELINES.md, TEST_PLAN.md, 이 Packet, PLAN.md, CHANGELOG.md다. DESIGN의 기존 semantic token·파란 Light·system font를 재사용한다. Import/Export/API/DB/Scheduling/보안/CI 문서는 실제 변경 영향 분석과 N/A 근거를 기록한다. B/C 후속 등록을 Import/Export 계약 구현으로 주장하지 않는다.

DOCUMENTATION_SYNC → 독립 UI/PRE_QA → Manager PR_READY → explicit allowlist 게시 → 독립 exact head/tree/parent/files 동등성 → canonical `Refs #456` PR → exact head의 pull_request / .github/workflows/ci.yml 실행 등록 순서다. 등록 조회는 id/head_sha/head_branch/event/path/url/time/attempt/repo/PR mapping만 사용한다. status/conclusion/jobs/logs와 CI 결과는 모니터링하지 않는다.

quality/e2e/docker·공식 최종 QA/Manager ACCEPT는 NOT TESTED다. 병합·main CI/GHCR·정식 release/tag·branch 정리·Issue 종료는 요청 범위 밖이다. 최신 main의 successful candidate handoff 정책을 상속하지만 이번 PR 작업을 main artifact PASS로 표시하지 않는다. 비밀값·실제 DB·raw trace/runtime log는 게시 allowlist에서 제외한다.

## 재개와 최신 baseline 정렬

최초 준비는828b26417c283659e61b9471f93245f77ab99543/v0.90.3였다. 재개 시 구현 source/test 미변경·원격 branch/PR 없음, 이전 Agent와 /tmp 보고 부재를 확인했다. 최신 main은26commit·174파일 앞선05fe212060ed4a935510dc2f7a692bb9113c55e8/v0.92.0이며 Task Editor 소스2와 의존성은 같지만 Gantt/fixture/UX 문서가 변경됐다.

기존 Manager PLAN/package2/Packet을 exact backup한 뒤 승인 tracked3만 복원하고 같은 branch를 최신main으로 fast-forward했다. PLAN은 최신main 원문을 보존하고 이 계획을 추가한다. package/lockroot만0.92.1로 반영해 version check chunk88e332/exit0 PASS다. 기존 실제 node_modules(non-symlink)의 버전 존재를 확인했으며 이번 재개에서 설치/복사를 수행하지 않았다. 이전 설치 이력을 직접 증거 없이 주장하지 않는다.

PLAN comment6013197532, B/C 연결STATUS6013243930, RESUME6016655430. 현재 branch/version 준비 PASS, 실제 before·구현·문서 최종 동기화·독립 QA·원격 게시/PR/CI 등록은 NOT TESTED다. 다음은 frontend의 최신main 실제 before 측정이다.


## 실제 before와 설계 승인

- 최신 main의 Editor 소스2 byte를 그대로 사용하고 후보 header만0.92.1인 상태에서 before를 수집했다. 고유 관찰2개/실행3 PASS를 구분한다. 첫 Resource allocation 미표시 자료는 canonical Resource선택·3역할·99%·기간을 포함해 재캡처하고 첫 자료를 별도 보존했다.
- 동일 유효 fixture는 name168자, Description2600자, URL1640자, Baseline9999근무일이다. 390/768/1024/1440/1920px의 Task/Resource/Relation/nested/Baseline/소속/물류에서 PNG35+geometryJSON35+env1=71개를 고정했다. 환경 en-US/Asia/Seoul/Chromium153.0.8010.12/기본100%이며 native125%는 NOT TESTED다. UA Windows는 preset이고 실제Windows 검증이 아니다.
- 실행: first40920/chunk3ac3d6(1PASS8.6s), canonicalResource recapture22786/chunk2da3e8(1PASS8.4s), 동적Milestone97067/chunk5cd78c(1PASS5.6s). scopedlint 최종경고0/chunkb979fb, ownedNext 종료·generated2정확복원·source/testfreeze drift0. 첫 lint unused warning과 수정도 이력으로 보존한다.
- 실측 desktop Baseline/relation action32px, footeraction104×44px, 일정모드672px이다. 390px Baseline의48.38px은 긴 label 자연wrap 높이다. 전체 Task5폭 documentoverflow0은 정상 before이고 수정 효과로 주장하지 않는다.
- 독립 UIUX는71hash drift0과대표PNG4를 확인해 FIX/KEEP를 권고했다. 1440px range right1253+gap12+value56이 panelright1259를 초과해 진행률 숫자가 잘리고1024/1920도 같은 구조다. source의 정적 위험을 실제 clipping 증거와 구분했다.
- Manager 구현 승인: status/slider/value budget FIX, 요청날짜·기간·종료+mode named group FIX, footer104px 일괄폭을 label/pending 기반 intrinsic폭으로 FIX(44px 유지), relation/baseline32→44px 확대 FIX. 긴 label은 자연높이를 유지하고 고정height로 자르지 않는다. Description1076px 읽기폭/최소120px/verticalresize는 KEEP하며 URL과 의미그룹만 추가한다. Resource/nested/소속/물류 정상조회 구조는 KEEP이나 dirty/state 보호 PASS를 뜻하지 않는다.
- before readonly/dirty/error/pending/401/412·비기본Gantt상태는 NOT TESTED이며 after/관련 선택회귀로 확인한다. before fixture의 background Resource workload/Dashboard 초기GET404는 별도peer검증이 아니고Editor물류child만 유효empty응답으로mock했다. after에서 유효mock 확장 시 변경근거와 비교 가능한 Editor자료를 구분한다. 실제serverauth/DB/원격CI·실기기·스크린리더는 별도 미검증이다.
- 현재 IMPLEMENTATION phase다. 다음은 승인2소스와 관련 E2E/문서, writer freeze 후 DOCUMENTATION_SYNC 및 독립 PRE_QA다.


## 초기 after 및 pending REWORK

첫 after geometry FAIL/Milestone PASS는390px의 기존 range→값 수직 배치를 같은 행으로 비교한 하니스 오류였다. 두 번째는 wrapping select label option 문자열을 exact 이름으로 찾는 locator timeout이다. 각 원본을 보존하고 name selector·별도 label 검사로 수정했다. 세 번째74651의 정상5폭2PASS/대표상태1FAIL은 실제pending 반복Escape가 Editor를 닫는 제품결함이다. pending 저장버튼 geometry 안정·입력/취소disabled·PATCH1회만 부분확인했고 전체PASS로 처리하지 않았다.

Manager는 owned TSX의 pending keydown Escape 방지 REWORK를 승인했다. readonly/dirty/nested/독립저장 경로는 유지하며 API/controller/shared 변경은 하지 않는다. 매 수정 전 ownedNextSTOP/generated2복원·freeze를 지킨다. 최신source 재검증·문서 동기화 후 독립QA로 전달한다. 하니스2FAIL과 제품1FAIL의 원본·재검증을 구분한다. EXCEPTION댓글6016897701에 초기 하니스 이력을 기록했다.


네 번째 실행39754는기존26회귀+새geometry/동적탭2=28PASS와pending1FAIL이다. disabled submit에서focus가body로이동해localkeydown을벗어나므로ownedTSX의documentcapture를실제pending+최상단해당Editor로한정하고cleanup한다. readonly/dirty자체나nestedchildEscape는차단하지않는다. 최신97792/chunk2fe54a는관련11/11PASS(38.8s), 새3case와기존8case다. 나머지선택회귀는Escape-in-flight effect만추가된영향근거로재사용하며단일최종전체실행PASS로표시하지않는다. 비기본Ganttstate·actualSQLite관련LFF와최종DOCSYNC는후속검증중이다.


## 비기본 Gantt 보존과 최소 범위 확장

비기본WBS/fullscreen/week/열/scroll/selection의 Editor 왕복에서 chart120→0이 발견됐다. 단계 계측36156/chunk6bd55c은 진입전120/38→menu120/38→opened0/38→tabs0/38→cancel0/38이며 다른APIidentity/fullscreen/scale/WBS/rootTask/vertical38/selection은 유지됐다. 빈열배열을 만든하니스selector는실제header의227px/108px두열로보강한다.

exact05fe의baselineEditor2source에서도92086/chunk67401e로동일재현해선행결함임을확인했다. 임시source는STOP/generated2복원후승인A source2로정확복원하고hashdrift0(chunk0b7494)을확인했다. baseline-state별도자료는원래before71과구분한다. contextsettle후로기준점을옮겨차이를숨기지않는다.

Manager가 처음 승인한 set-columns 보강은 실제 계측에서 Editor 진입 시 해당 sync가 발생하지 않아 원인 후보에서 제외했다. 시험 보강과 DEV 계측을 owned Next 종료 후 철회해 Gantt 소스는 HEAD 바이트로 복원했다. show-editor를 거치지 않는 직접 initialTab 경로도 같은 이동을 재현했다. autoFocus 및 showModal 동기 호출 직후 public/DOM 120/38을 유지한 뒤 chart scrollWidth 1632→884 축소와 left0을 관찰했다. 원래 before71·별도 baseline-state·실패 원본은 보존하며 기준 시점을 늦추지 않는다.

이후 ProjectReadonlyView가 렌더마다 visibleTaskIds 새 배열을 만들고 ProjectGantt filter effect가 배열 identity에 의존해 같은 filter-tasks를 반복 적용하는 구간을 확인했다. Manager는 기존 project-gantt.tsx의 filter effect와 동일 API·visible ID 집합 비교에 필요한 최소 코드만 frontend 소유로 승인했다. null/빈집합/실제 집합 변경과 API 교체를 구분하고 실제 scope/filter/Task canonical 변화는 유지한다. ProjectReadonlyView/DB/API/domain/shared/Core 내부/PRO 변경은 하지 않는다.

공개 SVAR API 조사와 설치 Core 자료를 확인한 researcher는 read-only 조사만 수행했다. set-columns의 viewport 보장이 없다는 자료는 조사 결과이며 기각한 복원안을 최종 구현으로 보고하지 않는다. 새 source3의 관련 Local Fast Feedback·문서 동기화·독립 UI/PRE_QA는 후속 단계다. 스크롤 전체 보존은 재검증 전이며 일부 identity 유지로 전체 PASS를 주장하지 않는다.

## 저장 단계의 별도 원인 분리와 승인

같은 visible ID·API 필터 중복을 제거한 뒤 Editor 열기·탭 이동·취소는 public/DOM 120/38을 유지했다. 저장 단계에서는 filter-tasks가 실행되지 않았지만 update-task 두 번과 set-columns 뒤 left0을 관찰했다. canonical sync 완료 후 진단 한정 2 requestAnimationFrame에서 set-columns 실행 전에도 left0/top38/scaleWidth884/chartWidth822가 확인돼, metadata canonical 갱신 이후의 재측정 경로를 별도로 보강한다. 이 계측 대기와 DEV 기록은 최종 후보에서 철회한다.

Manager는 기존 source3 canonical sync 안에서 metadata만 변경됐을 때의 공개 viewport 보존을 승인했다. 전후 행 ID·순서·일정·계층·Link 의미 signature가 같고 같은 API/visible/continuity key/최신 syncVersion이며 실제 zero-reset일 때만 복원한다. 날짜·기간·계층·Link·scope/filter 변화 및 실제 chart 사용자 입력은 복원 대상에서 제외한다. 기존 ensureTimelineEnd·queue·오류 회복을 유지하며 새 shared primitive나 Core 내부 구현을 만들지 않는다. 최종 signature 필드와 실제 회귀 범위는 frontend 결과로 확정한다.

## 최신 구현과 게시 준비 경계

최종 보강은 metadata-only canonical sync에서 요청을 기록하고 기존 set-columns·Summary 상태 복원·layout 정착과 ensureTimelineEnd 뒤에 한 번 소비한다. 중간 clamp91은 실제 zero-reset과 구분하며 무조건 이전 좌표로 덮지 않는다. 같은 API·visible·continuity key·최신 syncVersion 외에 scale·gridWidth·열 ID/폭/hidden을 확인해 의도된 보기 조작을 보호한다. 새 sync·stale·queue 실패·열 갱신 미실행·unmount에서 요청과 input listener를 정리한다.

실제 수정 source3의 session3105는 WBS/native fullscreen/week와 public/DOM scroll120/38·선택·트리·실제열227/108을 Editor 탭·취소·metadata PATCH1 뒤에도 유지했다. 변경 영향 회귀39520은19/19 PASS이며 source3 최종 보기 guard 보강 뒤10사례를 재검증 중이다. typecheck PASS, scoped lint error0/warning4이고 같은4개 warning은 HEAD 기준에도 존재한다. 이 중간 실행을 최종 전체 Local Fast Feedback로 확대하지 않는다.

원격 preflight는2026-10-06 13:40:38 UTC 한 번 수행했다. main SHA05fe212060ed4a935510dc2f7a692bb9113c55e8/tree214a02621db4f6786821960f8e769ec545db0f77/version0.92.0으로 기존baseline과같고, 원격작업branch와branch PR은없었다. 자동추가정렬이나CI결과조회는하지않는다. /tmp preflight SHA256 fa580cd5f2d2734a214ec49e070db695f805bd6c2eec2c332d183e2202c10e5c.

최종문서·source/test/evidence freeze→독립 UIX/PRE_QA→Manager PR_READY 후에만 게시한다. 후보manifest는불변으로두고 review보고SHA는별도gate기록으로연결한다. 원래root HEAD c5a7bc9e8462128b5f977918b719d38d4d7a89be/raw26 SHA256 drift0와 #453–#455 worktree head 보존을 확인했다. 게시완료뒤다시확인한다.

## 최종 문서 영향 분석

DOCUMENTATION_SYNC 대상은 TASK_EDITOR·PROJECT_UX·UI_UX_GUIDELINES·TEST_PLAN과 Manager Packet·PLAN·CHANGELOG7개다. 사용자에게 보이는 grouping/intrinsic44px/pending Escape, 실제 Gantt semantic filter·metadata guard·cleanup, 실패 이력과 실제 source별 실행·재사용·환경 한계를 반영한다. 정식 원격 회귀 PASS나 Issue 전체 종료를 주장하지 않는다.

REQUIREMENTS·ARCHITECTURE는 새 기능·계층 경계 변경이 없어 N/A다. API·DB_SCHEMA·SECURITY는 endpoint/schema/권한/Origin/session/revision 계약 무변경으로 N/A, SCHEDULING_ENGINE은 일정 알고리즘 변경이 없어 N/A다. IMPORT_SCHEMA·VBA_EXPORT와 관련 Excel/이미지/견적 교환 문서는 Import/Export·DRM·배정·Copy/Template 구현 변화가 없어 N/A이고 해당 후속은#491에서 다룬다. DEPLOYMENT·CI_CD·REMOTE_VALIDATION·GITHUB_OPERATIONS는 workflow/container/registry/검증 gate 변경이 없어 N/A다. DESIGN은 기존 semantic token·Light UI·system font 적용으로 N/A, UI_UX_ROLLOUT은 다른 화면 rollout 완료 판정을 바꾸지 않아 N/A다. 각 N/A는 해당 제품 전체의 검증 PASS를 뜻하지 않는다.

현재 source3가 영향을 주는 date/status/Baseline·검색/필터·scope/fullscreen/peer·실제SQLite 관련 선택 회귀를 실행했고, 마지막 guard-only 수정의 직접8사례와 나머지19 unique의 재사용 근거를 TEST_PLAN에 구분했다. native125%/실기기/스크린리더/최종수동UX 및 모든 상태×폭 조합은 NOT TESTED다. 실제SQLite persistence와 mocked payload/state는 서로 대체하지 않는다.


## Main CI #1993.1 security audit corrective

PR #500 병합 SHA `24072f4fd28cd1306b3c348d3f7da1a0e3dbc075`의 Main CI Run `37524404994`은 제품 build/typecheck/lint/Vitest/E2E 6/6/Docker smoke는 통과했지만 production audit에서 `sharp 0.35.4` High 취약점(CVE-2026-96889)으로 실패했다. audit gate를 완화하지 않고 corrective branch `fix/issue-456-main-ci-sharp-audit`에서 lockfile을 `sharp 0.35.5` 및 `@img/sharp-libvips 1.3.4`로 갱신하고 정적 최소 버전 회귀를 추가한다.

application version은 `0.92.1`을 유지한다. 이 corrective는 동일 Issue의 non-docs 후속 merge이며 Generic Finalizer의 same-Issue convergence가 최초 0.92.0→최신0.92.1 span으로 release_required를 판정하므로 기존 v0.92.1 authorization 범위를 유지한다. 새 PR exact-head quality/e2e/docker PASS → merge → 새 Main CI 시작이 현재 요청 종료점이며, 그 뒤 GHCR/finalize는 기존 자동 lifecycle gate가 처리한다.
