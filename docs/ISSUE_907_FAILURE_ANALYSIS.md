# Issue #907 누적 검증·실패 연결 원장

Owner는 처음 요청의 중복 번호를 #906·#907·#908 통합 처리로 명시했다. 단일 append-only 원본은 [Issue #906 통합 원장](ISSUE_906_FAILURE_ANALYSIS.md), 실행 범위는 [통합 Work Packet](exec-plans/active/ISSUE_906_908.md)이다. 이 문서는 통합 Primary 연결이며 동일 Failure ID를 중복 생성하지 않는다.

## 실제 원본과 구현 범위

- 기준 HEAD: `4aad8865972e3446f0d34c7ffcfd2bbab439e366`; 제품0.145.1.
- 실제 원본 F906-001~F906-011과 후속 결과는 [기계 인덱스](REGRESSION_INDEX.json)에 event 순서로 연결한다. 당시 source fingerprint 미수집 사실을 SCOPED 근거로 남기고 최종 exact source PASS로 확대하지 않는다.
- #704의 과거 다중 PR/CI 원장은 변경하지 않는다. 새 단계는 LOCAL/GIT_PUSH/GHCR/DEPLOY/BACKUP/RESTORE/ROLLBACK이며 과거 CI stage는 historyOnly 자료에만 허용한다.
- 원장 검증기는 파일/스키마/상태/실제 테스트 경로·Primary alias/출처 결속 및 Git 이전 인덱스 대비 append-only prefix를 확인한다. 테스트·게시·운영/복원 자체의 PASS 또는 인증된 서버 gate가 아니다.
- GHCR 오류/운영 오류/복원 오류의 append-only 방어는 합성 Unit fixture로 검사한다. 실제로 발생하지 않은 운영 실패·복원 PASS를 이 원장에 만들지 않는다.
- 상세 계약·검증 명령·공개 보안은 [Issue Ledger](ISSUE_LEDGER.md), 조회 경로는 [Regression Index](REGRESSION_INDEX.md)를 따른다.

## 최초 구현 상태

검증기·합성 음성/양성 테스트 작성 단계. 실제 focused 테스트와 최종 source 공통 Gate/독립 QA·main Push·GHCR digest·Owner FINAL은 실행 전 NOT TESTED다. 향후 결과는 삭제/치환하지 않고 Owner Issue 댓글과 원본 원장에 append한다. 원시 DB·화면·비밀번호·내부 주소·민감 로그는 공개하지 않는다.

## 로컬 빠른 검증 / 구현 checkpoint

- `npm test -- tests/scripts/issue-ledger-verifier.test.ts`: 최초19case PASS, Git Markdown prefix·명시 previous 우회·필수 image/backup 결속을 보강한 최종22case PASS(로컬 로그 start07:18:42 KST, duration455ms; 전체 명령 exit0). 이는 합성 fixture 및 검증기 계약 결과이며 실제 GHCR/운영 복원 PASS가 아니다.
- `npm run typecheck`: 최초 exit2(F906-008), nullable 합성 fixture 교정 후 exit0. 원본 오류와 두 관측 로그는 Primary 원장에 연결한다. 개별 실행 시각 미수집은 그대로 보존한다.
- `node scripts/verify-issue-ledger.mjs`: actual Git baseline `4aad8865972e3446f0d34c7ffcfd2bbab439e366`에서 인덱스 부재 bootstrap을 증명하고 원장/링크/상태/현재 testpath·event 출처 검사를 수행한다. 새 원장은 baseline에 없으므로 Markdown 이전 prefix 비교0건이며 기존 원장이 보존됐다는 실증으로 부풀리지 않는다. prefix 변경 거부는 합성 Git fixture 테스트에서 실제 검사했다.
- 최종 exact source의 전체 공통 Gate/독립 QA/Push/GHCR 결과는 이 scoped checkpoint로 대체하지 않는다. 최종 SHA·report digest·원장 관련 수치는 Owner Issue FINAL 댓글에서 연결한다.

## 최종 commit 전 실제 toolchain 원본 보완

F906-010의 ORAS 세 명령 성공과 후조건 assertion 실패, 동일 copy read-only 재검산 PASS를 각각 보존했다. F906-007/F906-009에는 재빌드하지 않은 동일 R02 OCI의 predicate/runtime child 검증 PASS를 추가했다. 합성 fixture source와 OCI/archive/runtime config digest를 결속하며 제품 후보·API/SQLite·registry Pull 성공으로 확대하지 않는다. source content hash와 전체 source fingerprint는 다른 값이므로 content만 수집된 이번 probe는 fingerprint 미수집으로 남긴다. 실제 argv/개별시각 미수집은 로컬 원본 참조와 함께 명시하고 가짜 명령·시각을 채우지 않는다.

## F906-012 연결 / 첫 exact candidate 전체 Unit FAIL

기계 인덱스에 12번째 실제 실패 F906-012를 추가했다. 최초 candidate `0671bb72d2ac99cddc31f0ba6ec22e55c8883e76`의 전체 Unit에서 legacy batch와 강화 source fingerprint 소비자 경계가 실패했으며 source/environment는 실행 중 고정이었다. 이 결과는 새 source 재검증으로 덮지 않고 원본 event에 보존한다. 기존 commit의 모든 원장 bytes와 기존 index records/events는 그대로 prefix로 유지했다. 수정 후 PASS·build/browser/Docker/게시 성공은 아직 등록하지 않는다.

## F906-013/F906-014 및 F906-012 재검증 연결

새 exact candidate `22ceadb1f7278b3a9a5c4bc4896761d3961c0eb2`의 전체 Unit PASS는 F906-012의 후속 event로 추가했다. 같은 fast에서 production packaging이 실패한 F906-013과, 그 caller 교정 helper의 별도 WIP 타입 실패→교정 PASS인 F906-014를 추가하여 실제 원본 14개를 보존한다. source/env/report 지문은 실제 report에서 결속했고 WIP 지문·개별 시각 미수집은 null/사유로 남겼다. 종전 source의 실패를 지우거나 부분 PASS를 전체 Gate PASS로 승격하지 않는다.
