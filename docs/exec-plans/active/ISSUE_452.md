# Issue #452 관리자 공통 페이지·인증 폼 및 버튼 간격

## 요청 범위와 기준

- Issue: [#452](https://github.com/planner77/masterGantt/issues/452), Epic [#449](https://github.com/planner77/masterGantt/issues/449).
- 최초 구현 기준 main: `6ce221bc16613625953b85244bb93ad50019b377`, application `0.83.3`; PR #466 병합 SHA는 `9280536ddc85a8a841346bdf413b2ba638685880`, application `0.83.4`다.
- 최초 작업 branch `fix/issue-452-admin-layout`은 PR #466으로 병합됐다. Main CI #1847.1의 E2E transport reset 보완은 `fix/issue-452-main-ci-e2e-transport`에서 진행한다.
- 현재 종료점: corrective PR의 exact head PR CI PASS → 병합 → 새 Main CI 시작 확인. 이후 Main CI SUCCESS 시 Generic Release Finalizer가 정식 GHCR release·safe cleanup·Issue 종료를 이어간다.
- 버전: PATCH `0.83.4` 유지. `release_required=true`, `release_authorized=true`; Issue의 trusted version-scoped marker가 `expected_version=0.83.4`를 승인한다. 운영 배포는 범위 밖이다.

## 인수 기준과 구현 계약

1. `/resources`, `/logistics-admin`, `/project-master-admin`은 로그인 전후 동일 공통 shell을 사용한다. 최대 100rem, 좌우 gutter 24px(640px 이하 16px), top 20px/bottom 40px, heading 24px, heading→content gap 16px를 공유하고 설명 줄 수의 자연 높이를 보존한다.
2. 인증 presentation만 공유한다. 비밀번호, 세션, API, 권한, Origin 및 revision 처리는 각 관리 영역의 기존 구현을 유지한다.
3. 인증 panel은 최대 `32.5rem`(root 16px에서 520px), padding 16px, gap 12px이다. workspace/list는 이 제한 폭을 적용하지 않는다.
4. desktop password input/submit은 같은 40px control-size와 bottom alignment를 사용한다. 좁은 화면은 입력 다음 제출 순서로 쌓는다. label/error/focus/disabled/busy/Enter와 민감 입력 삭제 계약을 보존한다.
5. `.secondary-button`의 기본 외부 margin은 0이다. toolbar/form/footer 또는 독립 CTA의 부모가 간격을 소유한다. `.text-link`의 기존 의미와 KPI `margin-top:auto`, Task Editor 44px hit-area는 보존한다.
6. 모든 legacy margin 사용처에 변경·보존·N/A 근거를 남긴다. 변경 영역은 bounding box/computed style로 확인하며 screenshot만으로 keyboard/권한 PASS를 판정하지 않는다.
7. 390/768/1024/1440/1920px, 긴 한글·영문, 오류/로딩/disabled/focus와 기존 인증 경계 회귀를 확인한다.

개별 Resource 탭/표 열/row 재설계(#453–#457), DB/API/Scheduling/security 정책 변경 및 새 design-system framework는 비범위다. SVAR Core `2.7.3`의 Gantt/Grid/API는 변경하지 않는 app-owned UI 작업이다.

## Issue Work Packet / 소유권

| 담당 | 단계 / 쓰기 소유권 | 제한 |
| --- | --- | --- |
| Manager | 범위·버전 결정, package/lock/CHANGELOG, DESIGN/UI_UX_GUIDELINES/PROJECT_UX/TEST_PLAN 및 이 실행 계획 | 공식 Issue 댓글 단독 작성 |
| ui_ux | 소스 기반 layout/state/accessibility 설계, 구현 비교 | 읽기 전용 |
| frontend | 세 관리 route/feature, 최소 공통 component, globals/module CSS, 필요한 legacy spacing 소비자, 관련 E2E·실제 session 격리 server test 및 비민감 증거 | 문서/version/GitHub mutation 금지 |
| qa_docs | 인수 기준↔코드↔테스트↔문서 및 로컬 실행 증거 독립 사전 검토 | 읽기 전용; 원격 결과와 구분 |
| infra | Manager QA-ready handoff 이후 commit/push/PR/CI 시작 | CI 모니터링·merge/release/close 금지 |

`issue_comment_writer=manager`; 모든 Sub-Agent의 `issue_comment_allowed_types=NONE`. 같은 파일 동시 쓰기와 재귀 위임은 허용하지 않는다.

## 설계와 상태

```text
Global header
공통 gutter / compact top spacing
화면 제목 · 설명
인증 panel (내용 제한 폭)
  권한 설명
  오류 (관련 실패가 있을 때)
  관리자 비밀번호
  [input........................] [로그인]
  확인 중에는 input/submit 잠금 및 버튼 상태 텍스트
인증 후: 동일 shell 아래 기존 관리 workspace
```

| 상태 | 보존·검증 계약 |
| --- | --- |
| 인증 전 | visible label/input, 접근 가능한 이름, 기존 초기 focus 정책 |
| 인증 중 | 중복 제출 차단, input/submit disabled, 상태 텍스트 |
| 401/403/429/네트워크 실패 | 기존 오류 처리 및 비밀번호 삭제; 입력과 오류 연결 |
| 만료 재인증 | 기존 401 잠금·재로그인·focus 복원, 일반 초안 보존 |
| 인증 후 | 관리자별 session/API 분리, Project edit 교차 승인 없음 |
| dialog/좁은 화면 | Escape·취소·focus 복원, 자연 wrap/stack, 내부 scroll과 document overflow 구분 |

## 검증과 문서 Gate

Local Fast Feedback은 관련 typecheck/lint/인증·geometry E2E에 한정한다. 공식 전체 회귀는 PR exact head의 GitHub Actions `quality/e2e/docker`이며 이번 요청은 시작 확인까지만 수행한다. 결과를 확인하지 않은 gate는 `NOT TESTED`로 남긴다.

필수 문서: DESIGN.md, docs/UI_UX_GUIDELINES.md, docs/PROJECT_UX.md, docs/TEST_PLAN.md. API/DB/Scheduling/Import/VBA/CI·Docker/배포 계약은 변경하지 않으므로 해당 계약 문서는 N/A다. 구현 이후 최종 class/geometry와 문서 일치 여부를 확인해 DOCUMENTATION_SYNC를 판정한다.

실제 진행 및 실행 결과는 이 계획의 증거 절과 Issue `STATUS` 댓글에서 기록한다. 설계 문서나 Agent 자체 보고는 실제 browser/CI PASS를 대신하지 않는다.


## 구현 증거

[검증 증거와 legacy 소비자 전수 분석](../../ISSUE_452_UI_EVIDENCE.md)을 따른다. 최종 로컬 실행 및 독립 사전 QA와 PR CI 시작을 구분하여 기록한다.

DOCUMENTATION_SYNC: PASS — 실제 구현 계약·필수 문서·전체 소비자 분석·실행/실패 이력·비민감 증거를 동기화했다. 관련 E2E는 combined run의 성공13 항목과 fixture 보정 후 단독 성공1 항목을 구분한다. 정식 전체 회귀 및 원격 QA는 NOT TESTED다.


## Main CI #1847.1 corrective 재개

- 실패 run: `37322272261`; Chromium E2E shard 2/6에서 `project-browser-title-favicon.spec.ts`의 `page.request.get(secondPath)`가 assertion 이전 `socket hang up`으로 종료됐다.
- 같은 shard는 56 PASS / 1 FAIL이며 다른 5개 E2E shard와 build/typecheck/lint/Vitest/Docker는 PASS였다. Main 임시 GHCR job은 전체 E2E gate 실패로 SKIPPED됐다.
- 제품 UI/API 코드는 변경하지 않는다. direct document GET에 한해 `socket hang up|ECONNRESET`만 최대 3회 bounded retry하며 HTTP status/body/title 실패와 retry 소진은 계속 FAIL한다.
- 이 corrective diff는 tests/docs의 non-docs 변경이며 기존 #452 merge와 같은 검증 scope로 취급한다. PR body는 canonical `Refs #452`를 유지해 Generic Finalizer의 same-Issue convergence 대상이 되도록 한다.
- v0.83.4 authorization marker는 이미 기록되어 있으며 새 version/tag를 만들지 않는다. 새 Main CI가 SUCCESS일 때만 Generic Release Finalizer의 release_start 경로가 annotated tag와 `release-image.yml`을 시작할 수 있다.
