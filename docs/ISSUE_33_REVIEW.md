# Issue #33 분석·설계·검증 기록

## 목적

운영 화면 우측 상단의 `Gantt 데모` 항목을 제거하되 기존 프로젝트/Gantt 기능과 헤더 navigation, 알림 UI에 회귀가 없도록 한다.

## 기준과 분석

- 기준 `main`: `1415ad24718fe679ab9464292263cb6a45f25ed9`, application `0.8.0`.
- `src/components/workspace-shell.tsx`가 주요 메뉴에 `/`의 `프로젝트`와 `/gantt-demo`의 `Gantt 데모`를 노출했다. 해당 데모 링크에는 별도 이벤트 핸들러가 없었다.
- `/gantt-demo` route와 `src/features/gantt/gantt-demo.tsx`는 단순 운영 기능이 아니라 `tests/e2e/gantt-demo.spec.ts`의 SVAR browser integration 및 server/browser timezone·hydration 검증 fixture로 사용된다. 따라서 route/fixture 삭제는 Issue #33의 UI 정리보다 검증 범위를 불필요하게 축소한다.
- `tests/e2e/project-notifications.spec.ts`의 10개 viewport 헤더 회귀는 기존에 `Gantt 데모` 링크 존재 및 클릭을 전제로 했으므로, 메뉴 제거와 함께 프로젝트 메뉴 1개 및 데모 링크 0개 계약으로 갱신했다.

## 구현 결정

1. `WorkspaceShell`에서 `Gantt 데모` navigation link만 제거한다.
2. `/gantt-demo` route, SVAR fixture, 전용 E2E는 내부 검증 자산으로 유지한다. 운영 navigation에서 접근 경로만 제거한다.
3. 기존 320/360/361/375/390/400/401/414/768/1440px 헤더 E2E는 프로젝트 링크·브랜드·알림 버튼의 hit area가 겹치지 않고 `Gantt 데모` 링크가 존재하지 않는지 검증한다.
4. API, DB, scheduling contract, SVAR package에는 변경을 만들지 않는다.

## 버저닝

`0.8.0`에서 **`0.8.1` PATCH**로 증가했다. 신규 기능/API 추가가 아니라 운영 UI에 잘못 노출된 데모 진입점을 제거하는 호환성 유지 수정으로 판단했다. `package.json`과 `package-lock.json`은 모두 `0.8.1`로 동기화했다.

## 검증 계획

- release version consistency
- TypeScript typecheck / ESLint / 전체 Vitest / npm audit / Markdown link / production build
- Chromium 전체 E2E: 특히 헤더 10개 viewport와 기존 `/gantt-demo` fixture E2E가 함께 통과해야 한다.
- Docker build/runtime/SQLite persistence 및 production HTTP·HTTPS transport 회귀
- PR head의 GitHub Actions 결과를 공식 완료 근거로 사용한다.

## 범위 밖

- `/gantt-demo` route 자체 삭제
- SVAR fixture 제거 또는 테스트 축소
- 다른 헤더 메뉴의 재설계
- Gantt 기능/API/일정 엔진 변경
- `main` 병합 및 `v0.8.1` 릴리스

## 원격 검증 결과

PR #42의 구현 head `10ce5840514f4c5caf7369ff8014d1cbf572654e`에서 CI Run #128 (`34905942327`)을 실행했다.

- release version consistency: **PASS**
- TypeScript typecheck / ESLint / test discovery: **PASS**
- 전체 Vitest / npm audit / Markdown link / shell syntax / production build: **PASS**
- Chromium 전체 E2E: **PASS** — 변경한 10개 responsive header 계약과 유지한 `/gantt-demo` fixture를 포함한다.
- Docker build/runtime smoke, image policy, SQLite restart persistence: **PASS**
- production HTTP·HTTPS browser transport 및 relocated Compose persistence: **PASS**
- PR에서는 immutable main commit image 게시 job이 정책대로 **SKIPPED**되었다.

이 문서 동기화 이후 PR의 최종 head에도 동일 GitHub Actions gate를 다시 적용하며, 최종 head/run 좌표는 PR 본문에 기록한다. 구현 범위에 대한 현재 판정은 **PASS**다.

## 릴리스 전 후속 검증

PR #42 병합 뒤 canonical `PLAN.md` 누락을 보완하는 과정에서 기존 Chromium E2E의 두 비동기 assertion이 불안정함을 확인했다. 추가 분석 결과 저장 거부 후 canonical GET 성공 시에도 `ganttResetGeneration`을 증가시켜 이미 복구 가능한 동일 인스턴스를 강제로 remount하고 있었고, 이로 인해 시간축 viewport가 바뀔 수 있었다. 성공한 canonical 조회는 기존 `applyCanonicalGanttSync` 경로로 동기화하고 조회 실패 때만 마지막 확인 snapshot 기반 reset을 수행하도록 보완한다. 테스트는 0-offset DOM 노드 개수 대신 실제 스크롤 상태를 비교하고, canonical sync 완료를 bounded polling으로 확인한다. 이 보완은 0.8.1 릴리스 전에 같은 전체 GitHub Actions gate로 재검증한다.
