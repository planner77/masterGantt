# Issue #37 분석·설계·검증 기록

## 배경

Issue #37은 프로젝트에 직접 진입할 때뿐 아니라 브라우저 history/BFCache 또는 클라이언트 재진입으로 기존 React subtree가 복원되는 경우에도 서버의 현재 edit session을 다시 확인하도록 요구한다. 클라이언트에 남아 있는 `edit` 상태는 권한 근거로 사용할 수 없다.

## 기존 구현 분석

- `ProjectReadonlyView`는 최초 snapshot 로딩 뒤 `GET /api/projects/{publicId}/edit-sessions/current`를 호출하고, 확인이 끝나기 전에는 `editing=false`로 mutation UI를 열지 않는다.
- 서버의 current-session 및 mutation 검증은 `projectId`, `authVersion`, `revokedAt`, `expiresAt`을 확인하므로 최종 권한 경계는 이미 fail-closed다.
- 다만 최초 권한 확인이 workspace mount lifecycle에 결합되어 있어 BFCache/history가 이미 마운트된 subtree를 복원하면 동일 검증이 반드시 다시 실행된다는 보장이 없었다.

## 설계

1. 현재 edit-session 응답을 보수적으로 해석하는 `parseCurrentEditPermission`을 분리한다.
2. `permission=edit`는 유효한 미래 `expiresAt`이 있을 때만 인정한다. malformed/non-2xx/expired는 readonly fail-closed다.
3. 프로젝트 페이지에 `ProjectPermissionRecheckBoundary`를 두고 `pageshow(persisted)`와 `popstate`에서 현재 `publicId`의 세션을 재확인한다.
4. 재확인 중 wrapper를 `inert` 처리해 기존 edit UI가 화면에 남아 있더라도 사용자가 mutation 동작을 실행할 수 없게 한다.
5. 정상 edit 재확인은 기존 Gantt subtree를 유지해 선택·스크롤·레이아웃을 불필요하게 초기화하지 않는다.
6. readonly/실패/malformed/expired이면 현재 문서를 reload하여 stale client edit state를 폐기하고 기존 최초 진입 로직으로 읽기 전용 상태를 재구성한다.
7. history callback은 현재 URL의 프로젝트 경로가 해당 `publicId`와 일치할 때만 동작해 프로젝트 A/B 전환의 세션 혼선을 막는다.

## 버전

동작 계약을 깨지 않고 기존 권한 검증의 lifecycle 누락을 수정하므로 Semantic Versioning 기준 PATCH `0.8.3`으로 반영한다.

## 검증 범위

- Unit: valid edit, explicit readonly, malformed payload, invalid timestamp, expiry boundary.
- E2E: 프로젝트 재진입 시 current-session 재조회.
- E2E: browser back/forward 복원 시 current-session 재조회.
- E2E: 재검증 실패 시 stale edit UI 폐기 및 readonly fail-closed.
- 기존 서버 edit-session/mutation authorization 테스트와 전체 CI를 함께 통과해야 한다.

## 보안 판단

서버가 최종 권한 경계를 계속 담당하며 이번 변경은 클라이언트에서 stale 권한 UI가 살아남는 시간을 제거하는 defense-in-depth다. 클라이언트 성공 응답만으로 서버 mutation 권한을 부여하지 않는다.
