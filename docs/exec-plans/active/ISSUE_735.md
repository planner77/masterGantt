# Issue #735 — 물류 시스템 관점과 직접·조율 조회

## Issue Work Packet

- Issue: [#735](https://github.com/planner77/masterGantt/issues/735), 상위 #723, 선행 #724/#726/#728/#729/#730; 기존 #188/#624 호환과 #717/#719 표현 규칙을 유지한다.
- lifecycle_phase: IMPLEMENTATION → DOCUMENTATION_SYNC → 독립 사전 검토 → PR Full CI 시작.
- baseline_sha: `8a0fc9773d33326b40f8d97f6307c17ae0cb6933` (main, #733 통합).
- branch: `feat/issue-735-system-dashboard`; 별도 worktree를 사용하고 원래 checkout의 미추적 증거를 보존한다. 기존 #735 PR은 착수 조회에서 없다.
- baseline_version: `0.125.0`; candidate_version: `0.126.0` MINOR. 시스템 전용 조회 기능을 추가하며 dependency 버전은 변경하지 않는다.
- risk_level: HIGH; risk_reason: 시스템 consumer에 필요한 직접/조율·정확 시스템 선택을 공통 WBS API/spec/snapshot에 연결한다.
- qa_required: true; qa_method: OWNER_MANAGED; independent_qa: N/A(독립 인간 검토 없음); manager_decision: NOT TESTED; MERGE_READY: BLOCKED.
- release_required: true; release_authorized: false. 구현·리뷰 thread/충돌 해결·PR CI 시작까지만 요청되었다.
- documentation_owner: Manager; issue_comment_writer: manager; issue_comment_allowed_types: PLAN, STATUS, EXCEPTION, RESUME.
- 비범위: CI 모니터링·병합·main/GHCR·Release/tag·브랜치 정리·Issue 종료, 새 계산기/DB/제어 엔진/Gantt/WBS·Assignment·Target writer, 운영 실적/가동률 추정.

## 소유권과 공통 계약 보완

ui_ux는 읽기 전용 설계, frontend는 시스템 descriptor/consumer·공통 optional control hook·client spec/transport와 Unit, backend는 공통 WBS API의 최소 corrective와 실제 SQLite/API 테스트, 별도 frontend는 전용 실제 API/UI E2E를 소유한다. Manager는 문서·버전·통합을, infra는 원격 게시·PR·CI 시작과 thread/충돌 확인을 담당한다. qa_docs는 실제 분리된 읽기 전용 사전 검토다. Agent의 사전 검토를 독립 인간 QA 또는 최종 Owner ACCEPT로 표시하지 않는다. 동일 파일을 여러 작성자가 동시에 수정하지 않는다.

`WbsViewSpec.systemView?: direct|coordination`, `systemIds?: string[]`를 system root에 한해 허용한다. 생략은 기존 동작이며 명시 빈 ID 배열은 빈 선택이다. 서버가 같은 Project의 원본 ID와 한도를 검사하고 spec을 report/details/scope/sourceContext/snapshot에 결속한다. 조율은 기존 Domain의 명시 coordinates 도달 System·실제 controller의 controls 설비와 직접 연결의 Task 합집합이다. 같은 Task 연관을 controls/coordinates로 바꾸거나 다른 Task로 무제한 확장하지 않는다. 공정은 #728 최신 W2 결정에 따라 Task 자신의 명시0..N만 사용한다.

## Design Delta B

DESIGN.md의 Light UI/system font/semantic token·이름 우선·상황형 도움말·표 내부 scroll을 적용한다. 시스템 단독을 기본으로 공정/WorkArea/설비/리소스 및 Milestone/공정의 하위 preset을 제공한다. 기존 Project/root 개인 설정을 보존한다. 기존 저장 spec에 mode/IDs가 모두 없으면 이전 프로젝트 전체/미연결 작업 의미를 호환 모드로 명시 유지하고 사용자 선택으로 직접/조율로 전환한다. 자동 mode 삽입으로 행 key·접힘·선택·focus를 바꾸지 않는다. 속성 필터는 서버 시스템 선택을 변경하며 기존 표 이름 찾기(표시만 제한)와 구별한다. 구성·작업·공수/full Gate를 나누고 상세 설명·책임 역할·실제 관계·진단은 접기 영역으로 제공한다. 기존 공통 표의 열 예산과 정확 source editor/Gantt 복귀를 재사용한다. 새로운 SVAR 기능을 추가하지 않으므로 공식 demo 조작은 N/A다.

## 상태 정합성과 영향 선정

읽은 기준은 baseline `8a0fc9773d33326b40f8d97f6307c17ae0cb6933`의 GSC `1.0.0-candidate`, GANTT_STATE_CONFORMANCE, GANTT_ADAPTER_ADR, GANTT_SYNC_TRACE 및 LOCAL_PREPR/PR_CI_FAILURE_TRIAGE다. GSC-01/03/04는 기존 canonical·원본 편집 gateway·오류/stale 잠금을 재사용하고, GSC-06/07/08은 현재 spec/snapshot/source와 최신 intent를 재검증한다. GSC-09/10/11/12는 동일 Gantt 인스턴스·focus·5폭·Core 공개 API 경계와 누적 직접/음성 증거에 적용한다. 새 viewport/axis/Core writer·Store override·관측 facade가 없어 GSC-02/05의 구현 변경·예외 ADR은 N/A다.

누적 SC-11(Resource/Dashboard/Editor/일정 왕복)·SC-13(Milestone full canonical·원본 진입/복귀·저장0)을 직접 범위로 선정하고 marker-OFF를 유지한다. SC-01~10/12/14의 native DnD/Calendar/axis/대량 Core 알고리즘은 변경하지 않으므로 기존 원격 전체 회귀에 유지하며 전부를 로컬 실행했다고 주장하지 않는다.

producer는 system root spec/selector·report/detail/scope와 consumer/hydration이다. 직접 소비자는 전용9 SQLite/API·전용 UI Unit·실제 System E2E, 간접/음성은 기존 WBS HTTP25/domain32·model/transport·공정 consumer/등록-only 구성·물류 direct/coordination KPI·Resource rollup이다. 새 시스템 선택을 기존 타 root에 적용하지 않는 음성과 foreign/cyclic·empty0·409를 포함한다. 구 Target/Resource API·DB writer·일정 산식/PRO·운영 배포는 변경하지 않는다. 전체 Chromium/clean Docker/main GHCR는 공식 원격 Gate와 승인된 후속 범위로 구별한다.

## AC_TEST_COVERAGE

- AC1: 전용 consumer Unit/SQLite/API/E2E에서 Target0 MCS1+ACS A/B 단독 및 두 동적 하위 경로를 검증한다.
- AC2: 전용 API와 원장·KPI 회귀에서 direct/coordination exact Task/Assignment·고유 공수·공유 controller·다른 Task 누출0을 검증한다.
- AC3: 전용 fixture에서 프로젝트 공통/복수 공정/구역미사용/작업0/PI미설정/Target-only·혼합을 검증한다.
- AC4: 공통 원장 및 Resource 회귀에서 선택 고유 합집합·full Milestone Gate·기존 부하/Capacity와 구성 수량·공수 단위 분리를 검증한다.
- AC5: 전용 실제 Chromium에서 원본 System/Task/Assignment·일정/복귀·dirty/readonly/stale/error와5폭/keyboard/focus/overflow를 검증한다.

| AC | 직접 검증과 인접 회귀 |
| --- | --- |
| AC1 | `tests/features/resources/system-dashboard.test.ts`, `tests/server/resources/issue-735-system-dashboard.test.ts`, `tests/e2e/issue-735-system-dashboard.spec.ts`: Target0·MCS1/ACS A/B·단독 및 두 동적 경로 |
| AC2 | 같은 Unit/SQLite/API/E2E의 direct/coordination exact Task·Assignment, 실제 명시 관계·공유 controller·복수 경로·t1/t2/t3 합집합; 기존 `wbs-task-ledger`·물류 KPI 회귀 |
| AC3 | 전용 consumer/API의 프로젝트 공통·복수 공정·WorkArea 미사용·작업0·PI/개발자 미설정·Target-only/혼합과 다른 Task 누출0 |
| AC4 | 서버 원시 KPI·full Milestone Gate·개인 Assignment/Resource 분모, System1식·고유 제어 설비 quantity와 공수 분리; 기존 Resource 회귀 |
| AC5 | 전용 실제 Chromium의 System/Task/Assignment 원본·일정/복귀·dirty/readonly/stale/error·snapshot·5폭 keyboard/focus/내부 overflow; 공통 #730/#733·기존 #624 인접 회귀 |

위 표는 선정 계획이며 실행 전 PASS가 아니다. 실행 결과·최초 실패와 보완·검증하지 못한 항목을 아래 누적 원장에 기록한다.

## DOCUMENTATION_SYNC

- `docs/LOGISTICS_DASHBOARD.md`: UPDATED
- `docs/RESOURCE_KPI_DASHBOARD.md`: UPDATED
- `docs/WBS_TASK_LEDGER.md`: UPDATED
- `docs/LOGISTICS_DOMAIN_DESIGN.md`: UPDATED
- `docs/API.md`: UPDATED
- `docs/ARCHITECTURE.md`: UPDATED
- `docs/REQUIREMENTS.md`: UPDATED
- `docs/PROJECT_UX.md`: UPDATED
- `docs/UI_UX_GUIDELINES.md`: UPDATED
- `docs/TARGET_RESOURCE_USER_GUIDE.md`: UPDATED
- `docs/TEST_PLAN.md`: UPDATED
- `docs/exec-plans/active/PLAN.md`: UPDATED
- `docs/exec-plans/active/ISSUE_735.md`: UPDATED
- `CHANGELOG.md`: UPDATED
- `docs/ISSUE_735_FAILURE_ANALYSIS.md`: UPDATED
- `DESIGN.md`: N/A(기존 시각 언어·동적 조회·동급 분기 규범 적용, 규범 변경 없음)
- `docs/DB_SCHEMA.md`: N/A(schema/migration/저장 writer 변경 없음)
- `docs/SCHEDULING_ENGINE.md`: N/A(기존 Calendar/공수/Gate authority 재사용)
- `docs/SECURITY.md`: N/A(기존 public-read·bounded query·Origin/session/revision 정책 불변; 추가 selector는 같은 서버 검증)
- `docs/CI_CD.md`: N/A(workflow/릴리스 계약 변경 없음)
- `docs/REMOTE_VALIDATION.md`: N/A(기존 Full PR CI 시작만 수행하며 검증 정책 변경 없음)
- `docs/GITHUB_OPERATIONS.md`: N/A(권한/Ruleset/GHCR/운영 계약 변경 없음)
- `docs/TASK_EDITOR.md`: N/A(기존 editor의 저장/dirty/권한 계약 재사용)
- `docs/IMPORT_SCHEMA.md`: N/A(입출력 계약 재사용 및 변경 없음)
- `docs/EXCEL_EXPORT.md`: N/A(동적 spec Excel 미지원 유지)

## 누적 실행 및 실패 원장

- 환경 준비: Node `v22.14.0`, `npm ci --no-audit --no-fund` 447 packages/17초 PASS. 원래 checkout modules는 Next16.3.4여서 전용 worktree에 lock 기준 의존성을 새로 설치했다. 제품 dependency 변경은 없다.
- 클라이언트 Unit: `npm test -- tests/features/resources/system-dashboard.test.ts tests/features/resources/wbs-view-model.test.ts tests/features/resources/wbs-view-transport.test.ts` 3파일/15테스트 PASS. frontend 소유 파일 ESLint와 `npm run typecheck` PASS.
- 인접 회귀: 공정 consumer/구성-only SQLite·기존 물류 KPI·WBS acceptance·Resource rollup 5파일/51테스트 PASS. `node scripts/check-markdown-links.mjs` 278파일 PASS, `npm run version:check` 0.126.0 PASS.
- 최초 #735 backend 테스트는 stale 코드를 `STALE_RESOURCE_SNAPSHOT`으로 잘못 기대하여31PASS/1FAIL; 기존 계약 `REPORT_STALE`로 테스트를 교정했다. 구현 오류를 숨기거나 서버 stale 계약을 변경하지 않았다. 후속64테스트 PASS; scan budget·direct controller10·foreign 관계 회귀 추가 후 전용9/HTTP25/domain32의 고유66테스트 PASS다. 최종 묶음65개 PASS 뒤 추가 foreign case가 포함된 전용9개 재실행 PASS이며 반복 실행을 서로 다른 테스트로 세지 않는다.
- 최초 E2E 명령은 `PLAYWRIGHT_BASE_URL`에 서버 없는 외부 주소를 지정해5개 setup ECONNREFUSED, 제품 검증 미실행. 기본 격리 서버 방식으로 교정했다. 첫 실제 case는 지원하지 않는 `projectProcessIds` 필터를 요청하여400; 이를 지원되는 시스템 속성 선택/UI 경로 검증으로 교정했다. 최초 fixture의 불필요한 Target 생성도 제거하고 실제 Target GET0개 단언을 추가했다. Target-only/혼합의 서버 검증은 별도 유지한다. 두 번째 실제 case는 불필요한 Target 공유 사용처가 만든 기존 확인 dialog를 테스트가 처리하지 않아 기존180초 한도에서 실패했다. Target0 fixture 교정으로 그 원인을 제거하고 reportResponse도 system root로 제한한다. 실제 세 번째 case는 Task/Assignment 원본·일정/복귀·stale/error 잠금과 Gantt 보존27.9초 PASS. 나머지 및 교정 재실행은 진행 중이다.
- 초기 frontend SSR 하네스는 저장소 alias 설정을 해석하지 못해 실제 UI 검증을 수행하지 못했다. 임시 하네스를 제거하고 model/transport Unit 및 실제 Chromium으로 검증했다. qa_docs의 최초 ESM named import probe도 모듈 형식 오류였으며 CJS require로 전환한 실제 SQLite probe는 PASS했다. 이 도구/하네스 오류를 제품 FAIL/PASS로 바꾸지 않는다.
- 설치 전 backend의 `npx tsc`는 실제 TypeScript가 없어 검증하지 못했다. 이를 typecheck FAIL/PASS로 사용하지 않고 설치 후 실제 `npm run typecheck`로 확인한다.
- GitHub 원본 Issue/댓글·선행 완료 상태·기존 PR 부재와 main을 조회했다. `gh` CLI API는401이나 연결 GitHub 도구와 Git read는 정상이다. 인증 내용은 기록하지 않는다.
- qa_docs 두 번째 P2: 이전 저장 spec에 기본 direct를 자동 삽입해 전체6→4Task 및 row fingerprint 변경으로 expanded/selected/focus 유실을 재현했다. 자동 변환을 제거하고 이전 전체 작업 호환 모드를 명시 유지하며 실제 저장 복원 E2E를 추가한다.
- qa_docs 사전 검토 P2: 선택 시스템의 공정 불일치와 전역 canonical 명시 공정없음/미매핑 진단을 한 문맥에 표시하여 오인할 수 있어 범위 문구를 분리한다. API의 전역 진단 값은 유지한다.
- `npm run verify:prepr -- --mode=fast --base=origin/main --issue=735 --risk=HIGH`: BLOCKED, sourceStable=true, working fingerprint `bc593db5bdc2d1edf5f36616e96ff53ec2aef626fa52765928d08cd62a953f46`, UNKNOWN3/missing0/selected33. [도구 JSON](../../evidence/issue-735/prepr-fast-initial.json), [요약](../../evidence/issue-735/prepr-fast-initial.md). 도구의 자동 매핑에 새 contract·logistics host·공통 projection core가 없어 검사 명령을 시작하지 않았다. 이를 Local 전체 검증 PASS로 사용하지 않는다. contract/host는 전용 client transport·실제 System/기존 process UI, projection core는 실제 SQLite API exact Task/Assignment·구성/snapshot·음성66테스트가 검증한다. 로컬 매핑 도구 수정은 이번 기능 범위 밖이며 UNKNOWN3을 숨기거나 gate를 완화하지 않는다. 전체 Build/Vitest/Lint/Docker 공식 회귀는 원격 PR CI가 담당한다.
- 최초 실제 E2E 전체: 3PASS/2FAIL, 7.7분. 원본/일정·stale/error27.9초,5폭/keyboard28.9초,readonly28.1초 PASS. 앞의 API400/공유사용처 확인 두 테스트 결함을 교정했고 새 legacy 복원 case를 포함한 최종6개 실행 중이다.
- qa_docs 독립 Agent 사전 검토: 진단 범위·저장 복원의 P2 두 건 보완 source 재검토 PASS, 당시 미해결 P1/P2 0개(이후 실제 focus 실패는 아래 별도 원장에 기록). 별도 최신 전용 서버/consumer2파일15테스트2.60초 PASS. 실제 legacy 브라우저·최종6case 결과는 아직 대기 중이다.
- 구현·Unit/API·실제 Chromium·DOCUMENTATION_SYNC·독립 사전 검토: 진행 중. 원격 Required3/Trusted QA·Owner ACCEPT는 NOT TESTED다.

## 원격 인계와 남은 Gate

최신 main과 충돌·미해결 review thread를 확인/해결한 정확 Head로 `Refs #735` PR을 만들고 Full CI의 등록/시작만 확인한다. 원격 성공·MERGE_READY·main artifact·정식 릴리스·Issue 완료를 주장하지 않는다. 실제 운영 storage/TLS·실기기/최종 수동 UX는 별도 환경 검증이며 이번 자동 브라우저 증거로 대체하지 않는다.


## 실제 브라우저 추가 실패와 focus 진단

- 두 번째 전체6개 실행은3PASS/3FAIL,5.7분이다. selector의 label/options 문자열 오인과 기존 공유 preview 확인 절차 누락, legacy 예상 Task의 일반 Task/전체 객체 grain 혼동은 테스트 계약 결함으로 교정한다. **Target0만으로 확인창이 사라진다는 초기 가설은 기각**했다. 기존 preview는 공유 Target0이어도 항상 확인을 요구하므로 exact ACS ID·공유 Target0을 확인하고 기존 원본 저장 명령을 누른다. API/제품 guard를 우회하지 않는다.
- 동결6개 재실행의 case1은24.7초 PASS. case2는 실제 System PATCH200·revision+1·새 snapshot·동일 spec과 행 `data-ready=true`/report confirmation2까지 PASS했으나 원본 행의 `원본` 버튼 focus 복귀가5초 내 성립하지 않아 FAIL했다. 이 단계는 **PRODUCT/UX 원인 조사 중**이며 앞의 테스트 계약 오류와 구별한다. 원래 `toBeFocused` 단언을 보존한다.
- 진단 loop는 전용 E2E의 System 원본 dirty/저장 한 case다. 현재 trace에 activeElement가 없어 목적지/취소 원인을 추정하지 않는다. 기존 source-return gateway와 공유 dialog cleanup의 focus 소유권, report 이후 trigger 교체/잠금, 확인 클릭의 새 사용자 의도 세 가설을 순서대로 검증한다. browser-only bounded focus timeline으로 구분하며 인증/요청 원문·쿠키를 기록하지 않는다.
- 이 재실행 당시 product/전용 Unit·API12파일 결합 SHA256은 `2c8198515f0f5a51283340bf12250c8435613d261886bcb36c528f01aa47c28e`, E2E spec SHA256은 `47649199e727a228aa53a28d3420ce4a13d3aecdc1db24dbecab295e9dd8ca5a`다. Node22.14.0/Playwright1.63.0, 별도 실제 launch로 확인한 managed Chromium은153.0.8010.12다.
- 사전 소스 검토 PASS는 이 새 실제 focus 결함의 PASS가 아니다. 해당 결함 해결·재검증 전 PR 게시를 보류한다. 기존 원격 CI 미실행/Owner 승인·릴리스 비범위는 유지한다.


## System 저장 focus 실패의 원인·교정

- 동결6개 최초 완주:5PASS/1FAIL,4.3분. 정확 불변 E2E spec `47649199e727a228aa53a28d3420ce4a13d3aecdc1db24dbecab295e9dd8ca5a`의 case1/3/4/5/6은 PASS, case2 System 저장의 원본focus만 FAIL이다. 이를 전체6PASS로 합산하지 않는다.
- 단독 red 재현30.8초: 실제 activeElement는 같은 행의 `상세` 버튼이다. 제한된 focusin 기록에서 공유 확인 저장4251ms→상세4695ms만 관측되어 외부 focus handoff 가설은 반증했다.
- controlled gateway probe에서 canonical `finish-entity/start`가 호출되지 않았다. `project-logistics-management.tsx`의 embedded Unified dispatch가 제공된 부모 `onWbsOpenEntity` 대신 local editor를 사용했고, local 단일 rAF 복원 시 새 revision/report 조회로 trigger가 disabled라 focus하지 못했다. 원본 행의 자체 fallback이 `상세`로 focus했다. **PRODUCT/UX 원인 확정**이며 서버 저장·snapshot 실패가 아니다.
- 교정: 제공된 canonical 부모 callback을 우선 사용하고 독립 사용에서는 기존 supported equipment/system/process editor만 local fallback으로 유지한다. 기존 snapshot/current intent·navigationAllowed/editing 및 receipt-ready focus gateway를 재사용하며 부모 focus/viewport 알고리즘은 변경0이다. source 파일 소유권은 frontend의 `project-logistics-management.tsx` 최소 routing 보완에 한정한다. `project-readonly-view.tsx`의 진단 변경은 모두 제거하여 최종 diff0이다.
- red→green: 동일 System case26.8초 PASS(command42.5초). 실제 PATCH/revision+1/newsnapshot/같은 spec 이후 정확 원본focus 및 두 번째 실제 저장/report 응답 전달 보류→사용자의 바깥 대시보드 탭 click→응답 재개 후 그 새focus 보존을 함께 PASS했다. API 응답은 실제 서버 `route.fetch` 결과이며 성공 데이터 대체/timeout 증가/단언 약화 없음이다.
- 모든 DEBUG-735focus 진단 instrumentation을 제품·최종 테스트에서 제거한다. 실제 실패 trace는 로컬 증거로 유지하고 raw trace/로그/인증 자료를 Git에 넣지 않는다. 인접 공정/설비의 원본 복귀·최신 intent와 최종 전체6개를 최종 동결 source에서 검증한다.


## 최종 후보와 인접 회귀

- 새 management routing을 포함한 product/전용 Unit·API13파일의 정렬된 `path + NUL + bytes` SHA256은 `87455823a3fd01d42bc5f5512c38b01e49659cc9f1e717b123cf19dd4a699b04`다. [파일별 manifest](../../evidence/issue-735/validation-source.json)를 qa_docs가 독립 재계산해 일치 확인했다.
- 최종 E2E spec SHA256은 `272e1963913ecc457a8ca6b84a66e915019358c152f9d7bbc7ca814f8d6cf95d`다. 실제 저장 원본focus와 지연 report 중 새 사용자 외부focus 보호,1440px summary overview 캡처를 포함하며 진단 코드는 없다.
- 인접 #730 지연 설비 원본→새 상세/Task 명령/이름 검색 양보24.2초와 #733 공정 원본 취소·정확 조회 복귀28.3초 모두 PASS(total1.4분). 이후 parent callback 경로는 동일하게 유지하며 standalone unsupported dimension 부작용만 종전처럼 no-op으로 보호했다. 해당 파일 ESLint PASS.
- 5폭 최종 geometry는 document overflow0·6열 header/body 정렬오차0·표 내부 scroll과 focus containment를 만족한다. overview는 요약과 mode/구성 UI의 실제 캡처이며 ancestor clip 범위의 일부 화면이다. 전체 표 가시성 증거는5폭 geometry와 실제 keyboard 단언으로 구별한다.


## 최종 로컬 결과와 PR 인계

- 최종 frozen E2E: `npx playwright test --config tests/config/playwright.config.ts tests/e2e/issue-735-system-dashboard.spec.ts` **6/6 PASS**,4.5분. 각 case25.6/28.9/31.5/34.2/31.0/24.6초. spec272e1963…/management3cf82ef8… 시작·끝 byte hash 동일이며 앞의 실패를 소급 PASS하지 않는다.
- AC1~AC4: Target0 MCS1+ACS A/B·단독/두 하위 경로·direct/coordination exact ID·공수 합집합·empty0·Task0·속성·명시 공정·Target-only/혼합·full Gate/구성 단위가 전용 Unit/API·실제 UI에서 PASS다. 기존 Resource/물류/공정의 인접 Unit과 API·도메인 회귀는66+15+51=132개 고유 테스트 PASS, 중복 실행을 새 케이스로 더하지 않는다.
- AC5: System 원본 dirty/공유 확인/실제 저장·새 snapshot·원본focus 및 응답 대기 중 새 사용자focus 우선, Task/Assignment/정확 일정 왕복·Gantt DOM 인스턴스 보존·readonly/mutation0·stale/error 잠금·legacy spec/expanded/selected/focus 복원 PASS. 추가 공정/설비 원본 인접2case PASS는 전용6개와 구별한다.
- 시각/접근성:390/768/1024/1440/1920px document overflow0·6열 정렬편차0·focus owner 내. 모바일 client/scroll364/772 및718/832. [geometry](../../../output/playwright/issue-735/geometry.json), [390px](../../../output/playwright/issue-735/system-390.png), [1440px](../../../output/playwright/issue-735/system-1440.png), [요약 overview](../../../output/playwright/issue-735/system-overview-1440.png). overview의 ancestor clip 경계를 보존하고 전체 표 캡처로 표시하지 않는다.
- Node22.14.0/Next16.3.8/Playwright1.63.0/managed Chromium153.0.8010.12; frozen npm ci·npm ls·version/Markdown link PASS. 최종 `npm run typecheck` PASS, 변경 source/test13파일 ESLint PASS, `docs_gate` structural/mapping PASS 및 Markdown279파일 PASS를 다시 확인했다. Next가 생성한 next-env.d.ts/tsconfig.json 변경은 원래 추적 값으로 복원하며 제품 변경으로 게시하지 않는다.
- 독립 Agent 사전 소스/문서 검토의 진단 범위·legacy 복원 P2와 실제 runtime focus 결함을 모두 보완했다. 독립 인간 QA는 N/A(OWNER_MANAGED), 원격 Required Quality/E2E6/Docker·Trusted QA 및 Owner 최종 ACCEPT는 NOT TESTED/MERGE_READY BLOCKED다.
- 로컬 PrePR 자동 도구의 UNKNOWN3/BLOCKED는 유지한다. 원본 report·수동 직접/인접 검증·제외/미실행 사유를 분리하며 전체 로컬 gate PASS라고 보고하지 않는다. 실제 운영 수동 UX·실기기/TLS·전체 원격 CI·main/GHCR·정식 릴리스는 미검증이다.
- main `8a0fc9773d33326b40f8d97f6307c17ae0cb6933`를 다시 fetch하고 최종 검토한 tree를 연결 Git Data API로 배치 게시한다. Git push dry-run 인증 실패를 CI/권한 변경으로 우회하지 않는다. local tree와 remote tree 일치·단일 branch/ref 게시 후 canonical `Refs #735` PR과 exact remote Head Full CI의 시작만 확인한다. PR 생성 후 thread/충돌 상태와 run URL·SHA는 Issue STATUS에 기록한다. CI 완료 모니터링·병합·게시·Issue 종료는 수행하지 않는다.

- 최종 독립 Agent `/root/system_qa`: 사전 AC1~AC5 PASS/미해결 코드 지적0. 실제 Playwright HTML에서 expected6/unexpected0/flaky0/skipped0과 source manifest를 직접 확인했다. 이는 독립 인간 승인·Trusted QA·Owner 최종 ACCEPT가 아니다.


## main 정렬 재개와 새 CI 인계 (2026-10-20)

- 사용자 요청으로 기존 PR [#757](https://github.com/planner77/masterGantt/pull/757)을 유지하고 Head `abd410fc4fa1f87be3c7975d2fa960b36f8d8877`에 최신 main `05f1e560eee456e6fba5535255c9ede30a357c16`을 merge한다. main의 #733 문서4개·shard plan을 가져오며 자동 병합 성공, 충돌 marker0이다. Changelog/TestPlan의 양쪽 이력과 plan을 보존하고 TEST_PLAN EOF 추가 빈 줄만 정리했다. 제품/전용 테스트/package 변경0이다.
- 기존 Full CI [#3051.1](https://github.com/planner77/masterGantt/actions/runs/39408703783)은 Quality/Docker SUCCESS, E2E FAILURE다. Copy ID canonical GET의 ECONNRESET 직접 실패·다른5개 Shard 취소·파생 QA 실패를 [단일 누적 실패 원장](../../ISSUE_735_FAILURE_ANALYSIS.md)에 기록했다. 해당 원형 정상/clipboard 거부 fallback2case는 변경·재시도 없이2/2 PASS,54.7초(17.7/4.3초). 원격 근인은 UNKNOWN이며 main의 Shard4 재배치로 해결됐다고 주장하지 않는다.
- product/전용 Unit·API13파일 결합 SHA256 `87455823a3fd01d42bc5f5512c38b01e49659cc9f1e717b123cf19dd4a699b04`, E2E spec `272e1963913ecc457a8ca6b84a66e915019358c152f9d7bbc7ca814f8d6cf95d`가 기존 동결 검증본과 일치한다. 기능 변경이 없어132개 Unit/API·6+2브라우저를 모두 반복하지 않고 이번 직접/음성2case와 selector·planner·문서 검증을 선정했다. 과거 결과를 새 원격 PASS로 사용하지 않는다.
- 실제 selector6회: 현재133개 spec 모두 정확1회, 누락/중복0, 분배 `[23,23,23,22,21,21]`, #733→5/#726→6/#735→1. plan은 main과 byte 동일. qa_docs의 planner Unit5개 PASS 및 독립 main 정합 사전 검토 PASS/새 지적0. Next 자동 생성 설정은 원래 추적 값으로 복원한다.
- 미해결 리뷰 스레드0. 기존 PrePR UNKNOWN3/BLOCKED는 역사적 결과로 유지하며 이번 main-only 정렬이 도구 매핑을 해결하지 않는다. DOC_SYNC·Markdown·version·diff 검증 후 단일 non-force branch update로 새 Head의 Full CI 등록/시작만 확인하고 exact SHA/run/attempt를 Issue STATUS에 기록한다. 새 Required3/Trusted QA·Owner ACCEPT는 NOT TESTED/MERGE_READY BLOCKED, CI 완료 모니터링·병합·릴리스·Issue 종료는 범위 밖이다.
