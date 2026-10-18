# Issue #493 Summary Description/URL 편집 실행 계획

## 요청 범위와 종료점

Issue #493의 Summary Task Description/URL 편집을 구현한다. 사용자 종료점은 최신 main 정렬, 코드·테스트·문서 동기화, 원격 branch/PR 생성과 exact head PR CI 시작 확인이다. CI 완료 모니터링, 실패 수정, merge, main CI, GHCR 게시, 정식 release, branch cleanup과 Issue 종료는 이번 요청 범위 밖이다.

- baseline: latest main `24072f4fd28cd1306b3c348d3f7da1a0e3dbc075`, application `0.92.1`, SVAR React Gantt Core `2.7.3`.
- branch: `feat/issue-493-summary-task-metadata`.
- version: 최신 main 0.92.1 위 하위 호환 사용자 기능 확장이므로 MINOR `0.93.0`.
- release_required: true. version 변경이므로 후속 merge 시 formal release 후보지만 이번 요청에는 게시 승인이 없다.
- release_authorized: false.
- DB migration: N/A. 기존 task description/url 컬럼과 Issue #36 저장 경로를 재사용한다.
- DESIGN.md 변경: N/A. 기존 Task Editor 필드 배치·semantic token·compact UI를 변경하지 않고 editability 정책만 정합화한다.
- UI_UX_GUIDELINES 변경: N/A. 기존 readonly/pending/stale/focus/Escape 계약을 그대로 사용한다.
- 공식 SVAR 참고: 설치 Core의 공개 `show-editor` 진입/intercept 기반 custom Editor 경계를 유지하며 신규 PRO API나 비공개 구현에 의존하지 않는다.

## 구현 계약

1. Summary의 `description`과 `url`은 자손 일정 파생값이 아니라 Summary 자체 메타데이터로 취급한다.
2. Task Editor에서 프로젝트 edit 권한이 있고 다른 mutation 초안/pending이 없으면 Summary Description/URL을 편집한다.
3. Summary의 요청 시작일·기간·일정 모드·진행률·상태·Baseline은 기존 readonly/서버 파생 계약을 유지한다.
4. Client command는 Summary에서 `name`, `description`, `url`, `explicitMilestoneTaskId`만 전송한다. 일정 초안 값이 변형돼도 payload에 포함하지 않는다.
5. Description은 기존 10,000 Unicode code point 제한과 공백-only null 정규화를, URL은 trim·4,096 code point·HTTP(S) scheme 검증을 그대로 사용한다.
6. Server Summary allowlist도 동일 네 필드만 허용한다. 일정·진척·상태·Baseline 요청은 기존 `SUMMARY_SCHEDULE_READONLY` 경계로 거부한다.
7. `TaskFieldProjectService`의 기존 외부 transaction 안에서 description/url을 저장하고 canonical response를 enrich하므로 별도 revision 증가나 부분 저장을 만들지 않는다.
8. 하위 Task 추가·삭제 및 Summary 일정 재계산은 저장된 Description/URL을 보존한다.

## 검증

- Unit: Task Editor Summary payload/validation, Milestone Membership 복합 payload.
- Server/SQLite: Summary details 저장·재조회, child 추가/삭제 전후 보존, schedule readonly와 실패 revision 불변.
- Browser/SQLite: Summary 필드 editability, PATCH 1회, 파생 일정 불변, empty Summary 전환 및 reload 보존.
- 공식 전체 회귀: PR exact head의 GitHub Actions `quality`, `e2e`, `docker`.

GitHub 커넥터 환경에는 repository checkout/로컬 Node 실행기가 없으므로 Local Fast Feedback은 NOT TESTED로 기록한다. 테스트를 생략해 PASS로 판정하지 않고 PR CI를 공식 회귀 증거로 사용한다.

## PR CI #1992 재작업

Run #1992는 두 독립 gate에서 실패했다. production audit는 Sharp 0.35.4에 공개된 CVE-2026-96889 / GHSA-wq5f-xc86-pv6w(High)를 검출했다. Next.js 16.3.8의 optional dependency 범위 `^0.35.4` 안에서 lockfile Sharp closure를 0.35.5와 libvips 1.3.4로 올리며 package.json의 직접 의존성은 추가하지 않는다.

Chromium shard 4의 실패 artifact accessibility snapshot에는 실패 시점에도 masterGantt 작업 정보 dialog의 Description/URL textbox와 기대 저장값이 실제 존재했다. 따라서 이전 reload-time interception race 가설은 기각하고 `project-gantt.tsx`는 latest main 상태를 사용한다. reload 후 assertion은 artifact에 실제 노출된 textbox role과 accessible name으로 검증한다.

재작업은 latest main `24072f4fd28cd1306b3c348d3f7da1a0e3dbc075`을 merge parent로 포함하여 Issue #456의 Task Editor layout/pending Escape/Gantt viewport 변경과 `0.92.1`을 보존한다.
