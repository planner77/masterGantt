# Issue #918 — 실행 지침 라우팅 로컬 통합

## 범위와 재사용

- baseline: `9a98265ea7526feb2d589461146312e439206167`, 기존 후보 `6491c5969bd072256a7d3c715e047d7cab718928`.
- Owner 2026-11-15: #918 이후 #891 구현·버전 규칙 채번·정식 GHCR 게시·Issue 종료까지 위임. PR/Actions/자동 Finalizer·운영 배포는 사용하지 않는다.
- REUSE_DECISION=EXTEND: 준비된5문서 후보·기존 책임 문서·로컬 실행기를 확장한다. 새로운 정책 원본을 만들지 않는다. 원본48,119byte AGENTS는 백업·대조했으며 오래된 tracked blob과 동일하다. 원본 worktree 미커밋 Compose/산출물은 보존한다.
- HIGH / AGENT_LOCAL / qa_required=true. Manager는 문서/통합/검증/Issue 기록·main Push·종료, 별도 qa918는 read-only 독립 검토. 같은 파일에 다른 writer를 배정하지 않는다.
- 제품·API·DB·의존성·버전0.146.0·Docker 입력 변경0. #918 이미지/GHCR·제품 Chromium/Docker는 N/A(실행 지침·참조 라우팅과 관리자 이력 표현만 변경). 공통 전체 검사 및 실행 정책 직접 테스트는 필수다.

## TEST_LIFECYCLE_REVIEW와 AC

기존 `tests/scripts/agent-qa-contract.test.ts`, `agent-model-selection.test.ts`, `prepr-verifier.test.ts`, `deployment-layout.test.ts`, `local-publish.test.ts`를 KEEP_UNIQUE로 실제 실행한다. 전체 Unit/Integration과 링크·typecheck/lint/build의 공통 fast를 수행하고 같은 source/환경의 targeted 및 admit로 결합한다. 기존 정책 회귀는 고유한 금지·역할·권한/출처 경계이므로 문구 변경에 맞춰 약화하지 않는다.

| AC | 검증 |
| --- | --- |
| AGENTS 32,768bytes 이하·Next 원문 유지 | 실제byte 및 baseline 생성블록 비교 |
| 모든 책임 문서와 참조 존재 | 변경문서 상대링크 검사·전체 markdown links |
| 기존 역할/보안/gate 보존 | 원본main과 #593tracked/보존본 대조·독립 qa918·기존정책테스트 |
| #911 완료이력과 현재조회 분리 | §3 매Push live 조회·차단 조건 검토 |
| 로컬원본 안전보존 | 외부0600백업 SHA256·원본git diff 없음 확인 |
| 반영/완료 | exact source fast/targeted/admit·QA·live설정·정상mainFF·FINAL |

## DOCUMENTATION_SYNC

UPDATED: AGENTS, AGENT_INSTRUCTION_AUDIT_20261114, GITHUB_OPERATIONS, ISSUE_LIFECYCLE, CI_CD 및 본 Work Packet. TEST_PLAN/LOCAL_PREPR/AGENT_CONFIGURATION/AGENT_PROMPTS/QA_REVIEW_POLICY는 기존 책임·명령을 변경하지 않아 N/A(해당 내용으로 라우팅만 정합화). 제품DESIGN/API/DB/보안/일정/Import/배포 계약은 N/A(제품 및 운영실행 변경0). 실제 시험/QA/Push·종료 결과는 Issue FINAL에 exact SHA와 연결하며 후보 준비만으로 PASS를 주장하지 않는다.


## F918-001 재작업

기존119개 영향case중118PASS/1FAIL 및 동일source fast UnitFAIL을 [원장](../../ISSUE_918_FAILURE_ANALYSIS.md)에 보존한다. 문서테스트소비자의 위치만책임문서로이관하며TOML모델/effort/read-only/Manager/6thread검증은보존한다. 테스트파일변경을포함한보수적admission상Docker/runtime도같은source로실행한다. 제품/빌드입력은불변이므로918단독게시와버전변경은N/A다. REGRESSION_INDEX및테스트소비자도UPDATED다.
