# AGENTS.md 최소화·현행 정책 정합성 감사 (2026-11-14)

> 이 문서는 #918의 **분석·분리 이력**이다. 신규 에이전트가 실행할 규범 문서는 루트 [AGENTS.md](../AGENTS.md)와 각 주제별 현행 원본이다. 이 문서를 별도 실행 gate로 사용하지 않는다.

## 범위·버전 차이

- 검토 기준: 원격 `main` `9a98265ea7526feb2d589461146312e439206167`의 `AGENTS.md` 10,126 bytes / blob `118347b18fe36421487221b6b1f322ecd49733a7`.
- 최초 경고의 WSL 로컬 `/home/planner/Dev/masterGantt/AGENTS.md`는 **48,119 bytes**로 보고되었다. 원격과 다르며 해당 로컬 미커밋 내용은 이 세션에서 읽거나 수정하지 않았다. 로컬 내용을 자동 덮어쓰지 말고 먼저 diff/백업·미반영 계약 재평가를 수행한다.
- 원격 `AGENTS.md`는 2026-11-10 #906/#907/#908에서 10KiB 규모로 이미 분할되어 있었으므로, 이 변경은 **중복 제거와 참조 라우팅 강화**다. 원본 문단을 또 하나의 운영 계약 파일로 복제하지 않는다.

## 이전 루트 섹션별 내용의 원본 위치

| 기존 루트 AGENTS 섹션 | 중복/정리 사항 | 계속 유지할 책임 문서 |
| --- | --- | --- |
| 1. 현행 운영 정책 | Issue 전 위험도 로컬→main→수동 GHCR/종료 절차의 상세 문장 중복 | [ISSUE_LIFECYCLE](ISSUE_LIFECYCLE.md), [GITHUB_OPERATIONS](GITHUB_OPERATIONS.md), [CI_CD](CI_CD.md) |
| 2. 프로젝트와 Source of Truth | 제품·레이어별 세부 조건과 변경 동기화 목록을 루트에 복제 | [REQUIREMENTS](REQUIREMENTS.md), [ARCHITECTURE](ARCHITECTURE.md), [DESIGN](../DESIGN.md), [API](API.md), [DB_SCHEMA](DB_SCHEMA.md), [SCHEDULING_ENGINE](SCHEDULING_ENGINE.md), [IMPORT_EXPORT](IMPORT_EXPORT.md) |
| 3. 보안·구조 경계 | 인증·DB 경계·PUBLIC 자료 금지의 상세 설명 중복 | [SECURITY](SECURITY.md), [ARCHITECTURE](ARCHITECTURE.md), [GITHUB_OPERATIONS](GITHUB_OPERATIONS.md) |
| 4. 구현과 로컬 검증 | 위험별 테스트·source 안정성·admission·게시 조건 중복 | [TEST_PLAN](TEST_PLAN.md), [LOCAL_PREPR](LOCAL_PREPR.md), [QA_REVIEW_POLICY](QA_REVIEW_POLICY.md), [ISSUE_LEDGER](ISSUE_LEDGER.md), [CI_CD](CI_CD.md) |
| 5. Multi-Agent 역할 | 모델/effort·역할표가 기존 설정/문서와 이중 관리 | [AGENT_CONFIGURATION](AGENT_CONFIGURATION.md), [AGENT_PROMPTS](AGENT_PROMPTS.md), `.codex/config.toml` 및 `.codex/agents/*.toml` |
| 6. 보고와 완료 | GitHub Issue 댓글 유형·Final 증거·보고 언어 이중 관리 | [AGENT_PROMPTS](AGENT_PROMPTS.md), [GITHUB_OPERATIONS](GITHUB_OPERATIONS.md), [ISSUE_LIFECYCLE](ISSUE_LIFECYCLE.md) |
| 7. 파일·실행 경로 | Docker·Vitest·Playwright·HTTP 명령/산출물 상세 경로 중복 | [REPOSITORY_STRUCTURE](REPOSITORY_STRUCTURE.md), [LOCAL_PREPR](LOCAL_PREPR.md), [HTTP_OPERATION](HTTP_OPERATION.md) |
| Next.js 자동 생성 블록 | 제거하면 `next dev`가 다시 추가할 수 있음 | **루트 AGENTS 내 생성 블록을 원문 그대로 유지** |

## 정책 불일치 및 해결

1. **#911 진행형 표현 vs 완료:** [Issue #911 FINAL](https://github.com/planner77/masterGantt/issues/911#issuecomment-6794064739)은 2026-11-11 관리자 Ruleset/Actions 전환 완료를 증명한다. '첫 직접 Push 이전 관리자 설정 전환'은 역사적 절차로 읽어야 한다. 현재 신규 작업에서 필요한 것은 [GITHUB_OPERATIONS §3](GITHUB_OPERATIONS.md#3-매-push-절차)의 **매 Push live 읽기·동일 source 검증**이다. 본 변경에서 ISSUE_LIFECYCLE·CI_CD·GITHUB_OPERATIONS의 표현을 구분했다.
2. **기존 PR/CI·Trusted/Finalizer 잔존:** 2026-11-10 이전 사례, 보존 문서와 과거 Issue 실행 결과는 실증 이력이지 현재 gate가 아니다. [보존 전문](history/owner-ci-retired-20261110/README.md)을 삭제·소급 수정하지 않는다.
3. **모델/role 표기 이중 관리:** 실행 모델명/effort는 [AGENT_CONFIGURATION](AGENT_CONFIGURATION.md), 실제 파일은 `.codex` 설정을 원본으로 둔다. 루트의 고정 모델표를 제거하고 실행/독립 QA 신원은 실제 보고와 대조한다.
4. **세부 테스트·원장·경로의 중복:** `TEST_PLAN`·`LOCAL_PREPR`·`ISSUE_LEDGER`·`REPOSITORY_STRUCTURE`·`CI_CD`가 이미 상세 계약을 담고 있으므로 동일 규칙을 새 파일에 복사하지 않고 루트 문서에서 해당 상황만 라우팅한다.
5. **문서 변경 위험도:** 단순 안내 문구와 달리 에이전트 지침·테스트/Push gate의 의미를 바꾸는 편집은 [TEST_PLAN](TEST_PLAN.md)상 자동 docs-only LOW가 아니다. 변경 영향 검토와 공통 로컬 테스트·same-source 검증이 필요하며 실제 실행이 없으면 `NOT TESTED/BLOCKED`로 기록한다.

## 검증·반영 경계

- 본 후보는 사용자 WSL 로컬 작업본과 합쳐지지 않았다. remote docs 분할안은 GitHub 별도 검토 브랜치에 먼저 보존하고 **main 직접 Push·GHCR·운영 배포·Issue 종료를 수행하지 않는다**.
- Markdown 상대 링크는 원격 현행 파일이 존재하는 경로를 기준으로 작성했다. 실제 브랜치 적용 후 `node scripts/check-markdown-links.mjs` 및 [LOCAL_PREPR](LOCAL_PREPR.md)의 공통/영향 검사·admission을 해당 exact source에서 실행하고 증거를 #918에 남긴다. 검증되지 않은 항목은 PASS가 아니다.
- 로컬 통합 전 `git status --short`, `git diff -- AGENTS.md`, `git ls-files --stage AGENTS.md`를 조회한다. 로컬 48,119-byte 파일은 별도 안전 백업하고 미커밋 정책/실사용 규칙을 먼저 비교한다. 작업본에 변경이 있는 상태에서 `git checkout -- AGENTS.md` 등 파괴적 명령으로 덮어쓰지 않는다.
- Next.js 생성 블록의 시작·끝 마커 및 블록 원문은 유지한다. 기존 `.codex` 파일, 운영 workflow/보존 원장, CI 재활성화 설정, 실제 제품 코드는 변경 대상이 아니다.

## 관련 근거

- [#918 문서 정리 이슈](https://github.com/planner77/masterGantt/issues/918)
- [#905 Owner 운영 정책](https://github.com/planner77/masterGantt/issues/905)
- [#911 관리자 전환 완료](https://github.com/planner77/masterGantt/issues/911)
- [현행 ISSUE_LIFECYCLE](ISSUE_LIFECYCLE.md), [TEST_PLAN](TEST_PLAN.md), [GITHUB_OPERATIONS](GITHUB_OPERATIONS.md)
