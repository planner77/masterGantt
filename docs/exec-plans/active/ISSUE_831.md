# Issue #831 — GPT-6.1 Terra Agent 모델 라우팅 Work Packet (2026-10-27)

## REWORK #1 — Full PR CI #3329.1 QA Preflight 직접 FAIL (2026-10-27)

- 원본 [Run 40453783682.1](https://github.com/planner77/masterGantt/actions/runs/40453783682) · `pull_request` / Ready FINAL_FULL · HEAD `5d24372236df86112277994ebf08915f56606a35` · base `dc8543f390616c0d5aca90a4f91899f3cf7ac5da` · test-merge `f65371c0247171a76727c4fbf58cbeaadee387a8`. 시각 2026-10-27T05:10:52Z 기준.
- **F831-001 / POLICY_CI / QA Preflight Job `122022384535` Step 4 FAIL**: `DOCUMENTATION_SYNC / AC_TEST_COVERAGE — DOC_SYNC 기록 누락`. 원래 Work Packet에는 문서 영향 분석을 서술했으나 신뢰된 base의 `scripts/qa_final_automated.py::docs_gate`가 요구하는 개별 `- \x60path\x60: UPDATED/N/A(reason)` 목록이 없었다. 또한 `AC_TEST_COVERAGE`는 표 형태여서 정규식 `- AC1: ...` 등을 충족하지 않았다. **검증기/Required Gate를 고치거나 완화하지 않는다.**
- 변경 경로 및 Trusted QA 경계 확인은 SUCCESS; Preflight 외의 Policy/Typecheck/Lint/Vitest/Build/E2E8/Docker 실제 구현은 SKIPPED/NOT RUN. PR Fast Gate `122022466138`, Quality Required `122022544360`, E2E Required `122022544336`, Docker Required `122022544212`, QA Automated `122022575103`의 FAILURE는 Preflight에서 전파된 **파생 차단**이다. 요구사항 회귀나 Terra 실행 결함의 증거가 아니다.
- 최초 누적 실패 원장: [ISSUE_831_FAILURE_ANALYSIS](../../ISSUE_831_FAILURE_ANALYSIS.md), CI 출처와 실패/파생 구분·artifact·조치·검증 제한 및 새 Run 인계를 기록한다.
- 보완: 아래 기존 `DOCUMENTATION_SYNC`를 요구 경로별 정확 형식으로, `AC_TEST_COVERAGE`를 기존 표와 함께 명시적 `- ACn:` 매핑으로 확장한다. `DESIGN.md`/UI_UX_GUIDELINES는 모델 설정만 변경하고 기존 light/data-dense/native interaction 요구를 변경하지 않으므로 N/A. 원격 새 Head의 QA·테스트 PASS, 실제 Terra 모델/effort 로딩은 **NOT TESTED**.
- 리뷰 스레드 0, Main 병합 충돌 없음(수정 전 Head); 다음 push 직전 ref 재검사 및 변경 후 정확 새 Head로 PR Full CI 시작, 이후 CI 결과 모니터링/병합/GHCR/Finalizer/Issue 종료 금지. HIGH/OWNER_MANAGED/qa_required=true/release_required=false/release_authorized=false 유지.

## Source & PLAN
- [Issue #831](https://github.com/planner77/masterGantt/issues/831), 이전 [#347](https://github.com/planner77/masterGantt/issues/347)/[#131](https://github.com/planner77/masterGantt/issues/131); OpenAI [Terra 소개](https://openai.com/ko-KR/index/introducing-gpt-6-1-terra/) 및 [API 모델 카드](https://developers.openai.com/api/docs/models/gpt-6.1-terra).
- Base: `main@dc8543f390616c0d5aca90a4f91899f3cf7ac5da`, branch: `issue-831-terra-agent-routing`.
- 목적: 비용 절감 가능성이 있는 UI 계열만 Terra/medium으로 변경하되 복잡·보안·데이터 작업의 Sol/high를 지킨다. 선택 기준/승격/rollback을 문서화하고 정적 회귀를 추가한다.
- 소유권: Main Manager가 이 역할 설정/AGENTS/문서/테스트의 단일 writer. researcher/qa_docs read-only 대리 실행 없이 문서 비교로 분석. 별도 Sub-Agent나 독립 QA를 실제 실행했다고 주장하지 않는다.
- Risk: **HIGH**(모든 UI Issue의 기본 Agent 모델에 파급), `qa_method=OWNER_MANAGED`, `qa_required=true`. `release_required=false`, `release_authorized=false`; 기능·API·DB·버전·GHCR 정책 불변.
- 이번 지시 해석: 역할별 검토와 필요한 설정 변경, 문서·정적 검증, PR/CI 시작까지. 병합/MAIN/GHCR/Finalizer/종료는 정확 Head Trusted/Owner 수용 전 수행하지 않는다.

## 역할별 결정
| 역할 | 이전 | 이후 |
| --- | --- | --- |
| Manager | Sol 6.1/high | 유지 |
| researcher | Luna/medium, read-only | 유지 |
| ui_ux | Sol 6.1/medium, read-only | **Terra 6.1/medium**, read-only 유지 |
| frontend | Sol 6.1/medium | **Terra 6.1/medium**, 작업별 Sol high 승격 |
| backend | Sol 6.1/high | 유지 |
| scheduler | Sol 6.1/high | 유지 |
| excel_vba | Luna/medium | 유지 |
| infra | Sol 6.1/high | 유지 |
| qa_docs | Sol 6.1/high, read-only | 유지 |

- 공식 API 정가/1M input/output: Luna `$0.10/$0.50`, Terra `$1/$5`, Sol `$2/$10`, Astra `$10/$50`. 동일 토큰 기준 Sol→Terra 50%↓/Luna→Terra 10배↑. 추가 추론·재시도·CI rerun 비용과 모델별 정답 확률을 제외한 nominal 비교일 뿐 실제 ROI는 아직 **NOT TESTED**.
- 모델 미지원은 silent fallback 없이 중단/보고. 위험한 SVAR interaction·shared state/revision/auth, 회귀 복잡도 상승은 Sol/high 재배정. 이미지/비정형 Excel은 필요 시 Luna→Terra 임시 승격. Sol high 초과 시에만 Astra. 자세한 정책은 [AGENT_CONFIGURATION](../../AGENT_CONFIGURATION.md#issue-831--gpt-61-terra-역할별-선택-2026-10-27).
- 기존 read-only sandbox, 8개 Sub-Agent/Manager 1개, concurrency=6, OWNER_MANAGED/Required3/Trusted/Finalizer는 변경 없음.

## AC_TEST_COVERAGE
- AC1: 9개 역할의 활성 모델·추론 강도/TOML 형식을 신규 `tests/scripts/agent-model-selection.test.ts`와 연결하고 정확 신규 HEAD의 Vitest/정책 원격 결과를 별도 판정한다. 기존 Run에서 관련 구현 미실행으로 NOT TESTED.
- AC2: 두 UI 역할만 Terra medium으로 바꾸고 나머지 Sol/Luna·read-only sandbox·역할 수·동시 실행 한도 6을 보호한다. 신규 Agent 모델 정적 회귀에서 확인하되 이전 전체 CI는 SKIPPED.
- AC3: `AGENTS.md`, 두 활성 Agent TOML, `docs/AGENT_CONFIGURATION.md`의 승격·fallback 금지·rollback 설명을 diff로 확인한다. 실제 Codex 런타임 모델 접근은 NOT TESTED.
- AC4: 기존 `tests/scripts/agent-qa-contract.test.ts` 보호 조건을 KEEP_UNIQUE로 두고 신규 모델 정적 테스트 ADD를 수행한다. `TEST_LIFECYCLE_REVIEW`는 본 Packet에 기록하고 원격 테스트 미실행을 PASS로 표기하지 않는다.
- AC5: 새 exact-HEAD PR Quality/E2E8/Docker Required3 및 Trusted QA·Owner와 실제 model 식별은 추후 원본 Run/Attempt·세션 증거로 검증한다. 현재 NOT TESTED/병합 BLOCKED.

| AC | 변경/보호 범위 | 검사 | 현재 상태 |
| --- | --- | --- | --- |
| AC1 | 9개 활성 model+effort 일치/유효 TOML | `tests/scripts/agent-model-selection.test.ts`; TOML 원문 제한 변경 | 원격 **NOT TESTED** |
| AC2 | 두 UI 역할만 Terra, 타역할/sandbox/6 제한 유지 | 동일 Vitest 설정/불변 계약 테스트 | 원격 **NOT TESTED** |
| AC3 | 안내/승격/rollback 문서 일치 | AGENTS 5절 + AGENT_CONFIGURATION + role developer_instructions 수동 diff | 문서 편집, QA 미검증 |
| AC4 | 기존 agent QA 지침 보존 | `tests/scripts/agent-qa-contract.test.ts` + 신규 역할 테스트 | 원격 **NOT TESTED** |
| AC5 | 새 PR HEAD/본모델 실증/CI·Trusted·Owner | GitHub Actions Required3와 실제 Codex 세션에서 모델 식별 | **NOT TESTED**, 병합 차단 |

## TEST_LIFECYCLE_REVIEW (#711)
- 기존 `tests/scripts/agent-qa-contract.test.ts`는 #598 owner-managed 지침이 활성 `developer_instructions`에 있는지 검사하므로 **KEEP_UNIQUE**.
- 신규 `tests/scripts/agent-model-selection.test.ts`는 모델·effort·read-only·role 수·manager 동시성 및 AGENTS 표의 정적 설정 별도 계약이라 **ADD**; QA 테스트와 명제 중복 없음.
- 기타 Vitest·Playwright/HTTP/SQLite/E2E8/CI 환경 계약 변경 N/A; 기존 테스트 축소·skip/폐기 없음. `npm test -- tests/scripts/agent-model-selection.test.ts tests/scripts/agent-qa-contract.test.ts`를 Local Fast Feedback 우선 대상으로 삼는다. 로컬 명령의 실제 실행 증거가 없으면 PASS로 표기하지 않는다.

## DOCUMENTATION_SYNC
- `AGENTS.md`: UPDATED
- `docs/AGENT_CONFIGURATION.md`: UPDATED
- `docs/QA_REVIEW_POLICY.md`: N/A(Owner managed 및 Trusted QA와 고위험 승인 기준을 변경하지 않음)
- `docs/CI_CD.md`: N/A(Quality E2E Docker Required 세 검사와 현재 CI 실행 체계를 그대로 유지)
- `docs/TEST_PLAN.md`: N/A(기존 회귀 범위와 테스트 운영 정책 동일하며 신규 모델 계약은 본 Packet에 명시)
- `docs/GITHUB_OPERATIONS.md`: N/A(기존 GitHub 운영 권한과 리뷰 절차 및 브랜치 정책에 변경 없음)
- `docs/REMOTE_VALIDATION.md`: N/A(원격 실행 Head Run Attempt 및 별도 실환경 검증 정책 변경 없음)
- `docs/exec-plans/active/ISSUE_831.md`: UPDATED
- `docs/exec-plans/active/PLAN.md`: UPDATED
- `docs/ISSUE_831_FAILURE_ANALYSIS.md`: UPDATED
- `DESIGN.md`: N/A(설정 파일의 모델 배정만 변경되며 사용자 화면 및 SVAR 동작 변경 없음)
- `docs/UI_UX_GUIDELINES.md`: N/A(접근성 화면 설계 및 컴포넌트 사용자 계약에 변경 없음)

### DOCUMENTATION_SYNC 판정
- 신뢰된 `scripts/qa_final_automated.py::docs_gate`가 요구하는 보호/Agent/테스트 변경의 **7개 경로**를 정확히 기록하고, 실제 diff에 존재하는 `AGENTS.md`·`docs/AGENT_CONFIGURATION.md`만 `UPDATED`로 선언한다. 변경하지 않은 필수 지침 5개는 사유가 있는 `N/A`이며 의미 검토는 Manager/QA 대상이다.
- 추가 변경 문서 Work Packet/active PLAN 및 최초 실패 원장을 UPDATED로 등록한다. 이 형식은 구조적 정적 검사 통과 대상이지 이미 원격 QA PASS라는 의미가 아니다.
- 필요한 다른 원본 문서의 영향/변경 불필요 판단은 아래 원래 기록을 보존한다.

- Required: `AGENTS.md` 모델 표/위험별 수동 승격, `docs/AGENT_CONFIGURATION.md` 과거 #347 대비 #831 정책, 두 Agent 활성 TOML 및 본 Packet, `docs/exec-plans/active/PLAN.md` 링크 — **변경 대상**.
- `DESIGN.md`/`docs/UI_UX_GUIDELINES.md`: UI 시각/컴포넌트 요구가 변경되지 않아 **N/A**. `README/ARCHITECTURE/API/DB_SCHEMA/SCHEDULING/IMPORT_SCHEMA/SECURITY/CI_CD/REMOTE_VALIDATION/QA_REVIEW_POLICY`: 제품 계약·검증 게이트·승인 방식 유지로 **N/A**. `CHANGELOG.md`/package version/lockfile: 애플리케이션 동작이 아닌 Agent 개발 운영 설정으로 **N/A**.
- `test lifecycle`/local 실행·원격 결과는 실제 소스와 분리해 보존. 고위험 설정의 exact-HEAD QA/Owner 승인 전 **MERGE_READY=BLOCKED**.

## 후속 수용 실증 (현재 NOT TESTED)
1. 새 Codex 세션에서 UI/Frontend의 실제 모델이 `gpt-6.1-terra`, effort `medium`으로 지정되는지 확인; 인식 실패·자동 대체·도구 미지원 기록.
2. 동종 UI 작업 10건 정도에서 모델/effort/token(가능 시)/재작업·첫 CI·Runner 실행시간을 Sol 기준과 비교. P1 이상 모델 연관 회귀 2건 등 악화 시 frontend 우선 Sol/medium으로 되돌리는 별도 PR 검토.
3. 정확 PR Head/새 main base/Required3/QA Final — Trusted 및 사용자 Owner 승인 검증 후만 병합. 그 전 정식 게시 및 이슈 종료 금지.
