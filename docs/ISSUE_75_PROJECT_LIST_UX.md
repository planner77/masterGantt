# Issue #75 프로젝트 목록 UX 구현·검증 기록

상태: PR 병합 및 main artifact 검증 완료 / `v0.19.0` 정식 릴리스 검증 진행  
구현 브랜치: `feature/75-project-list-ux`  
릴리스 정리 브랜치: `chore/75-release-finalization`  
버전: `0.19.0`

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
