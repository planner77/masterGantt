# 로컬 회귀 탐색 인덱스

PLAN/REWORK 전에 관련 도메인·증상으로 원본 누적 원장과 실제 테스트를 찾고 현재 source·환경·권한의 호환성을 판단한다. 기계 검증 원본은 [REGRESSION_INDEX.json](REGRESSION_INDEX.json), schema/append-only/출처 계약은 [ISSUE_LEDGER](ISSUE_LEDGER.md)다. 이 Markdown은 탐색용 연결이며 상태를 중복 관리하지 않는다. 최초 기계 등록 범위는 #906/#907/#908의 실제 실패이며 전체 과거 원장의 자동 이관 완료가 아니다. 등록만으로 테스트·게시·운영/복원 PASS가 되지 않는다.

| 도메인/증상 | 원본 실패 ID·근거 | 원인/재발 위험 | 현재 재사용 테스트·검사 | 증거 범위 |
| --- | --- | --- | --- | --- |
| 로컬 source drift/생성물 | [#552 SourceStable](ISSUE_552_FAILURE_ANALYSIS.md) | Next 생성 타입·스크린샷이 검사 중 source를 변경 | [prepr-verifier](../tests/scripts/prepr-verifier.test.ts), verify:prepr sourceStart/sourceEnd | 과거 원본 보존; 새 source는 실제 재실행 필요 |
| SQLite HTTP fixture/재오픈 시간 | [F711-001](ISSUE_711_FAILURE_ANALYSIS.md) | setup과 제품 assertion 예산 혼합; 환경 원인은 UNKNOWN | [wbs-dashboard HTTP](../tests/server/resources/wbs-dashboard-views-http.test.ts), [migration](../tests/server/db/issue-623-target-migration.test.ts) | 과거 실패이며 현재 PASS 아님 |
| case 수/파일 수·발견 누락 | [#711 인벤토리](TEST_LIFECYCLE_INVENTORY_711.md) | 정적 파일 수를 동적 실행 case 수로 오인 | [inventory Python](../tests/python/test_test_lifecycle_inventory.py), [discovery](../scripts/verify-test-discovery.mjs) | 파일/발견/실행·skip을 구별 |
| 문서 영향 누락/Visual source | [#895 F-001/R-002](ISSUE_895_FAILURE_ANALYSIS.md) | 문서 scope 누락·환경변수 이름 불일치 | [Agent 계약](../tests/scripts/agent-qa-contract.test.ts), [UI evidence](../tests/python/test_ui_evidence.py) | 과거 PR/CI는 역사; 새 검증은 로컬 계약 |
| 직접 Push 전 LIVE 설정 미전환 | [F906-001](ISSUE_906_FAILURE_ANALYSIS.md) | PR/Required Check·자동 Actions 활성 | 정확 Ruleset/Actions read-only snapshot과 전환 전후 대조 | BLOCKED; Owner가 필요한 #911 전환 위임, 완료 전 PASS 금지 |
| source/env/fixture·부분 PASS로 게시 | [#908 통합 검증 원장](ISSUE_908_FAILURE_ANALYSIS.md) | source 오염/환경 drift/누락 coverage에 의한 잘못된 게시 허용 위험 | [prepr-verifier](../tests/scripts/prepr-verifier.test.ts), verify:prepr --mode=admit | 신규 음성·회귀는 실행 전 NOT TESTED |

코드 수정 commit·실제 재실행 결과는 원본 Issue 누적 원장과 Git 이력에 연결한다. 실행 후 생긴 증거를 검사한 commit에 소급해 넣지 않는다. final evidence는 Owner Issue 댓글에 exact source/명령/exit/report digest/이미지 digest를 추가할 수 있다. 공개 저장소에는 정제한 합성 근거만 남긴다.

## #906/#907/#908 현재 기계 등록

F906-001(LIVE 전환 전제), F906-002(gh pagination), F906-003(Buildx template), F906-004(Issue 댓글의 skipped Run), F906-005(disabled 응답 assertion), F906-006(browser snapshot 입력) 및 F906-007(합성 OCI exporter probe), F906-008(nullable TypeScript fixture), F906-009(실제 provenance v1 wrapper 호환), F906-010(ORAS 로컬 copy 후조건), F906-011(보존 문서 EOF whitespace)을 [Primary 원장](ISSUE_906_FAILURE_ANALYSIS.md)에 연결했다. 원본과 후속 event를 각각 보존하며 최신 PASS로 첫 실패를 숨기지 않는다. [#907 연결](ISSUE_907_FAILURE_ANALYSIS.md), [#908 연결](ISSUE_908_FAILURE_ANALYSIS.md).

```bash
node scripts/verify-issue-ledger.mjs
```

현재 테스트 경로 누락·중복 Failure ID·잘못된 상태/stage/출처·Git 이전 인덱스 event 및 Markdown prefix 변경을 거부한다. 합성 GHCR/운영/복원 실패 fixture는 검증기의 음성 테스트이며 실제 운영·복원 결과가 아니다.
