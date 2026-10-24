# 실물·리소스 원본 이관·복구 절차

## Issue #792 — 보존 원본 scope 시범 적용·오프호스트 백업/복구 Gate

### 운영 착수 조건

본 Issue 코드의 수정 단위는 **기존 Summary 직접 `task_target_bindings` 한 건의 self/subtree**이다. 외부 Target CRUD의 410, 원본 `whole/subset/coverage`, 기존 `project_work_areas`, Task/Assignment/E1/MCS/공수와 archive graph는 보존한다. `POST` preview는 읽기 전용 영향 목록이고 `PATCH`는 같은 프로젝트 세션·Origin·If-Match·sourceFingerprint·impactToken을 다시 검증한 뒤 원본 scope만 갱신한다. 원본 구성원 교체, 자동 직접 관계 flatten, table DROP, 운영 데이터 일괄 이관/실사용 전환은 **승인된 범위가 아니다**.

| Gate | 작업·기록할 증거 | 현재 |
| --- | --- | --- |
| G0 소비자 | 기간·환경별 외부 legacy API 호출/클라이언트 버전, 410 오류 영향과 담당자, 신규 API 사용 허가/Origin; credential·token은 수집 금지 | NOT TESTED |
| G1 스냅샷 | 쓰기 중지 또는 SQLite online backup으로 일관된 DB 백업, 정확 migration ledger/schema checksum, `PRAGMA integrity_check`, `foreign_key_check`, Project/Task·Target/member·binding/member 행 개수와 canonical UUID·coverage·sourceTask/WorkArea hash를 **프로젝트·자료구조별** 고정 | NOT TESTED |
| G2 오프호스트 복원 | 원본 backup digest와 off-host 파일 digest 일치, 별도 호스트/격리 volume에서 현재 image 대응 migration DB 기동·restart, 동일 Source/Task/Assignment/WBS KPI/정확 drill/Excel·Copy/Template snapshot 비교. 구버전 바이너리만 실행하여 무손실 복구를 주장하지 않음 | NOT TESTED |
| G3 한정 pilot | 운영 전 승인된 **격리 복제본**의 Summary 직접 원본 1건에 GET→POST→PATCH→GET, 동일 source/member/coverage row 및 유효 task ID/quantity·resource 공수 전후 비교, scope 반대 방향 재적용 복원, stale token/Session revoke·FK 손상·중간 오류 롤백 및 재기동 | NOT TESTED |
| G4 운영 승격 | 운영 담당자/Owner의 정확 Head+데이터셋/백업 일시·digest·검증 로그·소비자 종료 승인, HA/성능·관제 및 긴급 rollback 경로. 불일치1개면 stop, backup 보존·실제 원본 재적용과 revision 재검토 | NOT TESTED |

### 실무 사전 질의(민감정보 제외)

- DB의 실제 경로/버전·WAL 사용 여부·quiesce 조건, 복구 호스트/용량/파일 digest 저장소, 앱 image commit sha를 운영 담당자가 확인해야 한다. 문서의 예제 파일 경로를 운영 디스크 경로라고 추정하면 안 된다.
- DB 한 트랜잭션마다 읽기 일관성이 필요하다. 활성 WAL 파일을 무작정 복사하는 대신 SQLite `.backup` API 또는 지원되는 온라인 백업 수단으로 일관된 snapshot을 만든 뒤, 별도 호스트로 복사하여 checksum을 기록한다.
- 격리 복원본에서 다음과 같은 **읽기 전용** 검사를 실행한다(실제 파일 위치는 운영자가 지정): `sqlite3 '<backup-db>' 'PRAGMA integrity_check;PRAGMA foreign_key_check;'`. 변경 전후 `SELECT project_id,task_id,target_id,public_id,scope,selection,anchor_member_id FROM task_target_bindings ORDER BY project_id,id;` 및 `SELECT project_id,binding_id,target_id,member_id,coverage FROM task_target_binding_members ORDER BY project_id,binding_id,member_id;`를 외부 보안 저장소에 비교용으로 보관한다. 수집물에 개인 정보·credential·API token 포함 금지.
- Preview 토큰은 현재 source·Project revision에 대한 확인 정보이지 오프라인 승인 도장이 아니다. 적용 도중 예외·다른 편집으로 snapshot이 달라지면 새 GET/POST가 선행되어야 한다. 장애 시 부분 UPDATE는 SQLite 롤백되어야 하며, 불일치가 발견되면 원본 백업+대응 image로 복원하거나 검토된 forward correction만 수행한다.
- 실제 `PRAGMA integrity_check=ok`만으로 외부 consumer 0, 업무 coverage 동일, 정확 WBS KPI, off-host DR 성공은 성립하지 않는다. 모든 G0~G4는 운영 실측 전 **NOT TESTED**이며 승인 없이 프로덕션 DDL·대량 수정·삭제를 진행하지 않는다.

[실행/미검증 Packet](exec-plans/active/ISSUE_792.md) · [단일 누적 실패 원장](ISSUE_792_FAILURE_ANALYSIS.md) · [API](API.md#issue-792--레거시-summary-직접-관계-적용-범위-한정-편집)

## Issue #785 — 공개 도메인 폐기와 단계적 원본 보존

이번 전환은 DB flatten/backfill/DROP을 수행하지 않는다. whole의 동적 구성·subset coverage·Summary 상속은 내부 archive resolver로 유지하며 실제 실물 ID·원본 Task/Assignment·opaque 관계 출처로 조회한다. 전용 공개 Target API의 410과 기본 resource/WBS v2 전환은 배포 소비자 확인 대상이다. 명시 v1 읽기는 deprecated이며 외부 소비자0을 추정하지 않는다. 구형 caller 목록·사용량·호환 종료일은 운영 조사 전 NOT TESTED다.

배포 dry-run은 source table/관계·유효 실물 ID·coverage·T0/A/R·집계/정확 상세의 before/after와 integrity/FK·migration ledger를 격리 backup에서 비교한다. 신규 직접 데이터와 legacy-only/mixed·whole/subset·self/subtree·비활성/공통/공유/동명·비정상 참조를 구분한다. 해석 불가·전송 JOIN 누락은 전체 실패·원본 보존이며 조용한 부분 변환을 허용하지 않는다.

지원 Copy/Template는 기존 private graph의 참조를 원자 재매핑한다. 신규 직접 업무에서 숨은 archive 그룹을 만들지 않는다. JSON1.1/일반 일정 Excel은 기존 미지원 한계를 유지한다. 공개 건수/시트는 실물 용어로 전환하지만 복구 원본을 버리지 않는다. 레거시 출처 자체의 안전 편집과 파괴적 P3는 별도 gate다. 소비자0·실제 backup/restore/restart·source 비교·Owner 승인 전에 archive 원본을 제거하지 않는다.

현재 runtime의 실제 migrations/ledger를 조회하며 아래0027/schemaVersion3 수치는 #623 당시 기록이다. 운영 DB 실제 건수·off-host backup/restore·구버전 binary 조합·최종 수용은 NOT TESTED다. rollback은 대응 backup/image 또는 forward correction이며 기존 volume/원본을 보존한다. [Work Packet](exec-plans/active/ISSUE_785.md), [실패 원장](ISSUE_785_FAILURE_ANALYSIS.md).

## Issue #737 — WBS 다관점·직접 WorkArea 복원 범위

아래 #623의0027/schemaVersion3 설명은 당시 이력이다. 현재 코드는 [DB_SCHEMA](DB_SCHEMA.md)와 실제 `db/migrations` ledger/checksum을 기준으로 하며, #725 Task 명시 문맥·설비 다중 구역, #727 프로젝트 리소스 참여, #762 Project 공정 직접 WorkArea와 지원 Template v5를 함께 확인한다. 기존 occurrence/WorkArea alias·Target/member/whole/subset·직접/상속 출처를 이름으로 다시 연결하거나 평탄화하지 않는다.

복원 검증은 direct-only/Target-only/mixed를 구분하여 원본 Task/Assignment/설비/System/Resource ID와 관계·revision·migration ledger, Task 공정 null/empty, 구역0..N·직접 owner/legacy alias·전체 Gate·다관점 raw union을 비교한다. Copy/Template의 새 Project 로컬 ID remap은 같은 DB backup의 ID 보존과 다른 계약이다. v5를 지원하지 않는 경로는 전체 거부해야 하며 구 형식으로 강제 저장하여 새 관계를 버리지 않는다.

신규 #737 합성 테스트는 이미 이관된 파일 DB의 backup→새 파일 열기→두 번 재시작에서 전체 table/ID와5root report를 비교한다. 과거 schema의 upgrade/transaction rollback/Copy·Template는 별도 기존 테스트로 확인한다. 이 증거는 실제 운영/off-host restore PASS가 아니다. [수용표](WBS_CROSS_FEATURE_ACCEPTANCE.md)와 [실행 원장](exec-plans/active/ISSUE_737.md)을 따른다.

동적 view spec이 지원되지 않거나 저장 설정이 오래됐으면 화면의 기본/단독 보기 복구 경로를 사용한다. 이는 UI 조회 설정 fallback이며 DB downmigration이 아니다. DB rollback은 편집 중지 후 검증한 backup과 대응하는 승인된 exact version/digest를 새 격리 volume에 복원·검증한 뒤 결정한다. 기존 volume/backup·Compose project를 보존하며 새 데이터 손실 범위를 운영자가 확인한다. 임시 `ci-*`를 정식 rollback 이미지로 추정하거나 구 binary를 새 schema에 바로 연결하지 않는다. 운영 실행·배포/릴리스 권한은 이번 테스트 PR 범위 밖이다.

Issue #623의 운영 인계 문서다. [DEPLOYMENT](DEPLOYMENT.md#8-backup-restore-rollback), [DB_SCHEMA](DB_SCHEMA.md), [수용표](TARGET_RESOURCE_ACCEPTANCE.md)가 기준이다. 아래 운영 절차의 작성과 격리 합성 SQLite 검증은 실제 운영/off-host 복원 PASS가 아니다.

## 1. 적용 전 확인

운영자는 현재 application/image의 exact version·digest, Compose project/volume 이름, DB 위치·migration ledger 최신 version/name/checksum, backup 시각·보관 위치·복원 승인자를 기록한다. 새 image는 검증된 release authority로 선택하며 임시 ci-*를 정식 rollback 이미지로 추정하지 않는다. 이번 #623은 새 release 권한을 주지 않는다.

현재 migrations는0027까지다. Target 확장은0025_process_catalog →0026_logistics_targets →0027_task_target_bindings 순서이며 기존 SQL/checksum은 수정하지 않는다. legacy 자유공정을 이름으로 자동 매핑하지 않고 비활성 참조도 임의 삭제하지 않는다. 새 schema에 구 binary를 바로 연결할 수 있다고 가정하지 않는다.

## 2. 일관된 backup

1. maintenance window를 잡고 신규 편집을 중지한다. 기존 `deploy/compose.yml`의 app을 cleanly stop한다. Compose project·영속 volume·실제 DB 경로는 유지한다.
2. 중지 완료 후 `/data` 전체(DB 및 존재하는 WAL/SHM 포함)의 일관된 storage snapshot을 만든다. 가동 중 main DB 파일 하나만 복사하지 않는다. 현재 제품에는 운영 backup CLI가 없다.
3. 원본 volume을 보존하고 access-controlled 별도 host/storage에 backup을 보관한다. 암호화·retention·RPO/RTO는 운영자가 정한다. backup·DB·secret·원시 운영 로그를 Git/image/Issue artifact에 넣지 않는다.
4. 같은 시점에 대응하는 이전 exact image/digest와 설정을 접근 통제된 운영 원장에 기록한다. `.env`/password/token 원문을 검증 보고서에 포함하지 않는다.

중지 명령은 기존 배포 위치·설정을 확인한 운영 환경에서만 실행한다.

```bash
docker compose --env-file .env -f deploy/compose.yml stop app
```

## 3. 격리 이관·시작 확인

새 격리 `/data` volume에 backup을 복원한다. 원본 운영 volume에 실험하지 않는다. image의 UID:GID1001:1001과 파일 접근 권한, absolute `/data` DB 경로, 같은 single instance 조건을 확인한다. production entrypoint는 app 시작 전 migrations를 적용하며 checksum/order/FK 오류이면 준비 성공을 반환하지 않는다.

권한 있는 SQLite 검사 도구에서 다음 무결성 결과와 migration ledger를 확인한다. 전체 운영 rows를 출력하지 않는다.

```sql
PRAGMA integrity_check;
PRAGMA foreign_key_check;
SELECT version, name, checksum FROM schema_migrations ORDER BY version;
```

integrity는ok, FK 위반은0행, ledger는 연속 prefix 및 배포 SQL checksum과 일치해야 한다. 이후 readiness·대표 Project read/write·Target/member/binding·개인 Assignment/Calendar·Resource/Excel·restart persistence를 확인한다. Project/Catalog/Calendar/참조 fingerprint가 바뀐 과거 report/detail/Excel은 stale로 실패해야 한다.

## 4. 실패와 복구

| 상태 | 조치·데이터 경계 |
| --- | --- |
| pending migration batch 실패 | runner의 schema/rows/ledger transaction rollback과 FK 설정 복원을 확인. 실패 DB로 ready 선언하지 않음 |
| checksum/order/새 ledger를 구 binary가 해석 못함 | SQL/ledger를 수동 삭제·변조하지 않음. 일치하는 artifact/migration 묶음을 확인 |
| 업그레이드 완료 후 제품 결함 | 우선 forward corrective 수정 또는 검증된 업그레이드 전 backup+대응 이전 image를 새 격리 volume에서 복원 |
| 이전 backup으로 복원 | backup 이후 새 데이터는 과거 backup에 없음. 편집 중지 시각과 손실 범위·복구 결정은 운영자가 명시 |
| 복원 검증 실패/backup 부재 | 원본 volume/backup 보존, 운영 전환 BLOCKED. 무조건 image만 되돌리거나 volume 삭제하지 않음 |

자동 down migration은 제공하지 않는다. Docker `down -v`/volume rm/운영 DB 덮어쓰기는 이 절차의 복구 명령이 아니다. 구 binary+신 schema 조합의 fail-closed와 구 backup+대응 구 migration의 격리 복원 가능 범위를 테스트하며, 업그레이드 후 신규 데이터를 무손실 down migration할 수 있다고 주장하지 않는다.

## 5. Copy·Template·외부 포맷

Project Copy/Template는 운영 DB backup의 대체가 아니다. local Task/Target/member/instance ID remap·shared MCS1회 복사·global Resource/기준정보 재사용과 유효 triple 검증을 확인한다. binding 포함 Template는 logistics schemaVersion3, binding 없는 v2/legacy는 호환한다. 현재 API에 자동 cross-site retarget을 가정한 입력을 만들지 않는다. 잘못된 site/occurrence/WorkArea 참조는 전체 거부·rollback해야 한다.

개인 Assignment가 있는 Task copy는 기존 `TASK_COPY_ASSIGNMENTS_UNSUPPORTED` 거부와 원본 불변을 확인한다. 지원되는 Task copy 및 기존 identity를 옮기는 cut/reparent는 명시 연결/subset/coverage와 새 조상 상속 영향을 확인하며 상속을 명시 row로 평탄화하지 않는다. 개인 배정을 삭제하는 우회를 이관 절차로 안내하지 않는다. Target-bearing 일정 JSON/plain Excel의 거부와 명시 Resource Excel 보고서 허용을 구별한다. #379 전체 참조 JSON 미완료이므로 JSON/Excel을 Target 포함 무손실 backup으로 안내하지 않는다.

## 6. 실행 가능한 합성 검증과 운영 미검증

전용 테스트는 임시 파일 DB·합성 rows만 사용하며 원본 운영 경로/volume을 입력받지 않는다.

```bash
npx vitest run --config tests/config/vitest.config.ts tests/server/db/issue-623-target-migration.test.ts
```

추가 Copy/Template·snapshot·OOXML 및 browser 명령/결과는 [Work Packet](exec-plans/active/ISSUE_623.md)과 [수용표](TARGET_RESOURCE_ACCEPTANCE.md)에 기록한다. SQLite backup API로 임시 backup→새 파일 restore→integrity/FK→재기동의 성공은 로컬 합성 범위다. production/off-host backup/restore·운영 TLS/proxy·실기기/screen reader·Windows Excel/VBA/DRM·최종 사용자 수용은 해당 환경에서 별도 실행 전 NOT TESTED다.
