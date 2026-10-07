# Issue #502 Work Packet — 실제 Error Boundary·환경별 검증

## 기준

- Issue: #502
- base: main `c94b13e110ed5fd9e17625daa084c181f35703e8`
- base tree: `69575ad752b313f4a232ab3a2a27cc4de22dd97f`
- application: `0.95.1`
- branch: `test/issue-502-error-boundary-validation`
- release_required=false
- release_authorized=false
- parent evidence: #457 / PR #503

## 범위

1. `app/error.tsx`와 `app/gantt-demo/error.tsx`가 실제 client render 오류를 포착하도록 제어된 E2E probe를 제공한다.
2. fallback의 recovery button을 native keyboard로 실행하고 `reset()` 이후 테스트 focus 지점 복원을 확인한다.
3. 일반 API/network error UI와 route error boundary를 assertion과 문서에서 구분한다.
4. #457 geometry/provenance helper를 재사용하되 #502 evidence namespace를 분리한다.
5. `ISSUE_457_UI_UX_COVERAGE.md`, `TEST_PLAN.md`, `UI_UX_GUIDELINES.md`, 활성 PLAN을 동기화한다.

## 안전 경계

- probe는 `NODE_ENV !== "production"` AND `E2E_ERROR_BOUNDARY_PROBE=true`에서만 활성화한다.
- root test route는 gate가 닫히면 `notFound()`다.
- gantt-demo는 추가 `__e2eBoundary=1` query opt-in이 있어야 probe를 렌더링한다.
- password/session/token/API payload를 evidence에 기록하지 않는다.
- 인증, Origin, revision, DB, scheduling, Import/Export 계약을 변경하지 않는다.
- 운영 환경에서 오류를 강제로 발생시키지 않는다.

## 검증 계약

자동화 대상:
- Chromium 390/1440px
- 실제 React segment error boundary heading
- native Tab으로 recovery action 도달
- Enter로 reset
- reset 후 probe focus restore
- source/test/fixture/config/browser/app version provenance

환경별 별도 대상:
- native browser 125% zoom
- 실기기
- screen reader
- 최종 수동 UX
- 승인 운영 source SHA/application version/reverse proxy 입력 상태

후자는 GitHub Actions로 대체하지 않고 환경이 없으면 NOT TESTED/BLOCKED로 유지한다.

## 현재 상태

구현 후보와 문서 동기화 후 원격 PR 및 exact-head PR CI를 시작한다. PR CI가 완료되기 전 공식 quality/e2e/docker 및 실제 boundary PASS는 NOT TESTED다. qa_docs 최종 독립 판정, 병합/main/GHCR/Issue 종료는 후속 gate다.


## PR CI #2076.1 실패와 보완

Exact head `563262218f69adcfecac86e9f08319c290cd2508`의 PR CI Run `37609042914`는 FAIL이었다.

- ESLint: probe의 effect body가 `setRecovered(true)`를 동기 호출해 `react-hooks/set-state-in-effect` hard error가 발생했다.
- Vitest: #502 evidence namespace를 추가하면서 #457 helper의 기존 literal fallback `testInfo.outputPath("issue-457-evidence")`가 사라져 repository contract 1건이 실패했다. #457 계약 변경이 의도가 아니므로 기존 fallback을 복원한다.
- Chromium E2E shard 1/6: root와 gantt-demo 모두 boundary 자체와 reset 후 recovered UI까지는 도달했지만 probe button focus restore가 실패했다. 다른 E2E shard 2~6, production build, TypeScript, Docker smoke는 성공했다.

보완은 effect에서 timer callback으로 recovery state를 전환하고, recovered button을 새 key로 재마운트하면서 `autoFocus`로 원래 테스트 control에 focus를 복원한다. #457/#502 기본 evidence output은 각각 명시적 literal 경로로 분리한다. 실패 gate를 삭제하거나 assertion을 완화하지 않는다.


## 최신 main 재정렬

PR CI #2076.1 보완 중 main이 `c94b13e110ed5fd9e17625daa084c181f35703e8` / `0.95.1`까지 전진해 기존 branch는 behind 3이었다. #502와 main #491 변경이 함께 수정한 `TEST_PLAN.md`, `UI_UX_GUIDELINES.md`, 활성 `PLAN.md`는 최신 main 내용을 우선 보존하고 #502 섹션을 다시 적용한다. 그 외 #502 파일은 latest main tree 위에 그대로 재적용한다. 새 PR CI는 latest-main exact head에서 수행한다.
