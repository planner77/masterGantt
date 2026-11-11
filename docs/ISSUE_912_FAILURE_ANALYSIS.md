# Issue #912 / #909 / #911 누적 실패·검증 원장

## 범위·출처와 공개 경계

단일 Primary는 #912이며 [#909](ISSUE_909_FAILURE_ANALYSIS.md)·[#911](ISSUE_911_FAILURE_ANALYSIS.md)은 이 원장으로 연결한다. [Work Packet](exec-plans/active/ISSUE_912_909_911.md), [기계 인덱스](REGRESSION_INDEX.json), [원장 계약](ISSUE_LEDGER.md)을 따른다. 기존4 Issues·20 Failure·45events와 원장 bytes는 그대로 보존한다. 기준 source는 `8eaaaaa2b7b9a24e2b4a72e7d81698217da5cf2d` 위 WIP이며 전체 working fingerprint를 수집하지 않았으므로 아래 빠른 검사·운영 보조 근거는 SCOPED다. 실제 명령·exit·시각을 모르는 값으로 채우지 않는다. 수정 commit은 아직 미생성으로 NOT TESTED다.

실제 DB/env/Origin/업무 값·키·인증 파일·원시 로그는 공개하지 않는다. 원본은 접근 통제된 비공개 저장소에 보존하며 공개 placeholder는 의도적인 정제다. 합성 native/CLI PASS와 실제 image·운영 복원, read-only registry probe와 실제 게시, 과거 GPG backup과 새 AES-GCM format을 구분한다. source 동결 후 새 candidate 전체 Gate·새 CLI 실제 게시는 아직 NOT TESTED다. [Owner PLAN](https://github.com/planner77/masterGantt/issues/912#issuecomment-6792734658).

## F912-001 · OPERATION / 오프호스트 목적지 부재 — BLOCKED

최초 read-only 조사에서 기존 백업 도구에 원격 job/connection이 없고 관측된 mount도 오프호스트 저장소가 아니었다. 외부 목적지·접근 근거 없이 전송/원격 복원을 실행하지 않았다. 정확 조사 argv/개별 시각·exit는 이 공개 원장 작성 시 미수집이며 원시 설정은 비공개다.

Owner가 `별도 없습니다.프로젝트 폴더 내 하위 폴더를 이용하세요`라고 결정했다. 승인 범위는 원본 프로젝트의 `backups/mastergantt/<backupId>`에 암호문/manifest만 보관하는 로컬 방식이며 key는 프로젝트 밖, 복원 평문은 모든 Git/운영 경로 밖 새 private root다. [Owner 범위 결정](https://github.com/planner77/masterGantt/issues/912#issuecomment-6793132205). 오프호스트 요구는 Owner 범위 변경으로 N/A·미실증 NOT TESTED이며 PASS가 아니다. 같은 호스트 유실 위험은 남는다. 보관·주기·RPO/RTO 숫자 정책은 별도 Owner 응답 전 PENDING이다.

## F912-002 · STATIC / 새 합성 테스트 BigInt literal — FAIL

통합 `npm run typecheck`에서 새 `tests/scripts/sqlite-backup.test.ts`의 BigInt literal이 현재 TypeScript target과 충돌해 TS2737로 FAIL했다. 첫 관측 `/tmp/mastergantt-909-typecheck-r5.log`를 보존한다. 첫 개별 시각/exit는 이 원장에 미수집으로 남긴다. 값 자체를 줄이지 않고 `BigInt("9223372036854775806")`으로 교정했다.

교정 후 실제 `npm run typecheck` exit0(`LOCAL:912/typecheck-r2`) 및 `npm test -- tests/scripts/sqlite-backup.test.ts` 최종16PASS/1file/exit0를 확인했다. 최종 r8 로그를 보존하고 QA의 독립 명령 `npx vitest run --config tests/config/vitest.config.ts tests/scripts/sqlite-backup.test.ts --maxWorkers=1`도2026-11-11T10:10:02Z·2.10s·16/16·exit0였다. 이는 WIP 합성/직접 CLI 범위이며 새 candidate 전체 Gate·실제 image PASS가 아니다.

## F912-003 · UNIT / symlink 부정검사의 guard 우선순위 — FAIL

`npm test -- tests/scripts/sqlite-backup.test.ts` r3는2026-11-11T10:05:03Z 시작·1.73s·exit1·14PASS/1FAIL였다. 실제 case `allows only the approved primary-project encrypted prefix and rejects Git/Docker exceptions or symlinked parents`에서 예상 `SYMLINK_REFUSED` 대신 `BACKUP_GIT_IGNORE_REQUIRED`였다. 위험 경로는 차단됐지만 symlink보다 Git ignore 검사가 먼저 실행됐다. 원본 `LOCAL:912/focused-r3`를 보존한다.

기존 backup ancestor의 canonical/symlink 검사부터 수행하도록 순서를 고쳤다. r4는2026-11-11T10:05:33Z·1.73s·15PASS·exit0, 실제 CLI 네 단계 포함 최종 r8은16PASS·exit0였다. 모든 Git 밖 key/plaintext/scratch, primary project의 정확 backup prefix, 실제 Git/Docker exclusion, 기존 파일 비덮어쓰기, WAL·NULL/BLOB/큰 INTEGER·quoted identifiers·late migration rollback·구 이미지 checksum 거부를 검증했다. 첫 오류와 이후 PASS는 별도 event로 보존한다.

## F912-004 · OPERATION / pinned ORAS의 실제 부재 응답 — BLOCKED

ORAS1.3.6 read-only probe는2026-11-11T10:23:05.206Z~10:23:09.094Z에 tags exit0/fetch exit1이었다. 오류에404 또는 MANIFEST_UNKNOWN이 없으므로 기존 엄격 부재 판정이 BLOCKED했다. 실제 원문/인증 정보는 비공개로 보존한다. 이는 upload 실패가 아니며 registry write는0이다.

교정은 pinned ORAS 오류의 두 exact reference와 인증된 repository inventory에 결속한 좁은 부재 판정이다. R2는2026-11-11T10:24:55.432Z~10:24:58.344Z 실제 read-only PASS였다. tag 존재/인증·네트워크 오류를 일반 부재로 간주하지 않으며 실제 게시 성공은 아직 NOT TESTED다. 정확 정제 명령·exit 근거는 아래 후속 운영 메모와 기계 event에 연결한다.

## F912-005 · OPERATION / PR 종료 후 보존 ref 누락 — BLOCKED

Owner 승인에 따라 기존 PR을 개별 미병합 종료한 뒤 readback에서 #847 원격 branch가 없음을 발견했다. 누락 actor는 확인하지 않았으므로 bot·자동 삭제로 단정하지 않는다. 첫 readback 시각/명령 exit는 미수집이다. 원본 Head `0f4aa289cf7183234a70bfca8d29d3063d209dcf`와 로컬 archive ref는 보존돼 있었다.

2026-11-11T10:21:16.308889Z~10:21:17.336553Z create-only Git ref API로 정확 같은 Head를 복구했다. force/기존 ref overwrite는 없었다. closure receipt의 성공 API 결과와 모든7개 원격 ref의 정확 Head·로컬 archive 보존 PASS를 확인했다. [Owner 개별 처리 승인](https://github.com/planner77/masterGantt/issues/911#issuecomment-6793181476), `LOCAL:911/closure-receipts.json`·`LOCAL:911/head-preservation.json`을 연결한다. 제품 feature merge/완료나 branch 삭제 승인이 아니다.

## F912-006 · OPERATION / 기존 registry 인증 파일 mode — BLOCKED

첫 read-only probe에서 기존 인증 파일이 요구0600이 아니어서 guard가 BLOCKED했다. 실제 인증 값·원래 경로·파일 내용은 공개하지 않는다. 원본 인증 파일의 mode를 바꾸거나 guard를 제거하지 않았다.

프로젝트 밖 새 private0700 root에 인증 파일을0600으로 복사한 뒤 같은 strict guard로 read-only probe를 수행해 PASS했다. 자기 소유 private copy만 사용했고 원본 파일은 보존했다. 정확 정제 argv/개별 시각/exit가 미수집인 관측을 새 source나 publication PASS로 과대 표시하지 않는다. auth-file Unit 계약과 실제 수동 probe 범위는 별개다.

## REVIEW 관측 / 실행 실패와 구분

독립 정적 검토에서 graph-directory 선행조건, 암호화 원문 로그 보존과 요약 status/실제 stage 일치 조건을 검토했다. 이들은 REVIEW 관측이며 실행하지 않은 사례에 실제 FAIL ID/명령/exit를 만들지 않는다. 실제 focused와 후속 full Gate·운영 결과는 별도 근거로 누적한다. 새 SQLite CLI의 독립 QA16PASS는 합성/직접 CLI 범위이며 실제 current/rollback image 리허설을 대신하지 않는다.

## F912-005 실제 wrapper exit 보완

Manager가 실제 tool session89982의 `python3 -` wrapper exit0를 확인했다. 같은 wrapper 안에서 create-only POST git/ref의 반환 ref/object SHA와 `git ls-remote`7개 exact Head 대조가 성공했다. API span은10:21:16.308889Z~10:21:17.336553Z이고 전체 wrapper의 정확 시작/종료는 미수집이다. HTTP status는 미수집이므로201로 추측하지 않는다. `LOCAL:pr-911-restoration-session-89982` 원본 실행 근거를 연결하며 remote API를 재실행하지 않았다.

## F912-007 · STATIC / 문서 링크 검사 명령 파일명 — FAIL

원장 작성 Agent가 `node scripts/verify-markdown-links.mjs`를 실행해 exit1/MODULE_NOT_FOUND를 관측했다. 실제 파일명이 `scripts/check-markdown-links.mjs`임을 확인해 `node scripts/check-markdown-links.mjs`로 교정했고 exit0/460 Markdown files link 검사가 PASS했다. 개별 시각은 미수집이다. validator·제품 결함이 아닌 로컬 실행 명령 오류이며 코드·검사를 약화하지 않았다. 최초 오류는 실행 원본과 이 기록으로 보존한다.

## 실제 기존 format 로컬 복구 리허설 / 새 CLI와 구분

Manager가 전달한 정제 결과에서 기존 암호화 backup의 원본 project-local copy·격리 복원의3단계가2026-11-11T10:17:59.146Z~10:18:10.872Z PASS였다. current source8e29/index `sha256:8ebd91b4f6b316c3bdc9a221e5a8ee9d50a3fb4fb845c2ebf140e44ac50292d1`와 rollback `sha256:7c8e3ed6ed8b78ab8d5832fa2b225cf3f160e1c8e5b044963330e78eb26dc866`,73tables·ledger38 보존을 확인했고 자기 소유 임시 자료 cleanup은10:19:47.417Z였다. 이 원장 작성 Agent는 raw DB/env/key/로그를 읽지 않았다. 정확 정제 argv/개별 exit와 backup ID는 추가 sanitized 근거 전 미수집으로 남긴다.

위는 기존 #913 GPG format·해당 current/rollback image의 실제 수동 리허설 보고다. 새 AES-GCM CLI로 운영 backup을 만들거나 새 candidate runtime을 검증한 결과가 아니며 새 format의 actual operator proof는 아직 NOT TESTED다.

## 후속 실제 근거 / 고정 candidate와 도구 호출 오류

아래 결과는 앞선 WIP·미수집·미실행 기록을 덮지 않고 추가한다. source는 `af3d72f85555722c8af81b8e99dc94a5c4f0c08f`이며 제품0.145.1이다. 실제 toolsourceaf3와 backup이 포착한 runtime source8e29/index8ebd를 구분한다.

## F912-001 후속 · 새 AES-GCM 실제 CLI/격리 복원 — PASS

`python3 <private-runner>/aes-trial.private.py <private-evidence-dir>`는2026-11-11T10:38:16.523934Z~10:38:17.592562Z exit0였다. 실제 keygen/backup/verify/restore는각exit0이며 native재open에서73tables·ledger38·schema/data가동일했다. backupID `mg-aes-20261111T103816Z-ac051a98`은원본project의승인prefix에암호문으로보관하고key는Git밖32byte0600,기존GPGkey와별도다. cipherSHA256 `f23b225e5499afadf6b943b58a943a9194fce6f68f57072199c48d586b301749`를결속했다.

실제backup source/image는 `8e29fe828a3a8b5fb5b8dc46b82b74722bae33fe` / `sha256:8ebd91b4f6b316c3bdc9a221e5a8ee9d50a3fb4fb845c2ebf140e44ac50292d1`다. 새toolsourceaf3를기존DB의source로바꾸지않았다. sourceDBconnectionreadonly·productionvolumewrite/restart0,scheduledjob0이며CLIruntimeImageVerified/offHostVerified=false를유지한다. testOnlyMaxAgeMs3600000은Owner정책이아니다. 최초offhostBLOCKED/로컬범위결정은그대로보존한다.

cleanup `python3 -` exit0·완료10:39:34.574012Z/시작미기록. 자기source/restoredplaintext DB/WAL/SHM제거·SQLitefiles0,AEScipher/manifest·외부32byte0600key·legacyGPG보존·생산변경0을확인했다. 독립QA는sanitizedmetadata만검토했고rawDB/key/env를읽지않았다. `LOCAL:912/aes-cli-sanitized-summary.json`에4CLI정제argv/시각/exit가있다.

## F912-004 후속 · 고정 source 검증과 실제 같은 OCI 게시 — PASS

exactsourceFingerprint `7128eeb035413b3a63a2a40b32a6456a48858db4f44b43f8b53ce47dda77addd`·environmentFingerprint `45cc59822937f2396b4fa9b031b0351b4b6b53c6b9dea0822d4b65a003b71cd0`가시작/끝같았다. fast10:34:54.088Z~10:38:19.936Z,targeted10:38:19.971Z~10:38:51.760Z,docker10:38:51.805Z~10:42:42.232Z,admit10:42:42.272Z~10:42:44.127Z 모두실제PASS였다. wholeUnit3970PASS/0FAIL/3SKIP,targeted108Unit/4browser를구분한다.4mode의integrityhash는기계event·로컬summary에보존한다.

실제publisher는10:44:59.604Z~10:48:40.550Z,session60229exit0였다. pinnedORAS1.3.6의원본부재판정오류를보존하고narrowexactreference+authenticatedinventory guard로재검증했다. 실제ORAScp는10:45:13.649Z~10:47:40.640Z exit0, `cp --from-oci-layout --recursive --to-registry-config <auth-config> <same-OCI>@sha256:9b68d8dda46f469d5fab87843f65f8b393ad6bb2fb767cd788f19afa90f85f2f ghcr.io/planner77/mastergantt:sha-af3d72f85555722c8af81b8e99dc94a5c4f0c08f`였다. placeholder는정확비공개/로컬경로를의도적으로정제한것이다.

동일OCI원격graph17blobs·SBOM/provenance·exactdigestPull·imagepolicy/readiness/APIauth/SQLiteRestart/integrity·owncleanupPASS였다. archiveSHA256 `c8b01a8ff06d38ad3e609cf4caca74b5a10d570cc6cf0d8d4d82bf947e8ae7f6`,configdigest `sha256:b0001c5304dc6527fc7a3ba1c48409a62c8563533bc53510de801abac483ed09`,receiptintegrity `4f0b47102c89c75671758c596ac74192979f67e76cc17b4f4e0b640468a8fc44`다. 독립QA는58encryptedstream의metadata/AAD/hash/mode/truncated0을검토했고key/plaintext는읽지않았다. 재빌드·기존정상tagoverwrite·운영배포는없다.

## F912-008 · STATIC / reviewer wrapper의 runner 종류 오용 — FAIL

독립Reviewer의 `node --input-type=module` stdin read-only검산은Vitest에도snapshotRunnerRoot를호출해 `BLOCKED: runner source 경로가 해당 보고서의 snapshot과 다릅니다.` exit1(chunkdb9953)이었다. 제품/source/report변경0,정확개별시각미수집이다. Playwright에만snapshotRunnerRoot,Vitest에실제repoRoot를사용한교정검산은exit0(chunkcc749d),source/checksum/log/runner/audit전부true였다. 제품결함·실제Gate실패와구분한다.

## F912-009 · STATIC / 운영 도구 staging native probe — FAIL

R01의better-sqlite3 private subpath require.resolve는ERR_PACKAGE_PATH_NOT_EXPORTED/exit1이었다. capturedAt10:40:33.133723Z는실패receipt저장시각이고시작시각은미기록이다. R02의build/Release addonpath추측은ENOENT/exit1,10:41:23.064000Z~10:41:23.096788Z였다. 두원본stderr/failure receipt를비공개로별도보존했다.

R03은실제require.cache에서loadedlinux-x64.node를찾아bytehash/native memorySQLiteopen을검사해exit0,10:42:07.481351Z~10:42:07.517481Z였다. pinnedNode22.14.0/ABI127·better-sqlite3 13.0.3·SQLite3.53.4·nativeSHA256 `6fd4292c6c5f352436cd85c9e1cb286978efa43c20ae350973f83414ced9991d`와sealedtool을결속했다. help/stagedexistingAESverify도exit0,staging완료10:42:32.185536Z이며이때activation/timer/prod0이었다. memoryDB만사용해새plaintextfile0,CLIverify scratch는finally정리했다.

후속수동operator활성화는10:47:32.236012Z~10:47:47.572324Z실제PASS이며activehelp/newAESverify각exit0였다. 기존userfilesoverwrite0/stagingbytes보존,productionwrite/restart0,timer/cron/prune/deployhook0이다. 숫자정책은계속PENDING이다.

## F912-010 · OPERATION / Manager GitHub 댓글 parameter schema — FAIL

첫structuredconnector호출은잘못된schema로INVALID_ARGUMENT였고외부mutation0이었다. 정확repo_full_name/pr_number/comment로재시도해comment6793663002가생성됐다. 정확개별시각은미수집이다. API tool은process exit가없으므로후속actual/toolStatus=SUCCESS를기록하고가짜exit0/PASS를만들지않는다. 기계event의후속NOTTESTED는process-exit검증경계를뜻하며실제댓글생성을부정하지않는다. 제품결함이아닌도구호출오류다.

## F912-011 · OPERATION / rollback SHA tag 추정 조회 — FAIL

Manager의read-onlyretention wrapper는10:43:33.470Z exit1(session73849)이었다. latest/0.145.1/0.145/0은기존7c8,currentsha8e29tag는8ebd로5조회exit0였다. 마지막rollbacksource90c5의sha-tag존재를추정한조회가exit1/digestnull이었다. 원문stderr미보존으로구체이유는UNKNOWN이며404/인증/네트워크오류로추정하지않는다. registrywrite0,제품/publisher결함아님을명시한다.

실제rollbackauthority인기존formal0.145.1및exactdigest7c8로교정한R2는10:44:05.886Z wrapperexit0(session36541),4formalrefs7c8동일/current8ebd·rollback7c8descriptor각exit0였다. stdout/stderr는암호화private로보존했다. 게시후10:49:16.710Z재검산도6reference동일·exit0였고정상tag/current/rollback보존을확인했다. 실제wrapperargv는현재공개원장미수집으로남기고원본root transcript를연결한다.

## F912-012 · RESTORE / 새 AES 복원 clone의 물리 RO/WAL 보조 파일 — FAIL

R01전체span10:49:04.311838Z~10:49:05.680253Z에서activeAESrestore는exit0였으나app시작전fingerprintsubcommand10:49:05.333049Z~10:49:05.680051Z가SQLITE_CANTOPEN/exit1이었다. sidecar없는WALsnapshot과물리ROownedvolume조합이원인이었다. 원본R01receipt/stderr를보존했고생산mount/write/restart0이었다.

자기ownedvolume만RWphysicalmount하고SQLiteconnectionreadonly/query_only를유지한 `python3 <private-runner>/aes-runtime-r02.private.py <private-evidence-dir>` R02는exit0,10:50:12.971286Z~10:50:16.630893Z였다. syntheticwrites전73tables/ledger38/schemaexact·actualSQL38·integrityok/FK0·APIauthOriginrevisionJSONexportrestartPASS였다. 새AESbackup→기존current8e29image의격리clone실증이며af3image의운영배포가아니다. productionmount/write/restart0,offhostfalse,testOnlyMaxAgeMs3600000은정책승인이아니다.

최종cleanup `python3 -` exit0,완료10:51:48.227267Z/시작미수집. ownclone1/volume1/restore평문을제거해workspaceSQLite0,AEScipher/외부32byte0600key·legacyGPG·activeoperatorstaging원본은보존했다. timer/cron/prune/deployhook0·productionmount/write/restart0을확인했다. 허용sanitizedsummary만읽고rawDB/env/key/원문로그는읽지않았다.
