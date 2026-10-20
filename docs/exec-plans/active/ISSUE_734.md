# Issue #734 — 설비 최상위 동적 대시보드

> 최신 통합: 게시 직전 #735/PR #757이 main `08a1d9ff25a97aba67f08d6b67029ac55d45121a`에 반영되어 문서11개·host·공통 projection 충돌13개를 해소했다. 시스템 direct/coordination·선택 ID·캐시/한도와 설비 유형 OR를 함께 보존한다. 후보는 main0.126.0 이후 MINOR **0.127.0**이다. 새 통합 소스의15파일155 Unit·통합/타입 검사 PASS. 앞선140 Unit/3 Chromium/분리 사전 리뷰는 통합 전 증거이며, 최종 Head Chromium8개·독립 재검토·Required3/Trusted/Owner ACCEPT는 NOT TESTED다.

## Issue Work Packet

- Issue: [#734](https://github.com/planner77/masterGantt/issues/734), 상위 #723; 선행 #724/#726/#728/#729/#730, 기존 KPI/통합 조회 #624/#731 및 공정 consumer #733 재사용.
- baseline_sha: `05f1e560eee456e6fba5535255c9ede30a357c16`; baseline_version: `0.125.0`.
- branch: `feat/issue-734-equipment-dashboard`; worktree: `/home/planner/Dev/masterGantt-734`. 기존 checkout의 미추적 증거는 보존한다.
- candidate_version: `0.127.0` MINOR. 제품의 설비 전용 조회 기능 추가이며 dependency 변경은 없다.
- risk_level: HIGH; risk_reason: 설비 consumer·같은 snapshot의 원본 metadata·유형 필터 및 공통 조회/편집 복귀 경계의 영향.
- qa_required: true; qa_method: OWNER_MANAGED; independent_qa: N/A(Owner-managed, 독립 인간 검토 없음); manager_decision: NOT TESTED; MERGE_READY: BLOCKED.
- release_required: true; release_authorized: false. 사용자 요청 종료점은 구현·문서·미해결 리뷰/충돌 해소 후 PR Full CI 시작 확인이다.
- documentation_owner: Manager; issue_comment_writer: manager; issue_comment_allowed_types: PLAN, STATUS, EXCEPTION.
- 비범위: CI 완료 모니터링, merge/main/GHCR/Release/tag/Finalizer/Issue 종료·branch 정리, 신규 DB/계산기/renderer/Gantt writer, 실제 설치완료/가동률 추정, marker-ON, #720 앱 내 매뉴얼 구현.

## 역할과 소유권

실제 별도 Sub-Agent를 사용한다. ui_ux는 읽기 전용 설계, frontend는 설비 consumer/model/CSS·Unit과 공통 optional filter seam·host 연결, backend는 같은 snapshot metadata·유형 필터 및 SQLite 수용, 별도 frontend는 전용 Chromium 수용을 담당한다. Manager는 문서·버전·통합·원격 게시를 소유한다. 분리된 qa_docs 사전 검토는 최종 Trusted QA·Owner ACCEPT를 대신하지 않는다. 동일 파일의 동시 작성은 하지 않는다.

## Design Delta B

기존 DESIGN의 이름 우선·상황형 도움말·Light UI/system font/semantic token·WBS 조회 투영 원칙을 구체화한다. 설비 root 고정, 기본 standalone `[]`, 수정 가능한 두 예시와 개인 저장 복원, 기존 6열 표/내부 scroll·focus를 재사용한다. 등록 구성과 필터된 작업 KPI를 분리하고 원본 상세·진단·전체 Gate는 접힌 영역에서 제공한다. 새로운 공통 시각 규범 A는 없으므로 DESIGN.md 변경은 N/A다.

## AC_TEST_COVERAGE

- AC1: `tests/server/resources/issue-734-equipment-configuration.test.ts`, `tests/features/resources/equipment-dashboard.test.ts`, `tests/e2e/issue-734-equipment-dashboard.spec.ts` — Target0의 AMR10/AMR5 root·등록-only·작업0·개인 미배정·비활성 및 유형 선택.
- AC2: 같은 전용 Unit/E2E와 기존 `tests/e2e/issue-730-view-composer.spec.ts` — 사용자의 축 추가/삭제/순서 변경으로 설비→공정→물류 시스템→리소스, 설비→Milestone→공정 구성·전환·복원 및 standalone. 설비 root는 다른 부모 아래 typed 형제 규칙과 구별한다.
- AC3: 전용 SQLite 수용 및 `tests/domain/wbs-task-ledger-acceptance.test.ts`, `tests/domain/wbs-task-ledger.test.ts` — direct/ancestor/Target whole·subset 중복, ACS-only subset·공유MCS·다중 Milestone·15대/고유 Assignment 공수 oracle. E10의 다중 WorkArea 각각10/상위10, Task5 M/D 다중 경로 상위5.
- AC4: 전용 SQLite/Unit/E2E — 명시 controls와 같은 Task 업무 연관을 구별. E1-t1-M/E2-t2-M에서 E1→M→공정 t2 누출0, 조회 mutation0/원본 복제0. 전체 Milestone Gate는 선택 밖 멤버까지 유지.
- AC5: 전용 Chromium 및 기존 #730/#624/#733, drill/model/transport 회귀 — 정확 Task/Assignment/설비 원본 editor·dirty/readonly/401/412/stale/pending·저장/일정 복귀·경로/필터/선택/focus, 긴 이름·390/768/1024/1440/1920px·keyboard/Escape/내부 overflow·Gantt instance/marker-OFF.

위 테스트 경로는 선정 계획이다. 실제 실행/실패/미검증과 최종 명령은 아래 증거에 별도 기록한다. 원본 문서의 W1/W2 결정 대기는 최신 #725/#728 main의 타 공정 WorkArea 허용·Task 명시 문맥 계약을 따른다.

## 변경 영향과 검증 계획

직접 producer는 consumer/model·공통 optional filter seam, 조회 parser/projection 및 snapshot catalog다. 직접 검사 외에 기존 #729 HTTP·원장/고유 집계, #733 process consumer, #730 composer/정확 source·오류/복귀, #624 legacy 설비 KPI, #731 integrated KPI를 교차 회귀로 선정한다. 기존 안전성 단언·timeout/retry/skip·6-shard/Required3·CI 정책은 유지한다.

Local Pre-PR fast/targeted를 실행하고 자동 영향 매핑의 UNKNOWN·미실행은 그대로 남긴다. 자동 계획을 PASS로 부르지 않으며 실제 직접 실행과 분리한다. source 동결 뒤 변경이 있으면 관련 검증을 재수행한다. 원격6runner·Docker/GHCR는 로컬 결과로 대체하지 않는다.

## DOCUMENTATION_SYNC

Manager가 실제 코드와 대조한 문서별 영향 기록이다. 실행 증거는 아래 원장에 분리한다.

- `docs/LOGISTICS_DASHBOARD.md`: UPDATED
- `docs/RESOURCE_KPI_DASHBOARD.md`: UPDATED
- `docs/PROJECT_UX.md`: UPDATED
- `docs/UI_UX_GUIDELINES.md`: UPDATED
- `docs/TARGET_RESOURCE_USER_GUIDE.md`: UPDATED
- `docs/API.md`: UPDATED
- `docs/ARCHITECTURE.md`: UPDATED
- `docs/REQUIREMENTS.md`: UPDATED
- `docs/TEST_PLAN.md`: UPDATED
- `docs/exec-plans/active/PLAN.md`: UPDATED
- `docs/exec-plans/active/ISSUE_734.md`: UPDATED
- `docs/ISSUE_734_FAILURE_ANALYSIS.md`: CREATED (PR #759 #3058.1 누적 실패 원장)
- `CHANGELOG.md`: UPDATED
- `DESIGN.md`: N/A(기존 이름 우선·상황형 도움말·조회 투영을 적용하는 Design Delta B, 새로운 공통 규범 A 없음)
- `docs/LOGISTICS_DOMAIN_DESIGN.md`: N/A(실물 원본·Owner·controls·WorkArea 관계의 도메인 의미 불변)
- `docs/WBS_TASK_LEDGER.md`: N/A(기존 Domain selector와 계산 산식 재사용이며 Domain 코드·원장 의미 불변)
- `docs/LOGISTICS_TARGETS.md`: N/A(기존 Target/member/coverage/상속 저장·호환 계약 불변)
- `docs/DB_SCHEMA.md`: N/A(Repository의 읽기 metadata 추가이며 schema/migration 및 DB 저장 writer 불변)
- `docs/SCHEDULING_ENGINE.md`: N/A(Calendar/공수/일정·Gate 계산 알고리즘 불변)
- `docs/IMPORT_SCHEMA.md`: N/A(새 조회 설정은 Import 입력이 아니며 parser/교환 schema 불변)
- `docs/IMPORT_EXPORT.md`: N/A(기존 Import/Copy/Template/Export writer 불변)
- `docs/EXCEL_EXPORT.md`: N/A(기존 Excel writer와 WBS view spec 미지원 경계 불변)
- `docs/SECURITY.md`: N/A(public-read 및 보호 mutation의 session/Origin/revision·권한 불변)
- `docs/GANTT_STATE_CONSISTENCY.md`: N/A(기존 단일 writer와 marker-OFF 규범 적용이며 상태 정책 불변)
- `docs/GANTT_STATE_CONFORMANCE.md`: N/A(기존 적합성 기준 적용이며 장기 conformance matrix 불변)
- `AGENTS.md`: N/A(기존 역할·문서·실행 지침 적용이며 지침 자체 불변)
- `docs/ISSUE_LIFECYCLE.md`: N/A(기존 PR CI 시작 단계까지 수행하며 Lifecycle 정책 불변)
- `docs/QA_REVIEW_POLICY.md`: N/A(HIGH/OWNER_MANAGED 및 Trusted QA/Owner 승인 정책 불변)
- `docs/CI_CD.md`: N/A(Required3/6-shard·workflow·main/GHCR/Release 계약 불변)
- `docs/REMOTE_VALIDATION.md`: N/A(기존 원격 gate·환경별 검증을 유지하며 CI 시작까지만 수행)
- `docs/GITHUB_OPERATIONS.md`: N/A(기존 canonical Refs·원격 게시·Owner 승인 경계 재사용)

## #720 매뉴얼 인계

`screenKey=dashboard.equipment` → [설비 현황](../../TARGET_RESOURCE_USER_GUIDE.md#설비-현황). 하위 축 조작·유형/작업 필터·등록과 작업 수치의 구분·원본 상세/편집·일정 복귀·오류 복구를 동기화한다. #720은 OPEN이며 앱 내 route/아이콘을 이번 변경의 완료로 주장하지 않는다.

## 실행 증거

- Node `22.14.0`, npm `11.10.0`, 전용 worktree의 `npm ci --prefer-offline --no-audit` exit0. 고정 Next16.3.8 local use-client 가이드 확인.
- 최초 gh API HTTP401. 연결 GitHub 도구로 Issue/댓글·open PR을 조회했고 Git fetch는 정상이다. 최초 #734 기존 PR 없음, baseline main과 새 branch 사이 충돌 없음.
- UI 읽기 전용 설계 완료. 구현·Unit/Chromium·PrePR·원격 CI는 실행 전 NOT TESTED.
- quality/e2e/docker, Trusted QA, 최종 Owner HIGH 수용/Manager ACCEPT: NOT TESTED. Main/GHCR·정식 릴리스·환경별 최종 수동 UX: NOT TESTED/요청 범위 밖.

### 사전 검토와 보완 이력

- backend 최초 신규 시험5건 FAIL은 기대 유형명·기존 other 코드 중복·deferred FK fixture 구성 오류였다. 원본 fixture를 올바르게 구성하고 기존 assertion·gate를 유지한 뒤 신규14건을 포함한4파일49건 PASS를 확인했다. Domain 계산·권한·실패 기준을 낮추지 않았다.
- 별도 qa_docs 사전 리뷰 P2-1: strict 개인 저장 schema에 새 equipmentTypeCodes가 없어 유형 선택 후 저장이 차단되는 결함. 기존 storage schema에 bounded 타입 배열을 추가하고 유형 OR 선택→후속 축/스크롤/focus 저장·복원, malformed 거부/직전 정상 저장 보존 회귀로 보완했다.
- 사전 리뷰 P2-2: 신규 equipment catalog가 응답 runtime schema에 없어 누락/중첩 malformed를 통과시키는 결함. report schema에 같은 typed metadata를 추가하고 누락/잘못된 중첩18종 음성 및 원본 source 무손실 회귀로 보완했다. 저장·transport·consumer 타깃16건 PASS 및 최종 typecheck/scoped lint PASS. 최종 통합은 아래 별도 동결 소스 기준이다.
- 첫 통합 Unit 선정은 실제12파일128건 PASS였으나 transport 보완 전 source다. 명령의 resource-drill-navigation.test.ts는 실존하지 않아 선택되지 않았다. 최종 명령에서 실제 resource-drill-navigation-model.test.ts로 바로잡고 새 transport/저장 변경까지 포함해 다시 실행한다. 이전 결과를 새 source PASS로 재사용하지 않는다.
- Chromium 첫 시작은 타 작업의127.0.0.1:3100 사용으로 test body0/환경 BLOCKED. 타 프로세스를 중단하지 않고 ignored 임시 wrapper에서 공식 Playwright config를 상속하여 shared bootstrap의 port/baseURL/APP_BASE_URL만3194로 일치시켰다. wrapper의 timing reporter 상대경로 문제도 절대경로로 고친 후 재시작했다. 격리 fixture·실 HTTP/SQLite·테스트 본문/정책은 그대로이며 이 시작 오류를 제품 FAIL/PASS로 분류하지 않는다.
- 자동 PrePR fast 초기 실행은 `.prepr-reports/issue734-fast-initial/{report.json,SUMMARY.md}`, sourceStable=true, UNKNOWN4/missing0/실제실행step0으로 BLOCKED. 계약 DTO/host·snapshot Repository·projection의 자동 direct import 매핑 부족이다. 전용 consumer·SQLite service/HTTP·원장·실제 browser 경로와 기존 직접 소비자 검증을 별도 명시하며 CLI 판정은 PASS로 바꾸지 않는다.

### 최종 인계 검증 (2026-10-20)

- 런타임 재개 뒤에도 제품 src/package 513파일이 원래 동결 manifest와 모두 일치했다(mismatch0). 초기 `/tmp` 보고서는 런타임 재개 중 사라져 유지된 worktree에서 같은13파일을 다시 실행했고 `.prepr-reports/issue734-unit-resumed.json`의 **140/140 PASS, FAIL0/SKIP0**를 확인했다. 전용14 server/4 consumer와 기존 원장·HTTP·공정·KPI·drill/transport/storage를 포함한다.
- 실제 Chromium의 최종 재개 실행에서 **3개 PASS**를 관측했다: Target0/15대/E10 다중 구역별10·고유5 M/D/full Gate(53.0s), 사용자 축 추가·정렬·삭제/두 경로·단독·재진입 복원(46.8s), 정확 Task/Assignment50% PUT·취소·일정 복귀/focus(42.2s). 다음5개(5폭·설비 원본 dirty 저장·readonly401/412·stale/pending·유형/controls)는 실행이 끝나기 전에 런타임이 다시 중단되어 **NOT TESTED**다. 전체8개 PASS/공식 E2E PASS를 주장하지 않는다. 캡처도 완료되지 않아5폭 screenshot은 NOT TESTED다.
- 첫 브라우저 FAIL은 사용중 설비 WorkArea 변경409였다. 테스트 준비만 기존 #733의 연결 해제→구성→Task 문맥→재연결 순서로 고쳤고 제품의 EQUIPMENT_WORK_AREA_IN_USE 보호를 유지했다. 유형 전체 선택 OR은 미연결 Task를 포함하는 무필터와 모집단이 달라, 관련 원시 Task ID 합집합으로 테스트 기대값을 바로잡았다. 원본 저장 case는 구역을 변경하지 않고 모든 기존 구역을 보존한 이름 저장·재열기를 검증하며, 최종 소스에 두 구역 전체 단언을 강화했다(해당 case 미실행).
- 별도 사전 검토 `/root/equipment_review`가 storage/transport 두 P2를 발견했고 수정 후 미해결 P1/P2=0을 보고했다. 직접 중복 없는6파일61건을 실행한 사전 결과는 최종140건의 부분집합으로 별도 합산하지 않는다. 이는 QA_FINAL/Trusted QA·Owner ACCEPT가 아니다.
- typecheck PASS, 변경17파일 ESLint PASS, version PASS, local Markdown278파일 PASS, 테스트 발견252 Unit파일/773 Chromium케이스 PASS, diff 검사 PASS. 최초 전체 lint는 생성 중/삭제 중인 Next 임시 산출물 ENOENT로 exit2, 재시도는 원인 미확인 SIGTERM143이었다. 환경 재개 후 소유한 임시 산출물과 임시 포트 wrapper를 제거한 최종 전체 lint는 exit0 PASS(기존13 warnings/0 errors)다. production build/로컬 Docker는 NOT TESTED이며 공식 PR CI가 수행한다.
- PrePR fast/targeted 최종은 각각 `.prepr-reports/issue734-fast-final/` 및 `.prepr-reports/issue734-targeted-final/`의 report.json/SUMMARY.md다. UNKNOWN4/missing0/실행step0으로 BLOCKED를 유지한다. 자동 매핑 누락을 별도 수동 검증의 PASS로 덮지 않는다. 원격 Full Required3·Trusted·Owner HIGH 수용은 NOT TESTED다.
- 기존 #734 PR 없음·최신 main05f1e560 그대로이며 충돌 없음. gh API 및 git push 인증은 실패했으나 연결 GitHub API의 repository write 경로로 동일 검토 Tree를 게시한다. 로컬 index Tree와 원격 Git Tree·부모를 대조하고 새 branch Ref를 한 번 만든 뒤 PR을 연다. 원격 URL/Head/Run은 게시 후 Issue STATUS 및 최종 응답에 남기며 CI 결과는 모니터링하지 않는다.

### 최신 main 충돌 해소와 최종 검증

문서의 두 신규 절은 모두 보존하고 공통 host에서 Process/Equipment/System consumer를 각각 연결했다. projection의 기존 시스템 direct/coordination selector 및 systemIds 집합과 설비 유형 OR를 조합하되 기존 Domain authority에서 원시 Task/Assignment·구성 합집합을 재계산한다. #735의 selection/configuration 캐시와50k budget을 유지한다. 초기 통합 typecheck의 wrapper root prop·selector union 타입 오류를 고쳤고 최종 typecheck PASS, 관련15파일155/155 Unit·통합 PASS/FAIL0/SKIP0를 확인했다. 기존13파일에 #735 consumer/server15건을 추가한 결과이며 `.prepr-reports/issue734-merged-unit.json`을 따른다.

원래 baseline과 최초 로컬 증거는 역사로 보존한다. 최신 통합 후 브라우저 전체/5폭/원본 복귀·별도 Reviewer·production build/Docker는 NOT TESTED이며 새 PR Full CI에서 검증한다. 사용자가 요청한 종료점인 새 CI 시작까지만 수행하고 결과를 기다리거나 병합하지 않는다.

### Full PR CI #3058.1 F734-001과 Review P2 재작업 (2026-10-21)

- canonical 누적 원장: [#734 실패 원장](../../ISSUE_734_FAILURE_ANALYSIS.md). 최초 CI [Run 39438998422.1](https://github.com/planner77/masterGantt/actions/runs/39438998422), Head `0786dde2a9fd96539250e91e482e85f4f557407f`, Base `08a1d9ff25a97aba67f08d6b67029ac55d45121a`. Quality/Docker SUCCESS, E2E shard1 FAILURE/2~6 CANCELLED, QA 파생 FAIL.
- 최초 실패는 `issue-734-equipment-dashboard.spec.ts` 5폭 E2E의 setup이 설비명 `LongEquipmentNameWithoutWhitespace.repeat(8)` = **272자**를 전송해 API의 200자 한도에 HTTP400으로 거부된 TEST_FIXTURE 계약 위반. Playwright 60/120s Timeout은 아님. 이름을 200자 경계값으로 고쳐 5폭/6열 정렬·가로 스크롤·native keyboard·Gantt instance/Marker OFF/읽기 전용 단언 그대로 유지한다.
- Codex 미해결 P2 두 건: 시스템 root 명시 `systemIds:[]`일 때도 유효하지 않은 `equipmentTypeCodes`를 cross-product 전에 거부하고, 동일한 설비 유형 표시명에만 `이름 (코드)`를 보여 접근 가능한 checkbox label을 구분한다. 서버/모델 Unit 반례 추가.
- 수정 범위: E2E 전용 파일, 서버 projection, equipment consumer/model, 서버/모델 Unit, 본 Work Packet 및 실패 원장. 인접 #735 system·#730 composer/원본 drill은 기존 Full6 shard 검증 범위를 유지한다. 실패 원인과 무관한 테스트 재분배·Timeout/Retry/Skip/Required3 정책 변경 없음.
- 본 환경에는 원격 checkout/npm/Chromium·Docker 직접 실행이 불가하여 보완 Head의 로컬/원격 결과는 **NOT TESTED**. 원본 Head Quality/Docker 및 과거 Unit155 PASS는 새 Head의 증거가 아니다. 리뷰 스레드 답글·resolve 및 main/ref 충돌 확인 후 단일 commit으로 Full PR CI를 시작하되 완료 모니터링, 병합, Release/Issue 종료는 수행하지 않는다. `HIGH/OWNER_MANAGED`, `manager_decision=NOT TESTED`, `release_authorized=false`, `MERGE_READY=BLOCKED` 불변.


### PR #759 Full #3061.1 F734-002 — 원본 공유 사용처 승인 절차 회귀 (2026-10-21)

- 최초 #3058.1 F734-001과 다음 #3061.1 F734-002의 전체 Run/Job·미실행·교정·원인별 Cross-run 매트릭스를 [단일 실패 원장](../../ISSUE_734_FAILURE_ANALYSIS.md#4-f734-002--두-번째-full-pr-ci-30611-저장-확인-단계-누락--2026-10-20-utc)에 append했다. #3061.1 Head `712d3edc85b5062ba1903c852427a97d464998f3`; Quality/Vitest/Lint/Typecheck/Build/Docker 성공, Shard1 12PASS/1FAIL/137NOT RUN, 나머지 5개 CANCELLED, E2E/QA는 파생 FAIL. 전용 5폭 케이스는28.1s PASS로 F734-001 재발 없음.
- 새로운 직접 실패는 같은 E2E 파일의 설비 **원본 dirty·PATCH 저장·snapshot 복귀** 테스트. UI 원본 편집은 공유 사용처 Target/Task 영향 preview를 반드시 거쳐야 PATCH가 발생하는데 시험에서 `저장` 직후 명시 confirmation을 누락하고 응답을 기다려 120s Playwright timeout. 서버 성능/Shard imbalance가 원인이라는 증거는 없다.
- #735 동일 공유 인스턴스 편집의 기존 browser 계약을 사용해 영향 확인(원본 ID/버튼 활성)·승인 전 0건 쓰기·`원본 변경 취소` 초안 보존·재확인 후 정확 PATCH200/새 WBS report, 2개 WorkArea·동일 spec·focus 복귀를 보호한다. 관측 GET과 실제 mutation, 원본 project revision/canonical UI를 구별하며 GSC `1.0.0-candidate` GSC-01/07/08/09/11과 conformance/ADR/Sync Trace를 기준으로 검토했다. 원래 120s test timeout과 Gantt writer, 전체6 shard/Required3, CI fail-fast/retry/skip 불변. 개별 PATCH 응답 관찰기에 한해 #735와 동일 유한30s 적용.
- 영향: 전용 `tests/e2e/issue-734-equipment-dashboard.spec.ts`(두 누적 실패와 후단 401/412/stale/유형), #735 system original confirmation, #730 composer와 #624 KPI/Task drill, 기존 HTTP/SQLite·server/consumer Unit/200자/접근성/원본 식별, Gantt instance/readonly. 직접 local Chromium 및 새 source Unit/CI/Trusted는 **NOT TESTED**이며 이전 실패 Head의 Quality/Docker 성공으로 대체하지 않는다. Work Packet·TEST_PLAN·누적 원장은 이번 corrective commit에 동기화, API/DB_SCHEMA/SECURITY/DESIGN/CI_CD/REMOTE_VALIDATION/AGENTS는 계약 변경 없음 N/A.
- GitHub connector의 정적 코드/원본 job 근거 검토 후, 실제 리뷰 thread0·strict current main alignment·충돌0 확인한 동일 branch의 새 PR Full CI 시작까지만 수행한다. main/GHCR·릴리스·Issue 종료와 CI 완료 모니터링은 하지 않는다. `HIGH/OWNER_MANAGED`, `release_authorized=false`, `manager_decision=NOT TESTED`, `MERGE_READY=BLOCKED`.


### PR #759 Full #3064.1 F734-003 — 인접 #730 총계 선택자 계약 변경 (2026-10-21)

- [#734 단일 실패 원장](../../ISSUE_734_FAILURE_ANALYSIS.md)의 세 차례 Full Run/Attempt(F734-001/002/003), 원본 Shard/Required와 취소·미실행 이력을 대조했다. [Full #3064.1](https://github.com/planner77/masterGantt/actions/runs/39485897399), Head cd7c3a12465478909c8c11d70f793e57bd72d7ff: Quality/Docker/Vitest/Typecheck/Lint/Build SUCCESS, Shard6의 tests/e2e/issue-730-view-composer.spec.ts:277 구 총계 locator에서 180초 대기 실패(32PASS/1FAIL/106 NOT RUN), 나머지 5 Shard CANCELLED.
- 이번 변경으로 설비 전용 WBS consumer의 aria-label이 '고유 총계'가 아닌 '설비 작업 고유 총계'로 실제 렌더된다. 이전 #730 테스트의 세 locator 및 후단 Task1 텍스트 기대를 새 계약(고유 Task 1건)으로 갱신한다. 검색 전후 총계 불변·응답 역전·원본 Task/Assignment 왕복·오류 409/503·stale·focus·기존 저장 schema 복구는 유지한다.
- #3064.1 취소 Shard1에서 #734 8 case 전부 개별 PASS(이전 F734-001/002 테스트 포함)했으나 Required 전체 PASS 아님. 누적 실패 2파일·3 case와 인접 #733/#735/#730/#624, GSC 1.0.0-candidate(01/07/08/09/11) 영향 검증 범위를 보존한다.
- 제품 코드/DB/API/보안/디자인/Gantt/CI 정책 불변. 이번 수정은 #730 E2E 선택자·본 Work Packet·docs/TEST_PLAN.md·#734 실패 원장 업데이트이며 나머지 문서는 N/A. 180초 timeout 확대·전체6 Shard 분배 변경·retry/skip/단언 완화 없이 신규 Head의 실제 CI 시작까지만 수행한다. 신규 local/npm/Chromium/Trusted QA·Owner ACCEPT는 NOT TESTED, 병합·릴리스 승인과 GHCR/Issue 종료는 BLOCKED.
