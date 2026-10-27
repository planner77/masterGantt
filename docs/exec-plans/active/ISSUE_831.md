# Issue #831 — GPT-6.1 Terra Agent 모델 라우팅 Work Packet (2026-10-27)

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
- Required: `AGENTS.md` 모델 표/위험별 수동 승격, `docs/AGENT_CONFIGURATION.md` 과거 #347 대비 #831 정책, 두 Agent 활성 TOML 및 본 Packet, `docs/exec-plans/active/PLAN.md` 링크 — **변경 대상**.
- `DESIGN.md`/`docs/UI_UX_GUIDELINES.md`: UI 시각/컴포넌트 요구가 변경되지 않아 **N/A**. `README/ARCHITECTURE/API/DB_SCHEMA/SCHEDULING/IMPORT_SCHEMA/SECURITY/CI_CD/REMOTE_VALIDATION/QA_REVIEW_POLICY`: 제품 계약·검증 게이트·승인 방식 유지로 **N/A**. `CHANGELOG.md`/package version/lockfile: 애플리케이션 동작이 아닌 Agent 개발 운영 설정으로 **N/A**.
- `test lifecycle`/local 실행·원격 결과는 실제 소스와 분리해 보존. 고위험 설정의 exact-HEAD QA/Owner 승인 전 **MERGE_READY=BLOCKED**.

## 후속 수용 실증 (현재 NOT TESTED)
1. 새 Codex 세션에서 UI/Frontend의 실제 모델이 `gpt-6.1-terra`, effort `medium`으로 지정되는지 확인; 인식 실패·자동 대체·도구 미지원 기록.
2. 동종 UI 작업 10건 정도에서 모델/effort/token(가능 시)/재작업·첫 CI·Runner 실행시간을 Sol 기준과 비교. P1 이상 모델 연관 회귀 2건 등 악화 시 frontend 우선 Sol/medium으로 되돌리는 별도 PR 검토.
3. 정확 PR Head/새 main base/Required3/QA Final — Trusted 및 사용자 Owner 승인 검증 후만 병합. 그 전 정식 게시 및 이슈 종료 금지.
