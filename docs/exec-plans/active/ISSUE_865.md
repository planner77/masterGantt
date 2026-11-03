# Issue #865 — 사내 LLM 공통 서버 모듈 분리 구현 (2026-11-04)

- Primary Issue: https://github.com/planner77/masterGantt/issues/865
- 원본 통합 PR: https://github.com/planner77/masterGantt/pull/870, source Head `ca58e987fd68261d9e9db97b4e931651350d6e4a`; 이 PR에서는 #866 국제화와 #869 Issue 화면 기능을 포함하지 않는다.
- 기준 Main: `352a43e74c7b34c72d952f67783a53463f8b519d`; 후보 독립 앱 버전 `0.140.0`. 실제 전용 PR 번호/Head/CI는 생성 후 별도 PR STATUS 댓글에서만 확정.
- 위험도 HIGH, qa_method OWNER_MANAGED, qa_required=true, release_required=true, release_authorized=false, MERGE_READY=BLOCKED.
- 요청 범위: 기존 #870에서 #865 코드를 선택적으로 이식 → 관련 문서·테스트를 독립적으로 구성 → 새로운 원격 Full PR CI 시작. 기존 #870 기록/HEAD는 보존.

## 구현 범위 (확정 정책)

1. `src/server/llm/{index,types,config-core,client-core,transport-core}.ts`: runtime 등록 provider/model, OpenAI 호환 비스트리밍 Chat Completions 공통 호출, 기본 OFF, 사설망/DNS 검증, redirect 금지, timeout/abort/요청·응답 크기/동시성 한도, token·Prompt·upstream 오류 비노출.
2. `tests/server/llm/{llm-config,llm-client,llm-boundary}.test.ts`: 설정/모델 선택·mock server/SSRF·무인증·비밀 누출 경계의 직접·음성 검증을 #870의 구현에서 이식. 현재 독립 PR에서 실제 실행은 NOT TESTED.
3. `.env.example`, `deploy/compose.yml`, `docs/LLM_CONFIGURATION.md` 및 관련 Architecture/API/Deployment/Security/Requirements/README/별도 LLM Test Plan/Changelog 문서만 분리. CI Workflow·프로젝트 DB/Issue 폼·i18n 레지스트리/Gantt 컴포넌트를 변경하지 않는다.
4. 앱 `package.json`과 `package-lock.json`을 같은 `0.140.0`으로 올리며 기존 의존성을 그대로 유지한다. #869도 Main 기준 별도 PR로 준비하므로 릴리스 버전은 선행 병합 이후 재정렬한다.

## 의존성/수용 기준

- #866의 `src/lib/i18n/**` import 없음, #869의 Project Issue component/CSS/DB API 변경 없음; 새 UI/공개 LLM API/자동 데이터 전송 없음.
- #865 AC1~AC9(두 provider, 한 provider에 2+ model, 기본값/override, mocked OpenAI POST, disabled network0, SSRF/DNS/secret 경계, Compose runtime, 문서, UI 비노출)를 동일 구현/테스트와 대조한다.
- 기존 main의 권한·DB schema·migration·일정 수치·Gantt editor, 배포 Container/SQLite 영속성을 보호한다.
- 실제 사내망 DNS/CA/토큰을 사용한 연결은 현장 운영 환경에서 별도로 승인/검증 필요. 앱 기본 비활성 상태에서 LLM 장애로 기존 app availability 차단 금지.

## TEST_LIFECYCLE_REVIEW / DOCUMENTATION_SYNC

- 새 LLM 전용 테스트 세 파일은 기존 #870의 동일 기능에서 이식(ADD), 새 중복 테스트를 생성하지 않음. 테스트의 직접 모듈만 의존성을 가진다. 기존 E2E8Shard/Quality/Docker 정책 불변.
- `docs/LLM_CONFIGURATION.md` 신규, Architecture/API/Deployment/Security/Requirements/README/별도 LLM Test Plan/Changelog UPDATED, `.env.example`/Compose UPDATED. DESIGN.md=N/A(LLM UI 없음), DB_SCHEMA=N/A(DB schema 없음), i18n/Issue 가이드=N/A(타 이슈).
- GitHub connector에서 파일/blob 및 부모 Main/Head를 정적 대조해 분리하나, 실제 독립 소스의 로컬 Vitest/typecheck/Playwright/Docker는 **NOT TESTED**. 원격 PR CI/Trusted/Owner는 이후 exact-Head 결과로만 판정.
- 기존 #866 누적 실패 원장 `docs/ISSUE_866_FAILURE_ANALYSIS.md`는 #866 PR에 그대로 남기고 #865 독립 PR에 복사하지 않는다. #865에서 별도 CI 실패가 발생할 경우 전용 `docs/ISSUE_865_FAILURE_ANALYSIS.md`를 생성한다.

## TEST_LIFECYCLE_REVIEW

- `tests/server/llm/llm-config.test.ts`, `llm-client.test.ts`, `llm-boundary.test.ts`은 동일 #865 기능의 기존 PR #870 사례를 재사용(KEEP_UNIQUE/ADD). 별도 중복 파일 없이 Config·Client mock·SSRF/보안 경계를 검증한다.
- 타입/린트/전체 Vitest, E2E8Shard, Docker smoke, 운영 runtime/Compose 및 Gantt/Project 영향은 기존 공식 CI 대상. #871 첫 Full #3476.1은 metadata Preflight에서 차단돼 실행되지 않았으므로 테스트 PASS 0; 후속 exact Head CI에서 직접 검증해야 한다.

## DOCUMENTATION_SYNC
- `AGENTS.md`: N/A(기존 CI·QA·Owner Managed 절차와 AGENT 실행 가이드를 변경하지 않음)
- `docs/QA_REVIEW_POLICY.md`: N/A(위험도 HIGH와 Trusted QA/Owner/Manager 검증 정책을 변경하지 않음)
- `docs/CI_CD.md`: N/A(8Shard·Quality/E2E/Docker required·workflow 설정을 변경하지 않음)
- `docs/GITHUB_OPERATIONS.md`: N/A(브랜치 분리 및 Git Data API 게시에도 기존 GitHub 원격 정책 그대로 적용)
- `docs/REMOTE_VALIDATION.md`: N/A(독립 PR의 최신 Head 검증 및 기존 remote gate를 변경하지 않음)

- `docs/API.md`: UPDATED
- `DESIGN.md`: N/A(기능은 서버 전용이며 신규 화면 및 공통 시각 디자인 변경 없음)
- `docs/TEST_PLAN.md`: N/A(기존 대용량 공통 계획을 덮지 않고 LLM 전용 검증 계획에 실제 파일과 범위를 명시)
- `docs/ARCHITECTURE.md`: UPDATED
- `docs/DEPLOYMENT.md`: UPDATED
- `docs/SECURITY.md`: UPDATED
- `docs/REQUIREMENTS.md`: UPDATED
- `docs/LLM_CONFIGURATION.md`: UPDATED
- `docs/LLM_TEST_PLAN.md`: UPDATED
- `README.md`: UPDATED
- `CHANGELOG.md`: UPDATED
- `docs/exec-plans/active/ISSUE_865.md`: UPDATED
- `docs/ISSUE_865_FAILURE_ANALYSIS.md`: UPDATED


| 대상 | 판정 | 이유 |
| --- | --- | --- |
| `.env.example`, `deploy/compose.yml`, `docs/LLM_CONFIGURATION.md` | UPDATED/ADD | runtime provider/model·secret·Compose 연결 |
| `docs/LLM_TEST_PLAN.md`, 본 Work Packet | ADD/UPDATED | #865 직접/인접/음성 수용 테스트·분리 인계 |
| `docs/ARCHITECTURE.md`, `docs/API.md`, `docs/SECURITY.md`, `docs/DEPLOYMENT.md` | UPDATED | server-only 경계·비밀정보·no-public-endpoint·운영 |
| `docs/REQUIREMENTS.md`, `README.md`, `CHANGELOG.md` | UPDATED | #865 기능·버전·사용 안내 |
| `docs/TEST_PLAN.md` | N/A | 대용량 공통 계획 원문 변경 없이 #865 전용 LLM Test Plan과 본 Work Packet에 coverage 기록 |
| `DESIGN.md`, `docs/DB_SCHEMA.md`, `docs/PROJECT_UX.md` | N/A | UI·DB·Project 화면 비변경 |
| `docs/ISSUE_865_FAILURE_ANALYSIS.md` | ADD | #871 Full #3476.1 사전 정책 실패부터 누적 기록 |

## AC_TEST_COVERAGE
- AC1: #865 제공 모듈·모의 응답·설정/보안/배포 테스트를 docs/LLM_TEST_PLAN.md 및 tests/server/llm에 각각 매핑, 원격 exact-Head 결과는 이후 검증
- AC2: #865 제공 모듈·모의 응답·설정/보안/배포 테스트를 docs/LLM_TEST_PLAN.md 및 tests/server/llm에 각각 매핑, 원격 exact-Head 결과는 이후 검증
- AC3: #865 제공 모듈·모의 응답·설정/보안/배포 테스트를 docs/LLM_TEST_PLAN.md 및 tests/server/llm에 각각 매핑, 원격 exact-Head 결과는 이후 검증
- AC4: #865 제공 모듈·모의 응답·설정/보안/배포 테스트를 docs/LLM_TEST_PLAN.md 및 tests/server/llm에 각각 매핑, 원격 exact-Head 결과는 이후 검증
- AC5: #865 제공 모듈·모의 응답·설정/보안/배포 테스트를 docs/LLM_TEST_PLAN.md 및 tests/server/llm에 각각 매핑, 원격 exact-Head 결과는 이후 검증
- AC6: #865 제공 모듈·모의 응답·설정/보안/배포 테스트를 docs/LLM_TEST_PLAN.md 및 tests/server/llm에 각각 매핑, 원격 exact-Head 결과는 이후 검증
- AC7: #865 제공 모듈·모의 응답·설정/보안/배포 테스트를 docs/LLM_TEST_PLAN.md 및 tests/server/llm에 각각 매핑, 원격 exact-Head 결과는 이후 검증
- AC8: #865 제공 모듈·모의 응답·설정/보안/배포 테스트를 docs/LLM_TEST_PLAN.md 및 tests/server/llm에 각각 매핑, 원격 exact-Head 결과는 이후 검증
- AC9: #865 제공 모듈·모의 응답·설정/보안/배포 테스트를 docs/LLM_TEST_PLAN.md 및 tests/server/llm에 각각 매핑, 원격 exact-Head 결과는 이후 검증


| 이슈 #865 AC | 이식한 구현 및 검증 파일 | 신규 독립 원격 증거 |
| --- | --- | --- |
| AC1 다중 provider · AC2 provider 내 복수 model · AC3 defaults/override/unknown | `config-core.ts`, `llm-config.test.ts`, `llm-client.test.ts` | #3476.1 Preflight 조기 FAIL, 직접 테스트 NOT TESTED |
| AC4 OpenAI-compatible HTTP mock·timeout/abort · AC5 기본 OFF/연결0 | `client-core.ts`, `transport-core.ts`, `llm-client.test.ts` | NOT TESTED |
| AC6 DNS/사설망/redirect/secret/client import 차단 | `transport-core.ts`, `types.ts`, `llm-boundary.test.ts`, `llm-client.test.ts` | NOT TESTED |
| AC7 Compose runtime·no DB disruption | `.env.example`, `deploy/compose.yml`, `docs/LLM_CONFIGURATION.md` | NOT TESTED |
| AC8 문서·성능·기존 Quality/E2E/Docker · AC9 공개 AI UI/API 없음 | `index.ts`, 전용문서와 파일 경계 감사, 기존 CI 필수 Job | #3476.1 metadata PASS 전 막힘, 재검증 예정 |

## PR #871 / 첫 Full #3476.1 — 메타데이터 재작업

[Run41741295176](https://github.com/planner77/masterGantt/actions/runs/41741295176) attempt1, Head `b3c693c895f9452dd35ac19920e593b23b1fdcb6`, Base `352a43e74c7b34c72d952f67783a53463f8b519d`. QA Preflight Job126283300587와 QA Trust Job126283170236가 PR 본문 `risk_level/qa_method/qa_required`의 파서 허용 구문 누락, Work Packet `## DOCUMENTATION_SYNC` 누락으로 실제 FAIL. Quality/E2E/Docker 집계 실패는 Preflight가 선행 Job을 SKIP한 파생이며 LLM 코드·네트워크·제품 테스트가 실패했다는 뜻이 아니다. 원본은 [별도 누적 원장](../../ISSUE_865_FAILURE_ANALYSIS.md)에 보존한다. 안전하게 PR metadata 형식을 정정하고 이 Work Packet·원장을 갱신하되 gate/승인 정책 완화 없음.

## REWORK2 — DOC_SYNC 구조 및 AC Test Mapping 수정 (2026-11-04)

[Full #3477.1](https://github.com/planner77/masterGantt/actions/runs/41742099717)의 직접 QA Preflight 실패는 Work Packet 테이블만으로 구조화된 문서 영향 등록이 되지 않는 문제였다. 이 문서의 ## DOCUMENTATION_SYNC 목록을 canonical `- \`path\`: UPDATED|N/A(reason)` 형식으로 보강하고 ## AC_TEST_COVERAGE에 AC1~9 항목을 각각 기록했다. #3478 metadata-only 실패는 #3477 선행 full 오류의 파생이다. [원장](../../ISSUE_865_FAILURE_ANALYSIS.md)을 따른다.

## REWORK3 — Full #3479.1 정책 영향 문서 Union (2026-11-04)

[Full #3479.1 / Run41742545244](https://github.com/planner77/masterGantt/actions/runs/41742545244), Head `d70a803667f9a8945be9723f070c8711a110f1b8`, QA Preflight Job126287542927: DOC_SYNC 필수 경로 `docs/GITHUB_OPERATIONS.md` 누락 1건. `docs/SECURITY.md`는 보호 정책 문서이므로 base 검증기 `docs_required(paths)`에서 `AGENTS.md`, `docs/QA_REVIEW_POLICY.md`, `docs/CI_CD.md`, `docs/TEST_PLAN.md`, `docs/GITHUB_OPERATIONS.md`, `docs/REMOTE_VALIDATION.md`의 Union을 요구한다. 변경 없는 5개에 대해 `N/A(reason)`을 명시하고 기존 `docs/TEST_PLAN.md` N/A(reason)을 유지했다. 기존 코드/CI 게이트는 변경하지 않고 새 정확한 Head Full에서 이 입력을 재검증한다.
