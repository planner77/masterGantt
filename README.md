# masterGantt

SVAR React Gantt 기반 프로젝트 일정 관리 시스템. 현재 Next.js 화면 기반과 SQLite Foundation을 구현했으며, 프로젝트 생성·편집 인증·Gantt 통합은 후속 단계다.

## 로컬 실행

Node.js 22 이상과 npm을 사용한다. 현재 검증 환경은 Node 22.14.0 / Linux x64다.

```sh
npm ci
npm run dev
```

홈 화면과 `GET /api/health/live`를 확인할 수 있다. Liveness는 DB를 열거나 readiness를 보장하지 않는다. `.env.example`은 환경 설정 항목 안내이며 실제 비밀값을 Git에 저장하지 않는다.

## SQLite 초기화

Repository root에서 실행한다. 로컬 DB 경로는 명시적으로 전달한다.

```sh
DATABASE_PATH="$PWD/.data/mastergantt.sqlite3" npm run db:migrate
```

SQL migration과 checksum ledger를 검증하고 미적용 변경을 transaction으로 적용한다. 재실행 시 이미 적용한 migration은 건너뛰며, 적용 이력의 누락·수정 또는 SQL 오류는 실패로 처리한다. 적용한 SQL 파일은 수정하지 않고 새 migration을 추가한다. CLI는 `.env`를 자동 로딩하지 않는다.

Production은 `NODE_ENV=production`과 `/data/` 아래의 절대 DB 경로를 사용한다. 운영 계정에 해당 디렉터리 쓰기 권한을 부여해야 한다. Docker·startup/readiness 통합과 백업 복원 검증은 W16에서 진행한다.

## 검증

```sh
npm run build
npm run typecheck
npm run lint
npm test
```

빌드와 typecheck는 `.next` 생성 파일을 공유하므로 순서대로 실행한다. DB 테스트는 임시 DB에서 프로젝트 격리, migration rollback 및 재연결 후 저장값을 검사한다.

상세 상태: [실행 계획](docs/exec-plans/active/PLAN.md), [DB 계약](docs/DB_SCHEMA.md), [테스트 계획](docs/TEST_PLAN.md).
