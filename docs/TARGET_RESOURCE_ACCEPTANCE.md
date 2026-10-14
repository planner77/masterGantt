# Resource MVP 통합 수용·증거 표

Issue [#623](https://github.com/planner77/masterGantt/issues/623)의 Q1 수용 후보를 추적한다. 기준 main `bd54205741da65a0211cf77f9cb086d3cdb1ab2a` / app0.114.0 / SVAR Core2.7.3. [Work Packet](exec-plans/active/ISSUE_623.md), [사용자 가이드](TARGET_RESOURCE_USER_GUIDE.md), [이관 절차](TARGET_RESOURCE_OPERATIONS.md)를 함께 읽는다.

## 완료 경계

현재 Q1은 로컬 통합 수용 후보이며 이번 요청은 exact-head PR CI 시작까지다. 로컬 PASS·문서 존재·선행 Issue CLOSED가 원격 전체 회귀/Trusted QA·Owner ACCEPT·main artifact 완료를 대신하지 않는다. Resource MVP(M2) 최종 완료는 원격 gate·Owner 결정 전 BLOCKED이며 #624/V1 미완료 상태로 Epic #613 전체 완료를 표시하지 않는다.

## 요구사항↔Issue↔AC↔검증↔문서

| 요구사항·소유 Issue | #623 AC | 이번 test/증거 | 관련 문서 | 상태 |
| --- | --- | --- | --- | --- |
| 공통 F0golden·기존530,614/619/620/621/622 | AC1 | tests/fixtures/issue-623-target-resource.ts·Domain8·server20·신규Chromium2의 raw ID/수치,shared5/AMR15/ACS2/MCS1 및53011.5 | RESOURCE_KPI_DASHBOARD/LOGISTICS_TARGETS/API/EXCEL_EXPORT | 로컬 집중 PASS · 원격 최종 NOT TESTED |
| 다관점 개별 mutation·동일 identity·권한/원자성/복귀,617/618/621/528 | AC2 | issue-623-resource-mvp 실제 HTTP/Chromium·기존621/622 focused | PROJECT_UX/SECURITY/사용자 가이드/GSC | 로컬 집중 PASS · 원격 최종 NOT TESTED |
| 실제legacy0024→27·checksum/rollback/backup/restart·Copy/Template/포맷,615/616/617/672 | AC3 | issue-623-target-migration 및 tests/server/projects/issue-623-target-transfer-acceptance.test.ts·기존 Copy/Template 회귀 | DB_SCHEMA/DEPLOYMENT/이관 절차/IMPORT_EXPORT | 로컬 집중 PASS · 원격 최종 NOT TESTED |
| raw/nullable/R/과투입·fanout/크기·5폭/accessibility,619/620/622/530 | AC4 | 대표SQL/time/JSON/OOXML/render·5폭 geometry/keyboard·한도 거부 | TEST_PLAN/REMOTE_VALIDATION/RESOURCE_KPI_DASHBOARD | 로컬 집중 PASS · 원격 최종 NOT TESTED |
| 구성→연결→집계→편집→과투입→Excel 안내 | AC5 | 사용자 가이드와 실제 UI/포맷 계약 대조 | TARGET_RESOURCE_USER_GUIDE | 로컬 집중 PASS · 원격 최종 NOT TESTED |
| source/Head·gate 추적과M2/V1 분리,613/623/624 | AC6 | 본 표·Work Packet·source inventory·원격 인계 STATUS | active PLAN/TARGET_RESOURCE_ROLLOUT/CHANGELOG | 로컬 집중 PASS · 원격 최종 NOT TESTED |

논리 fixture 키는 환경별 실제 public UUID로 매핑하고 각 동일 snapshot 안의 raw Task/Assignment/Resource ID를 대조한다. source/test manifest는 검토 범위의 content hash이며 remote commit SHA와 다르다. 최종 exact PR Head/base/test merge/run ID/attempt·thread/충돌은 출판 후 [Issue #623 원격 인계 STATUS](https://github.com/planner77/masterGantt/issues/623)와 PR 본문/댓글에 기록한다. 문서 자체 commit SHA를 자기 기입해 순환시키지 않는다.

## 선행 원격 증거 단일 조회 (2026-10-15)

아래는 착수 당시 API/인증 댓글 조회다. 진행 중 CI를 polling하지 않았다. 성공한 PR은 새623 Head의 CI가 아니며 원본 FAIL/SKIPPED/실행 부재를 소급 PASS하지 않는다.

| Issue / PR / 병합 SHA | PR CI | Main CI | Finalizer·릴리스·Issue 경계 |
| --- | --- | --- | --- |
| 614 /625/ `9f17dbb2ad6814d952aef4fb1b6eaea721fb6794` | [2516.1](https://github.com/planner77/masterGantt/actions/runs/38171311000) SUCCESS | [2518.1](https://github.com/planner77/masterGantt/actions/runs/38174489260) SUCCESS | [Finalizer142.1](https://github.com/planner77/masterGantt/actions/runs/38174791911) SUCCESS,closed/release 불필요 |
| 615 /627/ `c8949da48e7465db45d871887c3f55f9fb6dc743` | [2525.1](https://github.com/planner77/masterGantt/actions/runs/38182240084) SUCCESS | [2526.1](https://github.com/planner77/masterGantt/actions/runs/38183855873) FAIL | corrective628/승계로closed,원본FAIL유지 |
| 615 corrective628/ `6eaec3331fcbc720ab42106789a505c5ee5eefb4` | [2530.1](https://github.com/planner77/masterGantt/actions/runs/38185921696) SUCCESS | [2531.1](https://github.com/planner77/masterGantt/actions/runs/38186180273) SUCCESS | [Finalizer144.1](https://github.com/planner77/masterGantt/actions/runs/38186617875) SUCCESS,0.106.0미발행/0.106.1승계 별도 |
| 616 /631/ `b97709df8b5c0974f3c8252ac97819f45f73a5b9` | [2591.1](https://github.com/planner77/masterGantt/actions/runs/38248616034) SUCCESS | exact original push조회0건 | 0.107.0실패/철회·0.108.0후속 [기존수용댓글](https://github.com/planner77/masterGantt/issues/616#issuecomment-6155300627),closed. 후속run은 이조회에서재검증않음 |
| 617 /676/ `96c6c74b304f1ccd09f7340f37ebf0b0c393ae3b` | [2724.1](https://github.com/planner77/masterGantt/actions/runs/38485528985) SUCCESS | [2727.1](https://github.com/planner77/masterGantt/actions/runs/38489306613) SUCCESS | [Finalizer266.1](https://github.com/planner77/masterGantt/actions/runs/38491180517)·[Release168.1](https://github.com/planner77/masterGantt/actions/runs/38491250799) SUCCESS,closed |
| 618 /678/ `59fa8f9e8743e03699741a654038b3086c0e1778` | [2744.1](https://github.com/planner77/masterGantt/actions/runs/38509320836) SUCCESS | [2745.1](https://github.com/planner77/masterGantt/actions/runs/38512238015) FAIL | [Finalizer282.1](https://github.com/planner77/masterGantt/actions/runs/38513644305) SKIPPED,closed와원본성공은별개 |
| 619 /677/ `87dcbf9e60216f9b902806c08c99e390ddf6c568` | [2730.1](https://github.com/planner77/masterGantt/actions/runs/38499531334) SUCCESS | [2741.1](https://github.com/planner77/masterGantt/actions/runs/38502160850) SUCCESS | [Finalizer278.1](https://github.com/planner77/masterGantt/actions/runs/38503935874) SUCCESS,exactdigest smoke/handoff job115656248941성공;정식release이번조회미확인 |
| 620 /682/ `78691a97bb8c0ba74a560965ca39479d7c80b72c` | [2756.1](https://github.com/planner77/masterGantt/actions/runs/38525834948) SUCCESS | [2757.1](https://github.com/planner77/masterGantt/actions/runs/38529037100) SUCCESS | [Finalizer292.2](https://github.com/planner77/masterGantt/actions/runs/38531996032)·[Release169.1](https://github.com/planner77/masterGantt/actions/runs/38532745213) SUCCESS,closed |
| 621 /683/ `53c57743380e5d72a38e753078fc87c9d1b01365` | [2765.1](https://github.com/planner77/masterGantt/actions/runs/38558633366) SUCCESS | [2767.1](https://github.com/planner77/masterGantt/actions/runs/38564384207) SUCCESS | [Finalizer297.1](https://github.com/planner77/masterGantt/actions/runs/38567184524) SUCCESS,exactdigest smoke/handoff job115861183946성공;formalrelease이번조회미확인 |
| 622 /684/ `bd54205741da65a0211cf77f9cb086d3cdb1ab2a` | [2770.1](https://github.com/planner77/masterGantt/actions/runs/38634326054) SUCCESS,필수3 aggregate확인 | [2771.1](https://github.com/planner77/masterGantt/actions/runs/38638132383) in_progress 당시snapshot | mainartifact/finalizer/release NOT TESTED,IssueOPEN |

615의 [퇴역근거](https://github.com/planner77/masterGantt/issues/615#issuecomment-6121671778)는0.106.1 source `09bee924032b4126ff794ec7a485542fd72dd7bf`, digest `sha256:0ab78272f2637ca73ae0a1e7bec4f41b24fcc35e35f13cfc94b7e13a9cad560f`를 기록한다.616의0.108.0 Main2710.1/Release167.1/Finalizerresume32.2는 위기존댓글기록이며 이번조회에서원본run재검증PASS를주장하지않는다. #613/#623 OPEN, #624/V1 NOT TESTED다.

## 이번 후보 원격·운영 Gate

| Gate | 상태·증거 |
| --- | --- |
| #623 exact-head Quality / E2E / Docker / Trusted QA | NOT TESTED,PR CI 시작 후 결과 모니터링하지 않음 |
| Owner HIGH 위험 수용·명시 병합 허가 / Manager ACCEPT | NOT TESTED,MERGE_READY=BLOCKED |
| #623 main GHCR·Finalizer·cleanup / 정식 release | NOT TESTED,범위밖;release_authorized=false |
| 합성 SQLite migration/backup/restart | 로컬 PASS, actual0024→27·fresh·batch rollback·backup/restore/restart; 실제 운영은 NOT TESTED |
| production/off-host backup/restore·TLS/proxy·WindowsExcel/VBA/DRM·실기기/screen reader·최종수동UX | NOT TESTED,로컬/원격CI로대체불가 |


## 최종 로컬 후보·환경별 관측

- Domain 신규8case/관련64tests, backend 신규20case/관련37tests, 실제Chromium 신규2/관련9tests PASS. 별도read-onlyReviewer가동결된신규4Vitestfiles28tests 및신규Chromium2개를직접PASS했다. 실행간중복을전체고유수로합산하지않는다.
- API/UI/OOXML raw5MD/.25MM·같은Task/Assignment/ResourceID·여섯개별mutation·대표9축stale·legacy/Copy/Template/포맷·5폭은위각AC의로컬범위다. 실제운영복원/전체성능/실기기수용은NOT TESTED다.
- backend합성단일관측:133Task/489Assignment/4Resource/2Target/SQL48,report87.15852400000017ms/345599bytes,ExcelHTTP241.1588670000001ms/622705bytes. browser는별도3Task/R1/2Group/5Target의진입→표준비1289.041652999993ms·10geometry·HTTPXLSX30447bytes다.
- 최종검토8test/fixture SHA256 `0defd061a40ec282e0be9b8ca48e8bff57c52d95c537e7994b80582a51a911db`;[manifest](../output/playwright/issue-623/source-inventory.json),[실행원장](../output/playwright/issue-623/execution-result.json),[browser원시근거](../output/playwright/issue-623/cumulative.json),[geometry](../output/playwright/issue-623/geometry.json),[backend관측](../output/playwright/issue-623/backend-benchmark.json). hash는source/test범위이며전체tree/Head가아니다.
- exact-head PR CI·Trusted QA·Owner/Manager ACCEPT와main/GHCR/Finalizer는여전히위표의NOT TESTED/BLOCKED다. AC6의최종PR/Head/Run/attempt표는[Issue623인계STATUS](https://github.com/planner77/masterGantt/issues/623)에서출판후제공한다. #613의Resource MVP상태만로컬수용후보/원격gate대기로갱신하고 #624/V1미완료인Epic전체를종료하지않는다.
