# Issue #797 — DESIGN 기준 전 화면 재감사

## 목표 / 승인 범위

- Issue: https://github.com/planner77/masterGantt/issues/797
- 기준 main: `8d9dd93a9305ebc66ef1fb3784c9788c3e2ece24`, application `0.132.0`, SVAR Core `2.7.3`.
- Branch: `docs/issue-797-ui-audit`; 기존 작업과 분리한 worktree 사용.
- 2026-10-24 사용자 요청은 분석·계획·구현·문서 동기화 후 **PR CI 시작까지**다. Issue 등록 시의 감사 전용 범위를 실행하며, 제품 개선은 후속 #798/#799, 상시 회귀 확장은 #800에 인계한다.
- 산출물: 전체 화면 소스/브라우저 감사, 재실행 가능한 수동 관측 도구, 동일 fixture의 KPI와 동적 5관점 실측, 기존 이슈·테스트 중복 대조, KEEP/개선 후보/FOLLOW-UP/미실행 판정.
- 비범위: 전 화면 restyle, 새 테마·폰트·프레임워크, API/DB/권한/계산·Gantt lifecycle 수정, 폐기 Target 복구, #517/#720/#507 재구현. CI 결과 모니터링·병합·Main/GHCR/Release·Issue 종료는 수행하지 않는다.
- `version_decision=keep`, `release_required=false`, `release_authorized=false`: 제품 빌드 소스·의존성·버전 변경 없음.

## 분석 / 목표 흐름

`DESIGN.md` §2는 KPI를 이미 내부 참조로 지정한다. §4의 workspace-first, 동등한 목록, 동적 조회와 WBS 원본 분리, §5의 설명·상태 정책을 현행 화면에 적용한다. KPI를 모든 화면에 복제하거나 서로 다른 구성 참고/선택 작업/전체 Gate/Plan 모집단을 합치지 않는다.

감사 흐름은 `동일 source·runtime·fixture 고정 → KPI 기준선 → 각 관점/화면 관측 → 소스 사실과 실측 분리 → KEEP/후속 범위 → 동일 조건 after 비교 인계`다. 현행 레이아웃은 `전역 shell → Project context → 일정/대시보드/기준정보 → 하위 관점 → 조회·요약 → 작업 표/원본`으로 기록한다. 새로운 제품 배치를 이 PR에서 확정하지 않는다.

| 상태 | 감사 기준 / 판정 한계 |
| --- | --- |
| normal/readonly/edit | 실제 fixture의 상태·가능 명령·scope를 기록. 읽기 전용 관측은 서버 authorization PASS가 아님 |
| loading/empty/no-result | 대기와 결과 없음 구분, 실제 실행한 조합만 판정 |
| error/validation/stale/pending | 기존 spec과 화면 계약을 연결하고 새 실행 없는 조합은 NOT TESTED |
| long KO/EN/좁은 폭 | 문서 overflow와 owner scroll, 첫 데이터 위치, 표·control clipping을 구분 |
| keyboard/focus/Escape | 실제 native 입력과 focus 복귀 증거만 사용. 캡처·DOM 속성만으로 접근성 PASS 금지 |

## 실행 계획 / 소유권

1. Manager: 관련 문서와 GitHub Issue 현재 상태 확인, PLAN 댓글·Work Packet·문서 통합.
2. `audit_design` / ui_ux: read-only 설계·소스 사실/기존 원칙 비교. 제품 코드·문서 쓰기 없음.
3. `audit_browser` / frontend: `tests/manual/issue-797-ui-audit.*`와 `output/playwright/issue-797/**`만 작성. 기존 fixture·공통 geometry observer를 재사용하고 새 상시 spec·package script·CI 연결은 만들지 않는다.
4. `audit_qa` / qa_docs: read-only 기존 coverage 대조 및 최종 diff·주장의 독립 PRE_QA. 자기 구현 검토를 독립 QA로 표시하지 않는다.
5. Manager: 최소 로컬 검증과 DOCUMENTATION_SYNC → commit/push/Ready PR → 정확 Head PR CI 시작 증거 확보 후 종료.

## 위험 / QA

- `risk_level: HIGH`
- `risk_reason`: 제품 동작·원장·권한·배포·CI 입력을 변경하지 않는 격리된 수동 감사 자산과 문서지만, 기본 브랜치 `scripts/qa_final_automated.py::risk_floor`가 변경 경로의 `milestone/calendar/import/export` 문자열에도 HIGH 최소값을 적용한다. Milestone 증거 파일이 해당하므로 최초 LOW 분류를 상향한다. 파일명을 바꾸거나 분류기를 완화해 회피하지 않는다.
- `risk_triggers`: `output/playwright/issue-797/**/milestone-*.json` 및 PNG의 보수적 파일 기반 HIGH. 제품 상태 전이·보호 정책 변경은 없고 기존 안전성 테스트와 required gate를 추가/삭제/완화하지 않는다. 개발 서버의 자동 생성 차이는 최종 diff에 포함하지 않는다.
- `affected_paths`: 수동 관측 도구, 감사 증거·보고서, 활성 계획과 검증 안내 문서.
- `qa_required: true`
- `qa_method: OWNER_MANAGED` (2026-10-25 Owner의 명시적 전환 지시에 따라 AGENT에서 변경)
- `qa_review_mode: N/A(Owner-managed)` — 최신 Head의 별도 qa_docs 최종 승인은 요구하지 않되 신뢰된 원격 CI·Trusted QA·Owner 위험 수용을 유지.
- `reviewer: N/A(Owner-managed)`; 기존 `/root/audit_qa`의 독립 PRE_QA는 최초 Head `1d6fad35`에 대한 역사 증거로만 보존.
- `qa_evidence: N/A(Owner-managed; 독립 최종 QA 별도 실행 없음)`; Codex 최신 Head 코드 리뷰는 독립 qa_docs 실행을 대신하지 않는다.
- `trusted_qa_run: NOT TESTED`
- `ci_evidence: quality/e2e/docker NOT TESTED`
- `qa_final: NOT TESTED`; `manager_decision: NOT TESTED`; `MERGE_READY: BLOCKED`.
- PRE_QA는 원격 세 required aggregate·Trusted QA·정확 Head Manager ACCEPT를 대신하지 않는다. CI 시작 후 결과를 관찰하지 않으므로 PASS/ACCEPT를 주장하지 않는다.

## Design Delta

`ui-ux-pro-max`를 사용해 기존 compact/progressive disclosure/상태·접근성 기준과 비교한다. 밀도 검색 결과는 관련성이 부족해 새 설계 지침으로 채택하지 않는다. 기존 DESIGN·화면 계약을 우선한다. **B(기존 기준의 검증·인계 구체화)**이며 `DESIGN.md: N/A — 기존 원칙 구체화`; 새 공통 원칙 A 없음. 실제 제품 개선과 그 Delta는 #798/#799의 별도 구현 PR에서 결정한다.

## TEST_LIFECYCLE_REVIEW

- 변경된 계약: 제품 기능 계약 변경 없음. #797 AC1~AC6의 인벤토리·측정·후속 범위·출처를 수동 감사로 구현한다.
- 검색: `tests/e2e/cross-screen-regression.spec.ts`, `tests/e2e/helpers/ui-geometry.ts`, 기존 #730~#737/#719/#717 및 Project List/Workspace/Task Editor/admin/dialog/state spec. 상세 대응은 감사 보고서에 기록한다.
- `KEEP_UNIQUE`: 기존 실제 브라우저 기능·keyboard·권한·SQLite/계산·원본 이동·경합 보호. 존재하는 spec을 실행 PASS로 간주하지 않는다.
- `PARTIAL_OVERLAP`: #457 geometry와 #730~#736 기능 fixture를 수동 관측에 재사용한다. 시각 관측은 업무 의미·서버 검증을 대체하지 않는다.
- `EXTEND` 후보: 동일 fixture KPI+5관점의 지속 회귀는 #800 소유. 이 PR은 새 `.spec.ts`나 CI/shard 배정을 추가하지 않는다.
- `ADD`: CI discovery 밖의 수동 collector와 그 결과만 추가. 테스트 삭제/skip/timeout/required check 변경 없음. `CONSOLIDATE_CANDIDATE`/`RETIRE_CANDIDATE`: 없음.
- 비용: 5폭×6관점을 수동 관측하고 나머지 화면은 위험 기반 대표 상태만 기록한다. 새 상시 테스트/job은 추가하지 않으며 원격 PR의 기존 정책은 유지한다. 실제 Runner-minutes·checkout 비용 변화는 NOT TESTED다.

## DOCUMENTATION_SYNC

- `docs/UI_AUDIT_2026_10_24.md`: UPDATED
- `docs/exec-plans/active/ISSUE_797.md`: UPDATED
- `docs/exec-plans/active/PLAN.md`: UPDATED
- `docs/TEST_PLAN.md`: UPDATED
- `docs/UI_UX_GUIDELINES.md`: UPDATED
- `DESIGN.md`: N/A(기존 KPI 내부 기준선과 compact 및 상태 원칙의 감사 구체화이며 새로운 공통 원칙 채택 없음)
- `docs/PROJECT_UX.md`: N/A(기존 일정 및 6관점과 기준정보의 동작 및 복귀 계약을 변경하지 않는 감사)
- `docs/TASK_EDITOR.md`: N/A(Editor의 draft와 pending 및 dirty 상태나 접근성 계약을 변경하지 않는 감사)
- `docs/ISSUE_457_UI_UX_COVERAGE.md`: N/A(과거 source와 capture 및 실행 판정의 역사 자료를 덮지 않고 최신 별도 보고서로 연결)
- `docs/API.md`: N/A(API 경로 및 payload와 권한 또는 revision 계약 변경 없이 fixture를 관측)
- `docs/DB_SCHEMA.md`: N/A(DB 및 migration과 원본 보존 또는 데이터 저장 구조 변경 없음)
- `docs/SCHEDULING_ENGINE.md`: N/A(일정 계산 및 Calendar와 Dependency 알고리즘 변경 없이 화면 관측만 수행)
- `docs/IMPORT_EXPORT.md`: N/A(교환 대화상자 관측만 수행하며 import 및 export의 파일 형식이나 원장 의미 변경 없음)
- `docs/IMPORT_SCHEMA.md`: N/A(교환 대화상자의 화면만 관측하고 지원 JSON 및 CSV 스키마와 validation 계약 변경 없음)
- `docs/EXCEL_EXPORT.md`: N/A(Excel writer 및 OOXML과 원시 Task 및 Assignment 식별자 또는 계산 방식 변경 없음)
- `docs/REQUIREMENTS.md`: N/A(기존 업무 요구사항과 폐기 Target 비노출 경계를 유지하는 감사)
- `docs/ARCHITECTURE.md`: N/A(공통 read adapter와 Gantt lifecycle 및 서버 계층 변경 없음)
- `AGENTS.md`: N/A(기존 역할 및 실행 지침을 그대로 적용하고 보호 정책을 수정하지 않음)
- `docs/SECURITY.md`: N/A(격리 synthetic fixture에서 관측하며 인증 및 세션이나 보안 정책 변경 없음)
- `docs/QA_REVIEW_POLICY.md`: N/A(기존 위험도와 independent QA 및 Manager 승인 경계를 그대로 적용)
- `docs/ISSUE_LIFECYCLE.md`: N/A(기존 Work Packet과 PLAN 및 STATUS 기록 계약을 적용하며 정책 변경 없음)
- `docs/GITHUB_OPERATIONS.md`: N/A(기존 canonical Issue 및 PR과 exact Head CI 운영 경계 변경 없음)
- `docs/REMOTE_VALIDATION.md`: N/A(로컬 관측과 원격 Required3 및 환경 검증을 분리하는 기존 정책 유지)
- `docs/CI_CD.md`: N/A(현재 8-shard와 Required3 및 main과 GHCR 및 Finalizer 또는 release 정책 변경 없음)

## AC_TEST_COVERAGE

- AC1: 감사 보고서의 전 화면 인벤토리와 GitHub 최신 이슈 상태 대조표; 기존 spec의 존재와 새 실행을 분리한다.
- AC2: 같은 source와 fixture의 KPI 및 5관점 브라우저 관측 manifest와 screenshot 및 geometry; 실패 또는 미실행 조합은 NOT TESTED로 표시한다.
- AC3: 감사 보고서의 KEEP 및 개선 후보와 #798/#799/#800 및 #517/#720/#507 인계; 우선순위와 파일 소유권 및 의존성 구분.
- AC4: DESIGN 기존 원칙과 화면별 계약 및 src 변경0 정적 확인; 제품 계산과 권한 및 원본 의미 보존을 감사 PASS로 과대 표시하지 않는다.
- AC5: TEST_LIFECYCLE_REVIEW와 기존 observer 및 fixture 재사용; 상시 E2E 스펙과 샤드 또는 Required gate 변경0 확인.
- AC6: 로컬 관측 및 PRE_QA와 PR CI 및 QA/Owner와 main GHCR/Finalizer 상태를 별도 기록; 감사 종료와 제품 개선 완료 구분.

## 검증 / 잔여 범위

- `npm ci`: PASS. 기존 Next16.3.4 공용 설치본 대신 이 worktree에서 lock의 Next16.4.2/Playwright1.63.0을 실제 설치했다.
- `node --check tests/manual/issue-797-ui-audit.mjs`, `npx eslint tests/manual/issue-797-ui-audit.mjs`: PASS.
- `node scripts/check-markdown-links.mjs`: PASS(323개 문서). `git diff --check`: PASS.
- `node scripts/verify-test-discovery.mjs`: PASS(278 unit files, 808 browser tests; root/외부 cwd 일치). 수동 collector는 발견 대상 밖이다. 기존 테스트를 새로 실행한 결과가 아니다.
- 표준 수집: `representatives`47/48 + `dashboards`27/30 = 실제74관측, collector 결과 PARTIAL·전체 완결성 FAIL. calendar1440/process390/Milestone1024/System1024의 초기 준비4건 FAIL과 파생 completeness2건을 구분한다. 해당 네 표준 조합은 NOT TESTED이며 낡은 JSON을 재사용하지 않는다.
- 같은 frozen collector `2038ac9591667e51b0d264b6e9a847d224c71cc79efb7255b906d02b7dbff53b`·source·fixture/runtime/hash, 74 JSON/PNG 실제 viewport·locale/DPR/scale 일치, document overflow0: 해당 subset 검증 PASS. 실제 task4/assignment1/revision17·canonical fingerprint와 관측 mutation0 보존 PASS. 업무·접근성·서버 권한 전체 PASS가 아니다.
- 기준정보 Resource는 loading, WorkArea 선택 후 목록·관리자 populated는 NOT TESTED. 오류/pending/stale는 명시적 합성 UI 상태, keyboard는 Enter/Tab와 해당 focus만 확인했다. [감사 보고서](../../UI_AUDIT_2026_10_24.md)의 실제 범위·실패·단독 보완·미실행 목록이 우선한다.
- 별도 sidecar: 9 PASS/1 FAIL. process390·calendar1440 단독 진입 재확인, settings/export390/1440 Escape 정확 focus 복귀, dashboard1440 Arrow/Home, JSON preview390(commit0), 목록 no-result/reset390을 확인했다. dashboard390 원본 CLI 실행은 세부 원인 미확정 FAIL로 보존한다. 후속 bounded 진단의 OBSERVATION·matches=true 및 Arrow/Home 실제 focus 확인을 별도로 기록하며 10 PASS로 합산하지 않는다. 원본 bulk의 PARTIAL과 최초 준비 실패를 성공으로 치환하지 않는다.
- 제품 UI/API/DB/계산·CI·의존성/버전 변경0, after=N/A. 로컬 개발 초기화 HTTP500/JSON 오류의 정확 원인·production 재현은 미확정이며 최초 실패를 보존한다.

현재 원격 `quality/e2e/docker`, Trusted QA, 최종 QA/Manager ACCEPT는 NOT TESTED다. PRE_QA는 실제 별도 `/root/audit_qa`가 수행하며 정확 commit Head의 최종 사전 판정·PR·CI Run URL/attempt는 내용 동결 후 Issue STATUS/PR에 기록한다. native125%·실기기·screen reader·운영 source/digest는 #517의 별도 검증이며 자동화 브라우저 또는 DPR 변경으로 대체하지 않는다. 모든 폭×모든 상태의 전수 PASS를 주장하지 않는다.

## 2026-10-25 최신 main 동기화와 감사 기준선 보호

- 기존 Ready [PR #801](https://github.com/planner77/masterGantt/pull/801)의 Head `1d6fad35c39d8ebaa6631a2a74362addd7566114`에서 [Full PR CI #3255.1](https://github.com/planner77/masterGantt/actions/runs/40105650487)는 SUCCESS였다. 이후 main `22144ce3844ab50ac0f22a715742c9df82e072e8`까지 41개 커밋이 추가되어 PR이 dirty가 되었다.
- 충돌은 `docs/TEST_PLAN.md`, `docs/UI_UX_GUIDELINES.md`, `docs/exec-plans/active/PLAN.md`의 추가 항목 위치 충돌이다. main의 #798/#799/#506 등 새로운 계약과 #797 감사 안내를 **양쪽 모두 보존**하는 합집합 정렬이다. 제품 소스·테스트 실행 정책·SQLite/API는 수정하지 않는다. 원본 수동 collector·221개 첨부증거는 원래 blob/tree를 재사용하여 보존한다.
- `docs/UI_AUDIT_2026_10_24.md`의 74건 관측과 일부 준비 FAIL은 **main 8d9dd93 / v0.132.0의 역사적 before**로 그대로 유지한다. #798/#799 병합 이후의 현재 화면 after나 새로운 회귀 PASS로 승격하지 않는다. 이후 최신 main의 비교/변경 후 지속 검증은 #800에 귀속한다.
- 충돌 해소 후 새로운 merge Head에 대한 GitHub PR CI/Trusted QA 및 Owner 판정은 **기존 #3255.1 성공과 구분해 새 실행 기준으로 판단**한다. 해당 시점의 로컬 full build·Chromium 재실행은 NOT RUN. `HIGH/qa_required=true/qa_method=AGENT`, `release_required=false/release_authorized=false`, `MERGE_READY=BLOCKED`를 유지한다. 사용자 요청 종료점은 PR CI 시작이며 이후 감시/병합/게시/종료를 하지 않는다.

## 2026-10-25 Owner 관리 전환 및 최종 병합 인계

- Owner가 PR #801에 대해 `AGENT → OWNER_MANAGED`로의 전환과 병합 후 Main CI·Generic Finalizer 시작을 명시 승인했다. 정확한 PR Head에서만 유효하며 검증기/Ruleset·CI Required3·risk HIGH·qa_required=true를 완화하지 않는다.
- 선행 Ready Full PR [#3276.1](https://github.com/planner77/masterGantt/actions/runs/40164224759), 이전 Head `477d776f8e2fcd603a682c3b802cca7571b0b12e`의 세 required aggregate SUCCESS와 [Trusted #921.1](https://github.com/planner77/masterGantt/actions/runs/40164520844) PASS는 **이 메타데이터·문서 전환 이후 새로운 Head의 성공 근거가 아니다**. 새로운 exact Head의 PR Full/Trusted·Reviewer thread0·strict base 일치를 재검증한 다음에만 Manager ACCEPT·merge할 것.
- Owner의 HIGH 잔여 위험 인수 경계: 수동 브라우저 감사 74/78관측(PARTIAL), 준비 실패4/sidecar 실패1·calendar1440 HTTP500 정확 원인 UNKNOWN, native125%/실기기/screen reader·운영 실증 NOT TESTED. 본 이슈는 측정과 후속 인계가 목적이므로 #798/#799 제품 개선과 #800의 최신 지속 회귀를 완료한 것으로 취급하지 않는다. 실패·미검증 결과를 역사 자료로 계속 보존한다.
- `DOCUMENTATION_SYNC`: 이 문서의 현재 QA 경로는 OWNER_MANAGED이며 GitHub PR body도 동일하게 선언. 기존 기록의 원격 `NOT TESTED`는 기록 당시의 상태이며 새로운 검증 결과는 불변 GitHub Run URL/Attempt와 PR 댓글에서 관리한다.
- 변경 경로: 위 Work Packet 텍스트만 수정, 기존 수동 collector/증거 221개·제품 src/API/DB/계산/보안·workflow 및 package/lock 그대로. `release_required=false`, `release_authorized=false` 유지. 버전 변동 및 정식 GHCR SemVer 릴리스 없음. Main의 임시 ci-image는 실측된 경로 분류와 실제 Gate로 판정; Generic Finalizer가 verified Main CI 이후 safety cleanup·Issue FINAL/종료를 수행한다.
