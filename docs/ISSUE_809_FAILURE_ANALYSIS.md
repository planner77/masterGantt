# Issue #809 — 누적 실패·리뷰·충돌 원장

Primary Issue: [#809](https://github.com/planner77/masterGantt/issues/809). 기준은 [실패 분석 정책](PR_CI_FAILURE_TRIAGE.md)과 [Work Packet](exec-plans/active/ISSUE_809.md)이다. 원본 FAIL/BLOCKED/NOT TESTED는 후속 성공으로 지우지 않는다.

## 원격 Run/Attempt·리뷰·충돌

착수 baseline은 main `56a094b797300a554909cd8d81ef0bafe46d6def`, app0.134.0이다. #809 댓글0/기존 canonical PR0을 조회했다. 선행 #807은 CLOSED, #808 구현/교정 PR은 main에 포함되어 있다. #808 자체 lifecycle/Release 상태는 #809 구현 완료 근거로 전용하지 않는다. 신규 #809 PR과 CI는 아직 없으며 Required3/Trusted QA/Manager ACCEPT는 NOT TESTED다. 기존 root의 미추적 산출물은 별도 worktree로 보존했다.

실제 원격 게시 직전에 최신 main·열린 PR·미해결 리뷰와 mergeability를 다시 조회한다. 잠재 파일 겹침을 실제 merge conflict로 기록하지 않는다.

## 누적 사건 매트릭스

| ID | 원본 사실·분류 | 조치 | 재검증·남은 위험 |
| --- | --- | --- | --- |
| F809-001 | 최초 Issue connector 조회에 owner/repo 필드를 사용하여 `InvalidActionArgumentsError` 발생. TOOL_ARGUMENT, 제품/CI 실패 아님 | 도구 선언의 `repository_full_name`으로 교정 | #809 본문·연관 #806/#807/#808/#800·#809 댓글 조회 성공. 원격 mutation 없음 |
| F809-L01 | 최초 Playwright CLI 기본 Chromium1247 미설치로 open FAIL, 뒤따른 seed는 session없어 FAIL. ENVIRONMENT/준비 단계 | 설치된 Chromium1243 executable을 명시해 open 성공, seed 재시도 | 제품 차트 실행 이전 실패이며 실제 package-pinned binary·browser version은 최종 증거에 기록 |
| R809-001 | backend 초기 코드검토 보고가 selected.rows 전체 전달로 scopeKey에 legacy Target source/UUID가 포함될 수 있다고 주장. 실행 RED 없음; 후속 독립 검토로 미입증/철회(아래 정정) | task identity 6필드만 명시 pick하여 #808 모델에 전달 | 기존 R2 identity pick 방어를 확인하여 실제 누출 확정 철회. 최종 direct/mixed 공개 응답 음성 PASS; 최초4PASS와 구분 |
| R809-002 | 독립 qa_docs 초기사전검토에서 outer WBS 응답 내부 analysis를 존재 여부만 확인하여 서로 다른 분석 세대/조건/단위의 응답을 승인할 위험 발견. PRODUCT/provenance 코드검토 지적 | frontend에 source/query/generation/scopeKey·ID runtime 결속 및 혼합/역전 음성 테스트 보완 요청 | 작성 중 후보 지적이며 최초 실행 RED와 구분; 최종 교정/동일 source 검증 대기 |
| F809-L02 | backend 최종 전체 TypeScript 재검증이 작성 중 frontend `resource-charts-dashboard.tsx:106` TS1005/TS1134로 FAIL. 중간 구현 source이며 서버 신규73case는 PASS | frontend에 전달·작성 완료 후 최종 전체 typecheck 필요 | 초기 서버4파일 typecheck PASS와 최종 전체PASS를 구분. 서버 최종 3파일73/73 failed0/skipped0 |
| R809-003 | 독립 qa_docs schedule 추적: Task singleton은 보존하지만 non-Plan cell의 taskId만 전달하면 공동담당 Task의 다른 Assignment가 base report 범위에 남을 위험. AC3 정확 배정 집합 검토 지적 | frontend에 cell exact Task/Assignment 인계 seam·기존 host membership 재검증 요청 | 실제 구현·교차 음성 검증 후 결과 추가. 단순 Task focus를 전체 cell 이동으로 과대표시하지 않음 |
| R809-004 | backend API 문서 정합검토에서 HTTP stale 코드 초안 `STALE_SNAPSHOT`과 실제 `REPORT_STALE` 차이 발견. DOCUMENTATION | #809 API 설명을 실제 REPORT_STALE로 교정 | 기존 client 내부 오류 이름과 서버 wire 코드를 구분, 정책/서버 오류 약화 없음 |
| F809-L03 | 최초 before collector가 5폭 관측 후 자기 파일명 오기로 manifest 마감 ENOENT FAIL. EVIDENCE/관측기 | 파일명 교정 후 별도 before-final 출력에 5폭 전체 재관측 | 최종 before-final manifest·문서 overflow0. 첫 관측은 완결 증거에 합산하지 않음 |
| U809-01 | ui_ux 구현 비교: 상세 닫기/Escape에서 진행 중 revalidate intent 미취소로 닫힌 뒤 늦은 원본/일정 명령 실행 위험 | frontend에 controller/세대 취소와 후속 action 잠금 교정 요청 | 코드검토 지적이며 실제 실행 RED와 구분; 최종 검증 대기 |
| U809-02 | ui_ux: refresh/revision 뒤 기간/개인 결과가 줄면 page가 clamp되지 않아 빈 slice·13–5/5 같은 표시 가능 | 결과 길이에 맞는 페이지 제한 및 empty 0–0 표시 요청 | 최종 feature/browser 재검증 대기 |
| U809-03 | ui_ux: 접힌 개인/Group/Role/등급 조건의 적용 수·값 요약이 없어 모집단을 식별하기 어려움 | 접힌 상태에서도 실제 적용 조건 요약 표시 요청 | 최종 구현 비교 대기 |
| U809-04 | ui_ux: 공수 미설정(선택 범위)·개인 미배정(T0)의 KPI label이 같은 범위처럼 읽힐 위험 | 각 지표의 선택/T0 모집단을 label에 분리 요청 | 최종 의미·표시 검토 대기 |
| U809-05 | ui_ux: fullMilestones의 ready null·명시 Completed를 false/Not Ready와 합쳐 표시. 기존 Gate nullable/수동 이벤트 의미와 불일치 | 기존 Milestone 표현에 맞춰 manualEvent·Blocked·Ready·Completed를 분리하도록 요청 | 계산은 기존 모델 유지, 최종 문구·대표 테스트 확인 대기 |
| R809-005 | qa_docs: chart action의 AbortSignal을 host에 넘긴 뒤 host navigationLoading으로 busy=true가 되면 child effect가 같은 signal을 abort하여 자신의 일정 이동을 취소할 위험. 반대로 Plan 경로는 intentSignal 인계가 없음 | frontend에 재검증 controller와 사용자 navigation intent를 구분하고 기존 host gateway에 맞게 통합·지연 이동 회귀 요청 | 작성 중 코드 정적 지적이며 실제 브라우저/최종 동결 검증 대기 |
| F809-L04 | after-initial 3유형×5폭15관측의 문서 overflow0이나 수집 중 intent/Gate 표시 소스 수정이 겹침. SOURCE_STABILITY/PARTIAL | 중간 산출물을 보존하고 최종 동결 후15관측 재수집 | 최초 결과를 최종 source PASS로 사용하지 않음 |
| F809-L05 | 표시 oracle 포함25case 중1FAIL: 새 테스트가 partial Plan Load를 null로 예상했으나 기존 계약 값은 알려진 부하80%. TEST_CONTRACT + 표시 명확성 발견 | 기존 모델/oracle를 따라 기대를 교정하고 화면에 '알려진 부분80%'를 명시 | 산식/기존 golden 완화 없음; 최종 재검증 대기 |
| F809-L06 | 80/140 E2E를 manual3209 DB에 연결하여 fixture 중복 코드400 준비 FAIL. TEST_ENVIRONMENT, 제품 차트 진입 전 | 외부 DB 우회를 제거하고 표준 격리 서버/새 DB에서 실행 | 최초 준비 실패를 보존하고 새 실행과 구분 |
| U809-06 | qa_docs: 기간 막대 축은 M/D지만 제어가 차트 단위라 전체 축이 M/M으로 전환된 것으로 읽힐 여지 | Manager가 공수 표시 단위로 label 명확화·기간 막대/Capacity M/D 범례 유지 결정. 사용자/지표 가이드 동기화 | 기존 Plan 산식 변경 없음, 최종 UI/단위 검증 대기 |
| F809-L07 | 첫 표준 격리 #809 Chromium case가180초 timeout FAIL. 실제 선택80/Project140 수치 단언은 통과했으나 다음 select의 getByLabel exact가 중첩 option text 때문에 대상을 찾지 못함. TEST_LOCATOR | 실제 combobox role/name으로 선택 locator 교정. 원본 context를 output/playwright/issue-809/failures/initial-chart-scope-locator.md에 보존 | 행동/수치 단언·180초 timeout·retry 변경 없음. 새 실행으로 최종 재검증하며 초기 일부 통과를 전체 PASS로 합산하지 않음 |
| F809-L08 | 재실행 #809 E2E에서 pending 상세 닫기의 focus 복원 FAIL(39.7초). 취소/뒤늦은 editor 미표시는 PASS이나 close event의 focus가 아직 disabled인 trigger에 실행됨. PRODUCT/React commit timing | React DOM 반영 뒤 frame에서 connected/enabled trigger 또는 가시 fallback에 focus 복원 | 원본 failures/pending-detail-close-focus.md 보존. 수치/행동/timeout 약화 없이 같은 case 재검증; 최초 취소 통과를 최종 전체 PASS로 전용하지 않음 |
| F809-L09 | 실제 #809 E2E 일정 이동 뒤 원래 보기 복귀 시 trigger focus/선택 복원 FAIL(32.7초). 동일 query를 재조회하면서 generation/scopeKey가 바뀌고 pending 렌더가 출발 DOM을 제거. PRODUCT/방문 연속성 | 같은 visit·revision/query/filter/binding·refresh 세대의 확정 모델은 활성 복귀에서 유지. 기존 host 복귀 source 재검증과 모든 원본 action 재검증은 유지 | 조건/revision/새로고침/오류는 새 조회·기존 선택 무효화. 원본 failures/navigation-return-scope-focus.md 보존, 동일 case 최종 재검증 대기 |
| U809-02b | Manager 후속 코드검토: 결과 축소 시 slice/label clamp 뒤 이전/다음 버튼이 raw page를 사용하면 첫 이전이 무반응일 수 있음 | 유효 offset/size의 page를 버튼에 사용하도록 요청. 동일 key 조건 초기화의 intent 취소도 명시 | 새 source 최종 검증에서 확인; 앞선 clamp 수정만으로 완료 주장하지 않음 |
| U809-07 | Manager CSS 검토: warning에 미정의 status-warning-foreground 사용으로 일반 글자색 fallback | 기존 semantic token status-warning을 재사용하도록 요청 | 전역 token/테마 변경 없이 최종 캡처에서 확인 |
| U809-08 | qa_docs: 상세 scrollIntoView 후 닫기에서 focus preventScroll만 사용하여 root panel의 출발 스크롤이 복원되지 않을 위험. AC3 모바일/긴 목록 | 선택 직전 root scroll 저장 및 같은 close lease/세대 가드에서 복원하는 최소 보완·대표 실제 검증 요청 | 기존 일정 왕복 gateway의 scroll 보장과 상세 닫기 범위를 구분, 최종 결과 대기 |
| F809-L10 | 후속 #809 E2E180초 timeout: 기간과 개인 업무 집중의 R2 query가 같은 pivot[resource]인데 테스트가 새200응답을 기다림. TEST_OBSERVABILITY | 동등 query의 source/ID·요청 수 불변을 검증하고 다른 기여 pivot에서만 새 응답을 기다리도록 교정 | 중복 fetch를 강제하지 않으며 timeout/행동 단언 약화 없음. 원본 failures/equivalent-query-observer.md 보존, 최종 실행 대기 |
| U809-09 | 구현 중 chart peer 진입에서 숨은 legacy Plan이 summary로 바뀌어 unmount될 수 있음을 발견 | ResourceWorkspace가 charts 동안 마지막 reportView를 유지하도록 교정 | 인접 기존 #807/Plan 검증에서 상태·공간·요청 보존 확인 예정 |
| F809-L11 | cache 교정 뒤 일정 복귀에서 DOM/선택은 유지되었으나 focus FAIL(35.2초). host focusNavigation이 새 chart를 WBS consumer로 인식하지 못해 숨은 legacy visit을 복원 대상으로 사용. PRODUCT/host 식별 경계 | chart 고유 WBS consumer·visit/ready/project marker를 기존 captureNavigation/MutationObserver 복원 계약에 연결하고 WBS root가 있을 때 legacy receipt fallback을 차단 | F809-L09의 cache 교정은 필요한 일부 보완이며 focus 전체 근인 해결은 아니었음. 원본 failures/navigation-return-focus-root.md 보존. 같은 복귀 계약의 연속 실패로 독립 QA가 cache/root/receipt/trigger/busy/scroll/사용자 focus 전 경계를 종합 재검토 |
| U809-10 | Manager/qa_docs의 host 복귀 종합 검토: chart 내부 표/plot에 기존 scroll ingress marker가 없고 h3가 focus 불가라 원 trigger 소멸·오류 fallback이 무효 | 기존 data-wbs-scroll로 scroll owner를 연결하고 h3 tabIndex=-1을 적용하도록 요청 | 기존 captureNavigation/MutationObserver/focus gateway 재사용, 별도 writer 추가 없음; 변경 후 같은 복귀 위험 합집합 확인 |
| F809-L12 | 새 응답 역전 음성에서 slow query 취소 후 이전 확정 query로 복귀 시 fetch 중복은 없지만 pending=true가 남아 차트를 표시하지 못함. PRODUCT/cache 수명 | cache-hit에서 현재 요청/취소 가드 하에 pending 해제. 확정 model·요청 수 불변과 낡은 응답 무시 단언 유지 | 원본 failures/reversed-request-cache-pending.md 보존. 같은 source에서 최종 통합 실행으로 확인; 일정 복귀/390px close/touch/reduced-motion의 중간 통과와 전체 PASS를 구분 |
| F809-L13 | physical-type transport 양성 추가 준비에서 private 키를 잘못 사용해400. TEST_INPUT, 실행 경계 상세는 최종 영수증에 기록 | 실제 public-v2 physical type 입력과 source filter alias 동등성으로 교정·양성1case 추가 | 기존 v1 private 필터를 공개 입력에 되살리지 않음. 최종 Unit26case 예정 |
| U809-11 | QA의 host scope handoff 중 닫기→자체 busy 변경이 close RAF lease를 폐기할 수 있다는 정적 경합 가설; 실제 FAIL 미확정 | close용 사용자 intent/key/active와 자체 request busy 세대를 분리 검토, 두 번째 scope 지연 경계 확인 요청 | 추측을 실제 실패로 계산하지 않음. 기존 R809-005·U809-01의 수명 계약 안에서 최종 확인 |
| F809-L14 | physical-type 양성에서 올바른 public equipmentTypeCodes 응답을 신규 분석 validator가 거부. PRODUCT/consumer false rejection | WBS 구성 참고용 유형 조건은 기존 ledger 공수 predicate에서 제거되는 계약이므로 분석의 effective sourceFilters와 구성 조건을 분리 | 초기 alias/scopeKey 가설은 미재현으로 정정. 공개/폐기 조건 검증 유지, 신규 양성을 포함한 최종26case 재검증 |
| F809-Q01 | qa_docs 실제 fixture→service→v2→transport 독립 양성 스크립트의 첫 Node ESM 실행이 tsx/CJS named export interop 준비 오류로 FAIL. TEST_ENVIRONMENT | require interop로 준비 교정 | 실제 양성5개(resource/group/role/month M/M/null branch) PASS. 제품 오류로 계산하지 않음 |
| U809-12 | 동결 후 실제390px 캡처에서 같은 KPI grid row의 오른쪽 label만2줄이라 값 Y725/743·817/835로18px baseline 차이. PRODUCT_UI/실측 P2, document overflow0과 별도 | 기존 source 실행/관측을 보존한 뒤 국소 column flex+dd 하단 정렬로 교정 | CSS만 변경 후 r02 source 동결·최종 차트15+KEEP5 재관측과 #809대표case 재검증. 비영향 Unit26/서버73/인접case는 hash·의존성 근거로 재사용 |
| F809-E01 | 최종 E2E3case와 after-final15 수집·owned3209 Next/CLI 프로세스가 SIGTERM/exit143으로 중단. 최초 원인은 UNKNOWN 보고였으나 이후 사용자 daemon_recovery 메시지로 서버 재시작 확인. ENVIRONMENT | r01 source/증거/fixtureDB 보존 뒤 새 frontend·qa_docs·infra Agent로 재개. global node 정리/제품 오류로 추정하지 않음 | 기존 #73651.5초PASS만 완료, 나머지 E2E 및 after-final4JSON/manifest없음은 PARTIAL/미완료. CSSr02교정·미완료실행/최종capture 재개, 기존73/26 영수증은 hash 동등성으로 재사용 |
| F809-E02 | 복구 준비에서 manual 재인증 body의 password 대신 editPassword 계약을 놓쳐400, E2E에 PLAYWRIGHT_BASE_URL=3209를 지정해 warm DB를 재사용하여 #807/#809 모두 BU/P/S fixture POST400으로 제품 진입 전 FAIL(총6.64초; 각3.5초/343ms). TEST_ENVIRONMENT/기존F809-L06 재발 | body를 실제 계약으로 교정·외부 BASE_URL을 제거하고 표준3100/격리 DB로 재실행. 준비 실패 원본 JSON/trace/log 보존 | 해당 두 실패를 제품/최종 검증 PASS로 전용하지 않음. source는 r02 CSS 외 변경0, 기존 source/hash99case는 별도 보존 |
| F809-E03 | 복구 collector가 재인증 전에 시작되어 첫 period390의 편집 중 wait30초 FAIL. concentration390은 KPI baseline0/document overflow0 관측했으나 contribution390의 tab wait30초도 timeout(근인UNKNOWN). 동시3Next 서버/공유 tsconfig 자동 갱신이 관측됨 | 소유 collector PID만 확인해 PARTIAL로 중단하고 E2E 완료 뒤 manual 서버/CLI를 안정화하여 순차 전체15+KEEP5 재수집 | 동시 실행을 확정 원인으로 단정하지 않음. source는 CSS 외 변경0, timeout/단언 완화0. 중간 baseline0 관측을 전체15 PASS로 확대하지 않음 |
| R809-006 | 복구 독립 QA의 실제 fixture→service→scope→navigation 재현: 개인 R1 reportTask4개, T0 개인미배정2개 모두 report밖. 차트 T0→일정이 개인 report의 exactSelection subset guard에서 REPORT_STALE 거부. PRODUCT/AC3, fail-closed이나 정상 진단 탐색 불가 | 원 개인 source 재검증 후 원 기간/상태/Task/실물 scope는 유지하고 개인 조건만 제외한 기존 report를 명시적으로 조회, 동일 canonical 출처·정확T0부분집합 확인 후 기존 host에 새 report와 T0 exactSelection 인계 | 기존 subset/API/예산·권한 gate 완화 없음. T0명시 action에만 조회, 특화 교차 unit와 대표 E2E 재검증 후 최종 판정 |
| F809-Q02 | r03 feature 독립 실행 전 source guard가 dashboard와 초기 product-freeze-r03.json hash 차이로 BLOCKED(exit3/실행0). T0 추가 await 후 stage guard 보강 중 source 이동을 정상 차단 | 기존 freeze를 덮지 않고 product-freeze-r03-final.json으로 새 동결. T0 origin→추가 report→host 인계 전 mounted/intent/actionGen/liveKey를 재검증 | 제품 test FAIL 아님. 진행 중 E2E는 중간 증거로 구분하고 새 freeze 전후 동일 #809 재실행·독립27case 확인 |
| F809-S01 | 게시 전 실제 민감자료 예방 검토: recovery-e2e raw error-context.md2개에 credentialAssignment 패턴 각각2건(값 출력0). JSON 후보의 민감 필드0, ZIP2/log12/임시CLI2도 제외 대상 | 해당 raw Markdown2개도 로컬 원본만 보존하고 공개 allowlist에서 제외. 정제된 failures 문서·선별PNG·요약JSON만 게시 | git stage/commit/push/PR0인 시점에 발견하여 원격 유출0. 실제 제품 취약점/실행 FAIL과 구분, 최종 stage에서 재확인 |
| F809-P01 | 명시189파일 staging 뒤 cached diff whitespace check가 공개 failures/*.md6개의 Playwright codeframe trailing space20줄로 FAIL. EVIDENCE_FORMAT, 제품/실패 의미 변경과 별도 | 원본 bytes를 로컬 ignored .prepr-reports/issue809-publication/raw-failures에 먼저 보존하고 공개 Markdown의 줄끝 ASCII 공백만 정제. 전후SHA/수/범위를 failure-sanitization.json에 기록 | diff gate 예외/완화 없이 restage 후 전체 cached check 재확인. 원본 FAIL·메시지·코드/라인정보 유지, 제품/테스트 변경0 |
| F809-P02 | 전체190파일 allowlist·민감key/문자열0·551hash/cached whitespace/version/DOCgate PASS 뒤 일반 git push가 Invalid username or token / password authentication not supported로 거부(exit128). ENVIRONMENT/AUTH, 기존 CLI 인증경계 재현 | 원격 branch/PR0을 확인하고 연결 GitHub API로 동일 bytes/mode/tree/parent를 보존해 게시. 원장만 미게시 단일 commit에 amend | 제품/테스트/registry 변경0·민감값 출력0. 새 원격 SHA/tree/부모/리뷰·충돌·CI 등록을 실제 재조회하여 인계 |
| D809-001 | #808 pure adapter는 서버 canonical ledger 입력이 필요하고 기존 WBS report에는 chart 결과가 없음. 설계 발견이며 test FAIL 아님 | 같은 transaction의 기존 WBS query opt-in 분석 seam으로 소유 범위 확장·frontend/backend 분리 | 신규 API 계약/예산/동일 source·정확 상세 연결을 검증해야 함 |

## 로컬 실패·검증 합집합

착수 시에는 제품 테스트 실패가 없었다. 이후 실제 발견·실패·교정은 위 누적 사건 매트릭스와 아래 교차 원인/최종 검증 절에 보존한다. 미실행·중단을 PASS로 사용하지 않는다.

## 남은 범위

요청 종료점은 Ready PR Full CI 시작이다. 새 exact Head의 quality/e2e/docker 및 Trusted/Owner 결과는 NOT TESTED이며 모니터링하지 않는다. 병합·Main/GHCR·Release/Finalizer·Issue 종료·환경별 최종 수동 UX는 이번 실행에 포함되지 않는다.

## 초기 원격 사전조회

infra `/root/publication`이 실제 조회했다. #809 canonical PR/remote branch0, Manager PLAN댓글1. 선행 PR810/811/812의 리뷰는 각각1/2/0개이며 모두 resolved, 미해결 이관0이다. 열린 PR8개(#791/#708/#721/#563/#675/#346/#395/#259)의 파일 전수조회에서 Resource chart/analysis/WBS service 직접 겹침0, 문서/package 잠재 겹침은 있으나 실제 충돌 아님. main은 baseline과 같다. 초기 `AGENTS.md`/`next-env.d.ts`/`tsconfig.json`·`.next-809/` 자동 생성은 frontend가 소유와 종료 전 정리를 확인하며 관련 지침 변경을 구현에 포함하지 않는다.

## R809-001 독립 검토 반례·원인 정정

별도 `/root/chart_qa`가 baseline `resource-analysis.ts`의 scopeBody가 이미 task identity 6필드를 재구성함을 확인했다. 따라서 위 backend 초기 보고의 “selected.rows 전체 전달만으로 scopeKey에 legacy ID가 누출된다”는 인과는 현재 baseline에서 입증되지 않았다. 최초 주장은 역사로 보존하되 **실제 누출 확정은 철회/미입증**으로 정정한다. 신규 호출부의 최소 pick은 방어적 경계 명시이며 direct/mixed HTTP 공개 모델 전체의 폐기 ID 부재 검증은 유지한다. 실제 RED가 있다면 별도 source·메시지와 함께 추가한다.

R809-001 추가 확인: backend도 원본 domain198의 기존 방어를 재확인했고 RED 실행이 없었음을 명시하여 초기 누출 확정을 정정했다. direct/mixed HTTP5/5에서 모델 전체·scopeKey의 archived UUID/필드 부재를 확인했다. 최소 입력 pick은 방어적 계약 명시로 남긴다.

## 서버 동결·독립 검증

backend 최종3파일73/73 PASS: 실제 WBS HTTP/SQLite31 + #736 Plan/OOXML9 + R2 domain33, failed0/skipped0. 별도 `/root/chart_qa`도 같은5개 소스/테스트 hash를 전후 확인하고3파일73/73 PASS(원본 `/tmp/issue-809-qa-backend.json`)를 독립 실행했다. direct/mixed 공개v2·ghost Assignment 교집합·shared5·선택80/Project140·미설정/null/0/M/M·strict 음성·100Resource×1년 matrix422를 포함한다. [서버 영수증](evidence/issue-809/backend-validation.json)에 명령/환경/source hash를 보존한다. UI/transport·브라우저 및 최종 원격 검증과 구분한다.

F809-L02 후속: frontend가 작성 중 구문 오타를 교정하고 다음 전체 TypeScript 실행 PASS를 보고했다. 아직 최종 UI source 동결 전 결과이며 최종 통합 검증을 대체하지 않는다.

## 복귀 계약의 교차 원인 재검토

F809-L08은 pending 상세 닫기의 React disabled→focus timing, L09는 일정 왕복에서 query 재요청으로 DOM/scopeKey가 바뀐 경계, L11은 DOM 보존 뒤 기존 host가 chart root를 식별하지 못한 경계다. 단일 focus 증상으로 원인을 합치지 않는다. 기존 원장/정적 리뷰 R809-002·003·005 및 U809-01·02·08을 함께 확인하고, 모델 세대/정확 ID·수명·같은 visit·root receipt·기존 observer·출발 scroll/가시 trigger·새 사용자 focus 우선권의 producer→consumer를 종합 검토한다. 반복 timeout/전체 테스트 무작정 재실행이나 별도 focus writer로 우회하지 않는다. 최종 동결 source에서 실제 새 case와 기존 #807/Plan 인접 검증으로 교정 합집합을 확인한다.

## 중간 통합 PASS와 최종 동결 경계

#809 복합 Chromium 1case가31.2초 PASS했다. 실제3유형·선택80/Project140·Editor·child scope 지연 취소·390px 상세 닫기 scroll/focus·일정 왕복·응답 역전·412/401·touch emulation·reduced-motion emulation을 통과했다. 이후 host의 두 번째 scope 지연 취소·close focus lease/busy 분리·known-stale/export cache 무효화를 추가하므로 이 중간 PASS는 최종 소스 전체 PASS로 대체하지 않는다. 최종 동결 source·인접 케이스와 새 영수증을 아래에서 별도로 확정한다. 실제 기기·screen reader/native125%·production은 미검증이다.

qa_docs 중간 독립 검증: 동결551항목에 대해 feature3suite26/26 PASS, actual fixture→service→public-v2→transport 양성5개 PASS. 이후 U809-12 CSS 변경은 feature 모델·transport·navigation 또는 서버5파일을 변경하지 않으므로 해당 검증은 source hash 일치 범위로 재사용한다. 브라우저/geometry는 CSS 새 source에서 다시 확인한다.

## 서버 재시작 후 재개

사용자 daemon_recovery 지시 이후 현재 worktree·diff·영수증·원격 refs를 재확인했다. commit/push/PR 생성은 아직 없고 main `56a094b797300a554909cd8d81ef0bafe46d6def`는 유지된다. `.data/manual-809.sqlite3`와 fixture17은 보존되었으며 이전 `/tmp` 설정/프로세스는 소실됐다. 기존 `/root/chart_implementation`·`/root/chart_qa`·`/root/publication` 실행 이력은 증거대로 보존하고, 실제 새 `/root/chart_recovery`·`/root/qa_recovery`·`/root/publish_recovery`가 미완료 단계만 이어받는다. 이전 Agent의 PASS를 새 Agent가 직접 실행한 것처럼 표시하지 않는다.

## 공개 증거와 로컬 원본 분리

복구 실패의 Playwright trace.zip에는 네트워크 Cookie/세션값이 포함될 수 있어 로컬 원본만 보존하고 Git 게시 대상에서 제외한다. 복구 qa_docs가 실제 trace.zip2개의 JSON 필드 개수만 확인하여 각각 Cookie2/Set-Cookie2/password body key1을 관측했다(값 출력0). 원격 mutation0 시점에 차단했고 제품 보안 결함/이미 외부 유출로 분류하지 않는다. 임시 *.cli.js도 stage에서 제외한다. runtime DB·.playwright-cli 콘솔·.next 출력도 제외한다. 게시 증거는 민감한 요청/응답 헤더를 포함하지 않는 Markdown error-context·선별 화면·요약/해시/명령 JSON으로 구성한다. 원본 실패의 발생·분류·경로/해시는 원장에 남기며 제외를 실패 삭제/성공 전용 근거로 쓰지 않는다.

## r02 복구 검증과 r03 T0 연결

r02 CSS 교정 source에서 기존 #807 peer/Plan DOM·숨은 차트 공간0은52.4초, #809 확장 종합 case는48.3초 PASS했다. 서버 재시작 전 완료된 #736 Target0/Plan·Excel·412의51.5초 PASS는 해당 코드·테스트 비영향 hash로 재사용하며 한 실행의3case PASS로 합산하지 않는다. r02의 실제390 KPI 값 box baseline은743/743·835/835, 공통 높이44px로18px 차이를0으로 교정했다.

R809-006 r03 구현은 명시 T0 선택에만 개인 조건7개(`resourceIds/groupIds/roles/developerGrades/search/resourceActivity/groupActivity`)를 제외한 기존 report를 조회한다. taskSearch·기간/상태/Task/WBS/Milestone/실물 조건·원 binding.scope는 유지하고 analysis/granularity는 생략한다. 원 source를 먼저 재검증하고 실효 기간/환산 기준·동일 canonical 출처와 정확 T0 subset을 확인한 뒤 host에 Assignment0인 정확 Task 집합을 전달한다. 일반 차트 조회에 추가 요청이 생기지 않는다. 기존 feature3suite에 실제 fixture/service/scope→navigation 교차1case를 EXTEND하여27/27 PASS를 보고했으며, 이 절을 기록한 당시 개인 필터 T0 Editor/일정 왕복의 최신 #809 browser·독립 QA는 대기였으며, 아래 r03-final 실행/최종 교정 판정에서 확정했다.

## r03-final 독립 코드·연결 재검증

복구 Reviewer `/root/qa_recovery`가 새 `product-freeze-r03-final.json`의551항목 hash를 실행 전후 확인하여 불일치0, feature3suite27/27 PASS(failed0/pending0/exit0)를 실제 실행했다. 이전 서버5파일 hash는 같아 원래 Reviewer의73/73를 재사용하며 고유6파일100 Vitest case다. 이전26을 추가 합산하지 않는다.

원본 R809-006을 새 helper→실제 service→public-v2→scope→기존 navigation으로 재검증하여 T0 Task2/Assignment0 정상 인계에 성공했다. source revision/dataSnapshot/catalog/calendar·기간/asOf/md basis/provided·원본 scope·중복·개인 배정 Task 오인 음성11개 및 개인7조건 제거/비개인조건 보존 등 별도13체크를 PASS했다. 이는100 Vitest에 중복 합산하지 않는다. 추가 T0 await의 rejection은 기존 revalidate의 catch로 수집(cache 폐기/stale), 취소·소유 controller·actionGen/liveKey/mounted/intent 가드가 late handoff나 새 pending 덮어쓰기를 차단함을 독립 검토했다. 이 절을 기록한 당시에는 actual browser와 최종 geometry/DOC_SYNC 완료 증거를 기다렸으며, 아래 최종 실행/화면/교정 판정이 현재 상태다.

## 최종 r03-final 기능 실행

실제 #809 종합 Chromium은551항목 source/test guard의 실행 전후 불일치0에서1case57.8초 PASS(총 실행1.4분, exit0, retry0)했다. 개인 조건 T0의 원본/정확 일정 왕복과 기존 수치·출처·scope·지연 취소·모바일 focus/scroll·역전/401/412·touch/reduced-motion emulation을 같은 실행에서 확인했다. `recovery-e2e-final.json`과 `recovery-e2e-final-source-guard.json`이 원본이다. 중간 PASS·원본 실패를 덮지 않으며 원격 Required/Trusted/Owner PASS가 아니다.

## 최종 r03 화면 실증·KEEP

`after-final-r03`는15/15 관측·fault0·sourceStable=true, 같은 canonical revision17/Task 배열4/Assignment1(일반 작업 KPI와 별도)·fingerprint 전후 동일·capture 중 writes0, 다섯 폭390/768/1024/1440/1920px의 document overflow0이다. KEEP5도5/5·fault0·동일 제품hash·sourceStable=true다. before-final→KEEP의 기본 현황 KPI/table Y는5폭 모두 같다:390=1017/1458,768=670/958.5,1024=578/799.5,1440/1920=526/747.5. 완전히 보이는 기본 표 행0/0/0/1/1도 같다. 이를 모바일 표가 첫 화면에 들어온다는 주장으로 확대하지 않는다.

U809-12 교정의 실제390 glyphRange는 첫 KPI row의 두 값 Y754.40625/754.40625, 다음 row846.40625/846.40625로 delta0/0이다(dd 높이44px). 새 차트의 표 완전 가시행은390에서0이며1440/1920도기간표1행·집중/기여표0행이다. 그래프/데이터 표 전체와 기본 현황 가시행을 구분하고 전폭 first-fold 데이터 가시 PASS로 표현하지 않는다. 브라우저 runtime0.134.0과 source546hash 동등성을 확인했으며 package version-only 변경 뒤 정식 버전의 원격 build/Required 결과는 새 PR CI에서 확인한다.

## 최종 교정 판정과 게시 경계

- R809-001은 실제 누출 RED가 없는 초기 가설 오판으로 철회/정정했으며 기존 R2 방어와 mixed/direct 응답 음성 PASS를 보존한다.
- R809-002/003/005/006·U809-01~11과 F809-L08/09/11/12의 코드·범위·수명·복귀/캐시 지적은 최종 feature27·추가 T013체크·같은 r03-final551 source의 #80957.808초에서 교정 확인했다. Unit/특화체크/실제 browser의 환경과 case 범위는 영수증대로 구분한다.
- U809-12의 실제18px glyph 차이는 최종390 delta0/0·15차트/KEEP5·5폭overflow0에서 교정 확인했다. 기본 현황 Y/가시행은 그대로 유지하며 모바일 first-fold 표 가시 PASS를 주장하지 않는다.
- F809-L01~07/10/13/14·Q01/Q02·E01~03의 준비·locator/관측 계약·source 이동·재시작 이력은 그대로 보존한다. 최종 완료 source/명령/성공으로 과거 FAIL/BLOCKED/PARTIAL을 덮지 않는다. trace.zip/임시CLI/실행로그/runtime DB는 로컬 원본만 보존하고 공개 증거에서 제외한다.

패키지/lock 버전3필드만0.135.0으로 변경했으며 제품546/테스트5 hash는551항목 모두 같다. TypeScript/대상 lint·version/Markdown/diff와 DOC_SYNC/AC 구조 검사를 구분하고 최종 독립 사전검토 뒤 새 PR Full CI를 시작한다. 새 remote Head의 Required3·Trusted/Owner·Manager ACCEPT는 NOT TESTED, 병합/정식 게시/Issue 종료는 요청 밖이다. 실제 Head/PR/Run/Attempt·리뷰/mergeability는 Issue STATUS와 PR에 기록하여 문서 자기참조용 추가 push를 만들지 않는다.

최종 독립 LOCAL_PRE_QA/DOC_SYNC 의미 PASS: `/root/qa_recovery`가 current551 source/증거·version3필드만 변경·자동 생성 설정 diff0과 위 실행/실측·T0/async 계약을 직접 대조하여 새 P1/P2 없음으로 판정했다. 원격 staging의 민감 ZIP/임시CLI/runtime 제외, 최신 main/리뷰/충돌과 PR/CI 등록은 infra가 마지막으로 확인한다. 원격 QA/Owner/Manager는 NOT TESTED다.

게시 통제 추가: 원본 recovery-e2e 하위 error-context.md2개도 credentialAssignment 패턴으로 공개 제외했다. ZIP/Markdown 원본·실행로그·임시CLI를 보존한 로컬 경로와 공개 정제 증거의 범위를 구분하며, 모든 후보 JSON/정제 문서의 민감 필드/대입 패턴을 값 출력 없이 점검한다.

공개 실패 문서 줄끝 공백 정제는 [전후SHA 영수증](evidence/issue-809/failure-sanitization.json)으로 추적한다. 원본 bytes는 로컬 ignored 경로에 보존하고 공개본은 ASCII trailing whitespace만 제거했다. 실패 내용/코드/라인 판정은 동일하며 원본 실패를 성공으로 바꾸지 않는다.

일반 push 인증 실패 F809-P02는 원격 branch/PR 생성 이전에 발생했다. 저장된 CLI 자격값을 추출/공유하거나 권한/CI 정책을 우회하지 않고 이미 연결된 GitHub 앱의 승인된 저장소 쓰기 기능으로 동일 산출물을 게시한다. 원격 commit/PR/CI는 실제 조회 전 PASS로 간주하지 않는다.

## 2026-10-26 KST — F809-CI-001 / PR #813 Full #3304.1 최초 원격 실패와 통합 교정

### A–C. 모든 확인 가능한 원격 실행·최초 직접 실패·Cross-run

| PR / Run / Attempt | 원본 SHA 및 분류 | 결과 / 첫 실제 실패 | 후속·누락 |
| --- | --- | --- | --- |
| [#813](https://github.com/planner77/masterGantt/pull/813) · [CI #3304.1 / 40235454996](https://github.com/planner77/masterGantt/actions/runs/40235454996) · 1 · pull_request / CI | Head `e25c34c54f1044a8217cf82f91171a37486a974b`, Base `56a094b797300a554909cd8d81ef0bafe46d6def`, test-merge `e1237cdfcbabc50a4c6e8555af4387d34fdd6415` | [Shard 1/8, Job 121296525737](https://github.com/planner77/masterGantt/actions/runs/40235454996/job/121296525737) 실제 FAILURE, Playwright `tests/e2e/milestone-timeline-lane.spec.ts:231` #551 3,000 canonical rows (1,000 Task + 2,000 Milestone), `Test timeout of 30000ms exceeded`, `settle()` line 24의 `page.evaluate` 내부 5×requestAnimationFrame. 해당 shard 56 PASS/1 FAIL/47 NOT RUN. | Shard 2–8은 취소(CANCELLED; 내부 개별 PASS/FAIL 미확정). Required quality SUCCESS, docker SUCCESS, E2E aggregate [Job 121300194861](https://github.com/planner77/masterGantt/actions/runs/40235454996/job/121300194861) FAILURE(파생), QA Final Automated [Job 121300215810](https://github.com/planner77/masterGantt/actions/runs/40235454996/job/121300215810) FAILURE(파생: required E2E 미성공). |
| 같은 Head의 [보조 Workflow 40235455019](https://github.com/planner77/masterGantt/actions/runs/40235455019) | skipped | 실행된 테스트 없음 | 원본 Full 실패 횟수에 합산하지 않음 |

기존 Issue #809 원장에는 원격 Full PR 실패가 없으며 최초 게시된 CI는 위 #3304.1이다. 이 원장의 F809-L01~L14, E01~E03, Q/P/R/U 사건은 로컬 준비·UI/코드 검토 및 중단 등으로 보존되며 원격 Full 실패 횟수로 합산하지 않는다. `GitCommitInfo`의 3초 `git fetch` 경고는 이후 56개 PASS가 이어져 최초 직접 실패로 채택하지 않는다. 개별 Shard 중도 CANCELLED를 성공으로 추정하지 않는다.

**F809-CI-001 원인 분류: UNKNOWN (browser rendering/performance/fixture/runner contention 가설 검증 전).** 실패 지점은 `settle`의 5 RAF 대기이며 Gantt 스크롤/resize assertion에서 관찰된 불일치의 근거는 없다. 부하가 높은 3천 Task fixture의 제품/runner 정체 가능성은 가설이고 원본 30초 timeout 증가, 3천 건 축소, skip/retry 및 CI gate 완화는 하지 않는다. Shard1의 [Playwright report artifact 12614997477](https://github.com/planner77/masterGantt/actions/runs/40235454996/artifacts/12614997477)와 [timing artifact 12615112219](https://github.com/planner77/masterGantt/actions/runs/40235454996/artifacts/12615112219)가 별도 원본이다. 새로운 CI에서도 재현하면 해당 trace/프레임 구간 확인 후 원인별 교정이 필요하다.

**R809-007 / PR [미해결 P2 review](https://github.com/planner77/masterGantt/pull/813):** `resource-charts-dashboard.tsx`의 일정 이동 버튼이 `data.taskIds` WBS subset만 검사해, 선택 Task 80% vs 동일 개인 Project 140%에서 외부 Task를 포함하는 합법적 Plan 원본의 이동까지 숨겼다. 검증된 PRODUCT/UI 제어 조건 결함이며 F809-CI-001의 Milestone 브라우저 timeout과는 별도 원인이다. 선택 Project Plan은 기존 read-only `onResourceSchedule`/Plan `demandScope=project` 원본 gateway가 있을 때만 열고, 일반 WBS는 exact task subset, T0 진단은 기존 예외, gate 부재 시 fail-closed로 유지한다.

### D–F. 전체 실패 경로 합집합, 변경 영향, 수정과 검증 경계

- **기존 직접 FAIL 합집합:** 원격 `tests/e2e/milestone-timeline-lane.spec.ts`의 #551 large/resize/fullscreen. 원장의 로컬 UI/fixture·scope/focus·T0/역전 오류는 기존 최종 #809 검증 영수증에 보존. 7개 취소 shard는 추가 미실행/미입증이며 PASS 아님.
- **이번 변경 범위:** chart Plan/WBS 선택 gate를 공유 순수 함수 `resourceChartCanNavigate`로 분리, Project Plan 외부 Task 허용·WBS 제한·T0·무게이트 음성 Unit 2건 추가. 기존 `tests/e2e/issue-736-resource-dashboard.spec.ts`의 선택80/Project140 fixture에 외부 Task 일정 이동, 원래 보기/focus·필터 유지 실제 browser 단언을 추가. 원격 직접 실패 #551 large case는 일곱 개 5-frame settle 경로만 Playwright `test.step`으로 구분하여 **실패 원인 관측을 보강**하고 시간/데이터·assertion/재시도 정책은 변경하지 않았다.
- **KEEP_UNIQUE:** 기존 #551 Milestone 축/3천 건/전체 화면 시각 정합, 기존 WBS/Plan/Excel/OOXML·상호선택·T0/401/412/8-shard. 차트 일반 원장 산식·DB/ACL·기간·Task/Assignment 원시 집합·CI/Required/QA/Release는 변경하지 않는다.
- **본 GitHub 연결에서 로컬 Node/Chromium/Docker 실행:** NOT TESTED(체크아웃·실행 가능 런타임 미제공). 원본 이전 Head의 56 PASS/품질·Docker success는 이번 수정 후보 SHA의 통과 증거가 아니다. 수정 코드는 source contract/정적 비교로만 확인하며 **동일 source 통합 E2E, TypeScript, Vitest, Docker, Trusted QA 및 리뷰 이후 Quality/E2E8/Docker 결과는 새 원격 Head에서 확인해야 함**.
- **Cross-run 요약:** F809-CI-001 `#3304.1 / Shard1 / milestone-timeline-lane.spec.ts` 직접 FAIL → 새 Head에서 동일 #551/E2E8 재검증 대기, 원인 UNKNOWN. R809-007 `#813 P2 / chart Plan navigation` 확정 결함 → Unit 음성/확장 E2E 실행 대기. 이슈 내 다른 원격 Full PR 실패는 검색된 접근 가능 실행에 없음.
- **병합/승인:** mergeable true, latest main 대비 behind0은 보완 전 원격 조회 사실. 새 commit 이후 다시 PR mergeability/review0 확인. `risk_level=HIGH`, `qa_method=OWNER_MANAGED`, Required3/Trusted QA/Manager ACCEPT/정식 GHCR는 아직 새 Head에서 미입증, MERGE_READY=BLOCKED. 새로운 Full CI는 `synchronize` push 이후 Issue/PR 댓글의 불변 Run ID/Attempt를 사용해 별도 추적하며 시작을 성공으로 해석하지 않는다.
