# Issue #344 서버 삭제 복구 검증

검토 기준 main SHA는 `6532edd8418772454b96fdeb895b90c5ab7d3d6d`이며, 작업 branch는 `fix/issue-344-task-delete-failure-rollback`이다. 이 기록은 backend가 실제 수행한 Local Fast Feedback이며 PR의 공식 전체 회귀나 브라우저 화면 검증을 대신하지 않는다.

## 서버 계약과 진단

[Task DELETE API](API.md#delete-apiprojectspublicidtaskstaskid)의 성공은 Project revision을 정확히 1 증가시키고 canonical full snapshot을 반환한다. 마지막 child 삭제의 `409 EMPTY_SUMMARY_NOT_ALLOWED`는 현재 요청만 거부한다. 이전 요청에서 이미 커밋한 삭제와 revision을 복원하지 않는다.

`ProjectService.deleteTask`와 `TaskSubtreeDeleteService.deleteTaskSubtree`는 각각 SQLite immediate transaction 안에서 현재 세션·revision·구조를 검증한다. 마지막 child 또는 선택 범위 밖 parent Summary가 비는 조건은 거부하며 빈 Summary 자동 삭제·일반 Task 자동 전환을 하지 않는다. 이번 검증에서 서버의 이전 삭제 복원은 재현되지 않았다. 서버 구현, endpoint, 요청/응답, authorization 및 도메인 정책을 변경할 필요가 발견되지 않았다.

## 실제 검증 범위

[task-delete-recovery.test.ts](../tests/server/projects/task-delete-recovery.test.ts)는 mock service 없이 실제 Handler → Service → Repository → 파일 SQLite 경로를 실행한다. `includeDescendants=true`는 실제 Route와 동일한 TaskSubtreeDeleteService adapter를 Handler에 전달한다. Next.js HTTP listener 자체를 실행하는 테스트는 아니다.

- 단건 마지막 child 및 중첩 subtree 마지막 child 두 경우를 각각 실행한다.
- Task C 삭제 성공 → revision +1 → 마지막 child 삭제 `409` 순서를 실행하고, Task D 삭제 성공 → 같은 `409`를 다시 실행한다.
- 성공 응답의 ETag/revision/canonical tasks·links와 public GET의 `private, no-store` 및 ETag를 비교한다.
- 각 거부 뒤 Project/Task/Link DB 전체 row를 직전 성공 상태와 비교한다. 이미 삭제한 C/D는 계속 없고 마지막 child와 Summary는 남아 있으며 canonical GET 결과도 동일하다.
- 같은 성공 상태에서 인증 Cookie 없음(`401 EDIT_SESSION_REQUIRED`), stale If-Match(`412 REVISION_MISMATCH`), 다른 Origin(`403 ORIGIN_NOT_ALLOWED`)도 DB 변경 없이 거부한다.
- 거부 이후 별도 root Summary와 두 깊이 자손을 child-first로 삭제할 수 있고 revision이 다시 정확히 1 증가한다.
- 위 성공·실패 전 과정에서 unrelated X→Y FS Link의 ID/type/lag와 양 endpoint를 보존한다.
- 파일 DB 연결을 닫고 migration 포함 새 연결/새 ProjectService로 GET하여 최종 canonical state와 revision이 동일함을 검증한다.

## 실행 결과

| Local Fast Feedback | 판정 | 실제 결과 |
| --- | --- | --- |
| `npm test -- tests/server/projects/task-delete-recovery.test.ts tests/server/projects/task-handler-integration.test.ts tests/server/projects/task-subtree-delete-service.test.ts` | PASS | 3 files / 23 tests. 신규 반복 삭제 복구 2건 포함 |
| `npx eslint tests/server/projects/task-delete-recovery.test.ts` | PASS | exit 0 |
| `npm run typecheck` 초기 실행 | FAIL | 최초 backend 테스트 타입 2건 수정 후 재실행에서 backend 오류 0건. 병렬 작성 중인 `tests/e2e/project-task-delete-context.spec.ts:127`의 snapshot cast/permission 오류 1건은 frontend에 handoff |
| `npm run typecheck` 통합 후 독립 재실행 | PASS | frontend의 E2E permission cast 수정 후 backend가 다시 실행하여 exit 0 확인. 위 최초 FAIL 이력을 유지하며 targeted 서버 23 tests 결과는 재사용 |
| PR `quality/e2e/docker` | NOT TESTED | backend 실행 범위에 원격 CI 결과 확인 없음 |
| 실제 Chromium Grid/Chart 및 reload | NOT TESTED | frontend/독립 QA 검증 범위 |
| main/GHCR container artifact | NOT TESTED | 이번 사용자 요청은 PR CI 시작까지 |

Vitest는 기존 설정의 Vite native-config 전환 관련 안내를 출력했으며 테스트 실패는 없었다. Typecheck 최초 실패를 숨기지 않으며 수정 이후 통합 상태에서 backend의 독립 재실행 PASS를 위 표에 별도로 기록한다. 이후 head 변경의 공식 전체 회귀는 새 PR head의 GitHub Actions 결과로 판정한다.

## 문서 동기화 영향

- API 계약 변경 없음: 기존 DELETE의 요청 단위 rollback 의미를 frontend 담당자가 [API](API.md)에 명시한다.
- DB schema/migration N/A: 테이블·컬럼·영속성 정책 변경 없이 기존 migration을 적용한 SQLite로 검증했다.
- Security N/A: 실제 기존 session/Origin/revision 검증을 사용하며 보안 구현·정책을 변경하지 않았다.
- Scheduling Engine N/A: 기존 empty-summary 및 Dependency endpoint 보호, Summary 재계산을 변경하지 않았다.
- Requirements/Project UX/Test Plan: frontend 담당자가 실패한 mutation만 복구하고 이전 확정 snapshot/revision을 보존하는 정책과 신규 회귀 범위를 반영한다.
- 서버 Architecture N/A: Route/Service/Repository/SQLite 경계를 변경하지 않았다. 클라이언트 실패 복구의 same-instance 계약은 Manager가 [ARCHITECTURE](ARCHITECTURE.md)에 동기화한다.

Network 오류는 HTTP listener 이전/이후의 응답 유실 등 client 경로 문제이므로 이 서버 통합 테스트는 network 실패 복구 PASS를 주장하지 않는다. Browser Gantt 인스턴스, collapse/scroll/scale, 화면 Task 집합 및 늦게 도착한 client snapshot 보존은 별도 frontend/QA 증거가 필요하다.
