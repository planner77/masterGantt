# Issue #917 실패·재작업 원장

원본: https://github.com/planner77/masterGantt/issues/917

기준 source `1b8437fd199ff8f3bb2359ba7acc0d38f1ff67ca`, 위험도 HIGH. 현행 로컬 정책을 적용하고 원격 CI는 N/A다. 최초 실패·차단과 수정/재실행을 append-only로 보존한다. 합성 입력만 공개하며 실운영 DB·비밀·원문 운영 로그는 반입하지 않는다.

## 준비 관측

- 2026-11-13: 초기 과거 worktree는 #593 branch이며 사용자 변경이 존재하여 별도 최신 main worktree를 생성했다. GitHub connector 첫 Issue 조회는 repository owner 오기로404였고 정확한 `planner77/masterGantt` 재조회 성공. 댓글 조회는 `repo_full_name` schema를 확인해 재조회했다. 제품 테스트 실패와 구분한다.
- live Actions enabled=false, main ruleset deletion/non_fast_forward만 유지, classic branch protection404는 정책상 부재 확인이며 제품 오류가 아니다.
- 구현/검증/게시/배포: NOT TESTED / NOT PUBLISHED / NOT DEPLOYED.

## F917-001 — 기존 migration 개수 기대38/14가 신규0039의39/15와 불일치

- 발생: 2026-11-13, 구현 중 baseline HEAD `1b8437fd199ff8f3bb2359ba7acc0d38f1ff67ca` + 변경 diff(SCOPED, 개별 fingerprint/시각 미수집). Node22.14.0/npm11.10.0 Linux; application0.145.2→0.146.0.
- 단계/분류: INTEGRATION/TEST_FIXTURE. 실제 명령: `npm test -- tests/server/logistics/logistics-service.test.ts tests/server/logistics/logistics-repository.test.ts tests/server/db/issue-623-target-migration.test.ts`. exit=1.
- 기대: nullable 계약 및 기존 보호/회귀 만족. 실제 최초 결과: 16중13PASS/3FAIL: expected38 got39, pending14 got15.
- 원인/조치: 기존 migration 개수 기대38/14가 신규0039의39/15와 불일치. 원본 실패를 보존하고 담당자가 기존 seam을 수정·확장한다. 최종 clean source의 별도 전체 gate 전 재사용하지 않는다.
- 입력/소비자: 합성 fixture, `tests/server/db/issue-623-target-migration.test.ts` · migrates with target relational tables and version ledger. 잔여 위험: 최종 source admission·GHCR smoke·업무 수용은 별도.

## F917-002 — nullable 공유 계약 전파 중 아직 수정 전 소비자 타입 불일치

- 발생: 2026-11-13, 구현 중 baseline HEAD `1b8437fd199ff8f3bb2359ba7acc0d38f1ff67ca` + 변경 diff(SCOPED, 개별 fingerprint/시각 미수집). Node22.14.0/npm11.10.0 Linux; application0.145.2→0.146.0.
- 단계/분류: STATIC/PRODUCT. 실제 명령: `npm run typecheck`. exit=1.
- 기대: nullable 계약 및 기존 보호/회귀 만족. 실제 최초 결과: dashboard3곳 및 exchange export/copy/template3곳 타입 오류.
- 원인/조치: nullable 공유 계약 전파 중 아직 수정 전 소비자 타입 불일치. 원본 실패를 보존하고 담당자가 기존 seam을 수정·확장한다. 최종 clean source의 별도 전체 gate 전 재사용하지 않는다.
- 입력/소비자: 합성 fixture, `tests/features/resources/wbs-view-transport.test.ts` · accepts null primary process and rejects blank/missing process identity. 잔여 위험: 최종 source admission·GHCR smoke·업무 수용은 별도.

## F917-003 — 새 공정 필터 음성 fixture가 기존 합법 시스템 Task 연결도 포함

- 발생: 2026-11-13, 구현 중 baseline HEAD `1b8437fd199ff8f3bb2359ba7acc0d38f1ff67ca` + 변경 diff(SCOPED, 개별 fingerprint/시각 미수집). Node22.14.0/npm11.10.0 Linux; application0.145.2→0.146.0.
- 단계/분류: UNIT/TEST_FIXTURE. 실제 명령: `npx vitest run --config tests/config/vitest.config.ts tests/server/logistics/logistics-dashboard.test.ts tests/features/resources/wbs-view-transport.test.ts`. exit=1.
- 기대: nullable 계약 및 기존 보호/회귀 만족. 실제 최초 결과: dashboard 신규1FAIL: 공정 필터0 예상이나 시스템 경로가 실제 Task를 합법 포함.
- 원인/조치: 새 공정 필터 음성 fixture가 기존 합법 시스템 Task 연결도 포함. 원본 실패를 보존하고 담당자가 기존 seam을 수정·확장한다. 최종 clean source의 별도 전체 gate 전 재사용하지 않는다.
- 입력/소비자: 합성 fixture, `tests/server/logistics/logistics-dashboard.test.ts` · retains unassigned equipment in totals without inventing a process. 잔여 위험: 최종 source admission·GHCR smoke·업무 수용은 별도.

## F917-004 — 새 populated0038 seed의 공정 매핑 triple 필드 누락

- 발생: 2026-11-13, 구현 중 baseline HEAD `1b8437fd199ff8f3bb2359ba7acc0d38f1ff67ca` + 변경 diff(SCOPED, 개별 fingerprint/시각 미수집). Node22.14.0/npm11.10.0 Linux; application0.145.2→0.146.0.
- 단계/분류: INTEGRATION/TEST_FIXTURE. 실제 명령: `npm test -- tests/server/db/optional-equipment-process-migration.test.ts tests/server/logistics/optional-equipment-contract.test.ts tests/server/logistics/logistics-service.test.ts`. exit=1.
- 기대: nullable 계약 및 기존 보호/회귀 만족. 실제 최초 결과: 21중17PASS/4FAIL: seed58 PROJECT_PROCESS_MAPPING_TRIPLE_MISMATCH; migration 검증 도달 전 실패.
- 원인/조치: 새 populated0038 seed의 공정 매핑 triple 필드 누락. 원본 실패를 보존하고 담당자가 기존 seam을 수정·확장한다. 최종 clean source의 별도 전체 gate 전 재사용하지 않는다.
- 입력/소비자: 합성 fixture, `tests/server/db/optional-equipment-process-migration.test.ts` · upgrades populated 0038 without changing any row/PK/FK and preserves backup, restart and SQL guards. 잔여 위험: 최종 source admission·GHCR smoke·업무 수용은 별도.

## F917-005 — E2E가 기존 공유 인스턴스 변경 확인을 승인하지 않고 저장 완료 대기

- 발생: 2026-11-13, 구현 중 baseline HEAD `1b8437fd199ff8f3bb2359ba7acc0d38f1ff67ca` + 변경 diff(SCOPED, 개별 fingerprint/시각 미수집). Node22.14.0/npm11.10.0 Linux; application0.145.2→0.146.0.
- 단계/분류: PLAYWRIGHT/TEST_FIXTURE. 실제 명령: `npm run test:e2e -- tests/e2e/issue-726-logistics-master.spec.ts -g #917 --workers=1`. exit=1.
- 기대: nullable 계약 및 기존 보호/회귀 만족. 실제 최초 결과: 수정 저장 후 기존 공유 인스턴스 확인 dialog 미처리로 line160 timeout.
- 원인/조치: E2E가 기존 공유 인스턴스 변경 확인을 승인하지 않고 저장 완료 대기. 원본 실패를 보존하고 담당자가 기존 seam을 수정·확장한다. 최종 clean source의 별도 전체 gate 전 재사용하지 않는다.
- 입력/소비자: 합성 fixture, `tests/e2e/issue-726-logistics-master.spec.ts` · #917 permits zero-process equipment registration and nullable editing. 잔여 위험: 최종 source admission·GHCR smoke·업무 수용은 별도.

## F917-006 — 기존 resource snapshot은 primary process falsy를 오류로 거부하고 ledger는 null source를 추가

- 발생: 2026-11-13, 구현 중 baseline HEAD `1b8437fd199ff8f3bb2359ba7acc0d38f1ff67ca` + 변경 diff(SCOPED, 개별 fingerprint/시각 미수집). Node22.14.0/npm11.10.0 Linux; application0.145.2→0.146.0.
- 단계/분류: STATIC/PRODUCT. 실제 명령: `rg -n projectProcessId src/domain/resources/resource-kpi-targets.ts src/domain/resources/wbs-task-ledger.ts`. exit=0.
- 기대: nullable 계약 및 기존 보호/회귀 만족. 실제 최초 결과: 독립 QA P1: null 장비가 INSTANCE_PROCESS_UNAVAILABLE 및 equipment-process phantom source 생성 가능.
- 원인/조치: 기존 resource snapshot은 primary process falsy를 오류로 거부하고 ledger는 null source를 추가. 원본 실패를 보존하고 담당자가 기존 seam을 수정·확장한다. 최종 clean source의 별도 전체 gate 전 재사용하지 않는다.
- 입력/소비자: 합성 fixture, `tests/domain/wbs-task-ledger.test.ts` · nullable primary process preserves equipment without phantom process provenance. 잔여 위험: 최종 source admission·GHCR smoke·업무 수용은 별도.

## F917-007 — 새 Copy/Template 테스트 fixture에 필수 description 누락 및 잘못된 control role

- 발생: 2026-11-13, 구현 중 baseline HEAD `1b8437fd199ff8f3bb2359ba7acc0d38f1ff67ca` + 변경 diff(SCOPED, 개별 fingerprint/시각 미수집). Node22.14.0/npm11.10.0 Linux; application0.145.2→0.146.0.
- 단계/분류: INTEGRATION/TEST_FIXTURE. 실제 명령: `npx vitest run --config tests/config/vitest.config.ts tests/server/projects/project-copy-logistics.test.ts tests/server/projects/project-excel-logistics.test.ts tests/server/templates/logistics-template-graph.test.ts tests/server/templates/project-template-service.test.ts`. exit=1.
- 기대: nullable 계약 및 기존 보호/회귀 만족. 실제 최초 결과: 31중28PASS/3FAIL: projects.description NOT NULL(507), secondary control_role CHECK(574).
- 원인/조치: 새 Copy/Template 테스트 fixture에 필수 description 누락 및 잘못된 control role. 원본 실패를 보존하고 담당자가 기존 seam을 수정·확장한다. 최종 clean source의 별도 전체 gate 전 재사용하지 않는다.
- 입력/소비자: 합성 fixture, `tests/server/projects/project-copy-logistics.test.ts` · preserves equipment without a primary process through copy and template. 잔여 위험: 최종 source admission·GHCR smoke·업무 수용은 별도.

## F917-008 — 신규 Copy/Template fixture의 source/destination session token 재사용

- 발생: 2026-11-13 구현 중, baseline `1b8437fd199ff8f3bb2359ba7acc0d38f1ff67ca` + dirty diff; fingerprint/개별원본시각 미수집(SCOPED).
- 단계/판정/분류: INTEGRATION/FAIL/TEST_FIXTURE. 명령 `npx vitest run --config tests/config/vitest.config.ts tests/server/projects/project-copy-logistics.test.ts tests/server/projects/project-excel-logistics.test.ts tests/server/templates/logistics-template-graph.test.ts tests/server/templates/project-template-service.test.ts`, exit1.
- 기대: 정확 nullable/원본보존 및 실행입력 불변. 최초 결과/조치: 31중29PASS/2FAIL: edit_sessions.token_hash UNIQUE; destination 별도token으로 교정.
- 직접 소비자: `tests/server/projects/project-copy-logistics.test.ts` · preserves equipment without a primary process through copy and template. 최종 exact source 검사/게시 근거는 별도다.

## F917-009 — snapshot helper가 WITHOUT ROWID 테이블도 rowid로 정렬

- 발생: 2026-11-13 구현 중, baseline `1b8437fd199ff8f3bb2359ba7acc0d38f1ff67ca` + dirty diff; fingerprint/개별원본시각 미수집(SCOPED).
- 단계/판정/분류: INTEGRATION/FAIL/TEST_FIXTURE. 명령 `npm test -- tests/server/db/optional-equipment-process-migration.test.ts tests/server/db/issue-623-target-migration.test.ts tests/server/db/database.test.ts tests/server/migration-cli.test.ts`, exit1.
- 기대: 정확 nullable/원본보존 및 실행입력 불변. 최초 결과/조치: 35중32PASS/3FAIL: no such column rowid(:32); 실제PK열정렬로 교정.
- 직접 소비자: `tests/server/db/optional-equipment-process-migration.test.ts` · upgrades populated 0038 without changing any row/PK/FK and preserves backup, restart and SQL guards. 최종 exact source 검사/게시 근거는 별도다.

## F917-010 — 직접E2E Next 생성 경로 누적으로 삭제된 임시타입 참조

- 발생: 2026-11-13 구현 중, baseline `1b8437fd199ff8f3bb2359ba7acc0d38f1ff67ca` + dirty diff; fingerprint/개별원본시각 미수집(SCOPED).
- 단계/판정/분류: STATIC/FAIL/ENVIRONMENT. 명령 `npm run typecheck`, exit2.
- 기대: 정확 nullable/원본보존 및 실행입력 불변. 최초 결과/조치: TS6053 임시.next-e2e-isolated 경로파일4개없음; source변경 아닌 생성진입점/실행경합.
- 직접 소비자: `tests/scripts/prepr-snapshot.test.ts` · keeps original source unchanged while validating exact Next generated metadata. 최종 exact source 검사/게시 근거는 별도다.

## F917-011 — Resource snapshot INNER JOIN이 미지정설비행 누락

- 발생: 2026-11-13 구현 중, baseline `1b8437fd199ff8f3bb2359ba7acc0d38f1ff67ca` + dirty diff; fingerprint/개별원본시각 미수집(SCOPED).
- 단계/판정/분류: UNIT/FAIL/PRODUCT. 명령 `npx vitest run --config tests/config/vitest.config.ts tests/server/resources/issue-734-equipment-configuration.test.ts`, exit1.
- 기대: 정확 nullable/원본보존 및 실행입력 불변. 최초 결과/조치: 6view 신규회귀 INSTANCE_REFERENCE_UNAVAILABLE; LEFT JOIN+raw nonnull damagedref409 추가.
- 직접 소비자: `tests/server/resources/issue-734-equipment-configuration.test.ts` · preserves an unassigned registered equipment across all six views without a phantom process. 최종 exact source 검사/게시 근거는 별도다.

## F917-012 — 손상된 비null 공정 참조가 DTO/LEFT JOIN에서 정상null로 치환

- 발생: 2026-11-13 구현 중, baseline `1b8437fd199ff8f3bb2359ba7acc0d38f1ff67ca` + dirty diff; fingerprint/개별원본시각 미수집(SCOPED).
- 단계/판정/분류: STATIC/FAIL/PRODUCT. 명령 `rg -n processId src/server/logistics/logistics-service-core.ts`, exit0.
- 기대: 정확 nullable/원본보존 및 실행입력 불변. 최초 결과/조치: 독립QA P2: Template save/조회에서 손상참조 은폐; DTO409/raw snapshot409와corrupt회귀추가.
- 직접 소비자: `tests/server/projects/project-copy-logistics.test.ts` · rejects corrupt nonnull primary process source references during Copy and Template save. 최종 exact source 검사/게시 근거는 별도다.

## F917-013 — 신규409코드가 locale오류mapping에없어영문원문노출

- 발생: 2026-11-13 구현 중, baseline `1b8437fd199ff8f3bb2359ba7acc0d38f1ff67ca` + dirty diff; fingerprint/개별원본시각 미수집(SCOPED).
- 단계/판정/분류: STATIC/FAIL/PRODUCT. 명령 `rg -n PROCESS_INACTIVE src/features/logistics/project-logistics-management.tsx`, exit0.
- 기대: 정확 nullable/원본보존 및 실행입력 불변. 최초 결과/조치: 독립QA P2: ko/en/vi공정비활성/Target해제충돌안내누락; 기존error descriptor번역추가.
- 직접 소비자: `tests/e2e/project-logistics-management.spec.ts` · #917 기존 Target 충돌 409는 공정 해제 초안과 현지화된 오류를 보존한다. 최종 exact source 검사/게시 근거는 별도다.

## F917-014 — geometry검사가 실제Tab대신offscreen버튼programmatic focus만수행

- 발생: 2026-11-13 구현 중, baseline `1b8437fd199ff8f3bb2359ba7acc0d38f1ff67ca` + dirty diff; fingerprint/개별원본시각 미수집(SCOPED).
- 단계/판정/분류: PLAYWRIGHT/FAIL/TEST_FIXTURE. 명령 `npm run test:e2e -- tests/e2e/issue-726-logistics-master.spec.ts -g #917 --workers=1`, exit1.
- 기대: 정확 nullable/원본보존 및 실행입력 불변. 최초 결과/조치: 390px focus된수정버튼x1811로viewport밖 FAIL; 실제summary→Tab진입으로owner가로scroll/버튼가시성검증 후35.4sPASS.
- 직접 소비자: `tests/e2e/issue-726-logistics-master.spec.ts` · #917 공정 없이 설비 생성·재조회와 미지정 필터. 최종 exact source 검사/게시 근거는 별도다.

## F917-015 — 설비nullable 공유계약/UI/fixture의기존영향매핑부재

- 발생: 2026-11-13 구현 중, baseline `1b8437fd199ff8f3bb2359ba7acc0d38f1ff67ca` + dirty diff; fingerprint/개별원본시각 미수집(SCOPED).
- 단계/판정/분류: LOCAL_PREP/BLOCKED/POLICY_MAPPING. 명령 `node scripts/verify-prepr.mjs --mode=targeted --base=1b8437fd199ff8f3bb2359ba7acc0d38f1ff67ca --issue=917 --dry-run --report-dir=.prepr-reports/plan-01`, exit0.
- 기대: 정확 nullable/원본보존 및 실행입력 불변. 최초 결과/조치: dryrun NOT TESTED,selectionBLOCKED: 계약/UI/i18n/fixture UNKNOWN 및graph directimport미발견; 생성diff도포함.
- 직접 소비자: `tests/scripts/prepr-verifier.test.ts` · maps nullable Equipment contracts, locale and the reused HTTP fixture without accepting unknown producers. 최종 exact source 검사/게시 근거는 별도다.

## F917-016 — SCOPED E2E실행중테스트파일변경으로입력불변미충족

- 발생: 2026-11-13 구현 중, baseline `1b8437fd199ff8f3bb2359ba7acc0d38f1ff67ca` + dirty diff; fingerprint/개별원본시각 미수집(SCOPED).
- 단계/판정/분류: PLAYWRIGHT/BLOCKED/PROCESS. 명령 `npm run test:e2e -- tests/e2e/issue-726-logistics-master.spec.ts -g #917 --workers=1`, exit0.
- 기대: 정확 nullable/원본보존 및 실행입력 불변. 최초 결과/조치: runner1/1 37.8s지만실행중파일수정으로PASS근거제외; 후속freeze실행35.4sPASS는별도SCOPED.
- 직접 소비자: `tests/scripts/prepr-snapshot.test.ts` · rejects source mutations during a browser snapshot run. 최종 exact source 검사/게시 근거는 별도다.

## F917-017 — 백업CLI파일명을추정해잘못된경로호출

- 발생: 2026-11-13 구현 중, baseline `1b8437fd199ff8f3bb2359ba7acc0d38f1ff67ca` + dirty diff; fingerprint/개별원본시각 미수집(SCOPED).
- 단계/판정/분류: LOCAL_PREP/FAIL/ENVIRONMENT. 명령 `node scripts/sqlite-backup.mjs --help`, exit1.
- 기대: 정확 nullable/원본보존 및 실행입력 불변. 최초 결과/조치: MODULE_NOT_FOUND; rg실제파일발견뒤verify-sqlite-recovery.mjs사용;실제AESCLI후속PASS.
- 직접 소비자: `tests/scripts/sqlite-backup.test.ts` · validates encrypted backup and isolated restore without replacing source files. 최종 exact source 검사/게시 근거는 별도다.

## 구현 중 재검증·증거 제한

backend20files175tests/마지막2files16tests, exchange16files144tests/직접graph24tests, 인접migration6files81tests, Resource17tests·KPI18tests, transport/dashboard33tests 및 prepr-verifier50tests가 exit0이었다. 실제 Chromium#917 CRUD/15조합1test35.4s·상태#9172tests10.1s·기존유형1test11.4s도 exit0이다. 모두 baselineHEAD+dirtydiff의SCOPED이며 최종source admission으로승계하지않는다. 처음확보한원본실패trace/error-context는후속Playwright test-results정리로소실돼메시지/원장만남는다. 이증거손실을숨기지않고최종실행기는원본runner/로그/실패artifact를독립보고root에보존한다. 미모킹합성KPI404경고는실제성공근거가아니다.

0039/39 추가로변한기존최신migration기대만갱신했고기존SQLchecksum은변경하지않았다. Next가쓴next-env/tsconfig의격리출력경로는이번worktree최초cleanHEADbytes로복원했다. 제품/fixture를초기상태로되돌려PASS를만드는행위가아니며최종clean검증은별도worktree에서실행한다.

## 합성 AES backup/격리 restore

2026-11-13T06:34:26.591Z~06:34:27.664Z에기존#912CLI keygen/backup/verify/restore와0039 upgrade/reopen10단계exit0. backupID `mg917-syn-20261113T063426591Z-5f3c3998`, captured source `1b8437fd199ff8f3bb2359ba7acc0d38f1ff67ca`, prior digest `sha256:4fa043b351734d31047846f30fb468fe4c61bba77e36c37f95a2955e94dcb5ca`. 실제Docker/ORAS config·provenance의같은revision/digest결속도06:36:32.206605Z~06:36:37.318239Z read-only조회3회exit0으로확인했다. DB는실운영과분리한합성seed다. 73tables/31populated/44rows(ledger제외)정확보존, null설비추가후45rows재open유지, SQL39/integrityok/FK0/Target·coverage음성guard PASS. freshness3600000ms는합성실험값이며운영정책이아니다. SQL0039 SHA256 `f5b725ee12817f4f27e929f7c87ba5b8bd366950c5d4e62f3bf0ae6d97bcc7f8`, SQLinventory `87eb73cab0cff5c69e051172c5742404d09205e9ad66d442829750ddde4f5658` 전후같음. private키/백업/DB·원문경로는공개하지않는다. 후보이미지runtime/offhost는이CLI로검증하지않았으며별도다.

## F917-018 — 좁은 설비표 관리 버튼의 글자별 줄바꿈

독립 ui_ux/qa_docs의 SCOPED PNG/geometry검토와 Manager의 실제 geometry-ko-390.json Python조회(exit0)에서390px tableowner364/scroll1524, actioncol71.2, 버튼폭44/높이58·118·78·58, 행357.28125px을확인했다. 기존CSS/DOM은같았지만신규문구의열배분영향이있을수있어baseline대비인과는미확정이다. 기존설비표에만관리셀최소22rem·nowrap·버튼44px을추가하고내부가로scroll을유지했다. 테스트는ko/en/vi×5폭버튼동일행/비겹침·44px·행160px이하·dialog상단선택표시를추가해1test35.7s exit0. 최종exactsourcegate/시각검토는별도다. 첫SCOPEDgeometry를읽은뒤다음runner가test-results를정리하여copy시도는StopIteration(exit1)이었고그이전PNG는보존하지못했다. tool반환numeric/대화기록은보존하며후속afterfixPNG/JSON은ignored보고root에복사했다. 증거수집실패를원본화면보존으로과대표시하지않는다.

## 최종 gate 준비 보완

영향매핑은기존UNKNOWN을없애는임의면제가아닌실제producer/consumer경로등록이다. 계획67Unit/32Chromium파일이며실행목록은최종receipt에서재계산한다. 선정된기존Chromium소비자의과거output/playwright쓰기경로를추가발견하여testInfo.outputPath로출력만이관한다. 기존golden/fixture/테스트assertion/timeout/retry/skip은유지하고sourceguard는완화하지않는다. logistics-table-density의before전용역사캡처는기존명시opt-in(SKIP/N/A)이고필요after검증의PASS로사용하지않는다.

## 후속 SCOPED 교정 event와 최종 검증 준비

F917-001~015/018에 직접 소비자의 실제 exit0 재검사 event를 추가했다. 원본 FAIL/BLOCKED event·Markdown prefix는 그대로다. F917-016의 실행중파일변경은 뒤의 PASS로소급승인하지않으며최종snapshot sourceguard로새로검증한다. F917-017의잘못된CLI명은실제기존verify-sqlite-recovery CLI로keygen/backup/verify/restore 성공한위별도근거를따른다. F917-018관측command표기는요약이며실제Python heredoc(`python3 -`)였음을후속정정event로남겼다.

선정된산출물11spec의경로이관은독립QA가TypeScript AST로expect/test.skip/setTimeout/slow/fixme/fail/retries호출을HEAD와비교하여기존호출동일을확인했다. finalsource에서실제실행하는testInfo보고root가새PNG/JSON을보존하며과거committedoutput은변경하지않는다.


## 754786c 공통 Gate 및 AC 직접 증거 보강

source `754786c688a15f8f9cd4586f8874c32927045a95`에서 2026-11-13T06:46:39.926Z~06:50:32.224Z fast-01의9step 모두exit0/PASS: 전체321파일4009tests PASS/기존opt-in benchmark3SKIP, typecheck/lint/production build. 독립QA가source fingerprint `c88a7edc9b3a6729ff6d65e8a1299d5c714310d73e7255e303faa8575b23d4ba` 전후동일/envStable/report checksum/9개로그SHA/원본runner를대조했다. 이성공은754의것이며후속source에승계하지않는다.

독립QA는AC1의공정0Fleet UI직접증거부재와fixture가명시Task2개를만들던점, AC4의null검색/비활성교집합및실제대시보드·일정렌더증거를추가지적했다. 제품실행FAIL로잘못표시하지않고coverage NOT TESTED로분리해기존#917 E2E를확장했다. fixture child/summary를실제DELETE setup후공정/Project WorkArea/Task/Target0 baseline에서Unit1·Fleet7을UI로각POST201하고GET/reload에서서로다른ID/수량·Task0/Target0을확인했다. 이름/코드×전체/미지정검색·비활성hide/show/reload, 설비Dashboard의공정미지정/총량8/Fleet7, 일정EquipmentView의유형/모델/원본idle렌더도직접확인했다. 단일실행44.1s/1test exit0은dirtySCOPED이고최종HEAD Gate에서재실행한다. 기존150초test timeout은유지한다.


## F917-019 — 독립 QA 보고서 상대 경로 조회 오류

source `a38828a7f7b2dfc59e5202b66ebc39b83b79b427`, Node22.14.0. 실제argv `node --input-type=module`,stdin heredoc,cwd=검증worktree. `runner.resultFile`의`vitest-results.json`을cwd에서읽어ENOENT/open/exit1. reportDir상대경로로`path.join`하고절대경로는그대로읽도록즉시교정한동일argv의exit0에서fast02checksum/9개logSHA/runnerSHA/4009PASS0FAIL3pending/source·env안정성을확인했다. 두명령의정확UTC시각은미수집이며fast02완료2026-11-13T06:56:34.335Z이후의순서만알려져있다. 제품/테스트FAIL과구분한다. Reviewer는제품/테스트/문서·원격상태read-only였고초기검색출력1개를`/tmp`에저장한보조I/O는있었다.

## F917-020 — Chromium 원본149 PASS 뒤 docs PNG 오염으로 snapshot BLOCKED

- source: `a38828a7f7b2dfc59e5202b66ebc39b83b79b427`; fingerprint `d83665d0a2d52c47a5cdbcb16ba0d866b9e1273d445a9d2f776090011ed44b71`.
- 실제명령: `node scripts/verify-prepr.mjs --mode=targeted --base=1b8437fd199ff8f3bb2359ba7acc0d38f1ff67ca --issue=917 --report-dir=.prepr-reports/final-targeted-02`.
- 시각: 2026-11-13T06:57:30.685Z~07:57:09.208Z; exit1/최종BLOCKED. 영향67Unit파일803PASS,32Chromium파일149PASS/0FAIL/역사before캡처1SKIP(N/A),retries0·workers1·58.6분. rawassertions와최종admission판정은별개다.
- 최초오류: `BLOCKED: snapshot source/fixture 변경을 거부합니다: docs/evidence/issue-528/resource-drill-1440.png`. 전체5266개before/after목록을비교한실제변경은해당1440/390PNG두개와설치된Next의정확생성출력next-env/tsconfig두개뿐이다. untracked0,parent sourceStable/environmentStable=true.
- 원인: `resource-drill-ui.spec.ts`가`docs/evidence/issue-528`에직접screenshot을썼다. 기존output/playwright검색만으로모든writer를확인하지못했다. 원본PNG는정리된일회용snapshot에있었으므로bytes는보존되지않았지만before/afterhash·audit·원본runner/로그/일반test-results는유지한다. auditSHA256 `7c100357e6d5f2cbf4740a214ffa1aa3a291a994c4b7070a703c68b1ca06d0c2`, rawChromiumJSON `844074bbe83341cfe43b2bdcc2753c6c6b6d8625bfb8de38a384b16ca316e60e`.
- 수정: PNG390/1440경로만기존`testInfo.outputPath`로이관. 파일명·옵션·101개AST assertion/skip/retry/timeout호출은동일하며typecheck/lint/diff검산exit0. 독립QA는선정32spec의상대import/export/require/dynamicimport를재귀추적한69파일의writer를감사했다. 명시경로override3개는현재환경ABSENT이며defaultwriter는testInfo/attach또는fixture소유runtime경로다. 정적감사는임의동적문자열실행까지보증하지않는다.
- 복구조건: 새cleanHEAD에서공통fast·영향Chromium전체·Docker·admit를실행한다. a388의BLOCKED를PASS로승계하거나sourceguard를완화하거나사후PNG복원으로PASS를만들지않는다. Push/Publish/Close는계속차단한다.


## F917-021 — 격리 runtime 검증기의 빈 If-Match 기대 상태 오류

- 실제 source `dbec24261b940cf3e7ef73891ecd5a6cd88e7a20`, fingerprint `280a5144702d078461c2ceaa84d04108b4d5849fbfa19f38dc7769e9c2385f9b`; image config `sha256:f710f72dd5cdb463b5b0721b4cd6b900000f20a0a8d444b6ecde819e7271c2d0`, OCI index `sha256:7cb0c13d38c477572d829c918421fcdf6664915d11422b4eacfc429d2c886185`.
- R01: 2026-11-13T08:18:14.526Z~08:18:17.269Z. 실행은 Python stdin launcher의 subprocess.run(Node22 absolute path, private runtime.mjs, private proof root), cwd=verification worktree다. Node child exit1, 결과를 수집한 Python launcher exit0이다. 빈 `If-Match: ""` PATCH의 기대428/실제400으로 75번째 HTTP 검증에서 FAIL했다. 헤더 자체가 없으면428, 빈 값이면400이 정상 계약이다. 앞선74HTTP와 합성 AES 복원/0038→0039 성공은 whole runtime PASS가 아니다. raw receipt SHA256 `a181e1d9b5395668f0d6d545a85f1d4125ef31a051ddecdb9bfe0b0ce212feb8`.
- 교정: 빈400/누락428을 각각 검사하도록 probe만 수정했다. DELETE 기대200→204도 R02 전에 고쳤으며 R01에서는 해당 단계에 도달하지 않았다. 제품/API/테스트 gate는 변경하지 않았다.
- R02: 2026-11-13T08:19:18.096Z~08:19:24.439Z, Node exit0/Python exit0, 실제23단계·91/91HTTP PASS. 새 합성 backup `mg917-runtime-syn-20261113T081918096Z-fb15606c`의 keygen/backup/verify/restore→0038 identity→후보0039 upgrade에서73tables/44rows 원본 일치, 최종126합성rows·SQL39·integrity ok/FK0, 장비 null CRUD/quantity/권한/Origin/revision/409원자 rollback/두번 restart·자기 container/volume 정리를 확인했다. 운영 DB 접근0/registry write0/offhost 미검증이다.
- sanitized summary SHA256 `6c7dce0167aea36d3ef92a2ce83a0bd5bf43f5082aaa612c5424a4cceb9471fb`, raw receipt `d771da9ef0de8ef926ffb620e1ef5be37a66a5e9907d25a049f6f55f907ecf42`, probe `8edc43a76ea445fcc58d1afecbd6c5b84522f9e35bb304389193e3f667d9d9f3`.독립QA가91status/23steps/36개raw log hash를 확인했다. secret/cookie/합성DB·키 bytes는 공개하지 않는다. 이 성공은 dbec/당시 환경의 역사 증거이며 새 source/환경에 승계하지 않는다.

## F917-022 — 세션 중단 및 실행 환경 변경으로 전체 Chromium 재검증 필요

- 명령: `node scripts/verify-prepr.mjs --mode=targeted --base=1b8437fd199ff8f3bb2359ba7acc0d38f1ff67ca --issue=917 --report-dir=.prepr-reports/final-targeted-03`, source/fingerprint는 위 dbec와 같다.
- 2026-11-13T08:57:43.386165Z 복구 관측: controller session21477 소실·최종report 없음·process 종료값 미수집(null). Unit803PASS/Chromium67PASS·관측FAIL0이지만 전체 run=NOT TESTED, admission=BLOCKED다. 마지막 log write 08:52:41.386791Z; log SHA256 `b7500dea21da0dfdce86f8198796ad83c9490b488a281c2e8ab8b2dc712218bd`. interrupted snapshot/test-results·interruption.json은 별도로 보존했고 미완료 source audit를 PASS로 추정하지 않는다.
- source는 clean dbec 그대로였으나 environment fingerprint가 `a8ac276fdf9a906d5e7d23fd053b383fdc259aa752975e963dfcebb68b20d7c9`→`8bc2b35b31a6ce4d7d25acdd2e7c89c999b754fbcbb2a0c98a266a661b9dd906`로 바뀌었다. Node/npm/ABI/OS/설치 input hashes는 같고 environmentSha256만 다르다. 이전 raw 환경값은 의도적으로 저장하지 않아 구체 변경 key는 UNKNOWN이다. env ignore 목록이나 원본 report를 고쳐 이전 PASS를 결합하지 않는다.
- 복구: 새 원장 source를 freeze하고 동일 실제 환경의 official fast/targeted/docker/admit와 fresh 합성 exact-image runtime을 재실행한다. 세션 수명과 분리된 private 임시 실행 supervisor는 기존 CLI를 그대로 호출하고 실제 child exit를 기록하며 환경값/secret은 디스크에 저장하지 않는다. supervisor 시작 성공은 검사 PASS가 아니다. final-targeted-02/03과 fast03/docker03의 모든 원본 실패·성공·중단 증거는 보존한다. 새 전체검증/QA 전 Push/Publish/Close는 BLOCKED다.


## F917-023 — 중단 snapshot 보존 위치 때문에 root lint가 생성 파일을 검사

- source `b6a1c8886c4b5026bbe4bbee1d7a1bea345cd10f`, fingerprint `4704b914a02b5730f4acedaf9bd66ad0e042473825d72c8ef1325d0b3ee782c4`, env fingerprint `8bc2b35b31a6ce4d7d25acdd2e7c89c999b754fbcbb2a0c98a266a661b9dd906`.
- 실제 명령 `node scripts/verify-prepr.mjs --mode=fast --base=1b8437fd199ff8f3bb2359ba7acc0d38f1ff67ca --issue=917 --report-dir=.prepr-reports/final-fast-04`, 2026-11-13T09:05:51.120Z~09:08:16.624Z, controller exit1/whole FAIL, interrupted=false/sourceStable=true/environmentStable=true. 앞6step PASS 뒤 Lint의 `npm run lint` exit1/136531ms,1274errors/9668warnings. 이후 Unit/build 및 queued Docker/targeted는 NOT TESTED다.
- 원인: F917-022의 browser-source를 `.prepr-reports` 안에 보존한 채 fast를 시작해 root lint가 그 안의 `.next-e2e` 생성 JS까지 읽었다. 최초 지적은 nested Next chunks ESLintEnvWarning이며 제품 source의 신규 오류와 구분한다. 기존 ignore는 root `.next-e2e/**`이므로 중첩 worktree를 자동 제외한다고 추측한 Manager의 준비 오류다. 실제 검사 중 해당 잔재를 이동/삭제하지 않고 최종 FAIL을 보존했다.
- 원본 report SHA256 `732673116d19f7bc504d9f38482314205843a5c3b3004026fd5bc0ff6291e1b1`, Lint log `9f737ac01244186128c4f6d144d587771fc021daafb6ed135c7a075b8d2a2b93`.
- 복구: 실패 후 2026-11-13T09:09:03.755499Z에 `git worktree move`(Python subprocess launcher, exit0)로 자기 interrupted snapshot 전체를 저장소 밖0700 경로로 이관했다. 56080개 file/symlink inventory의 전후 bytes/hash/target 동일, inventory SHA256 `108b126b49833bdd6865b2d54324f44dfae955c4a6e6f8cd9bae579ec5ac5e8b`; Git locator metadata만 공식 move가 갱신했다. 원본 report/log는 불변이고 별도 relocation receipt/전체 inventory를0600로 보존했다. snapshot/sourceguard·ESLint ignore·fixture·검사 선정/skip은 변경하지 않았다.
- 신규 same-environment 전체 gate 전 Push/Publish/Close BLOCKED다. private supervisor v2는 동일 공식CLI와 실제 환경을 유지하고 게시도 별도 명시 job을 받은 뒤 동일 launcher에서 실행할 수 있게 준비한다. 자동 Push/Publish/Close는 예약하지 않는다.
