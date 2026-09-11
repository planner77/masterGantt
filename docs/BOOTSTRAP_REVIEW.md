# Bootstrap review evidence

범위: Bootstrap/Planning 및 W01 Foundation. 확인일 2026-09-11.

## Summary

최종 독립 **Planning QA: PASS**, Manager 판단: **ACCEPT**. W01 Foundation의 typecheck/lint/unit/webpack build/liveness smoke도 PASS했다. 이 판정은 Foundation 범위에 한정되며 제품·운영 release 승인이 아니다.

## Initial independent findings와 Manager 처리

| ID | qa_docs finding / 최초 판정 | Manager 처리 | 최종 독립 재검토 |
| --- | --- | --- | --- |
| QA01 | Summary mode 입력 생략과 DB NOT NULL의 불명확성 / FAIL | Summary mode auto로 정규화, requestedStart null, manual 거부를 API/DB 계약에 명시 | PASS |
| QA02 | Preview POST의 If-Match 요구가 불명확 / FAIL | Session+Origin 필요, If-Match 불필요, DB/revision 불변을 API/Security에 명시 | PASS |
| QA03 | Password 변경 후 호출자 session UX 미확정 / FAIL | 이전 모두 revoke, 호출자 새 session 원자 발급, 204/ETag/Cookie 정의 | PASS |
| QA04 | CSV 계약 부재로 fallback coverage 불완전 / BLOCKED | Backend/Excel 공동 grammar를 Manager가 IMPORT_SCHEMA에 반영, API/Security 동기화 | PASS |
| QA05 | 같은 volume backups 그림과 off-host 보존의 차이 / FAIL | 그림에서 같은 volume backup 제거, 별도 저장과 isolated restore Gate 명시 | PASS |
| QA06 | 구현물 부재를 실행 PASS로 표시하면 안 됨 / NOT TESTED | 모든 runtime 결과 NOT TESTED, 실제 Excel 사실 UNKNOWN·실행 환경 BLOCKED | 상태 구분 PASS; runtime NOT TESTED |

추가 검토에서 INTEGER progress→REAL, empty summary 생성용 atomic batch, siblingOrder 이름, Unicode business ID와 Task URL UUID 분리, VBA 예제의 누락 참조를 보완했다. 최종 qa_docs 재검토는 fractional progress와 W07/W09·W10/W12 순서도 확인하여 모두 Planning PASS로 판정했다.

## Requirement Coverage

R01–R25를 [REQUIREMENTS.md](REQUIREMENTS.md)에서 분류하고 [TEST_PLAN.md](TEST_PLAN.md)에서 planned test evidence에 매핑했다. 이는 coverage 계획이며 구현 동작 통과율이 아니다. 상세 Architecture/DB/API/Scheduling/Import/VBA/Security/Deployment와 W01–W19 issue 초안이 있다.

## Test Results

- qa_docs 독립 검사: 계약 문서18개, 내부 링크123개, JSON예제16개 PASS. Manager의 전체 검사에는 이후 추가한 요약 보고서도 포함되며 아래 결과와 구분한다.
- W01 `npm run typecheck`, `npm run lint`, `npm test`, Webpack `next build`, `GET /api/health/live` smoke: **PASS**.
- SQLite migration/persistence, authorization, Gantt, import/export runtime, Docker image/restart/restore, full E2E: **NOT TESTED**.
- 대상 Excel의 조직 정책·실행 가능 여부: **UNKNOWN**. 실제 POC는 [VBA_EXPORT.md](VBA_EXPORT.md)의 개별 prerequisite에 따라 **BLOCKED**이며 PASS한 실행은 없다.

## Security / Regression / Documentation

Security 설계에는 server session/project binding, scrypt+salt, CSRF Origin, token digest/expiry, concurrency, atomic import, safe XLSX와 secret 취급을 포함했다. 이를 실제 방어 검증으로 간주하지 않는다. 기존 application source가 없어 runtime regression을 실행하지 않았다. `.env`는 Git에 추가하지 않고 `.gitignore`로 보호한다. `AGENTS.md`와 Agent TOML 원문은 변경하지 않는다.

## Remaining risks / Recommendation

qa_docs는 문서 commit/push를 권고했고 Manager가 ACCEPT했다. 다음은 W01 Foundation과 첫 slice W01–W07의 작은 범위다. D01 실제 Excel 권한, D02 데이터 공개 범위, D03 target deployment는 해당 작업 전에 확인한다. 지금 원격으로 동기화하는 것은 검증 상태를 명시한 설계 기준선이다.

## Static Check Results

- Manager 검사: TOML8개, Markdown19개(요약 보고서 포함), local link140개, JSON16개, CSV2개: PASS.
- CSV는 13-column grammar와 embedded predecessor JSON, 예제의 parent/dependency 참조를 검사했다. 실제 제품 parser 테스트가 아니다.
- `git diff --cached --check`: PASS. Staged path는 docs와 .gitignore로 한정하고 실제 `.env` credential 값이 없는지 검사했다.
- `AGENTS.md`와 `.codex` 설정 원문 변경 없음. `.env`는 미추적·ignored이며 원격에 포함하지 않는다.
