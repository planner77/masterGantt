# Test Plan

상태: qa_docs가 작성한 검증 전략. Planning 독립 검토와 W01 실행 결과는 [BOOTSTRAP_REVIEW.md](BOOTSTRAP_REVIEW.md) 참조. W02는 DB01 및 DB02 중 DB 기반 부분(연결·migration·격리·parameter binding)을 검증했다. nth-write schedule/import rollback 등 Service 검증은 후속이다. [W02 검증 기록](W02_REVIEW.md) 아래 표는 전체 제품의 검증 계획이며 Auth/Scheduling/Import/Export/Docker/VBA 통과를 뜻하지 않는다.

## 판정과 증거

| 판정 | 의미 |
| --- | --- |
| PASS | 명시한 환경에서 기대 결과를 재현하고 command/version/fixture/exit code·산출물을 기록 |
| FAIL | 실행 결과가 계약과 다름; 재현 절차와 요구 ID 기록 |
| BLOCKED | 필요한 환경·권한·artifact 부재; 해제 조건 기록 |
| NOT TESTED | 계획만 있고 아직 실행 안 함 |
| UNKNOWN | Excel/VBA 환경의 정책·가능 여부 자체가 확인되지 않음 |

문서 존재·Agent 완료 보고는 제품 PASS가 아니다. 결과에는 commit, OS/CPU, Node/browser/Excel/Docker version, fixture, exact command, 시각, exit code를 기록한다. Password/Cookie/session/원본 Workbook 내용은 기록하지 않는다. Flaky retry로 최초 실패를 숨기지 않는다.

## 계층과 공통 fixture

- Static: R-ID와 API/DB/Security/Scheduling/Import/Deployment 간 양방향 추적 및 예제·링크 검증.
- Unit/Vitest: pure date/calendar/graph/summary/WBS, schema/security utility. Clock을 주입하고 DB/network 의존 제거.
- Integration: 임시 SQLite에 실제 migration 적용, Repository→Service→HTTP, FK/transaction/session/revision 검증.
- Browser/Playwright: 새 context, 두 편집자, Readonly/unlock/CRUD/drag/hierarchy/reload/import/export/error recovery.
- Artifact/system: 실제 target Docker/volume와 ExcelJS workbook 재개방, Excel/LibreOffice 표시, 승인된 Windows Excel 실환경 POC를 분리.

P-A/P-B 두 Project에 같은 externalId를 사용해 isolation을 시험한다. 금요일 2026-09-11, 주말, 9/14 테스트 조직 휴일, 윤년, 한글 ID·이름, `=1+1`, `+cmd`, `@SUM(1,1)`, HTML·SQL-like text, comma/quote/CRLF를 공통 fixture로 둔다. 9/14는 실제 법정 공휴일로 주장하지 않는다.

## Authorization / concurrency

| ID | 검증과 기대 결과 |
| --- | --- |
| AUTH01 | Create의 Origin/크기/rate 정책, Project+salt/hash+session 원자 저장, 같은 password에도 다른 salt/hash, 원문 미저장 |
| AUTH02 | 새 browser direct GET Readonly; UI 강제 edit 상태에서도 보호 API mutation은 거부 |
| AUTH03 | correct/wrong password, unknown Project 일반 오류, timing-safe compare, KDF concurrency/rate 제한 |
| AUTH04 | Production __Host cookie의 Path=/, HttpOnly/Secure/SameSite=Strict, Domain 없음, expiry; local HTTP 별도 이름; JS storage/token URL 없음 |
| AUTH05 | expiry 경계, revoke, auth_version, malformed token, P-A token으로 P-B write 거부; logout idempotent |
| AUTH06 | create/unlock/logout/preview 포함 unsafe method의 missing/null/malformed/multiple/cross Origin 거부, exact scheme/host/port; GET/HEAD 상태 불변 |
| AUTH07 | public Task UUID를 알아도 다른 Project CRUD 거부; parent/link composite FK도 cross-project insert 거부 |
| AUTH08 | If-Match 누락428/stale412; 동시 동일 revision write 둘 중 하나만 성공, 성공당 revision1 증가 |
| AUTH09 | preview 뒤 다른 write→commit412 전체 불변; password revoke/mutation race에서 transaction 최종 session 검증 |
| AUTH10 | route inventory를 보호 API 목록과 대조, 신규 unsafe endpoint 누락 실패; preview는 session+Origin 필요/If-Match 불필요/DB불변 |
| AUTH11 | log/response에 password/hash/salt/session/Cookie/import body/SQL/stack/내부 path 없음 |
| AUTH12 | password 변경으로 이전 모든 session 무효화, 호출자 새 token만 유효; 204/new ETag/Set-Cookie 계약 |

## Scheduling / database

| ID | 검증과 기대 결과 |
| --- | --- |
| SCH01 | strict date-only·윤년·월말·허용 기간, UTC/Seoul/DST 환경 동일 결과 |
| SCH02 | inclusive 근무일 duration, weekend+holiday/연속 휴일, 탐색 상한 |
| SCH03 | Task duration1+, milestone0/start=end, 잘못된 음수·소수 거부; end는 dependency 전 계산과 비교 |
| SCH04 | requestedStart 보존, Auto 이동 warning, dependency 삭제·앞당김 시 요청일로 복귀 |
| SCH05 | FS 분기·합류·여러 선행, self/duplicate/missing/summary endpoint/cycle/미지원 type·lag 거부 |
| SCH06 | Manual interval 유지, FS 및 calendar 변경 충돌 전체 거부, 명시적 Manual edit는 새 요청 |
| SCH07 | milestone 양쪽 endpoint와 chain에서 next-working-day FS, duration0 유지 |
| SCH08 | empty summary 단일 생성 거부; summary+첫 child batch는 최종 snapshot만 검증; 마지막 child 삭제·이동+summary 삭제 원자 처리 |
| SCH09 | nested/hidden descendant min/max span, fractional weighted progress·milestone-only 평균, DB REAL 값 왕복; summary mode auto/요청일null |
| SCH10 | root/sibling order, forward parent refs, reparent/reorder; sort/filter가 WBS나 stable ID를 바꾸지 않음 |
| SCH11 | 결정성·멱등성·입력 불변, leaf 근무일·FS bound·summary containment 성질 |
| SCH12 | Browser/server 동일 fixture, SVAR date end adapter, drag/resize, 단일 명령 중복 저장 방지 |
| DB01 | empty DB migration/ledger/checksum drift/FK pragma/foreign_key_check/WAL/busy 정책 |
| DB02 | bound SQL과 identifier allowlist, project isolation, nth-write fault 시 row·summary·revision 전체 rollback |
| DB03 | task-batch 100 operation/5MiB, unknown field/중복 변경 target, order 정규화, 명시적 삭제와 incident link ID 응답 |

## Import / VBA

| ID | 검증과 기대 결과 |
| --- | --- |
| IMP01 | minimal/full JSON1.0 preview→commit, normalized task/link/order/diff/count, preview DB불변 |
| IMP02 | encoding/JSON/duplicate key/version/unknown/missing field/date/duration/progress/type/mode 오류 path/code |
| IMP03 | payload·기존 DB duplicate ID, whitespace/control ID, missing parent/target·cycle·unsupported constraint 전체 거부 |
| IMP04 | array 뒤 parent forward reference, summary snapshot 차이 preview, derived authority |
| IMP05 | Manual conflict와 byte/task/link/depth/date 상한 초과→부분 commit 불가; direct API도 동일 validation |
| IMP06 | 정보용 Project metadata가 DB를 변경하지 않음; v1 참조는 batch 내부로 한정 |
| IMP07 | 첫·중간·마지막 insert fault 전체 rollback, stale commit 거부, 중단 후 일관된 재조회 |
| IMP08 | wizard file→parse→mapping→business preview→명시적 commit→result, cancel/back/retry/focus/loading |
| IMP09 | CSV UTF8 BOM 유무, reordered/duplicate/missing headers, metadata 일치, quoted comma/quote/CRLF, JSON predecessor cell, blank parent→null, [] 필수, JSON과 동일 결과 |
| IMP10 | 한글/Unicode externalId exact 보존과 API taskId 분리, formula-like text 실행·변형 없음 |

실제 Excel/VBA POC는 [VBA_EXPORT.md](VBA_EXPORT.md)의 각 항목을 PASS/FAIL/BLOCKED/UNKNOWN으로 기록한다. 조직 정책·대상 Workbook은 UNKNOWN, VBA/parser 미구현으로 못 하는 실행은 BLOCKED다. Fixture만으로 실제 POC를 PASS하지 않는다.

POC 필수: VBA 실행/셀 접근, Header 탐색·alias mapping, 필요한 열만 추출, 안정 ID·parent/dependency, 1900/1904 날짜·진척, 한글/escaping/encoding, 승인 위치 JSON과 CSV 저장, 오류 row 보고, 생성 파일의 실제 Web preview/commit. DRM 우회 없이 허용된 입력 경로만 검토한다.

## XLSX / Docker / UI

| ID | 검증과 기대 결과 |
| --- | --- |
| XLS01 | ExcelJS 재개방과 Project/Tasks/Dependencies, metadata·date·모든 task/link 값 비교 |
| XLS02 | canonical APP_BASE_URL/public ID hyperlink, Host header 영향 없음, password/session/internal ID 없음 |
| XLS03 | user string은 string cell, XLSX XML에 user-origin formula/external relationship 없음, 한글 실제 표시 |
| XLS04 | 한 revision snapshot, row/기간/resource limit, content-type·안전한 filename |
| XLS05 | Phase1 PASS 후 별도 Phase2: date/week/month, inclusive bar, weekend/holiday, progress/milestone/summary/print |
| DEP01 | actual arch clean lockfile build, builder/runtime ABI/libc/CPU, require/SELECT1/migration |
| DEP02 | non-root UID/GID, fresh volume·bind mount permission, invalid ownership 시 not-ready |
| DEP03 | live process vs ready SQL/config/migration/FK; checksum failure/readonly volume→503 또는 종료 |
| DEP04 | create/edit→restart/recreate 같은 volume→data/revision 유지, single instance |
| DEP05 | consistent backup→off-host artifact→isolated restore→integrity/FK/read/write/export/restart; 같은 volume 사본은 불충분 |
| DEP06 | context/image/history/log에 .env/PAT/DB/backup 없음; production path/URL/Secure 오류 시작 거부 |
| DEP07 | graceful/forced stop WAL durability, busy timeout, isolated upgrade/rollback |
| UI01 | Create→Readonly→unlock→CRUD→drag/resize→hierarchy batch→FS→reload |
| UI02 | 401/403/409/412/413/429/500 복원, loading/error/keyboard focus, no-PRO runtime 사용 확인 |

## Requirement traceability와 Release gate

| Requirement | 계획한 증거 |
| --- | --- |
| R01–R05 | AUTH01–12, UI01 |
| R06–R09 | SCH01–12, 공식 API/version/license POC, 기능 Matrix |
| R10–R11 | DB01–03, Architecture dependency boundary |
| R12–R16 | VBA POC, IMP09–10, 공동 계약 검토 |
| R17 | IMP01–10 |
| R18–R20 | XLS01–05, Phase 분리 |
| R21–R22 | DEP01–07 |
| R23–R24 | Agent 설정·독립 QA·Manager 기록과 구현별 build/typecheck/tests |
| R25 | UI01–02, Project List 공개 정책 D02 |

PR gate는 build/typecheck와 관련 unit/integration/E2E, migration 회귀, dependency/license 검토, 문서 일관성이다. 현재 command는 package가 없으므로 아직 정의되지 않았다. 구현 PR은 test ID에 실제 command·결과를 연결해야 한다.

Unauthorized/cross-project write, secret 유출, stale overwrite, cycle 누락, partial import, XLSX formula/link injection, migration/restore 실패, restart 데이터 손실은 release blocker다. QA 보고는 Summary/Requirement Coverage/Test Results/Failures/Security/Regression/Documentation/Remaining Risks/Recommendation을 포함한다.
