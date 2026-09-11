# W02 SQLite Foundation review

확인일: 2026-09-11. 범위는 SQLite Foundation이며 Project/Auth/Scheduling/Import/Docker 기능 완료 판정과 구분한다.

## 구현 및 소유권

- Backend agent: 최초 SQL schema, connection·migration·path policy, Project/Schedule Repository, DB 테스트, DB_SCHEMA 문서.
- Manager: 공식 package metadata·native runtime 확인, dependency/lockfile, migration CLI와 subprocess 테스트, 통합 문서·설계 판단.
- QA/Docs agent: 독립 코드·계약 검토 및 DB 회귀 검증. 최종 판정은 아래에 기록한다.

## Findings와 처리

| Finding | 처리 |
| --- | --- |
| 적용 이력 중간 누락을 거부하지 않아 잘못된 순서로 SQL 실행 가능 | ledger가 disk sequence의 정확한 prefix인지 검증; 실제 checksum으로 재현 테스트 |
| ledger 조회와 pending 판단이 transaction 밖에 존재 | 파일 읽기 후 ledger 생성·검증·pending 적용을 하나의 immediate transaction으로 이동 |
| 부모 RESTRICT가 전체 Project cascade와 충돌 | deferred NO ACTION으로 변경, 단독 부모 삭제 거부와 전체 cascade를 검증; ADR21 |
| 일반 Task 기간 제한이 계산된 Summary에도 적용 | leaf의 10000일 제한을 유지하고 computed Summary span은 별도 취급 |
| secret 제외 검사와 migration 실패 검사가 다른 원인으로 통과할 수 있음 | 금지 필드 개별 검사와 특정 ledger 오류·실제 checksum fixture로 보완 |

## 실행 환경과 검증

Node 22.14.0, Linux x64, better-sqlite3 13.0.3, SQLite 3.53.4. Dependency 설치 audit은 0 vulnerabilities였다.

마이그레이션 CLI의 첫 sandbox 테스트는 자식 프로세스 실행 `EPERM`으로 실패했다. 승인된 환경에서 재실행한 3개 CLI 테스트는 PASS했다. 파일 DB를 별도 프로세스에서 생성·재실행하고 schema ledger를 다시 열어 확인했다. 원래 실패를 제품 기능 PASS로 덮어쓰지 않는다.

Manager 실행 결과 (모두 exit 0):

- `npm run build`: Webpack production build PASS. 기존 `/`와 `/api/health/live` route 유지.
- `npm run typecheck`: scripts/tests를 포함하여 PASS. Build 완료 후 순차 실행.
- `npm run lint`: PASS.
- `npm test`: 3개 파일, **17개 테스트 PASS** (DB 13, CLI 3, liveness 1).
- `git diff --check`: PASS. `.env`와 SQLite data/sidecar는 Git ignore 대상이며 AGENTS/agent 설정 변경 없음.

독립 QA 최종 판정: **PASS**, Manager: **ACCEPT**. QA 에이전트가 `npm test -- tests/server/db/database.test.ts tests/server/migration-cli.test.ts`를 독립 실행하여 2개 파일·16개 테스트 PASS(exit 0), `git diff --check` PASS를 확인했다. 코드·문서 대조에서 미해결 기능·보안 blocker가 없다. 전체 17개 결과는 위 Manager 실행과 구분한다.

## Remaining risks

- 실제 Docker volume, container restart, backup/restore, 다른 CPU/libc의 native 동작은 NOT TESTED.
- Production 경로 검사는 `/data` 아래의 lexical boundary다. mount·symlink·운영 계정 권한은 W16 배포 구성의 책임이다.
- Project 생성/인증 서비스, revision 충돌 처리, 일정 계산, Import/Export 및 readiness/startup gate는 후속 단계다.
- 일반 Read Repository 결과는 password 자료를 제외하지만 내부 PK를 포함하는 서버 자료다. W04 API는 별도의 public DTO를 만들어야 한다.
