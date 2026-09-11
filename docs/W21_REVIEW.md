# W21 Synchronized Gantt Workspace Review

검증일: 2026-09-12. 대상 version: `0.3.0`.

## Summary

Project 화면을 별도의 Demo 목록 없이 단일 SVAR Core의 좌측 계층 Task Grid와 우측 동기 Gantt Chart로 구성했다. 빈 일정에서도 작업공간을 렌더하고, 보호 Task API가 반환한 canonical snapshot으로 첫 Task가 reload 없이 Grid row와 Chart bar 양쪽에 나타난다. Project route는 viewport 폭과 높이를 사용하고 Project 설정·작업 관리는 접이식으로 축소했다.

Manager 기능·회귀 검증과 독립 qa_docs 재검증은 모두 PASS다. Blocking finding 없이 W21을 **Manager ACCEPT**로 판정한다.

## Requirement Coverage

| 범위 | 판정 | 증거 |
| --- | --- | --- |
| 빈 Grid+Chart | PASS | empty snapshot에서 14일 range와 `displayMode="all"` 렌더, Desktop/narrow Chromium |
| 생성 직후 양쪽 반영 | PASS | POST success 뒤 canonical taskId의 Grid text와 `.wx-bar` visible |
| 계층 Renderer | PARTIAL PASS | Summary/child `parent/open`와 snapshot 순서 unit PASS; 생성·reparent·WBS는 W08 BLOCKED |
| Desktop width/height | PASS | 1440×900에서 width > 1,000px, height 580px, max-width cap 없음 |
| Narrow 접근 | PASS | 390×844에서 Grid+Chart visible, focus·internal scrollLeft, document overflow 없음 |
| Authorization/persistence | PASS | native Add column 제외, 기존 form→session/If-Match/API→canonical recovery 유지 |

## Research Findings

- SVAR Grid와 Chart 동시 표시는 [`displayMode="all"`](https://docs.svar.dev/react/gantt/api/properties/displaymode/)이며 Grid 초기 폭은 [`gridWidth`](https://docs.svar.dev/react/gantt/api/properties/gridwidth/)로 지정한다.
- Grid/Chart 경계 Resizer는 Core 기본 UI다. [공식 Resizer guide](https://docs.svar.dev/react/gantt/guides/appearance/resizer/)
- Task hierarchy는 `id`, `parent`, Summary `type`과 `open`으로 표현한다. [공식 Tasks guide](https://docs.svar.dev/react/gantt/guides/tasks/)
- 서버 저장은 Core action API로 연결할 수 있지만 현재 Project의 Cookie·If-Match·canonical full snapshot 계약은 별도 gateway를 유지해야 한다. [공식 backend guide](https://docs.svar.dev/react/gantt/guides/load-and-save/save-to-backend/)

## Architecture Decisions

- Grid column은 작업, 외부 ID, 시작, 기간을 명시하고 native Add column은 제외한다.
- 서버 mutation과 error recovery는 W07의 보호 Task API/canonical snapshot 경계를 변경하지 않는다.
- Gantt outer region이 width·height·focus·overflow를 담당하고 inner surface는 45rem 최소 폭으로 두어 narrow viewport에서도 Core의 Grid+Chart를 유지한다.
- Summary scheduling, atomic hierarchy mutation과 WBS는 UI Renderer와 분리해 W08에서 구현한다.

## Verification

Manager가 Node.js 22.14.0 환경에서 실행했다.

| 검증 | 결과 |
| --- | --- |
| `npm run version:check` | PASS — `v0.3.0 (stable)` |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm test` | PASS — 24 files / 310 tests |
| `npm run build` | PASS — Next.js 16.3.4 Webpack production build |
| `npm run test:e2e` | PASS — Chromium 8/8, worker 1, isolated Turbopack/DB |
| 독립 qa_docs 재검증 | PASS — 동일 310 Vitest, Chromium 8/8, build/typecheck/lint/version/link/diff 검사 |
| `git diff --check` | PASS |

첫 sandbox 실행에서는 자식 Node process가 `EPERM`으로 차단되어 4개 process-bound test가 실행되지 못했다. 코드 실패로 처리하지 않고 허용된 정상 실행 환경에서 동일 전체 Vitest를 다시 실행해 310/310 PASS를 확인했다.

## Failures Resolved

- 최초 Project의 empty shortcut이 Gantt 자체를 숨기던 문제를 제거했다.
- 75rem content cap, 고정 38rem height와 항상 펼쳐진 설정/작업 form을 viewport 작업공간으로 변경했다.
- narrow 화면에서 SVAR min-content가 document를 1,427px까지 확장하던 문제를 outer containment/internal scroll로 격리했다.
- 별도 narrow E2E가 process-global Project create 5/hour 제한을 초과할 수 있어 기존 empty→create persistence workflow 안으로 합쳤다.

## Security and Regression

- W21 검증은 격리된 test DB를 사용했으며 Project URL, Cookie 또는 password를 검증 기록에 남기지 않았다.
- native local Add를 노출하지 않아 server-side authorization과 revision을 우회하지 않는다.
- 기존 direct Readonly, unlock/current/logout, password rotation, Task mutation rejection recovery, move/left resize/right resize/delete/reload 및 same-revision race가 전체 E2E에서 통과했다.
- API, DB migration, Scheduling Domain과 Docker workflow 계약은 변경하지 않았다.

## Remaining Risks

- 실제 Summary 생성·reparent·expand/collapse 저장, WBS와 Summary 계산은 W08 범위이며 이번 완료에 포함하지 않는다.
- Grid width를 사용자가 조절할 수 있지만 preference로 서버에 저장하지 않는다.
- Grid/Chart Resizer의 실제 pointer drag geometry는 이번 E2E에서 별도로 자동 조작하지 않았다.
- W21 이후 D04 정책 결정과 credential 재사용 위험 수용은 완료됐지만, usable GitHub 인증과 원격 설정 적용이 없어 최신 release 게시와 digest pull은 여전히 BLOCKED다.

## Recommendation

**W21 PASS / Manager ACCEPT.** 다음 Scheduling 구현은 W08 Summary/Hierarchy/WBS를 유지한다. 신규 Project 생성 E2E는 현재 process-global 5/hour 한도를 정확히 소진하므로 기존 Project 재사용 또는 별도 server isolation을 먼저 설계한다.
