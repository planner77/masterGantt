# Issue #416 — Gantt Week Header 근무 가능 일수 상시 표시

## 기준

- baseline main: `c005e05718fbca8c48973d7006c20cd4f905c6f6`
- baseline application: `0.77.0`
- target application: `0.78.0` (MINOR)
- branch: `feat/issue-416-week-working-days`
- release_required: `true`
- release_authorized: `false`
- 사용자 요청 종료점: 구현·문서 동기화·PR 생성·해당 PR head의 CI 시작 확인
- 범위 밖: merge, main CI/GHCR, 정식 tag/release, Issue 종료

## 분석

#316에서 Week Header hover/focus Tooltip용으로 Project Calendar 기준 실제 `workingDays`와 holiday metadata를 이미 계산한다. #416은 이 canonical 결과를 재사용하여 기존 ISO `Wxx`와 68px Week cell 폭을 그대로 유지한 채 같은 cell 안에 `N일` secondary label을 상시 표시한다.

최신 main의 #299 Chart vertical DnD를 보존한다. 별도의 월~금/휴일 차감 계산을 만들지 않는다. 어느 요일이 근무일인지, 공휴일명과 비근무 사유는 Header에 중복 표시하지 않고 #316 Tooltip의 progressive disclosure로 유지한다.

## 설계 / 구현

- SVAR 2.7.3 공개 `scales[].format`은 기존 ISO `Wxx`를 계속 소유하고 `scales[].css(date)`가 #316의 app-owned ISO Monday date class를 제공한다.
- #316의 MutationObserver/cell lifecycle에서 같은 `GanttWeekHeaderTooltipData.workingDays`를 사용해 app-owned `.project-gantt-week-working-days` element를 한 번만 추가·갱신한다.
- visible label은 `aria-hidden`으로 두고 기존 cell `aria-label`/Tooltip이 접근 가능한 상세 설명을 계속 담당한다.
- label은 muted 10px/tabular numeric, absolute positioning과 cell 내부 inset을 사용한다. Week `cellWidth=68`은 변경하지 않는다.
- Day Header, ISO week formatter, #299 Chart DnD, Calendar/Scheduling/API/DB/revision, Gantt/API instance 및 network mutation 계약을 변경하지 않는다.

## 검증 계획

- Unit: #316 canonical `workingDays` 결과와 `0일/5일/6일` formatter를 검증한다.
- Chromium: W38 `5일`/W39 `4일`과 Tooltip parity, 68px 폭, 390/768/1024/1440 label geometry, Day↔Week instance identity와 mutation 0회를 검증한다.
- Local Fast Feedback은 현재 실행 환경에서 별도 checkout/runner가 없어 **NOT TESTED**다.
- 공식 전체 판정은 동일 PR head의 GitHub Actions `quality/e2e/docker`를 사용한다.

## 문서 영향

- `DESIGN.md`: N/A — 기존 workspace-first/data-dense/secondary typography 원칙 유지
- `docs/UI_UX_GUIDELINES.md`: N/A — 기존 Header/Tooltip/browser geometry 검증 기준 유지
- `docs/PROJECT_UX.md`, `docs/ISSUE_35_GANTT_SCALE.md`, `docs/ISSUE_316_WEEK_HEADER_TOOLTIP.md`, `docs/TEST_PLAN.md`, `CHANGELOG.md`: 동기화
- 독립 qa_docs runtime은 현재 제공되지 않아 별도 독립 PASS를 주장하지 않는다. lifecycle의 early-PR 허용 범위에서 CI를 시작하며 merge 전 최종 검토 gate는 별도다.

## 현재 상태

- PR #417 생성, initial head `09868e30ca969401a92bd6a21f22547d434e46dd`.
- PR CI Run #1654.1은 `verify-ci-run-trace.py`의 canonical PR metadata 요구사항(`Refs #416` 정확히 1개) 누락으로 path gate에서 즉시 FAIL했다. 구현/테스트 job은 gate 실패로 SKIPPED되어 application 실패 증거가 아니다.
- PR 본문을 `Refs #416` 형식으로 교정했고, 이 실행 기록 commit으로 synchronize 이벤트를 발생시켜 새 PR CI를 시작한다.

새 exact head의 PR CI 시작 확인까지 진행하며 CI 완료/merge/release는 이번 요청 범위 밖이다.
