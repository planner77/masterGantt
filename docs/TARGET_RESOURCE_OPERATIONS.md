# Target·Resource 이관·복구 절차

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
