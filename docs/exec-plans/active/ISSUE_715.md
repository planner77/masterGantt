# Issue #715 — Dashboard/관리 화면의 상시 설명 밀도 축소·상황형 도움말

## ISSUE WORK PACKET / 결정
- Primary Issue: [#715](https://github.com/planner77/masterGantt/issues/715), 상위 UI/UX Epic [#449](https://github.com/planner77/masterGantt/issues/449).
- 사용자 최종 요청(2026-10-18): **Issue 등록 + 전역 적용 UI/UX 정책을 `DESIGN.md`에 실제 갱신**. 제품의 네 화면 구현·브라우저 검증·병합·릴리스 지시는 별도 없음.
- Base main: `6fea0397bc07d0c3adf2d769f9ba6829473503a2`; product `package.json=0.115.0`; docs branch: `docs/issue-715-contextual-help-density`. 후속 작업 시작 시 원격 main/브랜치/PR·기존 진행 상태를 새로 읽는다.
- 실행 모드: GitHub Connector를 이용한 **단일 에이전트 순차 문서 작성·정적 비교**. 별도 `ui_ux`·`qa_docs` 독립 실행과 제품 브라우저 실증은 수행하지 않았음.
- 이번 문서 작업 `risk_level=LOW`, `risk_reason=Markdown-only; UI 코드/보안·CI·API·DB 정책 실행 경로 변경 없음`, `qa_required=false`, `qa_method=OWNER_MANAGED`; 독립 QA `N/A(문서 전용·보호 경로 변경 없음)`, Manager Owner 최종 승인/원격 필수 PR CI는 별도 판정.
- `version_decision=keep`: `0.115.0` 그대로. 문서 전용 `release_required=false`, `release_authorized=false`; GHCR/태그/운영 배포 비범위. **향후 제품 코드 구현**은 본 판단을 승계하지 않고 새 위험/버전/테스트/릴리스 필요성을 재평가.
- 이번 종료점: 문서 변경 branch/PR 등록 및 관련 이슈 진행 상태 남기기. PR CI·Trusted QA·병합·Main/GHCR·이슈 종료 완료를 암시하지 않는다.
- 역할: Manager=요구·전역 정책 채택/문서 책임, `ui_ux`=후속 read-only 검토 권고, `frontend`=후속 4개 화면 제품 구현·테스트, QA는 실제 Lifecycle 정책 적용.

## 채택 정책과 기존 원칙의 차이 (#589 Design Delta)
- 기존 `DESIGN.md`에 이미 Workspace-first, Data-dense, Progressive disclosure가 존재하나, 관리·대시보드의 **상시 설명 자체를 기본 레이아웃 예산에서 제거하고 정보의 노출 시점을 과업·위험 수준으로 결정**하는 교차 화면 기본값은 별도 명문화되어 있지 않았음.
- **A(신규 채택한 공통 화면 정책):** 정상 화면에 반복적인 일반 사용 설명 블록을 두지 않는 기본값, 기본 화면에서 반드시 보여줄 상태·범위·단위와 on-demand 설명의 경계를 `DESIGN.md §5`에 정책화한다. 대상=Milestone/Resource/Logistics/Master 관리와 유사한 반복 조회·편집형 화면; 보안/업무상 필요한 예외와 이유를 명시.
- **B(기존 원칙 세칙):** keyboard/focus/touch, helper·tooltip·toast·dialog 분류, before/after 측정·상태 검증은 하위 `docs/UI_UX_GUIDELINES.md`에 둔다. 한 화면의 버튼 간격·문구 목록은 Issue/제품 PR에서 관리하고 DESIGN에 적재하지 않는다.
- 현행 보안·domain/API/session/Origin/If-Match/revision/canonical snapshot·Gantt state·SVAR Core 우선순위는 그대로 유지한다. 접근성을 희생한 hover-only, 필수 경고 삭제, 기본 펼침 도움말을 다른 고정 줄로 교체하는 형식적 해결을 금지한다.

## DOCUMENTATION_SYNC
- `DESIGN.md`: UPDATED
- `docs/UI_UX_GUIDELINES.md`: UPDATED
- `docs/exec-plans/active/ISSUE_715.md`: UPDATED
- `docs/ISSUE_715_FAILURE_ANALYSIS.md`: UPDATED
- `AGENTS.md`: N/A(기존 공통 디자인과 상세 지침 참조 유지)
- `docs/ISSUE_LIFECYCLE.md`: N/A(기존 문서 동기화 게이트와 승인 절차 유지)
- `docs/QA_REVIEW_POLICY.md`: N/A(보호된 QA 경로와 위험 분류 변경 없음)
- `docs/TEST_PLAN.md`: N/A(제품 테스트·회귀 범위의 변경이 없음)
- `docs/API.md`: N/A(HTTP API 계약과 권한 동작이 변하지 않음)
- `docs/DB_SCHEMA.md`: N/A(테이블·마이그레이션 불변)
- `docs/SECURITY.md`: N/A(세션/권한/보안 경계 불변)


| 대상 | 판정 / 근거 |
| --- | --- |
| `DESIGN.md` | **UPDATED**: §5 공통 설명 밀도/상황형 도움말 정책 추가, 대상·예외/feedback/review 명시 |
| `docs/UI_UX_GUIDELINES.md` | **UPDATED**: 상태별 설명 위치·오류 피드백/키보드·터치·반응형·실측 검증 구체화 |
| 본 `docs/exec-plans/active/ISSUE_715.md` | **UPDATED**: 범위/판정/QA/버전/테스트·남은 작업 원장 |
| `AGENTS.md`, `docs/ISSUE_LIFECYCLE.md`, `docs/QA_REVIEW_POLICY.md` | **N/A**: 문서 참조·DOCUMENTATION_SYNC·역할·QA/릴리스 경계 이미 정의됨. 보호 정책 수정 불필요 |
| `docs/PROJECT_UX.md`, `docs/RESOURCE_KPI_DASHBOARD.md`, `docs/LOGISTICS_DOMAIN_DESIGN.md`, `docs/MILESTONE_STAGE_GATES.md` | **N/A(이번 PR)**: 제품 컴포넌트 동작/상태/데이터 설명은 미변경; 후속 구현에서 화면별 계약 diff를 판정하고 필요한 것만 갱신 |
| `docs/TEST_PLAN.md` 및 기존 E2E | **N/A(이번 PR)**: 실제 제품 테스트 행동 불변; 후속 구현의 AC1~AC6 회귀 커버리지와 실측을 위한 검증 증거는 필수 |
| `docs/API.md`, `docs/DB_SCHEMA.md`, `docs/SECURITY.md`, `docs/CI_CD.md`, `docs/REMOTE_VALIDATION.md` | **N/A**: 계약/권한/데이터/Runner 변경 없음 |
| `package.json`, lockfile, `CHANGELOG.md` | **N/A**: 앱 코드, 빌드, UI가 변경되지 않으며 버전 미상향. 제품 개편 후 변경·문서/릴리스 여부를 판단 |

## AC_TEST_COVERAGE
> PR #716은 문서 전용. AC1~AC6은 실제 화면 수정·테스트 전에 NOT IMPLEMENTED / NOT TESTED이며 이번 PR의 통과 조건을 제품 구현 완료로 오해하지 않는다.

- AC1: [후속 제품 PR / NOT TESTED] 네 화면 고정 설명 인벤토리·유지/이동/축약 근거와 실제 before/after 세로 높이 및 가시 행 비교.
- AC2: [후속 제품 PR / NOT TESTED] 정상 기본 화면에서 데이터·핵심 상태·작업 우선, 상시 장문 설명 없는 Layout 확인.
- AC3: [후속 제품 PR / NOT TESTED] tooltip/popover 정보 보존, mouse/keyboard/touch/ARIA/Escape/focus 접근성 테스트.
- AC4: [후속 제품 PR / NOT TESTED] 입력 오류·Toast·Dialog 분리 및 권한·401/412·stale/초안 복구/삭제 확인 테스트.
- AC5: [후속 제품 PR / NOT TESTED] Milestone/Resource/Logistics/Master KPI·권한·revision·Gantt 상태 불변 회귀.
- AC6: [후속 제품 PR / NOT TESTED] 390/768/1024/1440/1920px·긴 문구·상태별 browser geometry와 E2E 증거 확인.
- AC7: [문서 PR #716 / 변경 존재, 원격 CI NOT TESTED] DESIGN/공통 UI 가이드·영속 원칙/상세 상태 기준 및 문서 영향 동기화의 정적 확인.
- 이번 문서 작업 검증: `DESIGN.md`와 `docs/UI_UX_GUIDELINES.md` 새 subsection 존재·링크·전역/세칙 분리 및 `main...branch` 변경 경로 Markdown-only 확인. 정적 문서 diff 검토는 실제 UI browser 결과를 대신하지 않는다.
- [#715 AC7] 전역 디자인 정책·상세 가이드 업데이트: **문서 브랜치에 변경 존재 / PR 검증은 대기**. main 병합 전에는 전체 제품이 준수한다고 주장하지 않음.
- [#715 AC1~AC6] 실제 4화면의 설명 인벤토리·제거/이동, 화면 점유 높이/가시 행 수, keyboard/touch/ARIA, 401/412·삭제/복구, 390~1920 브라우저 geometry/E2E: **NOT IMPLEMENTED / NOT TESTED**.
- 원격 Quality/E2E6/Docker/Trusted QA: PR 생성 후 신뢰된 원본·정확 Head·실제 결론으로만 판정하며 docs-only skip은 제품 테스트 PASS 아님.

## 2026-10-18 — PR CI #2922.1 REWORK
- 실패 전체 이력: 접근 가능한 Full CI는 [Run #39079976744, Attempt 1](https://github.com/planner77/masterGantt/actions/runs/39079976744) 한 건, Head `ee5871040fd75d49f83881d0d10e613702a5de56`. [정규 누적 원장](../../ISSUE_715_FAILURE_ANALYSIS.md) F-001에 최초 Job·파생 FAIL·SKIPPED를 분리 기록.
- 원인 POLICY_CI: PR 제목 `docs: #715 ...`은 `Issue #715` 정규식 미일치(실제 `title Issues=[]`). PR 본문은 `qa_method`가 독립 행이 아니라 `qa_method=OWNER_MANAGED`라는 문장 내부에 있어 QA 경로 판정 불가.
- 잠재 추가 차단 사전 해결: `qa_final_automated.docs_gate`는 정확 `## AC_TEST_COVERAGE` 및 `- ACn: ...`, `## DOCUMENTATION_SYNC` 및 `- \`path\`: UPDATED|N/A(reason)` 기록을 검사. 기존 `## AC_TEST_COVERAGE / 상태`와 표만으로는 차단될 수 있다. 이 단계는 원본 CI에서 SKIPPED되어 **관측 실패가 아니라 정적 사전 점검**이다.
- 조치: Issue #715 canonical PR 제목, 독립행 `risk_level: LOW`/`qa_method: OWNER_MANAGED` 및 `Refs #715` 유지. 이 packet의 AC/doc 구조와 별도 실패 원장 보완. CI 검증기·정책·테스트를 완화하지 않는다.
- 검증: GitHub 원본 로그/스크립트 패턴 대조, 문서 구조 정적 확인. 브라우저·제품 E2E·로컬 Python 실제 실행은 NOT TESTED, 새 PR Head의 원격 결과는 신규 Run에서만 판단.

## 후속 구현 Handoff
1. `#715`은 **OPEN** 유지. 먼저 최신 main 화면과 배포 버전에서 before 위치·고정 안내 목록·정상/오류 상태·사용자 트리거를 실측한다.
2. `#715`의 네 화면을 분담하더라도 중복 popup primitive 생성 금지; 공통 UI/UX 규칙을 우선 사용. Milestone 지표의 Ready/Completed와 marker-OFF, Resource M/M/Capacity·Target roll-up, 물류 원본 공유/관리 권한, 기준정보 stable code와 draft/revision을 보호.
3. 제품 코드/테스트 변경을 시작할 때 `risk_level`, `qa_required`, `version_decision`, 관련 docs/N/A, 선택 테스트→교차 회귀→PR CI, 최신 Owner 승인/정식 릴리스 필요성 재판정.
4. 제품 구현 완료 후에만 UI 수용(AC1~6), 병합 이후에만 main 반영, Lifecycle 이후에만 이슈 최종 종료. 이번 docs-only PR로 `Closes #715` 사용 금지.
