# Issues #898 / #899 — 누적 현상·원인·교정·실패 원장 (2026-11-09)

대상 main `4aad8865972e3446f0d34c7ffcfd2bbab439e366`, v0.145.1, Core 2.7.3. 이 원장은 제품 운영 결함의 **사용자 관측**과 소스 조사·시험 누락·검증 결과를 구분한다. 이후 PR CI에서 추가 실패가 확인되면 정확 Run/Attempt/Job/Step/Head SHA·직접 실패/파생 실패·조치·재사용 결과를 증분 기록한다. 과거 실패를 성공으로 덮지 않는다.

| ID | 증거 종류 | 관측/근거 | 원인·처리 | 검증 상태 |
| --- | --- | --- | --- | --- |
| R898-001 | 운영자 재현 | #898: WBS·Resource·설비의 Chart Ctrl+휠 밀도 미동작, Grid Ctrl+휠 브라우저 Page Zoom. 기존 v0.145.1 기능과 별개인 실제 UX FAIL. | 특정 후손 row/bar에 한정된 `isDensityWheelTarget`과 `preventDefault` 조건이 빈 영역·스크롤 레이어를 누락할 가능성. current pointer·target·coarse/cancelable 계측 미수집; **최종 원인 확정 전 가설**. | 사용자 운영 FAIL / 새 PR 기기 시험 NOT TESTED |
| R899-001 | 정적 코드로 직접 확인 | #899: `schedule-view-panel.tsx` Grid Task button click이 `openTask`→`onSelect`+`onOpenTask`로 이어져 단일 클릭 Editor를 연다; projected scroller의 reveal 명령 없음. | 조회 Grid 선택 분리·현재 표시행 projected start reveal, Editor 더블클릭/명시 버튼/Chart Bar로 보존. | 직접 코드 원인 확인 / 보완 실제 E2E NOT TESTED |
| T898-001 | 테스트 누락 | #889 `schedule-views.spec.ts`의 `new WheelEvent` dispatch PASS가 실제 포인터 hit-test/브라우저 줌 차단을 증명하지 못함. #822 기존 `Control + page.mouse.wheel`은 특정 row/bar 위만 확인. | 기존 E2E/fixture·물리 wheel API EXTEND. 현재 source에서 수동 Chrome/Edge·비취소 wheel·coarse 실제 계측은 여전히 요구. | 기존 증거 재사용/새 커버리지 작성, 실행 NOT TESTED |
| T899-001 | 커버리지 회귀 위험 | #880에서 “작업 정보 열기” 버튼 Enter/Focus 복귀를 사용 중이므로 단일 클릭 분리 시 기존 Editor 접근성 손실 위험. | 동일 ARIA label의 별도 버튼과 Grid 더블클릭, 기존 Chart Bar 유지; 기존 E2E 삭제/skip/완화 없이 추가. | 회귀 시험 작성, 실행 NOT TESTED |
| D898-899-001 | 재사용 검토 | #895 Owner는 기존 구현·테스트·CI 증거 우선 검토, 사용자 통합 PR 및 재사용 명시 요청. #896 실제 UI evidence manifest, #897 Preview/UAT와 연결. | Work Packet `REUSE_REVIEW=EXTEND` 기록, 기존 공용 source/canvas/fixture 재사용. | 설계 완료 / 신규 Head evidence NOT TESTED |
| L898-899-001 | 검증 환경 제약 | GitHub Connector를 통한 원격 파일/PR 수정만 가능하고, 동일 버전의 로컬 Node/Chromium·Playwright 실행 결과를 확보하지 못함. | 코드를 실행했다고 주장하지 않음. 정적 설계·테스트 추가와 표준 Full PR CI 시작으로 인계. | LOCAL Unit/E2E/typecheck/lint/actual mouse = NOT TESTED |
| D898-899-002 | 큰 파일 안전성 | `docs/TEST_PLAN.md` blob 1,186,633 bytes로 GitHub fetch_file가 전체 내용을 반환하지 못함. | 부분 본문을 대체 저장하여 원본 훼손하지 않고 새 `docs/ISSUE_898_899_TEST_PLAN.md`를 연결. | 원본 보존 |

## 출처·남은 실패 분리

- 근거: [#898](https://github.com/planner77/masterGantt/issues/898), [#899](https://github.com/planner77/masterGantt/issues/899), [#822 테스트](../tests/e2e/project-summary-bar-visual.spec.ts), [#880/#889 테스트](../tests/e2e/schedule-views.spec.ts), [#889/#890 과거 원장](ISSUE_889_890_FAILURE_ANALYSIS.md), [#896 UI Evidence](UI_EVIDENCE.md).
- 신규 코드: `src/features/gantt/gantt-density.ts`, `project-gantt.tsx`, `schedule-view-panel.tsx/.css`, `schedule-view-reveal.ts`, 관련 Vitest/E2E.
- 위험: 브라우저마다 Ctrl+wheel event.target·cancelable 및 OS가 합성하는 zoom 동작이 다를 수 있음. Native125% 확대, touch/hybrid pointer, 다중 시작점 클램프, viewport 소유권·동기화 경합은 새 Head의 실제 브라우저와 운영 환경에서 별도 판정 필요.
- 원격 최초 Full PR CI: [#3606.1 / Run 42568402966](https://github.com/planner77/masterGantt/actions/runs/42568402966), 실패 source `77d79ef963beecbc2f4c2f46975701dea4d77008`. 메타데이터 직접 FAIL과 각 required Job SKIPPED를 아래 원장에 구분. 새 Head PASS/실운영 ACCEPT 아님.
- GHCR/릴리스: `release_required=true`, `release_authorized=false`; 이전 v0.145.1 불변, Issue open 유지.

## R898-899-PR904-001 — Full PR CI #3606.1 직접 실패와 파생 구분 (2026-11-09)

- **Run**: `42568402966` / attempt `1` / PR `#904` / source `77d79ef963beecbc2f4c2f46975701dea4d77008` / result `failure`.
- **DIRECT 1**: 변경 경로 판정 Job `128999906441`, Step `CI 실행 추적 메타데이터 검증`, `scripts/verify-ci-run-trace.py`: `PR 본문에는 canonical 'Refs #<Primary Issue>'가 정확히 1개 필요합니다: []`. 기존 본문은 Markdown 강조 한 줄 안에 `Refs #898`가 있어 독립 정규식을 충족하지 못했고 제목에도 `Issue #898` 형식이 없었다. 후속 분기에서 branch/title도 실패할 가능성 선제 보완.
- **DIRECT 2**: QA 신뢰 경계 Job `128999906060`, Step `보호 변경·AGENT 경로 판정`: `QA 경로 BLOCKED: PR 본문 qa_method의 명시값 필요`. 기존 PR 본문은 `risk_level=HIGH, qa_method=OWNER_MANAGED`를 한 문장에 넣어 strict 단독-line parser가 거절. 독립 단일 필드 `risk_level`, `qa_method`, `qa_required`, `release_required`, `release_authorized`로 정규화.
- **DERIVED**: `PR 빠른 검사 판정` Job `128999998250`는 `CHANGES_RESULT: failure` 파생; Required Quality/Chromium E2E/Docker 집계는 `failure`이나 구현 Jobs, TypeScript, Vitest, 8 Chromium, Docker smoke는 **SKIPPED/NOT RUN**. 실제 제품 테스트 FAIL 증거로 오인하지 않는다. FAST_DEVELOPMENT는 non-authoritative SKIPPED.
- **REVIEW P2 (CI 직접 실패는 아님)**: PR Review Thread `PRRT_kwDOUUB7Bc61JB5u`, `project-gantt.tsx:2230`: 좌표 누락 합성 `WheelEvent`의 `clientX/Y=(0,0)`가 `isDensityWheelTarget`에서 유효 native/projected body 밖으로 판단되어 #822 `project-summary-bar-visual.spec.ts:607-617`, #889 `schedule-views.spec.ts:753-758` 회귀 위험. 조건부 `isTrusted=false && x=0 && y=0`에서만 DOM fallback 유지, 실제 pointer 위치 판정 보존. 기존 Unit과 원래 E2E assertions 유지/새 helper Unit 추가.
- **PRE-FLIGHT 잠재 실패 선제 보완**: 현재 기본 브랜치 `scripts/qa_preflight.py`의 `reuse_review_gate`는 Work Packet `REUSE_DECISION: EXTEND` 단독 값·후보 설명을, `docs_gate`는 exact `AC01..AC06` mapping과 `DOCUMENTATION_SYNC` 경로별 `UPDATED/N/A(reason)`를 요구한다. 최초 #3606.1에서 실행 전 차단되었으나 구조상 추가 문제가 확인되어 제품·보호 Gate 변경 없이 Work Packet을 보완한다. 원본 큰 `docs/TEST_PLAN.md`는 Git blob으로 전체 읽고 기존 내용을 보존한 채 새 실패/시험 절만 맨 위에 추가한다.
- **REWORK 검증 및 재개**: GitHub API 실제 실패 Log와 원본 기본 브랜치 Validator를 비교한 정적 분석. 정확 새 Head의 로컬/원격 Unit·E2E·Typecheck·Docker·Trusted/Owner/Preview 결과는 실행 전 `NOT TESTED`. PR #904 유지/단일 새 변경 push→Full PR CI 시작, 모니터링 없음. 기존 Run 실패는 누적 보존, skip/retry/timeout/Required3 변경 없음.
