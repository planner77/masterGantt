## Issue #866 Phase B — 관리형 기준정보 다국어 회귀 계획 (2026-11-05)

- 기존 SQLite Migration, Project Master, Process Catalog, Logistics Type/Project Logistics, Resource Group, Copy, Template, HTTP Origin/If-Match와 Gantt/Task/E2E 테스트를 검색하고 증명 경계를 분리했다. 단순 같은 제목으로 테스트를 제거하지 않는다.
- ADD: `tests/server/i18n/managed-display-names.test.ts`(12 owner/권한/격리/revision/migration/snapshot), `tests/lib/i18n-translation-write-field.test.ts`(생략/전체·개별 해제), `tests/e2e/i18n-master-data.spec.ts`(관리자 3언어 입력·동명 ID·5폭).
- EXTEND: `tests/server/db/database.test.ts`, migration-cli, 기존 공정/물류/리소스/Copy/Template 테스트, `tests/scripts/e2e-shard-planner.test.ts`.
- KEEP_UNIQUE: Phase A locale/SSR/Gantt shell과 기존 안전·E2E8·SQLite/HTTP/권한·달력/스케줄 tests. 샤드7 신규 하나만 추가(144→145, [19,18,18,18,18,18,18,18]), 기존 spec 이동0, 과거 metrics 오용 금지.
- 신규 source 전수 TypeScript/Vitest/Chromium8/Docker/Trusted는 PR CI 실행 전 NOT TESTED, Owner 인수·운영 DB 백업 복원과 전체 Phase C는 미완료. 자세한 계약은 [Phase B](I18N_PHASE_B.md).

