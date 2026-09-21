# Issue #75 프로젝트 목록 UX 구현 계획

상태: 구현 진행 중  
브랜치: `feature/75-project-list-ux`  
버전: `0.19.0`

## 결정

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

## 검증 상태

현재 단계는 코드 수정까지이며 GitHub Actions의 `quality`, `e2e`, `docker`는 아직 실행 전이므로 **NOT TESTED**다. PR 생성 이후 동일 head SHA의 원격 검증 결과로 최종 판정한다.
