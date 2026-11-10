# Issue 실패 원장과 교차 회귀 계약

매 PLAN/REWORK에서 [Regression Index](REGRESSION_INDEX.md)·[기계 원본](REGRESSION_INDEX.json)을 도메인/계층/증상으로 조회하고 실제 원장→원인→현재 테스트 경로·case→source/환경/버전·잔여 위험을 확인한다. #704 원장과 #711 Test Lifecycle을 확장 재사용하며 별도 승인 DB를 만들지 않는다. [Issue Lifecycle](ISSUE_LIFECYCLE.md), [TEST_PLAN](TEST_PLAN.md), [LOCAL_PREPR](LOCAL_PREPR.md)과 함께 적용한다.

## 단일 원본·누적 방식

각 Issue는 `docs/ISSUE_<N>_FAILURE_ANALYSIS.md` 한 원장만 둔다. 통합 구현은 Primary 원장에 실제 Failure ID를 한 번 기록하고 타 Issue 원장에서는 Primary를 링크한다. 최초 실패·취소·BLOCKED·NOT TESTED·원본 근거를 지우지 않고 수정/재실행 event를 추가한다. 잘못된 원인도 원문을 교체하지 않고 후속 정정 event로 보완한다.

기계 인덱스의 failures는 전역 고유 ID와 Primary issue/ledger, relatedIssues, domain/layer/keywords, cause, 실제 tests(path/case), residualRisk, events를 갖는다. events는 id·시각(미수집이면 null+timeNote)·stage·status·sourceSha/fixSourceSha·sourceFingerprint/미수집 사유·환경/버전·실제 command/exit(미수집 사유)·입력/기대/실제·분류·recovery·근거·imageDigest/backupId·잔여 위험을 보존한다. synthetic은 실제와 합성 검증을 구분한다.

현재 단계는 LOCAL_PREP/STATIC/UNIT/INTEGRATION/PLAYWRIGHT/VISUAL/DOCKER/SQLITE/GIT_PUSH/GHCR_BUILD/GHCR_PUSH/GHCR_PULL/DEPLOY/SMOKE/OPERATION/BACKUP/RESTORE/ROLLBACK이다. 과거 PR_CI/MAIN_CI/RELEASE/FINALIZER는 `historyOnly=true` 이력에서만 허용한다. 신규 `remoteCi=N/A`이며 가짜 PR/run/attempt 값을 채우지 않는다.

## 출처와 상태

PASS에는 실제 exit0와 source·환경·이미지·백업 결속 verification이 필요하다. evidenceScope=EXACT에는 sourceFingerprint가 필요하다. 작업 중 source 지문이 수집되지 않은 과거 빠른 검증은 SCOPED와 이유로 보존하며 최종 publish 근거가 아니다. source/환경이 다른 PASS는 `--source`/`--environment` 대조에서 거부한다. 이 비교는 과거 이력을 삭제하라는 뜻이 아니라 현재 검증 재사용이 불가함을 알려 준다.

FAIL은 계약 불일치, BLOCKED는 환경/권한/외부 의존 불가, NOT TESTED는 미실행이다. 이미지 미게시·운영 미반영·복원 미실증은 성공으로 바꾸지 않는다. Git revert는 DB schema 복원이 아니며 #912의 호환 snapshot+digest·격리 복원 증거가 필요하다. [DEPLOYMENT](DEPLOYMENT.md).

## 검증과 append-only 기준

```bash
node scripts/verify-issue-ledger.mjs
node scripts/verify-issue-ledger.mjs --base=<기존-main-sha>
node scripts/verify-issue-ledger.mjs --previous=<로컬-이전-index.json>
```

기본 명령은 actual Git HEAD의 index와 현재 파일을 비교한다. 현재가 HEAD와 같으면 HEAD parent를 기준으로 새 commit의 변경을 검사한다. 새 인덱스는 Git 기준 tree에 파일이 없음을 증명한 bootstrap만 허용한다. 읽을 수 없는 Git 기준은 BLOCKED이며 이전본 없이 append-only 검증을 성공으로 꾸미지 않는다. `--base`는 고정된 실제 이전 commit을 지정한다. `--previous`는 별도 보관 이전본을 추가 비교하는 보조이며 Git 기준을 대체하거나 인증하지 않는다.

기존 Issue/failure 순서·원본 필드·모든 event prefix와 Git 기준 원장 Markdown bytes prefix의 수정/삭제/순서 교체를 거부한다. 추가 Issue/failure·후속 event만 허용한다. 누락된 원장/link/Failure heading, duplicate ID, 상태/stage 오류, stale 현재 테스트 경로, PASS 출처 불일치도 실패한다. 폐기된 테스트를 역사로 등록하려면 historyOnly와 정확 source SHA·이유를 남기고 현재 실행 근거로 사용하지 않는다.

검증 PASS는 원장 구조·원본 보존 검사다. 실제 테스트·GHCR 게시·운영·복원·Owner 수용을 승인하지 않으며 local JSON은 인증된 서버 gate가 아니다. 최초 도입은 #906/#907/#908의 실제 원본 11개를 연결한 범위이며 전체 과거 원장의 자동 이관 완료가 아니다.

## 공개 저장소 경계

운영 DB/WAL/SHM·실제 백업·원시 화면·고객/영업/생산 데이터·Cookie/Authorization·토큰·비밀번호·사내 IP/URL·민감 로그는 Git/Issue/이미지에 저장하지 않는다. 공개 근거는 합성 fixture·정제한 결과만 사용한다. 로컬 원시 artifact는 `LOCAL:` 불투명 참조로만 연결하고 파일 자체는 ignored 저장소에 보관한다. 검증기는 명백한 credential/private-address 패턴을 보조 검사할 뿐 비밀값 부재를 증명하지 않으므로 Manager가 공개 내용을 검토한다.
