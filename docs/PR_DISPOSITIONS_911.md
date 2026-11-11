# Issue #911 — 기존 PR 개별 처리 감사와 제안

감사 기준 main: `8eaaaaa2b7b9a24e2b4a72e7d81698217da5cf2d`. GitHub read-only 조회 시각: `2026-11-11T09:53:58.409467+00:00`. 대상 7개는 최초 조회 시점 `OPEN / merged=false`였고 이후 Owner 승인에 따라 Manager가 각각 미병합 종료했다. **Owner APPROVED / 7개 CLOSED·merged=false**다. 종료 시각·댓글·Head 재조회와 #847 ref 복구 예외는 아래 실제 처리 결과에 보존한다. 제품 코드 이식·merge·Actions 실행으로 오인하지 않는다.

현재 [Issue Lifecycle](ISSUE_LIFECYCLE.md)과 [GitHub 운영](GITHUB_OPERATIONS.md)은 위험도와 관계없이 No PR/No Actions다. 기존 PR에 제품 변경이 있으면 그 요구를 별도 로컬 단위로 보존하며, 과거 CI나 PR 종료를 제품 완료 근거로 쓰지 않는다.

## 감사 시점의 개별 분류와 Owner가 승인한 제안

| PR | 분류 / 연결 Issue | 현재 source 대조 | Owner 개별 처리 제안 |
| --- | --- | --- | --- |
| [#904](https://github.com/planner77/masterGantt/pull/904) | 제품 미반영 / 후속 보존 필요; #898 / #899 OPEN | 23파일(+694/-21), src 6개·test 3개. explorer의 base/main 비교에서 기존 경로는 PR base와 동일 bytes이고 신규 reveal module/test는 main에 없다. 기존 Full Run 42650331893은 cancelled, Fast 42650331953은 skipped다. | 두 제품 Issue를 OPEN으로 보존하고 정확 Head·branch를 새 No-PR 로컬 재작업으로 인계한 후, Owner가 이 PR의 미병합 종료를 개별 결정한다. version 0.145.2나 옛 지침을 운영 변경에 그대로 채택하지 않는다. |
| [#847](https://github.com/planner77/masterGantt/pull/847) | 퇴역 CI 전용; 명시적 제품 Issue 없음 | 14개 .github/workflows 파일의 full-SHA Action pin 교체만 있다. 앱·Docker·DB·로컬 Gate 코드는 없다. | 현재 모든 Actions 미사용 정책에 따라 미병합 종료를 제안한다. 과거 workflow/Run과 Head는 보존하고 pin 업데이트를 현재 로컬 도구 갱신으로 오인하지 않는다. |
| [#859](https://github.com/planner77/masterGantt/pull/859) | 퇴역 CI 계획 전용; #437 CLOSED | tests/config/e2e-shard-plan.json 한 파일의 8-shard timing/LPT 배치 갱신이다. sourceRunIds/16-run 통계는 과거 원격 실행 집합이며 현재 로컬 Gate의 실행 근거가 아니다. | 미병합 종료를 제안한다. 후보 JSON을 현재 main에 이식하거나 실제 테스트를 삭제하지 않는다. 현재 main의 기존 계획/원격 실패·측정은 역사 자료로 보존한다. |
| [#721](https://github.com/planner77/masterGantt/pull/721) | 문서 정책 후보 / 제품 미구현; #720 OPEN | 5개 Markdown만 수정했다. /manual route·화면 매뉴얼 icon/registry/content는 PR에도 없고 현재 main에도 구현 근거가 없다. main의 PROJECT_UX도 #720 미완료를 명시한다. 옛 동일 PR 문서 규칙은 새 No-PR 정책과 맞지 않는다. | 원본 설계 요구와 Head를 보존해 #720의 최신 화면/로컬 구현 계획으로 인계한 뒤 legacy PR만 미병합 종료하는 방안을 제안한다. #720 제품 완료/종료로 처리하지 않는다. Owner 개별 결정 전 PR은 OPEN 유지한다. |
| [#563](https://github.com/planner77/masterGantt/pull/563) | 이전 제품/테스트 보완이 최신 설계로 대체됨; #552 CLOSED | 27경로이며 project-gantt.tsx 실제 2개 hunk를 포함하므로 CI-only가 아니다. canonicalMilestone helper는 현재 main에 더 최신 화면 진입·정확 ID 검색으로 존재하고 canonical consistency/viewport authority도 별도로 진전했다. ISSUE_552 Packet 464/531행은 이 이전 branch를 그대로 병합/복제하지 말도록 기록한다. | 최신 #552 main/source·기존 원본 실패를 보존하고 superseded 보완 PR의 미병합 종료를 제안한다. 27개 patch 전체가 동일 bytes로 main에 반영됐다고 주장하지 않는다. 남은 재현이 발견되면 현재 source의 별도 회귀로 처리한다. |
| [#395](https://github.com/planner77/masterGantt/pull/395) | 실제 runtime 공급망 변경 / 미채택; 직접 연결 제품 Issue 없음 | Dockerfile의 builder/runtime FROM 2개를 node:26-bookworm-slim digest cd9f682...에서 662933c...로 바꾼다. 현재 main은 두 stage 모두 원래 cd9 digest다. 따라서 CI-only나 이미 반영된 변경이 아니다. | 새 로컬 runtime-security 재평가 Issue에 현재 base/정확 candidate digest·native SQLite/빌드/런타임 검증을 연결하고, 그 인계/미채택 범위를 Owner가 승인한 후 legacy PR 종료 여부를 결정한다. 이번 #912/#909 운영 변경에서 FROM을 몰래 바꾸지 않는다. |
| [#259](https://github.com/planner77/masterGantt/pull/259) | POC 미채택 / Issue가 NOT PLANNED로 종료됨; #253 CLOSED / NOT PLANNED | 14경로의 POC fixture/spec·측정 JSON/PNG·문서·esbuild devDependency 변경이다. 현재 main에 POC 파일/이미지는 없고 이 Head는 main ancestor가 아니다. #253의 2026-10-31 감사는 alignment FAIL로 Core-only Chart Overlay 미채택을 명시한다. | 미채택 실험 PR의 미병합 종료를 제안한다. 원본 Head/POC 측정·FAIL 및 미검증 범위는 PR/Git 객체로 보존하며 제품 Overlay 구현이나 POC PASS로 승격하지 않는다. |

## 보존하는 정확한 원본

아래 base는 PR metadata snapshot의 base SHA이며 감사 기준 main과 구분한다. Head/branch 원본을 보존하고 자동 merge·rebase·Dependabot 명령 댓글·head 삭제를 하지 않는다.

| PR | Head SHA | PR base SHA | branch |
| --- | --- | --- | --- |
| #904 | `ccb7cd4f997c733a88c2e105a8a7df6a3dc3b75e` | `4aad8865972e3446f0d34c7ffcfd2bbab439e366` | `fix/issue-898-899-gantt-input-reveal` |
| #847 | `0f4aa289cf7183234a70bfca8d29d3063d209dcf` | `8ae8413d00d50f476f8f377fe207effa70c23195` | `dependabot/github_actions/github-actions-0bec04b71f` |
| #859 | `b5e84f213ceff127e483fe05f35fa88afdc3b8fa` | `fe56cc6b97f0850c316fcbf6bbc2e1ccdfca79bc` | `ci/issue-437-e2e-shard-plan-40976565481` |
| #721 | `aa5df41ff4bd1940a3b68d9ff08f73f64da680b6` | `d2768676aa7a0edff67df9bdeb3e1b49979fd577` | `docs/issue-720-contextual-web-manual-policy` |
| #563 | `1879d9aa08091d0806878fb3095b53705e9da53f` | `6fea0397bc07d0c3adf2d769f9ba6829473503a2` | `fix/issue-552-ci-milestone-e2e` |
| #395 | `6046e214fe1680dd70dee7f91b7717c11013038b` | `31907bc3ff09266067c310f9ed406c002989cd8b` | `dependabot/docker/deploy/docker/node-662933c` |
| #259 | `1274f5aa208702b0623282e628c750a76cc04e57` | `e12a52a9ca5c1f06281e1cc07ffb5db540b25e66` | `feat/issue-253-baseline-overlay` |

## diff 출처와 범위

GitHub connector의 전체 변경파일 목록과 filename/patch 배열을 읽기 전용으로 보관했다. 아래 digest는 해당 배열을 `ensure_ascii=false`, `separators=(',',':')` UTF-8 JSON으로 직렬화한 SHA256이다. binary PNG bytes는 patch에 없으므로 원본 Head/tree의 blob을 별도로 보존하며 이 digest가 binary 내용까지 검증한다고 주장하지 않는다.

| PR | 변경 경로 수 | filename/patch JSON SHA256 |
| --- | ---: | --- |
| #904 | 23 | `a726a5be15b81c7daca439bf29618c343c85fcf127ba74acbf36271096efbec6` |
| #847 | 14 | `b452e76e1643cf0757e4911f4289bde4336b1bab799673182956db968708ed81` |
| #859 | 1 | `8586dba4b4428833a3d23a108a79003b1ada499f4228cda800b2596620e8aa22` |
| #721 | 5 | `41e8fcf1d5fe122e820a97d458a71ae5b60ff79362ab8fad9d292324687c9b0f` |
| #563 | 27 | `52655e12995c11ec9cb7f0fd7c54ae41826fa5ee81de7acc2d617632b8608cea` |
| #395 | 1 | `ae674795156e71815d93edebd7b7b3eae2d81cf6889341728e9a7566a11371ad` |
| #259 | 14 | `562e9dc5ca05c7243f2c928d6a3c0354ab3649ea9c3b6433ec00ac158e5f7152` |

로컬 원본은 ignored `.prepr-reports/pr-dispositions-911/all-seven-pr-audit.json`과 `seven-pr-summary.json`에 있다. 공개 문서에는 정제한 SHA·경로·판단 근거만 기록하며 비공개 운영 정보·credential·DB를 담지 않는다. #904의 코드 의미/byte 대조는 별도 `/root/pr_904_audit`의 read-only 결과를 사용했다. 이 감사에서 PR 코드를 checkout·실행하거나 제품 테스트 PASS를 새로 만들지 않았다.

## 적용과 재검증 경계

1. Owner는 각 PR의 제안/미채택/후속 요구를 개별 결정한다. 특히 #395의 runtime 갱신과 #721/#904의 미구현 제품 요구를 CI-only로 묶지 않는다.
2. Manager는 정확 Head·결정·인계 Issue를 #911에 기록한 뒤 승인 범위에서 legacy PR을 개별 수동 처리한다. 새 Head나 변경 범위가 생기면 stale로 보고 다시 대조한다.
3. 종료하더라도 merged=false, 원본 실패·미검증·관련 제품 Issue 상태와 원본 commit을 보존한다. CI/Actions 재활성·무검증 제품 반영·일괄 branch 삭제는 하지 않는다.
4. 이 문서의 제안만으로 #911/#905 완료나 기존 제품 Issue 종료를 주장하지 않는다. 실제 변경 결과·Owner 결정 링크는 이후 별도 append한다.

## Owner 개별 결정 요청 당시 기록

Manager가 [#911 개별 제안 댓글](https://github.com/planner77/masterGantt/issues/911#issuecomment-6792743534)로 일곱 건의 처리 방안을 제시했다. 요청 당시에는 응답 대기였으며 이 댓글 자체를 승인 또는 PR 종료 증거로 사용하지 않았다. 이후 Owner 결정은 아래에 따로 기록하고 실제 실행 결과는 정확한 Head와 함께 추가한다.

## Owner 결정 당시 / 실행 전 기록

Owner가 `제안대로 이관·개별종료`를 명시 승인했다. #911 공개 제안 댓글 `6792743534`의 일곱 건을 각각 처리하는 승인이다. #395는 새 로컬 runtime-security 재평가 Issue를 먼저 만들고, #904의 #898/#899와 #721의 #720은 OPEN으로 보존·인계한다. 나머지는 위 분류에 맞춰 원본 실패/미채택/후속 요구를 보존한다.

Manager가 원본 Head/branch 보존과 개별 설명·종료를 실행하기 전까지 실제 상태는 NOT APPLIED다. 이 승인으로 product 변경을 merge·cherry-pick하거나 baseline Node digest를 갱신하지 않으며 branch/head를 삭제하지 않는다. 실제 후속 Issue 번호·PR별 API 결과는 아직 추측해 적지 않는다.

## #395 후속 요구 등록

Manager가 [#914 로컬 runtime-security 재평가](https://github.com/planner77/masterGantt/issues/914)를 등록했다. 기존 PR #395의 정확한 candidate와 source를 보존한 인계이며 Node base를 이미 갱신했거나 검증 완료했다는 뜻이 아니다. #898/#899/#720과 함께 후속 요구는 OPEN으로 보존한다. PR별 종료 여부는 실제 API 실행·재조회 증거를 따른다.

## 실제 개별 처리 결과

Manager는 승인된 제안에 따라 다음 PR에 각각 설명 댓글을 남기고 종료한 뒤 API를 재조회했다. 모두 `state=closed`, `merged=false`이고 원본 Head는 위 보존 표와 일치한다. #898/#899/#720/#914는 별도로 OPEN임을 재조회했으며 제품 기능·Node base를 main에 반영하지 않았다.

| PR | 실제 종료 시각(UTC) | 개별 결정 댓글 | 재조회 |
| --- | --- | --- | --- |
| #904 | `2026-11-11T10:17:59Z` | [결정 6793192038](https://github.com/planner77/masterGantt/pull/904#issuecomment-6793192038) | CLOSED / merged=false / 원본 Head 일치 |
| #847 | `2026-11-11T10:18:05Z` | [결정 6793193616](https://github.com/planner77/masterGantt/pull/847#issuecomment-6793193616) | CLOSED / merged=false / 원본 Head 일치 |
| #859 | `2026-11-11T10:18:10Z` | [결정 6793195510](https://github.com/planner77/masterGantt/pull/859#issuecomment-6793195510) | CLOSED / merged=false / 원본 Head 일치 |
| #721 | `2026-11-11T10:18:15Z` | [결정 6793197093](https://github.com/planner77/masterGantt/pull/721#issuecomment-6793197093) | CLOSED / merged=false / 원본 Head 일치 |
| #563 | `2026-11-11T10:18:20Z` | [결정 6793198727](https://github.com/planner77/masterGantt/pull/563#issuecomment-6793198727) | CLOSED / merged=false / 원본 Head 일치 |
| #395 | `2026-11-11T10:18:26Z` | [결정 6793200669](https://github.com/planner77/masterGantt/pull/395#issuecomment-6793200669) | CLOSED / merged=false / 원본 Head 일치 |
| #259 | `2026-11-11T10:18:31Z` | [결정 6793202318](https://github.com/planner77/masterGantt/pull/259#issuecomment-6793202318) | CLOSED / merged=false / 원본 Head 일치 |

원본 실행 영수증은 ignored `.prepr-reports/pr-dispositions-911/closure-receipts.json`이다. local archive ref와 PR ref로 일곱 source Head를 보존했다. 원격 branch의 관측·복구는 다음 예외와 구분하며 처음부터 모든 원격 ref가 불변이었다고 주장하지 않는다.

### #847 원격 ref 일시 누락과 create-only 복구

종료 뒤 원격 ref를 점검할 때 `dependabot/github_actions/github-actions-0bec04b71f`가 없었다. 삭제 actor는 확인하지 않았으며 특정 bot·Owner·도구의 동작으로 추정하지 않는다. 다른 여섯 branch는 조회 시 원본 SHA와 일치했다. #847 source commit은 local archive와 PR ref에 계속 있어 유실되지 않았다.

Manager는 `2026-11-11T10:21:16.308889Z`~`10:21:17.336553Z`에 없던 ref를 `POST create-only git/ref`로 `0f4aa289cf7183234a70bfca8d29d3063d209dcf`에 복구했다. 기존 ref를 갱신하거나 force push·삭제하지 않았다. 복구 후 일곱 원격 branch가 원본 SHA에 있음을 확인했다. 일시 누락의 최초 관측과 복구를 영수증의 `refRestorations`로 남기며 처음 관측의 null을 숨기거나 원본 실패/상태를 바꾸지 않는다.
