# Issue #735 / PR #757 — 누적 PR CI 실패 분석

Primary Issue: [#735](https://github.com/planner77/masterGantt/issues/735) · PR [#757](https://github.com/planner77/masterGantt/pull/757) · 갱신일: 2026-10-20.
Source of truth: [PR CI 실패 원장 정책](PR_CI_FAILURE_TRIAGE.md), [Work Packet](exec-plans/active/ISSUE_735.md).

## 1. Run/Attempt 전체 목록

재개 시점 branch/event 조회의 전체 PR CI는 아래 1개이며 attempt1이다. 새 CI의 완료 모니터링은 요청 범위 밖이다.

| PR | Run / attempt / event | Head / base / test merge | Required 결과 | 원본 증거 |
| --- | --- | --- | --- | --- |
| #757 | [#3051.1 / 39408703783](https://github.com/planner77/masterGantt/actions/runs/39408703783) / 1 / pull_request | Head `abd410fc4fa1f87be3c7975d2fa960b36f8d8877`; base `8a0fc9773d33326b40f8d97f6307c17ae0cb6933`; merge `8c9c9c62e4fa38bdfba677ca4a197d2536aea602` | Quality SUCCESS, Docker SUCCESS, E2E FAILURE; Automated QA 파생 FAILURE | [직접 실패 Shard6](https://github.com/planner77/masterGantt/actions/runs/39408703783/job/118581617889), [E2E aggregate](https://github.com/planner77/masterGantt/actions/runs/39408703783/job/118589429808) |

| Shard | Job ID | 원본 결론 / 관측 |
| --- | --- | --- |
| 1 | 118581617893 | CANCELLED, 실제 테스트 FAIL 관측 없음 |
| 2 | 118581617922 | CANCELLED, 실제 테스트 FAIL 관측 없음 |
| 3 | 118581618000 | CANCELLED; 로그 summary107PASS, 실제 테스트 FAIL 관측 없음 |
| 4 | 118581618158 | CANCELLED, 실제 테스트 FAIL 관측 없음 |
| 5 | 118581617952 | CANCELLED; 로그 summary85PASS, 실제 테스트 FAIL 관측 없음 |
| 6 | 118581617889 | FAILURE; 90PASS / 1FAIL / 43 did not run, 테스트 실행18.6분 |

취소된 Shard1~5를 PASS로 세지 않는다. 관측하지 못한 테스트 결과는 미완료이며 summary의 일부 PASS가 Job 결론을 대체하지 않는다. 직접 실패 이후 E2E aggregate와 [Automated QA Job118589464493](https://github.com/planner77/masterGantt/actions/runs/39408703783/job/118589464493)의 `required e2e 미성공`은 파생 실패다.

## 2. 누적 실패 파일 및 Cross-run 매트릭스

| 실패 ID / 파일·case | 최초 실제 실패 | 원인·교정 | 같은 후보 재검증 / 잔여 위험 |
| --- | --- | --- | --- |
| F735-001 / `tests/e2e/project-task-context-menu.spec.ts:385` / Issue #390 Copy ID copies canonical taskId without changing TaskClipboard or revision | #3051.1 Shard6, 변환 후 `snapshot` GET (`:8:39`, 호출 `:413:19`)에서 `apiRequestContext.get: read ECONNRESET` | 직접 관측은 TRANSPORT 오류, 근인 분류 UNKNOWN. Copy ID 클릭 전 실패; 서버 종료/자원/제품 원인 확정 증거 없음. 테스트·제품·timeout·retry·단언 변경0 | 아래 §5의 원형 직접·음성 재실행. 로컬 재현 여부가 원격 FAIL을 소급 변경하지 않음 |

누적 실제 실패 파일 합집합은 `tests/e2e/project-task-context-menu.spec.ts` 1개다. 테스트 취소·미실행은 추가 검증 후보이며 새 실패 파일로 만들어 세지 않는다. 과거 로컬 #735 테스트 하네스/제품 focus 실패는 Work Packet의 기존 이력을 보존하며 원격 CI 실패와 구분한다.

## 3. F735-001 — 원본 사실과 증거

- Shard6 Job 시작 `2026-10-20T10:34:50Z`, 완료 `10:54:37Z`; 직접 오류 로그 시각 `10:54:28.1709251Z`. Step7 `E2E shard 실행`의 실제 GET 연결 종료다. 기대 HTTP200 전 응답 자체가 없었으므로 API 상태/데이터 불일치를 추정하지 않는다.
- `snapshot` helper는 원형 `page.request.get`을 한 번 호출한다. Summary 자식 생성·Milestone 변환 후 canonical snapshot을 읽는 구간이며 Copy ID 명령 실행 전이다. `fetch3초 timeout`의 GitCommitInfo 경고는 reporter 부수 로그, controlled error-boundary는 의도 probe이므로 직접 실패에서 제외했다.
- infra가 기존 Run의 6개 Shard 로그를 각각 단일 조회하여 다른 실제 테스트 FAIL을 찾지 못했다. 원문에는 session 자료가 포함되어 Git/Issue에 복사하지 않는다. 새로운 관측 없이 flaky/환경 문제로 확정하지 않는다.
- Artifact 메타데이터상16개 모두 expired=false. [Shard6 Playwright report12258469489](https://github.com/planner77/masterGantt/actions/runs/39408703783/artifacts/12258469489), [source12257504085](https://github.com/planner77/masterGantt/actions/runs/39408703783/artifacts/12257504085), [timing612259118832](https://github.com/planner77/masterGantt/actions/runs/39408703783/artifacts/12259118832), [QA12258509825](https://github.com/planner77/masterGantt/actions/runs/39408703783/artifacts/12258509825). 내용 다운로드/trace 분석은 NOT TESTED. Shard1~5 report는 없으며 timing3/5·setup1~6 존재를 결과 PASS로 사용하지 않는다.

## 4. 누적 분석과 이번 변경

- 이번 변경은 main `05f1e560eee456e6fba5535255c9ede30a357c16` 정렬이다. #733 Main Shard4 용량 사건의 기존 두 파일 재배치를 그대로 가져왔으며 F735-001 연결 종료의 해결책이라고 주장하지 않는다. 기존 실패 테스트/helper와 #735 제품·전용 테스트 변경0이다.
- 실패 파일의 생산자는 실제 Project/Task/구조 mutation과 snapshot GET, 직접 소비자는 Copy ID 정상 case, 음성 소비자는 clipboard write 거부 fallback이다. 두 case를 원형 그대로 선택했다. 같은 spec 나머지 Context Menu와 취소·미실행 전체 샤드는 새 Full PR CI에 유지한다. 원인 미확정 상태에서 관련 없는 제품·fixture·retry를 수정하지 않는다.
- 기존 #735 동결 source의132개 Unit/API,6개 전용 브라우저 및2개 인접 브라우저 PASS는 과거 로컬 증거다. manifest 동일성을 별도로 확인하고 새 Head 원격 PASS로 재사용하지 않는다. 이번 로컬 재실행은 아래 두 사례에 한정한다.

## 5. 같은 최종 source 검증과 새 CI 인계

- Node22.14.0 / Playwright1.63.0 / managed Chromium153.0.8010.12, 기존 test-scoped 격리 실제 서버·SQLite와 worker1/retries0. 원본 `tests/e2e/project-task-context-menu.spec.ts` SHA256 `e0c2208d1df1c0db39ef7d3824b69eded6dbe99abc81c600cb6a07c3e9d4aaf3`, fixture `e7f85ad48b4d80c882543278702706ab4b7b359467ea2296a8895fe2bbf871a5`.
- 실행 명령: `npx playwright test --config tests/config/playwright.config.ts tests/e2e/project-task-context-menu.spec.ts --project=chromium --workers=1 --retries=0 --max-failures=0 --grep 'Issue #390 Copy ID'`. 두 정상/음성 case를 선택하며 원형 timeout/단언을 유지한다. **2/2 PASS**, 총54.7초(정상17.7초/거부 fallback4.3초). 실행 전후 원본 spec/fixture hash가 동일하다. 로컬에서는 연결 종료가 재현되지 않았으며 GitHub runner/전체 Shard 환경에서의 근인 또는 해결은 증명하지 못했다.
- main 병합은 자동 병합 성공이며 두 Issue의 Changelog/TestPlan 내용과 최신 shard plan을 보존한다. EOF의 추가 빈 줄만 정리한다. 실제 CLI6회에서133개 spec이 정확1회 배정되고 shard counts `[23,23,23,22,21,21]`, #733→5/#726→6/#735→1이다. 누락/중복0. 새 #735 파일 때문에 main 단독132개와 다르다.
- 미해결 리뷰 스레드0, 독립 Agent 사전 검토와 DOC_SYNC는 새 인계 기록에서 확인한다. 새 Head Full CI는 게시 전 NOT TESTED이며 시작 후 URL/attempt/정확 Head는 Issue STATUS에 남긴다. Required3/Trusted QA·Owner ACCEPT/MERGE_READY는 NOT TESTED/BLOCKED다. 기존 Run FAIL과 근인 UNKNOWN을 보존한다.
