# Issue #623 — Resource MVP 통합 수용·이관 Work Packet

## PR #685 재개 — QA 차단·P2 리뷰·main 충돌 보완 (2026-10-15)

- 요청 범위: 기존 PR의 실패 원인 분석·보완, 리뷰 스레드 및 충돌 해결 후 새 exact-head Full PR CI 시작까지. 새 CI 결과 모니터링·병합·main/GHCR·릴리스·Issue 종료는 수행하지 않는다.
- 원본 [CI #2772.1](https://github.com/planner77/masterGantt/actions/runs/38642308191): run_id=`38642308191`, run_attempt=`1`, Head=`729f2e4dd1254d73c07ea13eecc287e4b9dac243`, base=`bd54205741da65a0211cf77f9cb086d3cdb1ab2a`, test merge=`d38b152a99c43e9c67fd71119f30d721a626567e`. 세 Required Quality/E2E/Docker와 Chromium 6 shard는 완료 PASS다. `QA Final — Automated` [job 116129943648](https://github.com/planner77/masterGantt/actions/runs/38642308191/job/116129943648)의 최종 조회 step은 `자동 QA: BLOCKED`, `사유: 미해결 review thread`로 exit 1이다. CI 실행 결론 FAIL과 QA의 원인 BLOCKED를 구별한다. 권한·workflow 결함이나 제품 테스트 실패로 해석하지 않는다.
- P2 두 건: `tests/e2e/issue-623-resource-mvp.spec.ts`의 두 테스트 180초 override 및 ArrowRight 이후 실제 이동 단언 누락. 기존 첫 흐름 최대 관측 30.6초를 근거로 해당 테스트만 유한 60초, 둘째는 기본 30초로 복원한다. 기존 action timeout 15초는 유지한다. 390px tree/matrix에서 scrollLeft를 시작점 0으로 준비하고 실제 키 입력 후 증가·focus 보존을 poll하며 JSON에 전후 값을 남긴다. 기존 열 경계·overflow·저장0·같은 Gantt 단언은 유지한다.
- 후속 [Trusted QA #415.1](https://github.com/planner77/masterGantt/actions/runs/38645161760), run_id=`38645161760`, attempt=`1`, validator SHA=`bd54205741da65a0211cf77f9cb086d3cdb1ab2a`, job=`116130083238` step 4는 `자동 QA: FAIL`, `사유: 원본 PR CI run 자체가 성공하지 않았습니다`다. Automated의 리뷰 BLOCKED로 원본 CI가 실패한 뒤 Trusted가 이를 거부한 연결이며 검증기·권한 변경으로 우회하지 않는다.
- 최신 main=`1449190a`를 기존 작업 branch에 병합한다. `docs/TEST_PLAN.md`, `docs/REMOTE_VALIDATION.md` 두 content conflict는 #623 수용과 main의 #622 초기화 준비 검증 절을 모두 보존해 해결한다. main의 Gantt probe·기존 Milestone 회귀 보완은 그대로 승계하며 이번 PR이 새 제품 변경을 추가한 것으로 계산하지 않는다.
- 소유권: frontend `/root/frontend`는 위 신규 E2E spec만, infra `/root/infra`는 원본 로그 read-only 분석, Manager는 충돌·문서·증거·GitHub 게시·리뷰 해결. issue_comment_writer=manager. 기존 타 worktree/미추적 자료는 보존한다.
- app=`0.114.0` 유지, release_required=false, release_authorized=false. risk_level=HIGH, qa_required=true, qa_method=OWNER_MANAGED, independent_qa=N/A(Owner-managed, 독립 검토 없음), manager_decision=NOT TESTED, MERGE_READY=BLOCKED. 새 Head의 원격 CI/Trusted QA는 NOT TESTED이며 원본 Head의 PASS를 재사용하지 않는다.
- DOCUMENTATION_SYNC: Work Packet·TEST_PLAN·REMOTE_VALIDATION·수용표·active PLAN·CHANGELOG 갱신. DESIGN/UI_UX/API/DB/SECURITY/SCHEDULING/CI_CD/GITHUB_OPERATIONS/QA_REVIEW_POLICY는 기존 UI·도메인·원격 gate·권한 계약 변경 없음으로 N/A다. 기존 AC1~AC6 mapping은 유지하고 AC4의 키보드 실제 이동 증거를 보강한다. 최종 로컬 결과 및 새 Head/run/attempt는 아래 원장과 Issue/PR STATUS에 기록한다. 아래 최초 구현 결과·hash·관측값은 원본 Head의 역사적 증거다.
- 재개 Local Fast Feedback: 실제 Chromium 신규2/2 PASS(34,544ms / 22,193ms, 전체1.8분), scoped ESLint PASS. 첫 흐름60초/둘째기본30초 안에서 기존 전체 단언을 통과했다. 390px tree `scrollLeft 0→15`, matrix `0→11`, 양쪽 focus=true/document폭390이다. 이번 집중 실행 FAIL 없음. 새 동결8test/fixture SHA256=`e1449a7a5a60d5db6896915d5323b6610ae2128f627e5564846eb6c04292b55d`.
- [재개 실행 원장](../../../output/playwright/issue-623/rework-execution.json), [키보드·geometry](../../../output/playwright/issue-623/rework-geometry.json), [원시 ID·여섯 mutation](../../../output/playwright/issue-623/rework-cumulative.json), [실행 시간](../../../output/playwright/issue-623/rework-timing.json)은 새 로컬 실행이다. 최초 cumulative/geometry/PNG10/source inventory는 보존하고 재개 화면 캡처를 새로 게시하지 않는다. Next 생성 next-env/tsconfig는 browser 종료 뒤 기준 HEAD로 복원했다. 원격 전체 회귀/Trusted·Owner ACCEPT 및 운영 환경 PASS를 주장하지 않는다.
- Manager 최종 빠른 검사: typecheck·version0.114.0·Markdown220파일·DOC_SYNC 구조/AC1~6 mapping·diff-check PASS. 최신 main 대비 src/package/lock/CI/SQL/deploy diff0 확인. 별도 read-only qa_docs `/root/qa` 사전 검토에서 신규 P1/P2 없음, 실행 시간·390px 실제 이동·source8hash·문서 충돌 양쪽 보존·원본 CI/Trusted 로그를 직접 대조했다. 이 검토는 최종 독립 QA PASS나 Owner/Manager ACCEPT가 아니다. 게시된 새 Head의 Required3/Trusted와 Owner 결정은 NOT TESTED다.

## 기준·범위·담당

- Issue: https://github.com/planner77/masterGantt/issues/623, 상위 #613, 선행 #614~#622. 기존 #530 Resource 통합 및 #528 exact drill 계약을 보존한다.
- baseline main: `bd54205741da65a0211cf77f9cb086d3cdb1ab2a`, application `0.114.0`, SVAR Core `2.7.3`. #622 PR #684와 Plan의 경량 Target catalog 후속 수정이 포함된다.
- branch/worktree: `test/issue-623-target-resource-acceptance` / `/home/planner/Dev/masterGantt-worktrees/issue-623`. 기존 #623 PR0·Issue 댓글0을 확인했다. 다른 worktree와 미추적 파일은 보존한다.
- phase: PR_READY → exact-head Full PR CI 시작 인계. 사용자 요청 종료점은 구현·관련 문서·미해결 리뷰/충돌 처리 후 exact-head Full PR CI 시작 확인이다. CI 결과 모니터링·병합·main/GHCR·정식 release/tag·브랜치 정리·Issue 종료는 별도다.
- version: 테스트/문서 전용이면 `0.114.0` 유지, `release_required=false`, `release_authorized=false`. 실제 제품 결함이 발견되면 Manager가 patch/version·관련 문서·위험을 다시 판정한다. 검증 범위를 줄여 결함을 숨기지 않는다.
- 실제 역할: Manager 통합·문서·version·Issue/PR 운영, scheduler `/root/domain` 공통 golden fixture/Domain, backend `/root/backend` SQLite/migration/Copy/Template/OOXML, frontend `/root/frontend` 실제 HTTP/Chromium 종단 검증, ui_ux `/root/ux` read-only 설계·가이드 검토, qa_docs `/root/qa` 별도 read-only 사전 검토, infra `/root/infra` read-only 선행 운영 증거/게시 사전 점검.
- 파일 소유권: domain=`tests/fixtures/issue-623-target-resource.ts`·`tests/domain/issue-623-target-resource-acceptance.test.ts`; backend=신규 `tests/server/**/issue-623*.test.ts`·지원 backend fixture; frontend=신규 `tests/e2e/issue-623*.spec.ts`·전용 E2E fixture; Manager=Markdown/최종 evidence·version. 제품 결함 수정은 Manager가 파일 소유권과 영향 범위를 확정한 뒤 담당자가 수행한다. 같은 파일 writer를 중복 배정하지 않는다.
- issue_comment_writer: manager; issue_comment_allowed_types: PLAN/STATUS/EXCEPTION/DECISION_REQUIRED/RESUME/FINAL. Sub-Agent는 원격 댓글 없이 Result Contract만 반환한다.

## 구현·수용 계약

같은 canonical fixture로 shared Task의 TargetA5/TargetB5/선택전체5 M/D, AMR10+5/ACS2/공유MCS1, ACS-only same-binding/member, 직접+상속/legacy 미연결·Group 중첩·T0/A/R·nullable 상태를 검산한다. 기존 #530의11.5 M/D golden을 새5 M/D로 대체하지 않는다. 논리 키는 환경별 실제 UUID로 매핑하며 해당 snapshot 안의 raw Task/Assignment/Resource ID 집합을 Domain/API/UI/OOXML에서 대조한다. 별도 계산기·원장·PRO 기능을 만들지 않는다.

다관점에서 name/date/status/progress/allocation/Target membership을 각각 수정하고 원본 identity1·실제 저장1·조회 저장0을 확인한다. 기존 Editor/gateway·session/Origin/strong If-Match·canonical queue/단일 viewport writer와 dirty/pending/readonly/stale/응답역전·복귀 focus를 유지한다. TargetA80%/same-R Project140%·Group 평균 뒤 개인 초과·unknown/MM 없음과 선택 밖 근거를 검증한다. 최신 Plan은 implicit 전체 Target projection 없이 `catalog.targetOptions`를 사용한다.

fresh DB와 실제0024 schema 형태의 합성 legacy DB를0025→0026→0027로 이관한다. checksum/order·실패한 pending batch rollback·FK·재기동·미매핑 자유공정·비활성 참조 보존을 확인한다. Copy/Template는 local ID remap/공유MCS1회·global catalog 재사용·whole/subset/coverage·상속을 보존한다. binding 포함 Template는 logistics schemaVersion3, binding 없는 v2/legacy는 호환한다. 자동 cross-site retarget 지원을 추정하지 않고 실제 유효 triple 검증/거부 및 rollback을 확인한다.

사용자 가이드와 운영 절차는 실제 지원/미지원 포맷·백업/복원 범위를 구별한다. #379 전체 참조 JSON은 미완료이며 Excel은 보고서다. production backup CLI를 새로 제공한다고 주장하지 않는다. 운영은 기존 DEPLOYMENT의 clean stop 후 /data 전체 일관 snapshot·새 격리 volume·대응 image 복원 절차를 유지한다. 합성 backup/restore 테스트는 실제 off-host/운영 복원 PASS가 아니다.

390/768/1024/1440/1920px의 표 내부 scroll·열 경계·keyboard/Tab/Enter/Escape·focus와 대표 fixture의 서버 SQL/시간/JSON/OOXML·UI 렌더 관측을 구별한다. 예산 초과는 명시 거부하고 부분절삭 합계를 전체로 표시하지 않는다. 실패·skip·환경 미검증은 실제 상태를 보존한다.

## GSC·Design Delta

baseline의 GANTT_STATE_CONSISTENCY/CONFORMANCE/ADAPTER_ADR/SYNC_TRACE 및 active GANTT_STATE_REMEDIATION을 적용한다. `gantt_standard_version=GSC 1.0.0-candidate (REVIEW_PENDING)`, `reviewed_document_commit=bd54205741da65a0211cf77f9cb086d3cdb1ab2a`, `exception_adr=NONE`.

SC-11 Resource→상세→Editor/일정→복귀와 관련 SC-01/02/03/04/06/09/10/12의 실제 수행 범위 및 기존 회귀를 구별한다. SC-05~08/13/14 전수 수용·3000행·GSC 전체 준수·#574/U5 완료를 이번 통합 집중 검증만으로 주장하지 않는다. Resource 조회 상태/저장/canonical 반영/viewport 소유권은 기존 단일 경로다.

read-only UI/UX 검토는 기존 Light/compact/progressive disclosure/상태·table scroll·focus 구체화인 Design Delta B를 반환했다. 신규 공통 원칙 A 없음, `DESIGN.md: N/A`다. 실제 browser PASS는 별도 실행 증거가 필요하다.

## DOCUMENTATION_SYNC

아래는 실제 문서 영향 분석과 갱신 결과다. 작성자는 Manager이며 최종 source/test freeze와 같은 PR에서 검토한다.

- `docs/LOGISTICS_TARGETS.md`: UPDATED
- `docs/RESOURCE_KPI_DASHBOARD.md`: UPDATED
- `docs/DB_SCHEMA.md`: UPDATED
- `docs/API.md`: UPDATED
- `docs/SECURITY.md`: UPDATED
- `docs/PROJECT_UX.md`: UPDATED
- `docs/TEST_PLAN.md`: UPDATED
- `docs/REMOTE_VALIDATION.md`: UPDATED
- `docs/EXCEL_EXPORT.md`: UPDATED
- `docs/IMPORT_EXPORT.md`: UPDATED
- `docs/REQUIREMENTS.md`: UPDATED
- `docs/ARCHITECTURE.md`: UPDATED
- `docs/DEPLOYMENT.md`: UPDATED
- `docs/TARGET_RESOURCE_USER_GUIDE.md`: UPDATED
- `docs/TARGET_RESOURCE_OPERATIONS.md`: UPDATED
- `docs/TARGET_RESOURCE_ACCEPTANCE.md`: UPDATED
- `docs/exec-plans/active/PLAN.md`: UPDATED
- `docs/exec-plans/active/TARGET_RESOURCE_ROLLOUT.md`: UPDATED
- `docs/exec-plans/active/ISSUE_623.md`: UPDATED
- `CHANGELOG.md`: UPDATED
- `README.md`: UPDATED
- `DESIGN.md`: N/A(기존 시각·상태·scope·표 scroll/focus 원칙의 통합 수용·구체화이며 신규 공통 원칙 없음)
- `docs/SCHEDULING_ENGINE.md`: N/A(기존 Calendar/일정/공수 엔진 검증이며 산식·알고리즘 계약 변경 없음)
- `docs/IMPORT_SCHEMA.md`: N/A(기존 JSON/CSV payload와 Target loss guard를 검증하며 무손실 포맷 확장 없음)
- `docs/TASK_EDITOR.md`: N/A(기존 공통 Task/정확 Assignment Editor·초안/저장 계약을 검증하며 기능 변경 없음)
- `docs/CI_CD.md`: N/A(기존 Required CI·Main/GHCR/Finalizer·릴리스 절차를 유지하며 workflow 변경 없음)
- `docs/GITHUB_OPERATIONS.md`: N/A(기존 권한·Ruleset·원격 운영 절차 불변이며 이번 증거는 수용표/원장에 기록)
- `docs/QA_REVIEW_POLICY.md`: N/A(최신 Owner-managed 정책·별도 승인 경계를 그대로 적용)
- `docs/ISSUE_LIFECYCLE.md`: N/A(기존 lifecycle을 적용하며 승인/종료 범위를 변경하지 않음)
- `AGENTS.md`: N/A(기존 실행 지침·역할·신뢰 경계 불변)

## AC_TEST_COVERAGE

- AC1: tests/fixtures/issue-623-target-resource.ts·tests/domain/issue-623-target-resource-acceptance.test.ts와 신규 SQLite/API/OOXML·Chromium의 같은 golden 원시 ID/수치, 기존53011.5 보존.
- AC2: 신규 Issue623 실제 HTTP/Chromium의 name/date/status/progress/allocation/membership 개별 저장·복제0·권한/원자성/stale·복귀 및 기존621/622/528 집중 회귀.
- AC3: 신규 Issue623 SQLite0024→27 이관·checksum/order/batch rollback·backup/reopen·Copy/Template/local ID/sharedMCS/globalreuse/coverage/cross-site 거부 및 safe format 경계.
- AC4: 신규 Domain/server/browser 대표 fixture의 한도·SQL/time/JSON/workbook/render 관측,5폭 keyboard/geometry, 환경별 PASS/FAIL/BLOCKED/NOT TESTED 원장.
- AC5: docs/TARGET_RESOURCE_USER_GUIDE.md의 구성→연결→집계→동일 편집→과투입→Excel 및 overlap/partial/미연결/WorkArea 미사용·안전 포맷 설명과 실제 UI 대조.
- AC6: docs/TARGET_RESOURCE_ACCEPTANCE.md의 요구사항↔Issue↔AC↔test↔문서↔remote exact Head 인계, active PLAN/rollout 및 Epic613 Resource MVP 상태만 별도 기록. V1/전체 Epic 완료로 확대하지 않음.

## 위험·검증 원장

`risk_level=HIGH`, `risk_reason=통합 공수/다관점 identity·권한·이관/복구 검증`, `qa_required=true`, `qa_method=OWNER_MANAGED`, `independent_qa=N/A(Owner-managed, 독립 검토 없음)`, `manager_decision=NOT TESTED`, `MERGE_READY=BLOCKED`.

별도 read-only Agent 사전 검토는 실제 검토 범위의 증거이며 Trusted QA·Owner HIGH 위험 수용/명시 병합 허가가 아니다. 원격 Required quality/e2e/docker·Trusted QA는 exact Head/base/run/attempt 완료 성공 전 NOT TESTED다.

- 착수 git fetch/main·version·기존 PR/Issue 조회 PASS. 실제 `npm ci --no-audit --no-fund` PASS,447packages/9초. 기존 eslintdeprecated 경고 보존, CI frozen install PASS 대체 아님.
- 선행614~621 Issue CLOSED,622 Issue OPEN.622 PR684 latest Head `1bb71002bcce52a409bb3caeeb8fafb01043557b`의 PR CI2770.1/run38634326054는 완료 SUCCESS. MainCI2771.1/run38638132383는 단일 조회 시 in_progress이며 main/GHCR/Finalizer/release 판정은 NOT TESTED다. 이를 기다리거나 모니터링하지 않는다.
- 선행618 원본 MainCI2745.1 FAIL/Finalizer282.1 SKIPPED,615 원본627Main2526.1 FAIL과 corrective/succession 증거,616 원본631 pushCI 부재/기존 릴리스 실패·철회/후속 승계를 구별한다. Issue CLOSED를 원본 모든 실행 PASS로 바꾸지 않는다. 자세한 단일 snapshot은 수용표에 기록한다.
- 운영 DB·실제 off-host/production volume restore·TLS/proxy·Windows Excel/VBA/DRM·실기기/screen reader·최종 수동 UX: NOT TESTED.
- 실제 명령/테스트 수/최초 실패·수정/성능·사전 검토·source hash·원격 인계는 구현 중 아래에 누적하며 미실행을 PASS로 표시하지 않는다.


## Local Fast Feedback 및 구현 결과 (2026-10-15)

- 제품 src/package/lockfile/DB SQL/CI/Docker 변경0. 테스트·문서 전용이므로 app0.114.0 유지,release_required=false/release_authorized=false 확정이다. 신규 공수 원장·엔진·API·PRO·Gantt/viewport writer를 만들지 않았다.
- Domain 신규8case와 관련4files64tests PASS,신규 fixture/test ESLint PASS. 같은 golden에서 raw ID/MD/MM·daily/week/month·T0/A/R·unknown/null/known0·sharedmember/provenance·query-order cache 재사용·graph/allocation/progress 독립 변화와 전체 Milestone Gate·예산 거부를 검증했다. 기존530의11.5는 별도 보존한다.
- Backend 신규20case: `tests/server/db/issue-623-target-migration.test.ts`3, `tests/server/resources/issue-623-canonical-acceptance.test.ts`13, `tests/server/projects/issue-623-target-transfer-acceptance.test.ts`4. 기존 related3files를 포함한6files37tests PASS. 원시 API/OOXML ID·수치·nullable/5·20·80/140,master/Target/binding/member/instanceQuantity/Calendar/Resource/Task/Assignment9축 변경 후 report/detail/Plan/current-project export stale를 확인했다.
- 신규 migration은 실제0024 schema 파일 DB→25/26/27의 정확 ledger/checksum·원본미매핑/비활성 rows·새binding·FK/재기동,합성 SQLite backup→새 파일24schema 복원·integrity/FK,구binary/newledger 거부,late27SQL실패 시25/26/27DDL/ledger 전체 rollback 및 checksum/gap fail-closed를 검증했다. 실제운영/off-host복원은별도 NOT TESTED다.
- Copy/Template는 local Task/Target/member/instance/Assignment ID 재발급·sharedMCS1회/globalcatalog재사용·비활성참조·schemaVersion3 binding/coverage를 확인했다. 잘못된 다른site/WorkArea/occurrence는 전체 거부/rollback한다. API의 자동cross-site retarget지원은 없다. 개인 Assignment가 있는 Task copy는 기존 TASK_COPY_ASSIGNMENTS_UNSUPPORTED와 원본불변을 검증하고,지원되는 개인미배정Task copy→reparent의명시binding/coverage와조상상속을별도로확인했다. 배정삭제우회를기능지원으로보고하지않는다.
- Frontend 최종 실제HTTP/Chromium 수용묶음9/9PASS,전체3.9분. 신규6232개(26.9/14.3초),기존6214개(13.0/14.4/16.2/13.8초),6221개18.7초,6182개(8.8/6.3초)다. 별도실행/중복을고유전수회귀로합산하지않는다.
- 신규종단은 두site의제품표준공정적용+site추가공정/optionalWorkArea,TargetA/B·AMR15/ACS2/sharedMCS1·Summary상속/ACSsubset을 실제API로구성한다. name/date/status/progress각PATCH4회,allocation/Targetmembership각PUT2회의method/path/body·revision각+1·TaskID집합불변·같은Core·양방향복귀를확인했다. 조회mutation0,Task복제0이다.
- API/UI A5/B5/선택전체5 M/D,UI선택전체0.25 M/M,같은confirmedreport의snapshot/filters→실제HTTP XLSX canonicalTask/Assignment/ResourceID·raw5/.25를대조했다. `cumulative.json`은실제UUID매핑/원시수치/여섯개별write·사업장표준참조·워크북근거다.
- 신규browserfixture는shared/ACS_ONLY/Summary3Task,R1/2Group 및geometry5Target의최소종단범위다. Domain/server full4Resource/T0진단·과투입별도fixture의Capacity20과browserR1의Capacity5를혼용하지않는다.80/140·outsideTarget편집/복귀·401/412/dirty/pending/응답역전/실제409는재실행한기존621/622/618에서확인했다.
- `geometry.json`은390/768/1024/1440/1920px×tree/matrix10개다. document폭=viewport,표소유scroll/열경계±1px·identity내action·wrapperfocus/ArrowRight·query0·같은Ganttinstance를확인했다. Editor Enter/Tab/Escape·stickyfocus의전체상태는기존집중회귀와구별한다. 새wrapper조작만으로screenreader/실기기접근성PASS를주장하지않는다.

### 최초 실패와 보완

- 최초browsergolden3≠5는 기본KR공휴일을물려받은fixture구성문제였다. F0의명시주중5일/no-country-holiday Calendar를API로설정했다. 운영KR달력을바꾸거나Calendar산식을수정하지않았다.
- 공통Domainfixture의reporttoSun11을TaskendSun11로도사용하면5workingdaycanonical종료와맞지않았다. 같은sharedfactory를5dayTask/SummaryendFri09,ZERO6day/endMon12(주말배정0유지),M1Fri09→M2Mon12FS로정합화하고날짜/duration/FS단언을추가했다. copy전용날짜보정변형을제거해같은factory를Domain/server/Copy/Template가사용한다. 원시5/20/80/140/53011.5는유지했다.
- 중간serverfloat excess2의raw1.9999999999999996은신규테스트에서12decimal근사로검증했다. 원시값·기존산식/기존허용오차를바꾸지않았다. Plan의fullProjectTarget참고는최신622에맞춰명시projectionOrder요청에서만검증하고일반Plan의경량경계를보존했다.
- Task copy중개인배정지원가정은실제TASK_COPY_ASSIGNMENTS_UNSUPPORTED로거부됐다. 테스트를지원범위/원자거부와명시미배정Taskcoveragecopy로구별하고기존guard를약화하지않았다.
- 중간fixture DependencyType/TaskHierarchyCommand 타입오류와Next가정리한isolated dev type경로참조를구별했다. fixture의실제공개타입을정정하고모든browser종료뒤기준next-env/tsconfig복원후최종typecheck를확인한다. 기존테스트재실행이갱신한tracked622화면원장은기준HEAD로복원하며신규623증거만게시한다.
- 신규server한도거부중bulk범위실패는실제366일초과검증이다. 이를productionfanout모든상한을실제초과한검증으로확대하지않는다. Domain예산반례와기존serverbudget회귀는별도다.


### Manager 최종 빠른 검증

최종 실제 typecheck PASS,version0.114.0 검증 및version7tests PASS/126ms,Markdown220files PASS,scoped ESLint/diff·DOC_SYNC 구조/AC1~6mapping PASS다. src/package/lock/migrationSQL/CI/Docker diff0을 확인했다. 모든 browser 종료 뒤 Next가 생성한 next-env/tsconfig 및 기존 tracked622화면 evidence를 baseline으로 복원했다. 원본622검증을 새623결과로 덮어쓰지 않는다.

기존 Vite native configLoader future warning·eslintdeprecated 경고는 보존한다. 실제 npmci447packages/9초는 CI frozen install 결과를 대신하지 않는다. 최종 gitfetch에서 main은 baseline bd54205741da65a0211cf77f9cb086d3cdb1ab2a로 동일하며 충돌 없음이다. 최종 PR의 thread/mergeability와 RunID/attempt는 생성 후 한 번 확인한다.


### 최종 사전 검토·동결 증거

별도 read-only qa_docs `/root/qa`가 최종 신규4Vitestfiles28tests PASS/1.82초(06:36:20),신규Chromium2/2PASS(30.6/14.7초·전체1.4분)를 직접 실행하고 AC1~AC5 로컬 PASS·AC6인계준비 PASS·미해결P1/P2없음을 반환했다. 현재 source/test8파일 hash는 `0defd061a40ec282e0be9b8ca48e8bff57c52d95c537e7994b80582a51a911db`다. 정렬된 path UTF-8 + NUL + bytes + NUL의 SHA256이며 문서/artifact/generated를 제외한다. Manager 재계산과 일치했고 `source-inventory.json`에 경로별 hash를 보존했다. 전체 remote tree/commit SHA와 혼용하지 않는다.

독립 Reviewer의 이전16PASS/1FAIL은 M/M 기준없음 케이스에 mdPerMm:undefined를 직접 넘겨 strict filter 오류가 난 테스트 oracle였다. 실제 JSON의 필드 생략을 반영해 key를 제거하고 최종 공통factory에 결속한 신규28개 전체를 재실행했다. 기존예외/guard를완화하지않았으며이전FAIL을소급PASS하지않는다.

최종10PNG·cumulative.json·geometry.json은 Reviewer의 독립Chromium 실행 결과다. browser관측은3Task/R1/2Group/5Target,진입→표준비1289.041652999993ms,실제XLSX30447bytes/raw5MD·.25MM/여섯write다. frontend수용묶음 당시1298.019441ms/30462bytes와 실행별 UUID/압축bytes 차이를 구별한다. before캡처없음으로after증거이며대량3000행/native전수또는운영성능PASS가아니다.

`backend-benchmark.json`은 backend 최종집중실행06:35:05의133Task/489Assignment/4Resource/2Target·48SQL,실제HTTP87.15852400000017ms/345599bytes·ExcelHTTP241.1588670000001ms/622705bytes 단일관측이다. 중간99.66ms/345599bytes·358.22ms/623324bytes는별도DTOreadback을포함한이전export측정이었으므로최종HTTPexport와구별한다. 숫자를운영성능보장또는모든budget상한전수성공으로확대하지않는다.

관련21문서의 actual UPDATED/N/A·가이드/운영절차·수용표를 code/test와대조했고 DESIGN DeltaB/N/A가유효하다. `execution-result.json`은로컬실행과원격NOTTESTED·M2BLOCKED·Owner/릴리스경계를구별한다. 최종원격Head/base/testmerge/CIrun/attempt/thread/충돌은출판후PR/IssueSTATUS에기록한다. 사전AgentPASS는 QA_FINAL/OwnerACCEPT가아니다.
