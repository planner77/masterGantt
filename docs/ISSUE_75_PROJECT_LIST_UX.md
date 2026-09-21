# Issue #75 프로젝트 목록 UX 구현·검증 기록

상태: PR 병합 및 main artifact 검증 완료 / `v0.19.1` 정식 릴리스 복구 검증 진행  
구현 브랜치: `feature/75-project-list-ux`  
릴리스 정리 브랜치: `chore/75-release-finalization`  
버전: `0.19.1` (`v0.19.0` release 실패 이력 보존)

## 구현 결정

1. 목록 route만 일반 75rem content cap에서 분리하고 최대 100rem까지 확장한다.
2. 프로젝트명은 상세 화면 Link로 유지하고 중복 `열기` action은 제거한다.
3. 행 action은 More trigger 하나로 통합한다.
4. 메뉴 내부에서도 navigation은 Link, command는 Button semantic을 유지한다.
5. 삭제와 링크 복사는 기존 API/보안 계약을 그대로 재사용한다.
6. 메뉴는 portal/fixed positioning, keyboard navigation, Escape, focus restoration을 제공한다.
7. API/DB/정렬/권한 모델 변경은 하지 않는다.

## 변경 범위

- `src/app/page.tsx`: 목록 전용 wide modifier
- `src/app/globals.css`: project-list-page width 정책
- `src/components/project-list.tsx`: 기존 inline action 제거 및 RowActions 연결
- `src/components/project-row-actions.tsx`: overflow menu
- `src/components/project-link-button.tsx`: menu presentation 재사용과 fallback 수명 처리
- CSS module: table hierarchy / menu
- E2E: wide layout, menu keyboard/focus, copy/delete 회귀
- version/changelog/requirements/test/UX 문서

## 검증 결과

- PR #78 초기 head `ead01e0f84599b24501382fa81281dcb2fc86c57`, CI run #391:
  - quality PASS
  - Docker PASS
  - Chromium E2E FAIL — ARIA menu의 실제 접근성 role이 `menuitem`인데 테스트 selector가 `button`/`link`를 기대한 테스트 결함 2건
- selector를 실제 ARIA menu 계약에 맞춰 수정한 최종 PR head `82291fa644e25bceefc4f440ab689e36af992231`, CI run #392:
  - quality PASS
  - Chromium E2E PASS
  - Docker PASS
- PR #78은 squash merge되었으며 merge commit은 `602b4e69c98bfb3d21ddee39ad5f463854768605`이다.
- main CI run #393:
  - quality PASS
  - Chromium E2E PASS
  - Docker PASS
  - 임시 `ci-602b4e69…` GHCR image 게시 → exact digest 재-pull → image policy/readiness/native SQLite/Project·Task API/HTTP·HTTPS 검증 PASS
  - 임시 GHCR package version cleanup PASS

## 릴리스 정리

- Issue #75 요구사항 추적 ID는 기존 Calendar `R44`와 충돌하지 않도록 `R45`로 정정한다.
- 정식 `v0.19.0`은 annotated tag를 release authority로 사용한다.
- release helper는 자신의 main 병합 commit이 전체 main CI와 임시 GHCR digest 검증을 통과한 경우에만 `v0.19.0` tag를 생성하고 release-image workflow를 실행한다.
- 정식 release-image workflow가 exact SemVer image와 digest smoke를 성공한 뒤에만 `feature/75-project-list-ux`와 `chore/75-release-finalization` 브랜치를 삭제한다.
- 최종 release run/digest와 Issue 종료 근거는 Issue #75 종료 댓글과 workflow summary에 기록한다.

## v0.19.0 release 실패와 복구

- annotated `v0.19.0` tag는 release-finalization merge commit `2305643ed9c4ba10303ee573b0df9397facfa9b0`에 생성되었다.
- release-image run #18 (`35610134945`)은 SemVer 검증, typecheck, lint, Vitest, audit, build까지 PASS했으나 Chromium E2E 53건 중 1건이 실패했다.
- 실패 지점은 `project-create-and-read.spec.ts`의 390/768/1024/1440 반응형 메뉴 루프다. Playwright `click()`이 화면 밖 action trigger를 자동 스크롤한 뒤 메뉴를 열었고, 지연된 `scroll` 이벤트가 제품의 정상적인 scroll-close 처리와 경합해 menu가 즉시 닫혔다.
- 나머지 52개 Chromium E2E는 PASS했고, release candidate build와 GHCR write job은 gate 실패로 모두 skip되었다.
- 릴리스 정책에 따라 `v0.19.0` tag는 이동·삭제·재사용하지 않는다.
- E2E는 trigger를 명시적으로 먼저 scroll한 후 두 animation frame을 기다려 viewport/scroll 이벤트를 안정화하고 메뉴를 연다.
- 이 변경은 제품 runtime 동작을 변경하지 않는 테스트 안정성 수정이며 `0.19.1` PATCH로 관리한다.
- `v0.19.1` release가 성공한 뒤에만 Issue #75 관련 작업 브랜치를 삭제하고 Issue를 종료한다.
