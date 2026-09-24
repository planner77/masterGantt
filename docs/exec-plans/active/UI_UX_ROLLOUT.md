# UI/UX 이슈 순차 실행 계획

요청: 원격 UI/UX 이슈를 Issue Lifecycle에 따라 단계별 처리하고 변경본을 로컬 Docker로 제공한다. **Issue #30은 제외**한다.

## 기준과 범위

- 2026-09-24 착수 기준: 원격 main `69fa36aac486bf81bd247595cc0ab2bfbbc8982a`, version `0.27.0`, 열린 PR 없음. 현재 main과 검증 상태는 아래 완료 증거를 따른다.
- 2026-09-24 08:01:35 UTC 원격 갱신: GitHub 이벤트에서 `planner77` 계정이 PR #144를 병합해 main이 `e91bcff22a6e087b510d5706c2e71a75c47ad92f` / application `0.27.2`로 이동했다. 이 작업에서 병합을 실행하지 않았다. [새 main run 35972848516](https://github.com/planner77/masterGantt/actions/runs/35972848516)의 quality/e2e/docker와 임시 GHCR 게시·검증·정리 job은 모두 PASS다. 임시 `ci-e91bcff22a6e087b510d5706c2e71a75c47ad92f` exact digest `sha256:02b24fac87e655c3506890f1edccffe12ff40b4d374fd876136ec7d22a4553ad` pull·policy/API/인증/재시작/HTTP·HTTPS smoke·SBOM/provenance·임시 package version 삭제까지 독립 로그 확인했다. 아래 #155 작업 packet의 `f7f18ee…`는 착수 기준 SHA다.
- 착수 시 열린 대상: #115, #116, #117, #118, #119, #121, #122, #130. 이후 열린 UI/UX 관련 #136, #138, #140, #141, #142, #155도 원격 Issue 본문을 확인해 순서에 추가했다. #115는 종료됐고 #30은 요청대로 제외한다. #149는 Agent 운영 지침, #157은 운영 Compose/GHCR 정책 이슈이므로 이 UI/UX 실행 순서와 분리한다.
- #120/PR #135 공통 semantic token은 기존 결과를 재사용한다.
- 독립 감사에서 #120이 `release_required=true / release_authorized=false`인 채 종료된 불일치를 확인해 재개했다. #120 코드는 이후 `v0.27.1` image에 포함됐지만 #115의 게시 승인을 #120 Lifecycle 승인으로 소급 적용할 근거는 확인되지 않았다. #120은 열린 상태로 범위·승인·증거를 별도 판단한다.
- 기준: [Issue Lifecycle](../../ISSUE_LIFECYCLE.md), [디자인](../../../DESIGN.md), [UI 지침](../../UI_UX_GUIDELINES.md), [원격 검증](../../REMOTE_VALIDATION.md).
- 최신 승인 범위는 구현·테스트 계획·문서 동기화·PR 생성·해당 head의 CI **시작 확인**과 로컬 확인용 Docker다. 각 Issue는 이 지점에서 다음 Issue로 넘어간다. CI 완료·실패 수정은 후속 재작업으로 기록하고 병합/main 검증은 보류한다. 정식 릴리스는 `release_required=미확정`, `release_authorized=false`이며 tag/정식 GHCR 게시 전에 범위를 확정한다. 미확정을 N/A 또는 전체 완료로 표시하지 않는다.

## 순서

| 단계 | 목표 | 현재 상태 |
| --- | --- | --- |
| #115 | 캘린더 draft와 미리보기 대응, 실패·revision 변경 처리 | PR/main/정식 `v0.27.1` CI·GHCR digest PASS, 안전한 branch 삭제 확인, Issue closed; 본문 AC checkbox 동기화는 별도 확인 |
| #116 | 작은 화면·높이의 계층 메뉴 경계 및 키보드 보존 | PR #144 최종 head `3bf5e73f`의 [CI 성공](https://github.com/planner77/masterGantt/actions/runs/35970926248) 뒤 `planner77` 계정이 main `e91bcff2`로 병합; Issue #116은 open, main CI/임시 GHCR exact digest smoke·cleanup PASS, 후속 PR ancestry 별도 확인 필요 |
| #117 | 리소스 조회 실패 시 이전 결과·부분 실패·재시도 구분 | PR #145 다섯 번째 head quality/docker PASS, e2e 82 PASS / 1 FAIL(상위 #116 메뉴 위치); 자체 명세 4건 PASS, 상위 변경 동기화·재검증 필요 |
| #118 | 모바일/태블릿 도구 모음 밀도와 정보 버튼 개선 | PR #146 두 번째 head quality/docker PASS, e2e 86 PASS / 1 FAIL(상위 #116 구버전 Add 상태); 자체 4폭 명세 PASS, 상위 PR 재검증 필요; 구현 전후 높이 실측 NOT TESTED |
| #119 | 반복 입력의 대상 구분·필드 오류 연결 | PR #147 quality/docker PASS, e2e는 상위 실패를 포함해 FAIL; 자체 변경 정적 QA PASS |
| #121 | App Shell 본문 바로가기 | PR #148 최신 head quality/docker PASS, e2e 94 PASS / 7 FAIL(상위 실패); 자체 skip-link 390/1440 PASS, 누적 head 전체는 FAIL |
| #122 | 상세 7건 인수 기준·증거 감사 및 tracker 정리 | 현황 감사와 Issue 댓글 완료; 7건 전체 AC 미완 |
| #130 Phase 1 | Project List 디자인 정합화 | PR #150 Row More 경합 REWORK 정적 QA PASS, 새 head `ec412966`의 Actions run 0개·선행 branch 충돌로 새 CI NOT TESTED; 이전 head CI 시작 이력은 있음, 전후 실측 NOT TESTED |
| #130 Phase 2 | Project Workspace 디자인 정합화 | 로컬 수정·정적 QA PASS, PR #152 quality/docker PASS, e2e 94 PASS / 10 FAIL(선행 실패 포함); 자체 2건 PASS |
| #130 Phase 3 | Task Editor 디자인 정합화 | 로컬 수정·독립 정적 QA PASS, PR #153 quality/docker PASS, e2e 96 PASS / 9 FAIL(선행 실패 포함); 자체 1건 PASS, 전후 실측 NOT TESTED |
| #130 Phase 4 | Search / Filter 공통 시각·상태 정합화 | PR #154 첫 head quality/docker PASS·e2e 96 PASS / 11 FAIL; Phase 4 명세 2곳 REWORK 정적 QA PASS, 새 head `89198288804ec68d453fa96f08907a7df45e34f5`의 [CI run](https://github.com/planner77/masterGantt/actions/runs/35971567049)은 quality/docker PASS·e2e 97 PASS / 10 FAIL; 상위 실패 별도 기록 |
| #155 | Grid/Chart 전체 화면 버튼·단축키·상태 보존 | 설계·독립 정적 QA PASS, [PR #156](https://github.com/planner77/masterGantt/pull/156) head `063a81f53d2beb1bddc692bf9ec3bd54c6e6698d`의 [CI run](https://github.com/planner77/masterGantt/actions/runs/35973400077)은 quality/docker PASS·e2e FAIL; 전체 회귀와 최종 QA 미완 |
| #136 | 공통 헤더 브랜드 옆 빌드 버전 표시 | 다음 작업. #155 branch 위에 별도 PR; 패키지 버전 단일 Source of Truth, 4폭 헤더·홈 링크·접근성 검증 |
| #141 | 파비콘과 프로젝트별 브라우저 타이틀 | #136 PR/CI 시작 후. 프로젝트명 변경·직접 URL·비프로젝트 화면 복원 검증 |
| #138 | 프로젝트 상태 저장·표시·다중 필터 | #141 PR/CI 시작 후. #130 List/Filter 구조 재사용; SQLite migration·API·revision·readonly·기존 데이터 보존 필요 |
| #140 | Grid Task/Summary/Milestone 이름 인라인 편집 | #138 PR/CI 시작 후. SVAR Core 편집 기능·권한·기존 Task update 경로 확인 필요 |
| #142 | Chart 날짜 셀 범위·Milestone 중앙 정렬 | #140 PR/CI 시작 후. 실제 timeline cell 좌표와 zoom/scroll·drag/resize 회귀 확인 필요 |

원래 완료 경로는 설계 → branch → 구현/관련 테스트 → DOCUMENTATION_SYNC → 독립 QA → PR quality/e2e/docker → Manager 병합 판단 → main CI/임시 GHCR exact digest smoke/SBOM/provenance/cleanup → 로컬 Docker 확인 → 인수 기준 감사 → 안전한 branch 정리/Issue 종료다. 필요한 릴리스의 범위/승인은 종료 전 확정한다. 아래 최신 사용자 범위 변경에 따라 이 작업은 후속 이슈의 PR/CI 시작까지만 순서대로 진행하고 나머지 gate를 보류한다. #136 이후에는 앞 이슈의 PR head를 다음 이슈의 branch base로 하는 직렬 stacked PR을 사용하되, 현재 main과 선행 PR의 ancestry/CI를 별도 증거로 판정한다. PR #144의 외부 병합 사실과 이 작업의 승인 범위는 구분한다.

## 2026-09-24 작업 범위 변경

사용자가 처음에는 남은 UI/UX 이슈를 **수정까지만 진행하고 테스트·PR·CI는 실행 준비만** 하도록 지시했다. 이후 **테스트 계획 수립과 PR·CI 생성까지** 범위를 넓혔다. 최신 지시는 **각 Issue의 PR을 열고 해당 head의 CI가 시작된 것까지만 확인한 뒤 다음 Issue로 이동**하는 것이다. 이에 #116부터 기존 순서대로 코드·관련 문서·실행 가능한 테스트 자료를 준비한다. 로컬 테스트 명령은 실행하지 않는다. 각 수정의 정적 검토, 로컬 미실행(`NOT TESTED`), 원격 CI 시작·실제 결과를 구분해 기록한다. CI 실패는 기록하되 다음 Issue의 착수를 막지 않고 별도 REWORK로 추적한다. 이 작업에서는 병합·main GHCR·정식 릴리스·Issue 종료를 실행하지 않는다. 로컬 변경은 기존 volume을 건드리지 않는 별도 Docker 미리보기로 제공한다.

[PR #143](https://github.com/planner77/masterGantt/pull/143)은 최신 main을 통합한 문서 두 파일 전용 head `ab8da09f8371085dee493bb96edc65ecdd4a903d`로 갱신됐다. [run 35974729225](https://github.com/planner77/masterGantt/actions/runs/35974729225)의 quality/e2e/docker는 PASS이며 이 결과를 #116 이후 제품 수정의 테스트/CI 근거로 재사용하지 않는다. #115는 아래 정식 릴리스·안전한 branch 정리 증거에 따라 종료됐고, #120의 별도 릴리스 범위·승인 판단은 여전히 대기한다.

#116의 코드·CSS·E2E 명세·문서는 작성했고 독립 `qa_docs` 정적 재검토에서 PASS했다. 최초에는 로컬 실행을 보류했고, 이후 사용자 범위 확장에 따라 PR CI를 실행했다. 최종 원격 결과는 아래 head/run 증거를 따른다. 실제 모바일·스크린리더 검증은 NOT TESTED다. 현재 8299의 정식 `latest` image는 `0.27.1`이며, 아래 8301의 #155 별도 미리보기가 후속 변경을 담는다.

범위 확장 후 [#116 PR #144](https://github.com/planner77/masterGantt/pull/144)를 main 기준 허용 8파일만으로 열었다. 첫 head `2a9185edc8019533dffbccfb30d5ccf0b3efabb5`의 [run 35958787914](https://github.com/planner77/masterGantt/actions/runs/35958787914) attempt 1에서 quality `npm run typecheck`가 TS2367(`project-gantt.tsx:1023`의 narrowed JSX 분기 중복 비교)로 FAIL했고, 의존 e2e/docker는 미실행이다. 비교 한 줄을 제거하는 REWORK가 독립 정적 검토 PASS를 받았고 새 head `996047afc630ef960a1982d49928d006396b27f7`로 push했다. 새 head의 CI는 실행 결과로 재판정한다. 이전 실패를 retry PASS로 덮지 않는다.

#116 네 번째 head `ee6d2a3172fb5e2305439e139204dd48894ca212`의 [run 35962507007](https://github.com/planner77/masterGantt/actions/runs/35962507007)은 quality/docker PASS, e2e 78 PASS / 1 FAIL이다. 768px 오른쪽 모서리의 메뉴가 왼쪽에 배치되지 않은 trace에서 합성 `dispatchEvent("contextmenu", { clientX, clientY })`가 React handler에 좌표를 전달하지 않아 row bounds fallback을 사용한 것으로 판명됐다. 실제 `MouseEvent`를 dispatch하고 기존 16개 corner·placement·gutter 단언을 유지하는 최소 테스트 수정은 독립 정적 QA PASS다. 다섯 번째 head `30fe979465325b74a6ff2fad0709d11550bbc807`의 [run 35964067138](https://github.com/planner77/masterGantt/actions/runs/35964067138)은 quality/e2e/docker 모두 PASS다. 이 head의 PASS를 아직 구버전 #116을 포함하는 후속 PR의 PASS로 재사용하지 않는다.

두 번째 #116 head `996047afc630ef960a1982d49928d006396b27f7`의 [run 35959917435](https://github.com/planner77/masterGantt/actions/runs/35959917435) attempt 1은 quality(615 tests)·docker PASS, e2e 78 PASS / 1 FAIL이다. 390px 네 모서리는 통과했고 768×844로 크기를 변경한 직후 첫 contextmenu가 메뉴로 남지 않았다. 원격 trace는 resize 완료 3ms 뒤 dispatch 및 메뉴 부재를 보이며 제품 resize listener와 경합이 개연적이지만 resize event 자체는 기록되지 않아 원인 확정은 아니다. 테스트에 viewport/레이아웃 안정화 후 기존 strict geometry 검사를 유지하는 REWORK를 작성했고 새 head의 실제 결과를 기다린다.

[#117 PR #145](https://github.com/planner77/masterGantt/pull/145)는 #116 branch를 base로 하는 stacked PR이다. 첫 head `0cf5d7df4debe1c5091104691d06b9bfe1303eec`의 [run 35960709612](https://github.com/planner77/masterGantt/actions/runs/35960709612) attempt 1은 typecheck 후 lint `react-hooks/set-state-in-effect`에서 FAIL했고, e2e/docker는 미실행이다. effect의 직접 조회 호출이 동기 loading state를 변경한 경계를 비동기 yield와 중단 guard로 수정 중이다. #116 재검증 완료 전 #117의 상위 변경 의존성도 해소됐다고 주장하지 않는다.

#116 세 번째 head `4daad99e347c95d0cf81daca42059987900a59b6`의 [run 35961132655](https://github.com/planner77/masterGantt/actions/runs/35961132655) attempt 1은 quality/docker PASS, e2e 78 PASS / 1 FAIL이다. 390px 네 모서리 뒤 768px 첫 모서리에서 root는 보이고 focus도 받았으나 `Add` 하위 메뉴가 열린 상태였다. trace는 직전 실제 포인터가 `Add` 클릭 위치(165,407)에 남은 채 가상 contextmenu 좌표(8,8)만 바뀌었음을 보인다. 포인터 이벤트 자체는 trace에 기록되지 않아 원인 확정은 아니며, 모든 가상 contextmenu 전에 포인터를 메뉴 밖(0,0)으로 이동하는 테스트 수정이 독립 정적 QA PASS를 받았다. 네 번째 head `ee6d2a3172fb5e2305439e139204dd48894ca212`의 원격 결과를 기다린다.

#117 두 번째 head `03ba32685ce0a6d552de97cb4ff4f9c031a45021`의 [run 35961082360](https://github.com/planner77/masterGantt/actions/runs/35961082360)은 같은 lint 오류로 FAIL했고 e2e/docker는 미실행이다. 세 번째 head `2b39d34218076681ba98e6ee3f5a9850abd931c4`의 [run 35961359006](https://github.com/planner77/masterGantt/actions/runs/35961359006)은 quality/docker PASS, e2e 81 PASS / 2 FAIL이다. 하나는 #116 상위 Add 초기 상태 실패, 하나는 390px 재시도 버튼이 resource panel의 가로 scrollLeft 338 때문에 viewport x=-313으로 이동한 제품 UX 실패다. resource panel을 세로 스크롤 전용으로 두고 중간 grid를 수축시키며 Task table의 내부 가로 스크롤만 유지하는 CSS/E2E REWORK를 로컬에 작성했다. 원격 결과 전까지 실제 수정 PASS로 표시하지 않는다.

[#118 PR #146](https://github.com/planner77/masterGantt/pull/146), [#119 PR #147](https://github.com/planner77/masterGantt/pull/147), [#121 PR #148](https://github.com/planner77/masterGantt/pull/148)은 각각 바로 앞 branch를 base로 하는 stacked PR이다. 각자 로컬 수정·테스트 명세·독립 정적 QA는 PASS했지만, 상위 #116/#117의 E2E FAIL 영향과 각 head의 원격 CI는 별도 판정한다. #118의 같은 fixture 구현 전후 Gantt 높이 실측, 실제 모바일·스크린리더는 NOT TESTED다.

#121 head `425790f21501b783fd52c95b7470db8d8809cb0c`의 [run 35962453537](https://github.com/planner77/masterGantt/actions/runs/35962453537)은 quality/docker PASS, e2e 92 PASS / 9 FAIL이다. 신규 skip-link 실패 2건은 390/1440px 오류 화면에서 fragment 이동이 `ProjectPermissionRecheckBoundary`의 `popstate` 권한 재검사를 유발하고, readonly/error 응답이 현재 페이지를 reload해 본문을 loading 상태로 바꾼 실제 제품 결함이다. 단순 E2E 대기나 단언 약화로 처리하지 않고 같은 문서의 hash-only 이동만 재검사에서 제외하면서 실제 history/BFCache 검사를 보존하는 REWORK를 진행한다. 새 head의 원격 CI 전에는 수정 결과를 PASS로 판정하지 않는다.

#121 REWORK는 독립 정적 QA PASS 후 head `438593bde8c8d19b6d1caa58cabdd8ccfbd93178`로 [run 35964641369](https://github.com/planner77/masterGantt/actions/runs/35964641369)을 실행했다. 같은 문서의 fragment-only 이동은 재검사에서 제외하며 오류·읽기 전용·편집 상태에서 skip link 이후 불필요한 edit-session GET·document navigation 0회와 본문 focus를 검증하는 명세를 추가했다. quality/docker PASS, e2e 94 PASS / 7 FAIL이며 신규 skip-link 390/1440px 두 건은 PASS했다. 남은 실패는 이 head에 포함된 이전 단계의 구버전 명세·수정이다. 누적 head 전체 e2e는 FAIL이며 상위 변경 동기화 후 다시 검증한다.

#130은 Phase 1 [PR #150](https://github.com/planner77/masterGantt/pull/150) → Phase 2 [PR #152](https://github.com/planner77/masterGantt/pull/152) → Phase 3 [PR #153](https://github.com/planner77/masterGantt/pull/153) → Phase 4 [PR #154](https://github.com/planner77/masterGantt/pull/154)의 stacked PR로 진행한다. 각 version은 `0.27.7`/`0.27.8`/`0.27.9`/`0.27.10`이며 Phase 2·3·4 후보는 앞 단계의 변경만 포함하도록 source tree와 파일 범위를 확인했다. Phase 1 최초 head `9a105e2e9f17e4108c92cdc8a045ce31121ae085`의 [run 35962998208](https://github.com/planner77/masterGantt/actions/runs/35962998208)은 quality/docker PASS, e2e 94 PASS / 8 FAIL이다. 신규 목록 명세는 실패 목록에 없지만, 앞 단계의 실패가 있는 이 누적 head 전체를 PASS로 표시하지 않는다. Phase 2 head `012f2dc7bdbaff096989f63f84efa5acd9f50c7f`의 [run 35964288488](https://github.com/planner77/masterGantt/actions/runs/35964288488)은 quality/docker PASS, e2e 94 PASS / 10 FAIL이고 자체 Phase 2 명세 2건은 PASS했다. Phase 3 head `1c6eafd30a50a50680b042dd177b41d44971fd11`의 [run 35964538054](https://github.com/planner77/masterGantt/actions/runs/35964538054)은 quality/docker PASS, e2e 96 PASS / 9 FAIL이며 자체 Phase 3 명세 1건과 Phase 2 명세 2건은 PASS했다. 세 head 모두 선행 변경의 구버전 실패를 포함해 전체 e2e는 FAIL이다. 이전 구현의 같은 fixture·viewport 기준 화면·높이 baseline은 아직 확보하지 않아 전후 실측은 NOT TESTED다.

Phase 4는 Phase 3 branch를 base로 하는 [PR #154](https://github.com/planner77/masterGantt/pull/154)로 열었다. 첫 head `d09b7184e16079c98a4e17158b61a751f2f4ce23`의 [run 35967180712](https://github.com/planner77/masterGantt/actions/runs/35967180712)에서 quality/docker PASS, e2e 96 PASS / 11 FAIL이며 PR write·publish job은 수행하지 않았다. 독립 QA는 Phase 4 신규 명세가 다섯 폭 반복 중 이전 폭에서 고급 panel을 열린 채 남겨 다음 폭에선 filter toggle로 닫는 상태 누수 1건, 기존 #83 Resource 날짜 입력이 고급 panel로 이동했는데 열지 않는 기존 명세 1건, 그리고 아직 동기화되지 않은 선행 변경 실패 9건을 분리했다. 두 명세의 REWORK는 정적 QA PASS이고, 이를 반영한 새 head `89198288804ec68d453fa96f08907a7df45e34f5`의 [run 35971567049](https://github.com/planner77/masterGantt/actions/runs/35971567049)은 quality/docker PASS·e2e 97 PASS / 10 FAIL이다. 실패 목록에 Phase 4 신규 spec은 없지만 누적 head 전체 E2E는 FAIL이며 최종 QA는 별도 판정이 필요하다. CI 시작 확인 후 #155로 진행했다.

## #130 Phase 4 검색·필터 계약

List·Schedule·Resource는 데스크톱에서 검색 → `필터 N` → 조건부 초기화 → 결과 수 순서를, 390/768px에서 검색·필터 첫 행과 결과·초기화 둘째 행을 사용한다. `필터 N`은 quick search를 포함한 활성 조건 수다. 고급 panel의 `aria-expanded`/`aria-controls`, Escape 뒤 trigger focus, 초기화 뒤 search focus, 결과·실패·stale·실제 빈 상태·검색 결과 없음의 문구 구분을 E2E 명세에 포함한다. 검색·초기화는 client view state만 바꾸고 refetch·mutation·revision 변경을 만들지 않는다.

Resource의 종류·상태·기간은 고급 panel로 이동하고 M/D·M/M·새로고침은 독립 명령으로 남긴다. 기존 #83 Task 날짜 역순 자동 정렬과 #84 List의 잘못된 range 표시·조건 미적용 계약은 이 시각 정합화에서 변경하지 않는다. 날짜 정책 통합은 별도 모델·predicate 변경과 회귀 검토가 필요하다. 구현 전후 동일 fixture·viewport·zoom·locale의 toolbar bounds, overflow, 상태별 screenshot은 별도로 확보해야 하며, 현재는 NOT TESTED다.

## Issue Work Packet — #155 Grid/Chart 전체 화면

- Issue: [#155](https://github.com/planner77/masterGantt/issues/155), 분석·설계·구현의 독립 정적 QA PASS. 착수 당시 원격 main 기준 `f7f18ee589812e0357a023887202979c83b245ba` / application `0.27.1`; 선행 누적 PR은 #154 head `89198288804ec68d453fa96f08907a7df45e34f5`다. Branch `feat/issue-155-gantt-fullscreen`의 [PR #156](https://github.com/planner77/masterGantt/pull/156) head `063a81f53d2beb1bddc692bf9ec3bd54c6e6698d`와 [CI run 35973400077](https://github.com/planner77/masterGantt/actions/runs/35973400077)가 시작됐다. quality/docker PASS·e2e FAIL이며 최종 QA는 아직 NOT TESTED다.
- 목표·인수 기준: Gantt Grid/Chart의 전체 화면 버튼, `Ctrl/Cmd+Shift+F`와 `Escape`, 읽기 전용 공통 제공, 크기 재계산과 Gantt 인스턴스·분할/열 폭·zoom·양축 scroll·선택·계층 펼침 상태 보존. API/DB/Scheduling/권한 계약 변경은 범위 밖이다.
- Version 결정: `0.x`의 새 하위 호환 기능이므로 [CI/CD 정책](../../CI_CD.md)에 따라 `0.28.0` MINOR. `release_required=UNKNOWN`, `release_authorized=false`; 이번 요청은 PR과 해당 head CI 시작까지만 승인한다.
- 설계 결정: 설치된 Gantt 2.7.3/Core 2.6.1의 SVAR Fullscreen helper는 런타임 export와 타입 선언이 어긋나고 Fullscreen API 요청 거절에 대한 상태 처리가 없으며 입력 중 단축키 차단도 제공하지 않는다. 이 인수 기준에서는 기존 `.project-gantt-frame`에 브라우저 Fullscreen API를 직접 적용한다. 표시 단위 도구줄·Grid·Chart·작업 메뉴만 대상 안에 두고 App Shell·프로젝트 정보·검색·Resource panel은 밖에 둔다. 상태 표시는 `document.fullscreenElement` 확인 후에만 바꾼다.
- 구현 소유자: frontend — `project-gantt.tsx`, `gantt-scale-toolbar.css`, `project-readonly-view.tsx`, 전용 E2E, `docs/PROJECT_UX.md`, `docs/TASK_EDITOR.md`, `docs/TEST_PLAN.md`. infra — 격리 branch·`package.json`/lock/CHANGELOG `0.28.0`·PR/CI. Manager — 이 packet과 단계·판정. researcher·ui_ux·qa_docs는 읽기 전용이며 설계와 사전 QA는 PASS다.
- DOCUMENTATION_SYNC: 전체 화면/단축키/Task Editor의 전체 화면 종료 후 열림 계약을 세 문서에 반영한다. API/DB/Scheduling/DESIGN/UI_UX_GUIDELINES는 계약 불변이면 N/A 근거를 남긴다. 로컬 테스트·브라우저·빌드는 사용자 지시에 따라 NOT TESTED다. 전용 E2E는 버튼/단축키/Escape·입력/대화상자/Resource tab guard·거절·읽기 전용·네 폭·상태 보존·resize를 명세한다.
- 다음 handoff: PR #156 CI 결과를 후속 검토 대상으로 기록하고 현재는 로컬 확인용 Docker 후보를 별도 volume·port에 격리한다. CI 성공 대기·main 병합·GHCR 게시·Issue 종료는 이번 범위 밖이다.

## 다음 Issue Work Packet — #136 공통 헤더 버전 표시

- Issue/범위: [#136](https://github.com/planner77/masterGantt/issues/136). 공통 헤더의 `masterGantt` 브랜드 옆에 빌드된 application version을 `v<SemVer>`로 낮은 위계의 metadata로 표시한다. 헤더 높이·전역 navigation·홈 링크 의미를 보존하고 좁은 화면 overflow를 막는다. SHA/빌드 시각·About 페이지·헤더 전체 재설계는 제외한다.
- 기준과 의존성: 원격 main `e91bcff22a6e087b510d5706c2e71a75c47ad92f` / `0.27.2`; 선행 #155 [PR #156](https://github.com/planner77/masterGantt/pull/156) head `063a81f53d2beb1bddc692bf9ec3bd54c6e6698d` / `0.28.0`을 branch base로 한다. 이전 Issue PR의 미완 gate나 CI 결과를 #136의 PASS로 전용하지 않는다.
- 버전과 승인: UI에 새 정보 제공이므로 `0.29.0` MINOR 후보로 결정한다. infra가 package/lock/CHANGELOG를 한 번에 반영한다. `release_required=미확정`, `release_authorized=false`; 이번 사용자 범위는 PR과 해당 head CI 시작까지이며 병합·tag·정식 GHCR 게시·Issue 종료는 승인 범위 밖이다.
- 소유권: frontend는 `src/components/workspace-shell.tsx`와 관련 header CSS·전용 E2E, `docs/PROJECT_UX.md`·`docs/TEST_PLAN.md`의 작성 및 `DESIGN.md`·`docs/UI_UX_GUIDELINES.md` 영향 분석을 맡는다. 공통 디자인 원칙 변경이 실제 필요할 때만 Manager가 DESIGN/UI 지침 문서 작성자를 지정한다. infra는 격리 branch·package/lock/CHANGELOG 버전·PR/CI·Docker 미리보기를, Manager는 이 계획과 인터페이스·단계 결정을 담당한다. qa_docs는 독립 read-only 검토한다. `next-env.d.ts` 등 기존 사용자 변경은 보존한다.
- 구현/검증 계약: `package.json.version`과 같은 단일 빌드 시점 값을 재사용하며 UI에 버전을 하드코딩하지 않는다. desktop과 390/768/1024/1440px에서 header 높이·브랜드 링크·navigation·screen reader 링크 이름을 확인한다. E2E는 빌드된 version 문자열과 표시, 홈 링크, responsive overflow를 검증하도록 작성한다. 로컬 테스트 명령은 최신 사용자 지시에 따라 실행하지 않고 `NOT TESTED`로 남긴다.
- DOCUMENTATION_SYNC: frontend는 `docs/PROJECT_UX.md`·`docs/TEST_PLAN.md`를 실제 계약에 맞춰 갱신하거나 N/A 근거를, `DESIGN.md`·`docs/UI_UX_GUIDELINES.md`는 공통 규칙 변경 여부와 N/A 근거를 기록한다. infra는 version과 함께 `CHANGELOG.md`를 갱신한다. API/DB/Scheduling 변경은 N/A다. QA 정적 PASS 후 기존 Issue 중복 PR이 없는지 확인하고 #136 PR을 열어 해당 head의 CI 시작을 확인한 다음 #141로 이동한다. PR CI의 production build와 8302 Docker 후보의 build/readiness/화면 버전은 실제 실행 시 각각 판정한다. 정식 GHCR image와 브라우저 표시 version의 일치 검증은 이번 PR/CI 시작 범위에서 NOT TESTED이며 병합·정식 게시 이후 별도 gate다.

## 역할과 소유권

- Manager(`/root`): 계획/인수 기준/통합/판단, 이 실행 계획 문서.
- ui_ux(`/root/ux`): 읽기 전용 설계·구현 비교. 추가 재귀 위임 없음.
- frontend: 지정 컴포넌트·테스트 및 해당 UX 문서. 다른 이슈 구현은 시작하지 않는다.
- infra(`/root/infra`): Git/PR/CI/Docker와 package/lockfile/CHANGELOG 버전 동기화.
- qa_docs: 구현 담당과 분리된 읽기 전용 QA 및 원격 증거 확인.

동일 파일에 동시 쓰기하지 않는다. 기존 `next-env.d.ts` 개발 모드 변경은 보존하며 이 작업 커밋에 섞지 않는다.

## #116 진행 기록

- branch `fix/issue-116-context-menu-viewport`, PR #144, version `0.27.2`.
- 390/768/1024/1440px 네 모서리의 child menu viewport 경계, 390px drilldown, 390×160 내부 스크롤, keyboard/Escape/focus 복원 및 #77/#104 회귀를 전용 E2E로 검증한다.
- 원격 PR head `30fe979465325b74a6ff2fad0709d11550bbc807`의 CI run `35964067138`은 quality/e2e/docker PASS였다. 이전 실패는 Playwright generic Event의 contextmenu 좌표 누락과 viewport 준비/hover 잔류 원인을 보존해 기록했다.
- Codex P2에서 child가 열린 뒤 일반 root 항목으로 focus/pointer 이동 시 child가 남는 접근성 불일치를 확인했다. 일반 root 명령 진입 시 child를 닫고 `aria-expanded=false`를 유지하도록 코드·E2E·PROJECT_UX·TEST_PLAN을 보완했다.
- 착수 당시 main `f7f18ee589812e0357a023887202979c83b245ba`를 작업 branch에 통합했고, 최종 head `3bf5e73fc373fc22b018718ef78d806d74047c69`의 [run 35970926248](https://github.com/planner77/masterGantt/actions/runs/35970926248) quality/e2e/docker PASS 뒤 `e91bcff22a6e087b510d5706c2e71a75c47ad92f`로 병합됐다.
- API/DB/Scheduling 계약 변경은 N/A이며 실제 모바일 기기·스크린리더 수동 검증은 별도 NOT TESTED다.

## #115 작업 계약

- 기준 main: 위 SHA. branch `fix/issue-115-calendar-preview`, PATCH `0.27.1`.
- implementation_owner/documentation_owner: frontend. 파일: `src/features/projects/project-work-calendar-editor.tsx`, 관련 E2E, `docs/PROJECT_UX.md`, `docs/TEST_PLAN.md`.
- 모든 의미 있는 국가/기간/휴무/대상/추가/삭제 변경에서 이전 미리보기가 현재 결과처럼 남지 않도록 한다. 계산 중·실패·완료·재계산 필요 상태와 다음 행동을 표시한다.
- revision/publicId 변경이나 늦은 응답이 결과를 되살리지 않도록 방어한다. 초안 및 요청 중 입력 잠금, 401/412 처리는 유지한다.
- 저장 전 미리보기 강제 절차를 추가하지 않는다. API/DB/계산 알고리즘 변경은 범위 밖이므로 관련 계약 문서 수정은 N/A.
- 검증: KR→US→재계산, 각 draft 변경, 실패/재시도, revision 변경/늦은 응답, 390/768/1024/1440 상태 안내와 버튼 접근, 기존 캘린더 저장 회귀.
- 로컬 빠른 검증과 원격 quality/e2e/docker/main GHCR 결과를 구분한다. 실제 기기·스크린리더는 별도 미검증이다.

### 승인된 UI 상태 설계

ui_ux 읽기 전용 검토를 바탕으로 결과가 사라지는 이유와 다음 행동을 같은 영역에서 알린다. 버튼은 `미리보기 계산`, 결과는 `미리보기 결과 — 현재 입력 기준`으로 표시한다.

| 상태 | 표시와 동작 |
| --- | --- |
| 최초 | 현재 입력의 미리보기를 계산할 수 있다는 안내 |
| 계산 중 | 이전 결과 숨김, 진행 안내, 기존 fieldset/버튼 잠금 유지 |
| 완료 | 요청 입력 fingerprint 및 revision이 현재와 일치할 때만 결과 표시 |
| 입력 변경/기준 revision 변경 | 이전 결과 숨김, 재계산 필요 안내, draft 보존 |
| 계산 실패 | 이전 결과 숨김, 실패와 재시도 안내, 기존 알림 보존 |
| 401/412 | 기존 재인증/충돌 및 canonical 재조회 처리 유지 |
| 저장 성공 | 미리보기 clear, canonical 재조회 및 저장 알림 유지 |

하나의 polite atomic 상태 영역으로 요약을 알리고 긴 결과 목록 전체를 live region으로 만들지 않는다. 완료/실패로 focus를 강제로 이동하지 않는다. request identity와 현재 입력/revision/unmount를 비교하여 늦은 성공·실패·finally가 더 최신 상태를 덮어쓰지 못하게 한다. SVAR API/PRO 기능은 추가하지 않는다. 공식 문서와 demo URL 확인은 실제 demo 조작 PASS와 구분한다.

## 로컬 확인 환경

초기 #115 미리보기는 기존 Compose project·volume과 8299 포트를 유지한 `mastergantt:preview-issue115-candidate`(application `0.27.1`)로 실행했고 당시 container healthy, `GET /api/health/ready` 200이었다. 중간 점검에서는 해당 container가 없었으나 이후 외부에서 `mastergantt-app-1`이 재기동됐다. 현재 8299의 `ghcr.io/planner77/mastergantt:latest`는 image label version `0.27.1` / revision `f7f18ee…`이며 healthy이고 기존 `mastergantt-data:/data`를 사용한다. 이 작업은 기존 container 삭제·volume 연결/복사/migration을 하지 않았다.

현재 확인용 미리보기는 [PR #156](https://github.com/planner77/masterGantt/pull/156) head `063a81f53d2beb1bddc692bf9ec3bd54c6e6698d` / application `0.28.0`의 `mastergantt:preview-issue155-063a81f`를 별도 Compose project `mastergantt-preview-issue155`, 별도 volume `mastergantt-preview-issue155-data`, `127.0.0.1:8301`에서 실행한다. `http://localhost:8301/api/health/ready` 200, container healthy, 새 SQLite Project/Task 0개·integrity `ok`를 확인했다. 기존 `mastergantt-data` volume은 사용하지 않았으므로 기존 사용자의 일정 데이터는 이 미리보기에 표시되지 않는다. 로컬 실행은 정식 GHCR 게시 또는 운영 배포 완료가 아니다.

## 완료 증거

원격 검증 결과는 각 Issue/PR에 실제 SHA/run/digest 근거로 기록한다. 아래 로컬 결과로 PR/main CI·GHCR PASS를 주장하지 않는다.

### #115 구현과 로컬 빠른 검증

- frontend 구현 및 DOCUMENTATION_SYNC 완료. `PROJECT_UX.md`, `TEST_PLAN.md` 갱신, API/DB/계산 계약은 변경 없음.
- `npm run typecheck`, 변경 component/spec 대상 ESLint, `git diff --check` PASS.
- 설치 Chromium 1208을 지정한 전용 `project-work-calendar-preview.spec.ts` 2/2 PASS(33.2초). KR→US 미리보기/저장, 미리보기 없이 저장, 모든 draft 입력, 실패/잘못된 응답/재시도, metadata 저장 후 unmount와 늦은 응답, 401/412, 키보드 포커스, 390/768/1024/1440 버튼 접근을 검사했다. 응답의 중첩 calendar revision 일치 및 If-Match 헤더 보존은 코드 검토와 구분한다.
- 최초 키보드 검사에서 비활성 버튼의 focus 손실을 발견해 현재 요청 종료 시에만 안전하게 복원하도록 수정했다. 독립 QA에서 지적한 늦은 저장 알림 및 테스트 KR/US 입력 흐름 불일치도 수정했다. 최종 독립 QA와 원격 CI는 별도 gate다.
- [변경 전](../../images/issue-115-before.png)은 KR 초기 설정(계산 전), [변경 후](../../images/issue-115-after.png)는 US 미리보기 완료 상태다. 같은 결함 순간의 쌍으로 오해하지 않도록 구분한다. 원래 결함 흐름은 Issue 재현 기록과 E2E로 검증한다.
- 같은 editor mount에서 revision prop만 변경하는 브라우저 경로는 없어 실제 E2E는 metadata 저장→revision 변경→설정 창 unmount를 검증했다. 순수 prop 변경 경계는 코드 검토와 구분하며 실제 모바일/스크린리더는 NOT TESTED다.
- PR #137 첫 head `76f7f415f7efe2ed178eddd79458cda983bee1b9`의 [run 35950170417](https://github.com/planner77/masterGantt/actions/runs/35950170417) attempt 1: quality/docker PASS, e2e FAIL(77 passed / 1 failed). 새 캘린더 live status와 기존 오류 toast를 `project-modal-feedback.spec.ts`의 광범위한 status locator가 동시에 선택했다. 기존 오류 알림 검증을 정확히 지정하도록 REWORK하며 접근성 status나 테스트를 제거하지 않는다. 후속 head에서 required gate 전체와 독립 QA를 다시 수행한다.
- REWORK의 첫 로컬 시도에서 전역 toast의 test id가 모달 안에는 없음을 확인해 FAIL했다. 실제 모달 내부 `div[role="status"][aria-atomic="true"]`를 지정하고 role·문구·가시성·알림함 회귀를 유지한 최종 대상 테스트는 1/1 PASS(4.2초), 해당 spec ESLint/diff 검사도 PASS다. 제품 코드와 기존 UX/테스트 계약은 바뀌지 않았다.
- 후속 head `f040519808840eba14cbddf02d7907a0289c6f9d`의 [run 35951130019](https://github.com/planner77/masterGantt/actions/runs/35951130019) attempt 1: quality/docker PASS, e2e FAIL(77 passed / 1 failed). 모달 알림 및 #115 신규 테스트는 PASS했지만 `project-notifications.spec.ts:39`에서 페이지 스크롤 0→1px와 전체 영역 y 좌표 -1px가 확인됐다. timeout은 아니며 원격 trace를 확보해 클릭 준비/스크롤과 알림 동작을 구분하는 원인 분석을 진행한다. 근거 없이 허용 오차를 늘리거나 실패를 retry로 숨기지 않는다.
- 원격 trace의 `call@2491`에서 milestone Add 클릭 직전 Playwright `scrolling into view if needed`가 실행됐고, action/after snapshot에 처음 document scroll top 1이 기록됐다. frontend와 Manager가 독립 확인했다. 알림 동작 전에 발생하는 클릭 준비 스크롤이 baseline에 섞인 것이므로 해당 대상에 명시적 scroll 준비를 마친 뒤 baseline을 잡는 최소 테스트 수정을 승인했다. 제품 CSS/코드를 바꾸거나 geometry 허용 오차를 추가하지 않고 실제 클릭과 이후 모든 strict geometry/인스턴스 검증을 유지한다.
- 해당 원격 trace를 qa_docs도 독립 확인했다. `project-notifications.spec.ts`에서 버튼 scroll 준비 → chart 내부 scroll 설정 → baseline → 실제 클릭 순서로 정리한 뒤, 대상 Chromium 테스트를 3회 반복해 3/3 PASS(14.5초)했다. 해당 spec ESLint와 diff 검사 PASS이며 제품/UX 계약 문서 수정은 N/A다. 후속 head의 required 원격 gate는 모두 새로 판정한다.
- 로컬 Docker는 `0.27.1`로 교체했고 기존 volume·8299 포트를 보존했다. SQLite integrity `ok`, 외래키 오류 0, 프로젝트 1개/작업 24개, migration 1~7을 확인했다. Manager 브라우저 확인에서도 읽기 전용 Gantt/24개 작업/문서 가로 overflow 없음/readiness 정상이다. 이미지 source tree `7ed0f9f22336f6b39121dbca22136fef367887c4`와 최종 #115 게시 tree의 차이는 문서·E2E 테스트이며 제품 runtime/package는 동일하다. 원격 E2E locator 수정은 runtime 변경이 아니다.
- 최종 PR #137 head `5339d82ad569e36c42d0592df1d07fcaa21dd873`의 [run 35952444601](https://github.com/planner77/masterGantt/actions/runs/35952444601) attempt 1은 quality(62 files/615 tests), e2e(78/78), docker 모두 PASS다. 이전 두 head의 E2E FAIL은 위 기록에 유지한다. qa_docs가 최종 head의 요구사항·코드·테스트·문서와 원격 gate를 독립 확인했고 Manager가 병합을 승인했다.
- #115의 merge SHA `692ed6dc51674e00eabb096a9ae46696b6b82cfd`에 대한 [main run 35953411571](https://github.com/planner77/masterGantt/actions/runs/35953411571) attempt 1은 quality/e2e/docker 및 임시 GHCR 게시·검증·정리 job이 모두 PASS다. 임시 `ci-<SHA>` digest `sha256:05989b6fa41d4c41d712c48b4f141dd2ac0c2c73067ae0f17151f47f467ef9ff`를 exact pull하여 image policy/readiness/native SQLite/API 권한·재시작 영속성/HTTP·HTTPS를 검증했고, BuildKit SBOM·provenance 생성과 임시 package version 삭제를 infra 및 qa_docs가 확인했다. 이 main run 시점에는 정식 version tag·GHCR 게시는 미실행이었으며, 임시 이미지를 운영 artifact로 취급하지 않는다.
- 사용자 요청에 따라 [PR #139](https://github.com/planner77/masterGantt/pull/139)로 `AGENTS.md`에 향후 UI/UX 작업의 문서별 참조 상황을 명시했다. 문서만 변경해 version `0.27.1`을 유지했고 해당 문서 PR 별도 정식 release는 N/A다. 당시 main `39a3dd7199149ee6394345b070ee35249589e8bc`의 [run 35954491810](https://github.com/planner77/masterGantt/actions/runs/35954491810) attempt 1에서 quality/e2e/docker와 임시 GHCR exact digest smoke, SBOM·provenance, 임시 package version 삭제가 PASS했다. 이 결과 자체는 #115 정식 릴리스 증거가 아니며 후속 release run은 아래에 기록한다.
- 최초 감사에서는 #115의 `release_required`가 미확정이고 `release_authorized=false`였으며 Git HTTPS 쓰기 인증 부족으로 branch cleanup이 BLOCKED, Issue가 열려 있었다. 이후 사용자의 정식 GHCR 게시 요청이 Issue 댓글에 승인 근거로 기록됐고 정식 게시·안전한 정리·Issue 종료가 수행됐다. 후속 이슈는 최신 사용자 지시에 따라 PR/CI까지만 진행하며 이 범위를 #120의 별도 릴리스 승인으로 확대하지 않는다.

### 2026-09-24 후속 Registry 사실 확인

독립 read-only 감사에서 `ghcr.io/planner77/mastergantt:0.27.1`과 고정 OCI index digest `sha256:2c47272ba011f3987b67a0c657b89f494ed068cdacb7628eee051703513413b5`가 현재 Registry에 있음을 확인했다. annotated `v0.27.1` tag는 병합 전 main commit `f7f18ee589812e0357a023887202979c83b245ba`를 가리키며 [release run 35963660204](https://github.com/planner77/masterGantt/actions/runs/35963660204)의 4개 job과 exact digest 재검증·SBOM·provenance는 PASS다. 안전한 branch cleanup helper는 PR #137의 head를 검증하고 branch 삭제·부재를 확인했고, #115는 closed/completed다. #115 댓글에는 사용자의 정식 GHCR 게시 요청이 승인 근거로 기록돼 있다. 다만 이 감사에서 사용자 원문은 독립 확인하지 못했고 Issue 본문 AC checkbox는 아직 미동기화다. #120은 open/reopened이며 코드가 `0.27.1`에 포함됐어도 #115 승인 범위를 #120의 별도 Lifecycle 승인으로 소급 적용하지 않는다. `ci-*`는 임시 검증 후 삭제하는 정책이고, 이 정식 image는 #116 이후 열린 PR의 변경을 포함하지 않는다.

### 선행 #120 및 로컬 데이터 보존 확인

- infra와 qa_docs가 별도로 확인한 #120 PR #135 head: `973ccab6d833b8035e5fcb138f5eeba507398474`. [PR run](https://github.com/planner77/masterGantt/actions/runs/35943339330) attempt 1의 quality/e2e/docker PASS.
- main `69fa36aac486bf81bd247595cc0ab2bfbbc8982a`의 [main run](https://github.com/planner77/masterGantt/actions/runs/35945670408) attempt 1에서 quality/e2e/docker와 publish job PASS.
- 임시 이미지 digest `sha256:add282cba2d3a3c5d20534408a0334fbeec71a241a33af7482f7557cf5bda3e4`의 exact pull/runtime/API/HTTP·HTTPS smoke, SBOM/provenance 생성과 임시 package version 삭제를 로그로 확인했다. GitHub 별도 Artifact Attestation은 이 증거와 구분한다.
- 정식 `v0.27.0` tag는 조회 시 없었다. #120의 기존 상태별 before/after 자료 및 병합 전 독립 QA 증거는 이번 감사에서 확인하지 못했다. 구현 dependency 재사용 PASS와 전체 Lifecycle 미완료를 구분한다.
- 로컬 Docker 교체 전 SQLite 일관 백업을 Git 밖 `/tmp`의 제한된 권한으로 보관했다. 별도 읽기 전용 검사에서 integrity `ok`, 외래키 오류 0, 프로젝트 1개/작업 24개, migration 1~6을 확인했다. 컨테이너 교체 후 같은 데이터 보존을 다시 확인한다.
