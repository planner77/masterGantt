# Issue #762 — 누적 PR CI 실패 분석

Primary Issue: [#762](https://github.com/planner77/masterGantt/issues/762) | 구현 [PR #779](https://github.com/planner77/masterGantt/pull/779) | 최초 기록: 2026-10-22 UTC
Source of Truth: [PR CI 실패 누적 분석 지침](PR_CI_FAILURE_TRIAGE.md). 과거 실패 Run을 덮어쓰거나 SUCCESS로 소급 변경하지 않는다.

## 1. PR / Run / Attempt 전체 목록

| 원장 ID | Run 및 event | Head / Base / Test merge | Required aggregates | 최초 오류·증거 |
| --- | --- | --- | --- | --- |
| F-001 | [#3150.1](https://github.com/planner77/masterGantt/actions/runs/39779367052), ID 39779367052, attempt 1, `pull_request.opened`, CI/FINAL_FULL, 2026-10-22 12:33 UTC | Head `752d1c464f8f2e7cf61b330e2bbb15c18a8dafbb` / Base `72c2c9d0a912dc906d4101ea41a7a57e0c686597` / Test-merge `9d295d4d56d58ea755e46f0780e5f1cc103bdbf9` | Quality PASS (119828278605), E2E FAIL (119832376573), Docker PASS (119829075135); QA Final FAIL 파생 (119832418392) | Shard 6, [Job 119827457118](https://github.com/planner77/masterGantt/actions/runs/39779367052/job/119827457118), [report/trace artifact](https://github.com/planner77/masterGantt/actions/runs/39779367052/artifacts/12426786845) |

- 같은 HEAD의 [FAST_DEVELOPMENT #15.1](https://github.com/planner77/masterGantt/actions/runs/39779366938)은 `skipped`이며 Full/Required의 대체 증거가 아니다.
- 이 문서 최초 작성 시 #762를 귀속시킨 열린 PR은 #779 한 개이고, 조회 가능한 Full CI는 F-001 한 번이다. 이슈 #726의 별도 역사적 실패는 본 이슈 Run 수에 포함하지 않는다.

## 2. F-001 — 실제 최초 실패와 파생 취소

- **실제 실패:** Shard 6/8의 `tests/e2e/issue-726-task-logistics.spec.ts:234`, 테스트 `#726 Task 공정 0..N·WorkArea self/subtree 원본 연결, 초안·오류 보존과 상위 출처 구별`. 검증 위치 `:327`의 `expect(locator).toBeEnabled()`, 5초 경과 후 `element(s) not found`. 기존 선택기 `/A 작업구역 WA-A/`는 해당 체크박스를 찾지 못했다.
- **직접/파생 분리:** Shard 6 job ID 119827457118 FAIL, 실행 결과 36 PASS / 1 FAIL / 54 NOT RUN(91 cases, `--max-failures=1`). Shards 1/2/3/4/5/7/8 각각 jobs 119827457075 / 119827457138 / 119827457000 / 119827457196 / 119827457113 / 119827457156 / 119827457202 `CANCELLED`. 일곱 로그에서 별도 Playwright `✘`/assertion 실패는 관측되지 않았으나 완료 PASS도 아니다. E2E aggregate FAIL 및 QA Final `required e2e 미성공`은 같은 최초 실패에 따른 파생 결과이다.
- **정상 Job:** Changes, QA Preflight, Policy, Vitest, TypeScript, ESLint, PR Fast Gate, Next.js Build, Docker Smoke, Required Quality·Docker 모두 SUCCESS. 정책/빌드/이미지 환경 자체가 최초 실패라는 증거는 없다.
- Shard 6의 `GitCommitInfo: timeout of 3000ms ... git fetch` 경고 후 테스트가 37번 case까지 진행됨. 비검증 외부 fetch 진단을 UI checkbox 실패의 원인이나 임의 timeout/재시도 확대 근거로 승격하지 않는다. Playwright report의 `1 error was not a part of any test`는 정식 원인 불명으로 분리한다.
- 해당 실패 시점의 원본 CI/Artifact, 완료/취소 상태는 불변이며, 신규 HEAD CI 시작 직전까지 수정 후 원격 결과는 `NOT TESTED`이다.

## 3. 원인 분석 · 전체 실패 매트릭스

| 실패 ID / 영향 파일 | 원본 증거와 분류 | 이전 이력 대조 | 수정 후 확인/남은 위험 |
| --- | --- | --- | --- |
| F-001 · `issue-726-task-logistics.spec.ts`의 legacy WorkArea 선택 5곳 | **TEST_CONTRACT**: #762가 화면 label을 `A 작업구역 · 기존 공유 구역 WA-A`로 정확히 확장했지만 테스트는 이전 `A 작업구역 WA-A`를 찾음. `element(s) not found`는 선택·저장 API 실패의 직접 증거가 아님. | [#726 원장](ISSUE_726_FAILURE_ANALYSIS.md)의 과거 F-001은 UUID 배열 정렬 계약으로, 동일 증상/동일 원인이 아니다. 신규 #762 원격 Run은 F-001만 조회됨. | 명시적인 shared legacy label + 안정된 코드 전체를 검증하는 한 개 locator helper로 5 호출 수정. 원격 동일 케이스·소비자 회귀 아직 NOT TESTED. |

- **근거 교차:** `tests/e2e/fixtures/target-project.ts`가 A occurrence 아래 `A 작업구역`/`WA-A` 전역 구역을 작성하여 A 공정에 명시 매핑한다. `src/server/repositories/project-work-area-repository-core.ts`는 이 mapping을 `source: "legacy"` 읽기 alias로 반환한다. `src/features/logistics/project-workarea-options.ts`와 `src/features/gantt/task-process-context-editor.tsx`는 기존 WorkArea ID/owner를 유지하면서 legacy label에 ` · 기존 공유 구역`을 추가한다. 구 ID 삭제·사라진 체크박스·사용 불가 판정은 확인되지 않았으며 성공된 실 DB 동작과 다른 추론은 금지한다.
- **보완:** E2E test 내부 `legacyArea()` helper는 `/^A 작업구역 · 기존 공유 구역 WA-A$/`와 `getByRole("checkbox")`를 사용하여 기존 이름·기존 공유/읽기 alias 구별·정확 코드 확인을 함께 보존한다. 이전 선택기 5곳을 교체하며, 시간 증가·skip·retry·UI marker 제거·원본 DB/DTO 변경 없이 기존 저장·원자성·권한·Task/Summary/5폭 assertion을 유지한다.
- **교차 검증 대상:** 같은 #726 3개 Task/Equipment 케이스, #725의 직접/기존 공정 구역 매핑, #762 신규 실제 HTTP/SQLite/Task·설비 소비자, #730/#733 WBS drill, legacy/default/active/foreign-owner/error cases. 이번 수정은 테스트 선택기만이고 나머지 원격 취소 사례는 새 Full8 CI로 검증한다. 프론트엔드/DB 영속성과 보안·음성 검사는 기존 coverage를 약화시키지 않는다.

## 4. 변경 후보 검증·안전 경계

- 변경 경로: `tests/e2e/issue-726-task-logistics.spec.ts`, 이 원장, `docs/exec-plans/active/ISSUE_762.md`. 제품 코드는 그대로; `AGENTS.md`/`DESIGN.md`/`CI_CD.md`/`TEST_PLAN.md`의 정책·UI 원칙은 변경하지 않아 N/A.
- **한정 정적 검사 PASS:** 오리지널 패턴 정확 5곳 발견/5곳 전부 교체; 새 label은 정규식 매칭, 구 label·다른 code·다른 owner label은 거절. 이 검사는 브라우저·HTTP·SQLite 실행이 아니며 **Playwright, Unit, TypeScript, ESLint, 로컬 Pre-PR의 새 후보 HEAD는 NOT TESTED**이다.
- 신규 HEAD에서 [`issue-726-task-logistics.spec.ts`](https://github.com/planner77/masterGantt/blob/feat/issue-762-process-workarea/tests/e2e/issue-726-task-logistics.spec.ts) 와 #725/#762 직접/legacy 소비자 및 FULL8을 원격 CI로 검증한다. 기존 #3150.1의 실패·취소를 PASS로 취급하지 않는다.
- PR #779 review thread **0**, inline review comment **0**, review **0** 확인. 첫 재작업 직전 main `72c2c9d0a912dc906d4101ea41a7a57e0c686597`와 PR head 동일 merge base, ahead 1 / behind 0, `mergeable=true`; 충돌 없음. 새 HEAD에서 재점검한다.
- Risk HIGH, QA OWNER_MANAGED, independent QA N/A, Owner risk ACCEPT **NOT TESTED**, `release_required=true`, `release_authorized=false`; 새 PR CI는 전체 Required3/Trusted QA/Owner·Main/Release의 대체가 아니며 이번 요청은 새 PR CI 시작까지만이다.

## 5. 다음 Run 기록 규칙

- 새 한정 수정/원장/Work Packet 단일 HEAD SHA와 PR `synchronize` 이벤트의 새 Run ID/Attempt는 검증 확인 뒤 아래에 추가한다. 검증 시작과 성공은 구별한다. 추가 실패 시 F-002부터 동일 문서에 누적하며 원래 F-001을 수정·삭제하지 않는다.
