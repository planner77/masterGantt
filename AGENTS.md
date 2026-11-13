# masterGantt — Agent 공통 실행 지침

이 파일은 **모든 작업의 필수 규칙·순서·상황별 문서 경로**만 정의한다. 세부 조건·명령·테스트/게시 기준은 아래 링크된 **현행 문서**에서 확인한다. 과거 기록은 신규 실행 지침이 아니다.

## 1. 모든 작업의 필수 규칙

- **현행 운영:** Owner의 2026-11-10 결정([#905](https://github.com/planner77/masterGantt/issues/905))을 따른다. 위험도에 관계없이 **Issue → 로컬 구현·검증 → 일반 fast-forward main Push → 승인된 수동 GHCR 게시·운영 배포 → 수동 종료** 순서다. 신규 PR, GitHub Actions/원격 CI, Trusted QA, 자동 Finalizer는 실행하지 않는다. 단계별 gate는 [ISSUE_LIFECYCLE](docs/ISSUE_LIFECYCLE.md)이 원본이다.
- **공개 보안:** 이 저장소는 PUBLIC이다. 운영 DB/WAL/SHM·백업, 비밀번호/토큰/세션, 사내 IP/URL, 고객·생산 원시 자료와 민감 화면·로그를 Git/Issue/이미지에 넣지 않는다. 합성 fixture·정제한 증거만 사용한다([SECURITY](docs/SECURITY.md), [GITHUB_OPERATIONS](docs/GITHUB_OPERATIONS.md)).
- **실제 근거:** 현재 Issue·main·코드/테스트·실패 원장과 명시된 Owner 결정을 확인하고, 실행하지 않은 테스트·QA·게시·배포를 PASS/완료로 표시하지 않는다. 기존 재사용 조건이 명시되지 않아 판단 불가하면 구현 전에 질문하고, 확정된 동일 범위는 재질문하지 않는다.
- **차단:** 필수 검사의 FAIL/BLOCKED/NOT TESTED, UNKNOWN, source/base·fixture·환경 drift, 승인 없는 게시/배포, 미확인 GitHub 보호 설정은 후속 Push/Publish/Close를 차단한다. Owner 위험 수용을 검증 PASS로 바꾸지 않는다.
- **역사 자료:** [2026-11-10 이전 정책 보존본](docs/history/owner-ci-retired-20261110/README.md)의 PR/CI/Finalizer 명령은 신규 작업에 적용하지 않는다. #911의 관리자 전환은 [완료된 이력](https://github.com/planner77/masterGantt/issues/911)이고, 현재 Push마다 **live 상태**를 [GITHUB_OPERATIONS](docs/GITHUB_OPERATIONS.md)에 따라 재확인한다.

## 2. 필수 작업 순서

1. **PLAN** — 실제 Issue·AC·범위·현재 main·기존 구현·실패/회귀 이력·위험·Owner 요청 종료점을 확인하고 [Work Packet](docs/AGENT_PROMPTS.md)을 작성한다.
2. **REUSE_REVIEW** — 기존 구현/테스트·대체 가능성을 검토하고 `REUSE_DECISION`·`TEST_LIFECYCLE_REVIEW`와 근거를 확정한다. 불명확하면 `REUSE_DECISION_REQUIRED/IMPLEMENTATION_BLOCKED`로 중단한다.
3. **LOCAL_IMPLEMENTED** — 합의한 범위와 파일 소유권에서 구현·테스트를 수정하고 관련 계약 문서 변경을 준비한다.
4. **LOCAL_VERIFIED** — 같은 정확 source/fixture/환경에서 [TEST_PLAN](docs/TEST_PLAN.md)의 공통·영향·위험별 검사를 실제 실행하고 [LOCAL_PREPR](docs/LOCAL_PREPR.md) 결과와 admission을 검산한다. 지침/검증 정책 변경은 자동으로 단순 docs-only 위험으로 낮추지 않는다.
5. **DOCUMENTATION_SYNC** — 영향 문서를 갱신하거나 항목별 N/A 사유를 기록하고, 기존 실패 원장·[Regression Index](docs/REGRESSION_INDEX.md)를 보존·연결한다.
6. **MAIN_PUSHED** — 최신 main·fast-forward 가능 여부, 검증 source 동일성, [#911 현행 설정](docs/GITHUB_OPERATIONS.md)을 확인한 뒤 승인된 일반 Push만 수행한다. force Push/우회는 금지한다.
7. **GHCR / DEPLOY (조건부)** — 코드 변경 및 명시 승인 범위에서만 exact source 수동 GHCR digest 검증과 필요한 운영 배포·호환 DB 복원 준비를 수행한다. 문서만 바뀐 경우 이미지는 N/A(reason)다.
8. **OWNER_FINAL / CLOSED** — AC·실제 테스트/미실행·원장·source SHA·게시·배포·위험을 구분해 보고하고, 모든 요청 gate 충족과 Owner 최종 수용(또는 같은 범위의 명시 위임) 후 수동 종료한다.

## 3. 상황별 필독 문서

| 상황 | 상세 기준 문서 |
| --- | --- |
| Issue 상태·실행 gate·수동 종료 | [ISSUE_LIFECYCLE](docs/ISSUE_LIFECYCLE.md), [GITHUB_OPERATIONS](docs/GITHUB_OPERATIONS.md) |
| Agent 선정·역할·모델·위임·결과 기록 | [AGENT_CONFIGURATION](docs/AGENT_CONFIGURATION.md), [AGENT_PROMPTS](docs/AGENT_PROMPTS.md), [QA_REVIEW_POLICY](docs/QA_REVIEW_POLICY.md) |
| 테스트 선정·로컬 명령·Chromium/UAT·source 격리 | [TEST_PLAN](docs/TEST_PLAN.md), [LOCAL_PREPR](docs/LOCAL_PREPR.md), [UI_EVIDENCE](docs/UI_EVIDENCE.md) |
| 오류·재작업·회귀·미검증 | [ISSUE_LEDGER](docs/ISSUE_LEDGER.md), [REGRESSION_INDEX](docs/REGRESSION_INDEX.md), 해당 `docs/ISSUE_<N>_FAILURE_ANALYSIS.md` |
| 요구사항·일정/업무 구조 변경 | [REQUIREMENTS](docs/REQUIREMENTS.md), [ARCHITECTURE](docs/ARCHITECTURE.md), [PLAN](docs/exec-plans/active/PLAN.md) |
| UI·Gantt·메뉴/모달·키보드·반응형 | [DESIGN](DESIGN.md), [UI_UX_GUIDELINES](docs/UI_UX_GUIDELINES.md), 해당 화면 설계, [GANTT_ADAPTER_ADR](docs/GANTT_ADAPTER_ADR.md). 설치된 SVAR Core·공식 문서와 호환성 확인 |
| API·DB·인증/권한·로그 | [API](docs/API.md), [DB_SCHEMA](docs/DB_SCHEMA.md), [SECURITY](docs/SECURITY.md), [LOGGING](docs/LOGGING.md) |
| 일정 계산·Calendar·Dependency | [SCHEDULING_ENGINE](docs/SCHEDULING_ENGINE.md), [COUNTRY_CALENDAR_DATA](docs/COUNTRY_CALENDAR_DATA.md) |
| Excel/JSON·VBA·Import/Export | [IMPORT_SCHEMA](docs/IMPORT_SCHEMA.md), [IMPORT_EXPORT](docs/IMPORT_EXPORT.md), [VBA_EXPORT](docs/VBA_EXPORT.md). DRM 우회 금지 |
| 다국어·표시명 변경 | [I18N_PHASE_A](docs/I18N_PHASE_A.md), [I18N_PHASE_B](docs/I18N_PHASE_B.md), [I18N_PHASE_C](docs/I18N_PHASE_C.md), [DESIGN](DESIGN.md) |
| GHCR 게시·Docker·백업/복구·배포 | [CI_CD](docs/CI_CD.md), [DEPLOYMENT](docs/DEPLOYMENT.md), [REPOSITORY_STRUCTURE](docs/REPOSITORY_STRUCTURE.md) |
| 내부망 HTTP·Reverse Proxy | [HTTP_OPERATION](docs/HTTP_OPERATION.md), [SECURITY](docs/SECURITY.md) |
| 지침 재구성의 중복·충돌 판정 근거 | [AGENT_INSTRUCTION_AUDIT_20261114](docs/AGENT_INSTRUCTION_AUDIT_20261114.md) (감사 이력; 실행 정책 원본 아님) |

각 작업에서는 관련 행의 문서를 읽고 현재 실제 코드/버전과 대조한다. 충돌·오래된 링크·누락된 재사용 승인을 발견하면 임의의 구버전 규칙을 선택하지 말고 Issue에 차이를 기록해 Owner 판단을 요청한다. 세부 실행 명령과 모델 값은 루트에 중복 유지하지 않는다.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
