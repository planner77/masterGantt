# Milestone Timeline #553 교환·출력 수용 추적표

기준: 2026-10-25 / 운영 **marker OFF** / Issue [#553](https://github.com/planner77/masterGantt/issues/553), PR [#562](https://github.com/planner77/masterGantt/pull/562). #548의 역사적 ON 계획과 #551의 개발용 lane은 현재 운영 수용 조건이 아니다. Main 기준 #552 native 행 제거를 유지한다.

| #553 AC / #548 MP | 근거 테스트·경로 | 문서 | 이번 latest-head 증거 |
| --- | --- | --- | --- |
| AC1 full canonical·Summary·전체 Ready/Complete·revision 조회 불변 (MP-01/03) | `tests/fixtures/issue-553/canonical-interchange.ts`, `tests/integration/milestone-timeline-interchange.test.ts`; #552 `milestone-visibility.spec.ts` | MILESTONE_STAGE_GATES / MILESTONE_PRESENTATION_POLICY | 새 Head 원격 NOT TESTED |
| AC2 JSON1.1 UUID/FK·명시 소속·mixed Link 원자 거부 (MP-05/06) | 위 integration 13개 중 JSON/mixed/rollback 및 `milestone-timeline-interchange-http.spec.ts` | IMPORT_EXPORT | 새 Head 원격 NOT TESTED |
| AC3 Project Copy/Template·multi-root Copy/Cut·complete lock | integration 및 HTTP Copy/Template spec; 기존 #464 교환 guard | IMPORT_EXPORT / TASK_RELATIONS | 새 Head 원격 NOT TESTED |
| AC4 Excel hidden Milestone/Source revision/Resource opt-in (MP-06) | integration OOXML·HTTP 실제 Workbook; 기존 `resource-excel-export-ui.spec.ts` | EXCEL_EXPORT | 새 Head 원격 NOT TESTED |
| AC5 SVG/PNG canonical WBS/범위·fail-closed·escaping (MP-06) | integration SVG·HTTP SVG / 기존 `project-gantt-image-export.spec.ts`의 실제 PNG·SVG E2E | IMAGE_EXPORT | 새 Head 원격 NOT TESTED |
| AC6 OFF UI 390/768/1024/1440/1920·Day/Week·소속/날짜/복귀 (MP-02/04/07/08) | #552 `milestone-visibility.spec.ts`의 운영 OFF 5폭; #574 별도 종단 QA. 과거 #553 UI ON 10건 이식 금지 | MILESTONE_TIMELINE / PROJECT_UX / 본 가이드 | 동일 새 Head 전체 원격 NOT TESTED |
| AC7 사용 가이드/환경·불변식·테스트 이력 | `docs/MILESTONE_USER_GUIDE.md`, 본 표, `docs/ISSUE_553_FAILURE_ANALYSIS.md` | TEST_PLAN / ISSUE_LIFECYCLE | 작성, 실제 QA_FINAL/Owner ACCEPT NOT TESTED |

## 선행·후속 및 출처 관리

- #549~#551: 모델·Dashboard·선택적 표시 기술 이력; 과거 source PASS는 최신 main의 PASS가 아니다.
- #552/PR #561: marker-OFF WBS 분리 완료, native M row/bar 0; main에 병합된 baseline을 이 PR에서 재구현하지 않는다.
- #553/PR #562: 기존 0.106.1 stacked source `afd5ec2899183a2464b64f91d34e9de5d8a8319c`는 archive와 merge first-parent로 보존. 최신 main 동기화 후 **선별 이관**이며 과거 6-shard 증거는 현행 8-shard CI의 PASS가 아니다.
- #574: 실제 5폭·HTTP/SQLite·SC-01~14 및 독립 통합 수용의 책임. #573/#693: 사용자 opt-in marker ON용 **선택** 후속이며 #553/574 OFF 수용을 막지 않는다.

TEST_LIFECYCLE_REVIEW: 기존 `milestone-visibility.spec.ts`, `project-gantt-image-export.spec.ts`, `milestone-exchange-state.spec.ts`, `resource-excel-export-ui.spec.ts`, `milestone-stage-exchange.spec.ts`를 검색해 상호 비교했다. canonical fixture/integration 및 실제 HTTP 교환은 **KEEP_UNIQUE** (실제 DB/새 UUID·process restart와 기존 synthetic UI가 다른 위험), 이미지 E2E에 안내 문구 assertion은 **EXTEND**, old marker-ON UI 파일은 **RETIRE_CANDIDATE 아님**—archive에서 역사 보호, 최신 운영에 무단 실행/복원하지 않는다. 기존 테스트 삭제·skip·assertion 완화 없음. 신규/변경 테스트 Local NOT TESTED(실행 환경 미제공), Full8/Trusted/Manager NOT TESTED; 병합/Release 미승인.


## #3272.1 실패와 Issue AC8–AC10 매핑 (2026-10-25)

- [원본 Full CI #3272.1](https://github.com/planner77/masterGantt/actions/runs/40160694952): PR Body `Refs #553` 단독 행 부재로 `changes` FAIL, TypeScript/Unit/E2E 8-shard/Docker **NOT RUN**. [F553-G 실패 원장](ISSUE_553_FAILURE_ANALYSIS.md)과 [Issue #553 Work Packet](exec-plans/active/ISSUE_553.md) 참조.
- **AC8:** 운영 marker-OFF Dashboard/소속 Task 대신 경로와 내보내기 형식 차이 → `MILESTONE_USER_GUIDE.md`, `project-gantt-image-export.spec.ts`.
- **AC9:** #549~#553 고정 Source와 exact Run 출처/미검증 및 #548/#574 marker OFF 종합 인수, #573/#693 선택 marker ON 분리 → 본 추적표 + Packet.
- **AC10:** 독립 QA/Owner ACCEPT·Windows Excel/DRM/운영 proxy·외부 소비자 검증은 실제 증거 전 NOT TESTED, 무단 병합·정식 게시·종료 금지.
- Issue 본문의 기존 10개 acceptance 체크박스를 **AC1~10**으로 1:1 식별하고 `## AC_TEST_COVERAGE`에서 각각 test/docs/정확 Head 결과를 구분한다.


## #3274.1 direct Vitest 실패 — E2E Shard4 계획 복구 (2026-10-25)

- 원본 [#3274.1 / 40162277020](https://github.com/planner77/masterGantt/actions/runs/40162277020): `changes`, Trusted Preflight, TypeScript, ESLint, Policy PASS. Vitest **13/13 Milestone integration PASS**, 전체 3293 PASS / 1 FAIL / 3 existing SKIP. `e2e-shard-planner.test.ts:109`에서 `milestone-timeline-interchange-http.spec.ts` 계획 배치 누락(실물141 vs explicit140). Fast Gate/3 Required/QA Final 파생 실패, 실제 E2E8/Next build/Docker 미실행. [실패 원장 F553-H](ISSUE_553_FAILURE_ANALYSIS.md).
- [Metadata-only #3273.1 / 40162212311](https://github.com/planner77/masterGantt/actions/runs/40162212311)은 기존 Head의 과거 #3272 Full 실패 확인에 따른 FAIL이지 새 완전 CI 직접 실패가 아님.
- **AC3/4/6/7:** 신규 3-case 실제 HTTP/SQLite/restart 전용 E2E를 현행 8개 Shard 중 **4번**에 명시 배치, 141/141 unique·중복0/유실0, 기존 140개 배치 유지. 최소 네 개 main successful job Shard4 wall(20.5/19.8/17.3/14.1분)은 선정 근거이며 새 소스 성능 PASS가 아니다. 기존 `tests/scripts/e2e-shard-planner.test.ts` strict file inventory와 negative guard도 지속.
- **AC10:** 정적 Plan/Issue/PR 출처 조회 ≠ 실제 새 HEAD CI/Test/QA PASS. marker OFF, 사용 가이드, JSON1.1/Excel/SVG/PNG·Copy/Template, Owner release gate 불변. 새 exact-head Full CI 결과 전 `NOT TESTED`.


## #3275.1 marker-OFF 신규 브라우저 교환 회귀 후속 (F553-I, 2026-10-25)

- [Full Run 40163358017](https://github.com/planner77/masterGantt/actions/runs/40163358017): Quality/Docker/TS/ESLint/Vitest/Preflight/Policy, Shard1·7 PASS, Shard4는 29 PASS/1 FAIL; 나머지 5 shard CANCELLED. 실제 HTTP/SQLite/restart와 Copy/Template 첫 2개 PASS, 세 번째 case의 구 `◆ Milestone 표시` 버튼 클릭이 160000ms timeout. 후반 Export/권한·원자 guard는 NOT RUN. [누적 원장 F553-I](ISSUE_553_FAILURE_ANALYSIS.md) 참조.
- **AC1/4/5/6/7/8/10:** 운영 #552 marker-OFF 기준의 사용자 토글0·native Milestone Grid row/bar0·lane/guide0를 **정확 canonical Milestone IDs**에 대해 4개 JSON/Excel/SVG/PNG Download 전후 실제 DOM으로 검사. 기존 export bytes/원본 Tasks·Links·Membership/Gate·revision 및 readonly·401/412/422·no server mutation·Summary collapse/search/Core instance·Object URL leak0 단언은 보존. 사용자 Marker ON 재활성화가 아니라 기존 위험의 정확한 oracle 이전이다.
- #552 전용 브라우저 row0/marker 부수작용0와 #553 실제 HTTP/SQLite Export 검증은 목적/출처가 달라 별도 유지. #574 marker-OFF 통합 최종 게이트와 #573/#693 선택 marker-ON은 그대로 분리. 변경 새 Head PR/QA/운영 Excel·DRM은 실제 Run 전 **NOT TESTED**.


## F553-J — #3277.1 old HEAD Full 8/8 PASS·QA Final provenance BLOCKED (2026-10-25)

- [Full #3277.1 / Run 40165691579](https://github.com/planner77/masterGantt/actions/runs/40165691579) exact HEAD `f190b639daf775a95fbd382d62f27bace5400030`, old Base `22144ce3844ab50ac0f22a715742c9df82e072e8`, test merge `149a44b91abccdc239617d8a154773fef6d7d9f5`: Quality, TypeScript, Vitest (3294 PASS/3 existing SKIP), Docker, **Chromium shards1~8 모두 SUCCESS**, #553 actual HTTP/SQLite/restart·Copy/Template·JSON/Excel/SVG/PNG·401/412/422 3cases **32.1/6.8/13.7초 PASS**. 이 성공은 old Head+Base 범위에만 유효.
- QA Final [Job121091214522](https://github.com/planner77/masterGantt/actions/runs/40165691579/job/121091214522) `mergeability 또는 test merge 불일치` BLOCKED. Run 중 새 main [Issue797/#3280.1](https://github.com/planner77/masterGantt/actions/runs/40166327552) `f431806329dd3af492e1eb6ce67bb73c1262d61e`로 진입. 당시 GitHub API predicate의 정확 어느 값이 달랐는지는 UNKNOWN, [F553-J 원장](ISSUE_553_FAILURE_ANALYSIS.md) 참조.
- **AC1~AC10**의 원본 데이터·Marker-OFF/편집·교환/내보내기/보안/Resource acceptance 테스트는 old Head에서 PASS, 새 latest-main aligned Head는 **NOT TESTED**. #797 UI audit/TEST_PLAN 등 새 Main 변경 227경로를 지키면서 양측 `docs/exec-plans/active/PLAN.md`만 원문 결합한다. QA/Owner/Release/Windows Excel/DRM 별도 승인·검증 미완료.
