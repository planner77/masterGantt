# Issue #403 실행 계획 — Project List 날짜 열 겹침 및 Data Table 회귀 방지

상태: 최신 main 기준 구현·문서 동기화 완료, PR CI 시작 준비.

- baseline main: `cbe90acf0bf9785240e6a0ff2a2e5c532ab9251f`
- baseline version: `0.71.0`
- target version: `0.71.1` (PATCH)
- branch: `issue-403-project-list-date-columns`
- superseded branch: `issue-403-data-table-layout-guardrails` (main보다 2 commits behind)
- release_required=true / release_authorized=false
- 요청 종료점: PR 생성 및 PR CI 시작 확인

## 문제

#343에서 Project List에 사업부·제품·법인/사업장 열이 추가된 뒤 기존 fixed table의 percentage width 합계가 100%인 상태에서 작업 열 3.75rem이 별도로 존재했다. 생성/최근 변경 열은 각각 9%이고 `white-space: nowrap`이어서 browser locale/timezone datetime의 intrinsic width를 보장하지 못해 인접 셀 위로 text가 표시될 수 있다.

## 구현

- Project List에 명시적 `colgroup`을 추가한다.
- 열 역할을 fixed/flexible로 구분하고 날짜 두 열은 동일한 12rem width를 사용한다.
- table 최소 폭은 84rem으로 조정하고 Project/설명은 남는 폭을 사용한다.
- 날짜 header/body horizontal padding을 compact하게 유지하면서 datetime content가 셀 내부에 머물도록 한다.
- `data-column` hook으로 E2E가 구현 CSS selector가 아니라 사용자-visible column geometry를 안정적으로 검증한다.
- 좁은 viewport의 table-owned horizontal scroll과 native table semantics/Row Action 계약은 유지한다.

## 검증

`tests/e2e/project-list-search-filter.spec.ts`에 #403 geometry 회귀를 추가한다.

- 긴 Project/Owner/Description fixture
- 사업부·제품·법인/사업장의 synthetic long rendered labels
- 실제 hydrated browser locale/timezone 생성/최근 변경 datetime
- 390/768/1024/1440/1600px
- date cell `scrollWidth <= clientWidth`
- 생성→최근 변경→작업 sibling boundary 비침범
- header/body x/width alignment
- Row Action cell 내부 수용
- long master label ellipsis contract
- document-level overflow 없음
- 1024px 이하 table-owned scroll, 1440px 이상 불필요한 table scroll 없음

Local Fast Feedback은 이 세션에서 repository runtime shell을 사용하지 않아 NOT TESTED다. 공식 판정은 동일 PR head의 GitHub Actions `quality/e2e/docker`를 사용한다.

## 문서 영향

갱신:
- `DESIGN.md`
- `docs/UI_UX_GUIDELINES.md`
- `docs/PROJECT_UX.md`
- `docs/TEST_PLAN.md`
- `.codex/agents/ui-ux.toml`
- `.codex/agents/qa-docs.toml`
- `CHANGELOG.md`

API/DB/Scheduling/Security 계약 변경은 N/A다.

## 릴리스 경계

제품 CSS/E2E와 application version이 변경되므로 `release_required=true`다. 사용자는 현재 구현 후 PR CI 시작까지만 요청했으므로 `release_authorized=false`이며 merge, main CI, annotated tag, 정식 GHCR 게시, Issue 종료는 현재 범위 밖이다.
