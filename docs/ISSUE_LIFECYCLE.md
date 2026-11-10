# 단일 Issue Lifecycle

Owner 2026-11-10 최종 정책 [#905](https://github.com/planner77/masterGantt/issues/905)를 적용한다. LOW/MEDIUM/HIGH 모두 로컬 검증 후 main 직접 fast-forward Push를 사용한다. PR·GitHub Actions·원격 CI·Trusted QA·자동 Finalizer는 신규 작업에 사용하지 않는다. 문서·스크립트 준비와 실제 관리자 전환·게시·배포 완료를 구분한다.

## 1. 단일 상태와 완료 조건

```text
PLAN → REUSE_REVIEW → LOCAL_IMPLEMENTED → LOCAL_VERIFIED
→ DOCUMENTATION_SYNC → MAIN_PUSHED
→ GHCR_DIGEST_VERIFIED(코드 변경)
→ DEPLOYED_VERIFIED(운영 배포 요청)
→ OWNER_FINAL/CLOSED
```

| 상태 | 완료에 필요한 실제 근거 | 다음 단계 차단 조건 |
| --- | --- | --- |
| PLAN | 실제 Issue 본문/댓글·현재 main SHA·version·기존 작업·범위/AC·담당/파일 소유권·위험·Owner 게시/배포 승인 범위 | 불명확한 요구·권한·실데이터 반입 |
| REUSE_REVIEW | 기존 코드/API/fixture/테스트·관련 실패 원장 검색, 재사용 결정과 Owner 근거, TEST_LIFECYCLE_REVIEW | 승인 없는 신규 병렬 기능, 미해결 소비자/UNKNOWN |
| LOCAL_IMPLEMENTED | 승인된 범위의 코드·테스트, source/base·변경 파일·fixture 고정 | 관련 계약/테스트 누락 |
| LOCAL_VERIFIED | [TEST_PLAN](TEST_PLAN.md)의 공통+영향+위험별 필수 검사, [LOCAL_PREPR](LOCAL_PREPR.md)의 동일 source·환경 보고·admission | 필수 FAIL/BLOCKED/NOT TESTED, 취소, source/fixture/환경 drift |
| DOCUMENTATION_SYNC | 관련 문서 UPDATED 또는 항목별 N/A(reason), AC→실제 test·증거 링크, 실패 원장 append | 현재 코드/계약/문서 불일치 |
| MAIN_PUSHED | #911 live 설정 전환 증거, 최신 main과 ancestry·fast-forward 확인, Owner 권한 Push, 원격 exact SHA 재조회·새 자동 Run 0건 확인 | 관리자 전환 미확인, 최신 main 이동/충돌, source 검증 불일치 |
| GHCR_DIGEST_VERIFIED | 코드 변경의 exact main SHA, 로컬 Build-once·고유 태그 Push·실제 digest Pull·runtime/API/SQLite restart smoke | 권한/태그 충돌/source·digest drift/Smoke FAIL; 문서 전용은 N/A(reason) |
| DEPLOYED_VERIFIED | 운영 배포가 명시 요청된 경우 exact digest·호환 백업/복원 준비·실제 운영 smoke | 게시만 성공, backup/restore 미확보, 운영 미반영 |
| OWNER_FINAL/CLOSED | 모든 요청 AC/gate와 증거를 담은 FINAL 기록, 실제 Owner의 범위별 최종 수용 또는 동일 범위 명시 위임·수동 종료 | 미완료 AC/선행 의존성/필수 미검증, FINAL 실패 |

`PASS`는 해당 소스·환경에서 실제 실행해 성공한 검사다. `FAIL`은 실행 결과가 계약과 다르며, `BLOCKED`는 환경/권한/외부 의존성으로 수행 불가, `NOT TESTED`는 미실행이다. 이미지 `NOT PUBLISHED`, 운영 `NOT DEPLOYED`는 테스트 결과와 별도다. 위험 수용이 있어도 미실행을 PASS로 바꾸거나 필수 실패 상태에서 Push/Publish/Close하지 않는다. Owner가 범위를 명시 변경하면 남은 범위·미검증·사유를 DECISION 기록으로 보존한다.

## 2. 역할과 실행 순서

1. 첫 전환 중 Actions가 활성이라면 Issue 댓글도 원격 Run을 만들 수 있다. 읽기 전용 snapshot과 #911 Actions 비활성을 먼저 확인하고 원격 진행 댓글을 남긴다. Manager가 Issue·관련 원장·현재 main/작업 branch·설치 환경을 조회하고 [Work Packet](AGENT_PROMPTS.md)을 확정한다. 여러 이슈 통합은 Primary 원본을 하나 정하고 타 이슈에서 링크한다. GitHub 개발 Issue와 제품 내 Project Issue는 별도 원장이다.
2. `REUSE_REVIEW`에 `REUSE_DECISION`, 후보, 호환 조건, Owner 근거를 기록한다. #895가 요구하는 재사용 결정이 불명확하고 기존 명시 승인으로 확인할 수 없으면 구현 전에 질문한다. 같은 승인 범위를 반복 질문하지 않는다.
3. 구현 Agent는 지정 파일만 수정하며 다른 Agent의 변경을 되돌리지 않는다. 단일 writer와 공용 interface 소유권을 유지한다. 독립 ui_ux/researcher/qa_docs는 read-only다.
4. 로컬 검사 전에 source/base HEAD·tracked diff/untracked bytes·fixture digest·Node/npm/lock/browser 환경을 고정한다. 제품 소스 수정과 최종 검증을 동시에 실행하지 않는다. 각 검사 명령·exit·케이스 수·선택/제외·trace를 [실패 원장 계약](#5-실패재작업-원장)에 연결한다.
5. Manager가 DOCUMENTATION_SYNC와 [로컬 QA](QA_REVIEW_POLICY.md), Owner 수용 범위를 확인한다. Push 전에 #911 live 전환·최신 main·동일 source admission을 확인한다. 원격 main이 이동하면 merge/rebase 결과를 새 source로 다시 검증한다. force Push·PR 우회 금지.
6. infra는 승인된 Push·로컬 GHCR 단계만 실행한다. Owner가 게시를 명확히 요청하지 않으면 게시하지 않는다. SemVer/rolling tag와 운영 배포는 별도 exact scope 승인이 필요하다.
7. 모든 요청 gate 뒤 Manager가 FINAL을 남기고 Owner 또는 종료를 명시적으로 위임받은 Manager가 수동 종료한다. 자동 Finalizer를 연결하지 않는다. 구현·테스트·문서·게시 중 하나만 끝난 상태를 전체 완료로 보고하지 않는다.

## 3. 여덟 가지 적용 시나리오

| 시나리오 | 담당과 로컬 증거 | 게시/완료 판단 |
| --- | --- | --- |
| 신규 기능 MEDIUM | Manager REUSE/AC → domain Agent Unit/Integration·공통 검사·직접/인접/음성 소비자 | exact source admission 뒤 direct Push·코드 이미지 digest smoke·Owner FINAL |
| LOW UI 문구/격리 스타일 | frontend + 필요 시 ui_ux, 실제 Chromium·keyboard/5폭 geometry·합성 #896 manifest | UI 영향이므로 browser N/A 불가; #897 로컬 UAT는 영향 범위에 따라 기록 |
| HIGH DB/migration/삭제 | backend, full 관련 Unit/Integration·실제 SQLite upgrade/실패 rollback/restore/restart·관련 Chromium·Docker | 호환 snapshot+digest 복원 준비 없이는 파괴적 migration 배포 금지; #912 미실증은 NOT TESTED |
| HIGH auth/공통 Gantt/동시성 | backend/frontend/scheduler, 권한401/409/412/422/500·canonical/viewport·공통 소비자 합집합·실제 Chromium·Docker | 위험도는 검사 강도만 결정, PR 승격 없음 |
| docs-only | Manager/작성자, 공통 정적·전체 Unit/Integration·build + 링크/정책 정합성; 영향 browser/Docker·이미지 N/A 근거 | 이미지 N/A; 정책/실행 지침 변경은 단순 docs-only로 오분류하지 않음 |
| 실패 재작업 | 기존 Issue/원장/branch 재사용, 원본 FAIL 보존·원인 분류·수정 SHA·같은 최종 source 재실행 | 이전 source PASS 승계 금지, 의존 소비자 회귀 완료 후 전진 |
| unknown/광범위 | Manager가 HIGH로 분류, 소비자/fixture를 확인해 매핑; 관련 full Unit/Integration/Chromium·Docker | UNKNOWN 해소 전 BLOCKED; 임의 exclude/skip로 PASS 금지 |
| 운영 오류/복구 | infra + backend, 정제한 증상·source/digest·backup ID·실제 restore/smoke | 새 revert/교정 commit 또는 호환 DB+이미지 쌍 복원, 실운영 승인·결과 별도 |

## 4. 선행 이슈와 전환 경계

| Issue | 책임과 의존성 | 이번 통합 구현과의 경계 |
| --- | --- | --- |
| #906 | 현행 정책·문서·템플릿 | 본 흐름의 정책 원본 |
| #907 | append-only 실패 원장·교차 Regression Index | Owner가 #906/#907/#908 통합 구현을 승인; 실제 validator·회귀 검증 결과를 #908 선행 증거로 연결 |
| #908 | #697/#699 로컬 검증·source 안정성·게시 admission | #906/#907에 의존; 로컬 도구 PASS와 운영 전환을 구분 |
| #912 | 일관된 백업·격리 복원·DB+digest 호환 | #906/#907 병행; 데이터 위험 배포의 필수 사전증거 |
| #909 | exact source Build-once→수동 GHCR→digest smoke/보존 | #907/#908, 데이터 위험 시 #912 연계; 현재 승인·도구 가용성 재조회 |
| #911 | live Ruleset/branch protection·Actions 비활성·기존 open PR 개별 처리 | 첫 직접 Push 이전 Owner 관리자 전환·실증; 문서 변경으로 완료되지 않음 |

#910의 CI 자동 Finalizer 신설안은 미채택이다. 기존 open PR을 일괄 종료·무검증 병합하지 않는다. 과거 PR/CI 기록·immutable tag·기존 실패 판정은 불변이며 신규 gate가 아니다. [보존 정책](history/owner-ci-retired-20261110/README.md).

## 5. 실패·재작업 원장

Issue마다 `docs/ISSUE_<N>_FAILURE_ANALYSIS.md` 하나를 append-only로 유지한다. 최소 Failure ID, Issue/기준·수정 source SHA, 발생 시각/단계/환경, 실제 명령·exit, 합성 재현 입력, 기대/실제·최초 근본 오류, 원인 분류, 상태, 수정/재실행 시각·결과, 영향 소비자/테스트·잔여 위험을 기록한다. LOCAL/GIT_PUSH/GHCR/DEPLOY/BACKUP/RESTORE/ROLLBACK을 구분한다. 과거 PR_CI/MAIN_CI/RELEASE/FINALIZER는 역사 조회만 허용하며 신규 입력은 N/A다.

#907의 [원장 계약](ISSUE_LEDGER.md)과 [Regression Index](REGRESSION_INDEX.md)를 사용해 도메인/증상→Failure ID→원인/수정→실제 테스트→현재 source·환경 호환 순으로 조회한다. #906/#907/#908의 통합 범위 승인과 실제 구현·검증 완료는 별개다. 인덱스·원장 validator 결과와 실행 근거를 확인하고 미검증은 NOT TESTED/BLOCKED로 기록한다. 기존 원장의 직접 검색 결과와 누락 위험도 Work Packet에 남긴다.

재작업은 기존 Issue/branch를 재사용하고 원본 FAIL·취소·미실행을 지우지 않는다. source/fixture/환경 변경 뒤 관련 로컬 결과와 admission을 다시 생성한다. append-only 원장 작성 자체도 source가 바뀌므로 최종 admission은 최종 commit 기준으로 확인한다.

## 6. 게시·복구·종료

GHCR의 정확 source SHA·image digest·DB schema/migration·backup ID·운영 여부를 연결한다. [CI_CD](CI_CD.md)의 build/push/digest 검증과 [DEPLOYMENT §8](DEPLOYMENT.md#8-backup-restore-rollback)을 따른다. 정상·직전 정상 digest를 보존하며 임의 tag overwrite와 운영 volume 삭제 금지. Git revert는 새 commit이고 schema downmigration이 아니다.

Owner FINAL에는 AC별 실제 결과, source/main SHA, 로컬 보고서, 원장, 문서, GHCR digest/Smoke·미게시·미배포, 복구/환경별 미검증, 위험 수용 및 남은 이슈를 담는다. Manager 자체 ACCEPT나 기계 PASS는 Owner 수동 최종 수용을 대체하지 않는다. 현재 사용자의 동일 범위 수동 종료 위임이 있으면 증거를 완료한 Manager가 API로 종료할 수 있고 추가 승인 질문을 반복하지 않는다.
