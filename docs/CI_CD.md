# 로컬 Build·GHCR 게시 계약

Owner 2026-11-10 결정으로 모든 위험도에 [단일 Issue Lifecycle](ISSUE_LIFECYCLE.md)을 적용한다. 이름이 CI_CD인 이 문서는 현재 **로컬** 검증·수동 GHCR 게시를 규정한다. PR·GitHub Actions·원격 CI·Trusted QA·자동 Finalizer를 실행하지 않는다. 과거 운영 전문은 [보존 구역](history/owner-ci-retired-20261110/CI_CD.md)에 있다.

## 1. 검증과 게시의 선행조건

- [LOCAL_PREPR](LOCAL_PREPR.md)의 공통/영향/위험별 실제 로컬 PASS·같은 clean source admission과 DOCUMENTATION_SYNC, Owner 승인 범위를 확인한다. 검사 FAIL/BLOCKED/NOT TESTED·취소·unknown·source/fixture/환경 drift는 Push·Publish·Close를 차단한다.
- 첫 main Push 이전 #911 live Ruleset/Actions 전환을 실제로 확인한다. 문서 변경이나 `[skip ci]`는 전환 근거가 아니다.
- 최신 main exact commit/tree·lock·Node·Docker/platform·배포 입력을 고정한다. Push 뒤 같은 SHA인지 재조회한다. dirty checkout이나 검증 뒤 변경된 source는 게시하지 않는다.
- 게시 요청과 운영 배포 요청을 분리한다. 고유 SHA 이미지 게시 승인이 SemVer/rolling tag 변경 승인 또는 운영 배포 승인은 아니다. docs-only는 이미지 N/A(reason)를 기록한다.

## 2. Build-once와 고유 태그

#906/#907/#908의 로컬 Docker Gate·OCI 검산을 재사용하고 #912/#909/#911 통합 범위에서 `scripts/publish-local-image.mjs`의 계획·사전검증·게시와 private 증거 보존을 구현한다. CLI 구현·집중 테스트나 이전 이미지의 수동 게시 성공은 새 exact source에서 실행한 CLI의 게시 PASS가 아니다. 도구/권한이 없거나 실제 검증을 하지 않았으면 BLOCKED/NOT TESTED이며 기존 원격 workflow를 대체 실행하지 않는다.

깨끗한 exact source에서 `deploy/docker/Dockerfile`·Buildx와 운영 architecture `linux/amd64`를 사용해 한 번 build한다. build/runtime의 Node major·ABI·distribution/libc·architecture 일치를 확인한다. 실제 commit/tree/lock·빌드 입력을 기록하고 revision/source/version label과 비교한다. label 자기신고만으로 source provenance PASS를 만들지 않는다. BuildKit SBOM/provenance의 실제 생성·보존 여부를 기록하고 미생성이나 유실을 숨기지 않는다.

`verify:prepr --mode=docker`는 고유한 격리 docker-container builder에서 한 번 build하여 SBOM/provenance를 포함한 OCI archive 하나를 출력한다. 검증한 runtime child의 config/layer를 offline에서 안전하게 Docker-load archive로 재포장하여 load·smoke한다. 이는 재빌드나 layer 의미 변경이 아니며 config ID와 비압축 diffID·순서를 대조해 같은 runtime임을 확인한다. version label은 실제 package version을 사용한다. classic Docker store의 runtime image가 OCI index/attestation까지 보존한다고 주장하지 않으며, 게시용 원본 attested OCI는 변경 없이 보존한다.

`report.dockerImage`는 local tag/image ID·source Head/content SHA·platform·실제 version과 OCI archive 경로/SHA256·index/manifest/config digest·SBOM/provenance·build metadata를 연결한다. admission은 source/환경과 함께 archive bytes·OCI layer 도달성·index/manifest/config 관계와 재포장한 runtime의 config ID·비압축 diffID/순서 및 local image identity 일치를 다시 확인한다. Gate는 registry write를 하지 않는다.

Owner가 승인한 `ghcr.io/planner77/mastergantt:sha-<full40SHA>` 같은 고유 태그만 사용한다. registry에서 기존 tag collision을 먼저 검사하고 존재하면 중단한다. 기존 immutable SemVer/Git tag를 덮거나 재발행하지 않는다. 새 exact version이나 rolling alias는 별도 Owner 선택·검증 범위를 기록해야 한다.

수동 게시에서는 검증한 동일 OCI archive를 검증된 ORAS 도구로 고유 태그에 복사한다. 재빌드나 classic store image의 별도 Push로 attestation을 잃지 않도록 archive checksum과 registry index digest를 대조한다. source·archive·image identity가 바뀌면 게시하지 않고 재검증한다.

인증은 로컬 Docker credential store와 최소 package read/write 권한을 사용한다. token/secret을 Git·Issue·명령 출력·image layer·build argument에 남기지 않는다. 과거 CI/PR 메타데이터를 게시 허가 증거로 오인하지 않는다.

### 로컬 게시 CLI

`node scripts/publish-local-image.mjs --help`로 실제 옵션을 확인한다. 모든 인수는 `--이름=값`이며 아래 모드를 구분한다.

| 모드 | 실제 경계 | 결과 해석 |
| --- | --- | --- |
| `plan`(기본) | 계획만 작성; 외부 검증·registry 쓰기·runtime 없음 | NOT TESTED이며 게시 허가/실행 성공이 아님 |
| `verify` | 같은 source의 실제 admission, ORAS/인증·원격 Head/태그 충돌 사전검증 | 사전검증 PASS여도 이미지 게시·runtime PASS가 아님 |
| `publish` | 동일 attested OCI 복사·registry graph/digest 대조·새 exact Pull/runtime/API/SQLite | 해당 source·실행의 전체 결과로 판정 |

공통 Gate와 publisher는 **동일한 controlled launcher/실제 환경**에서 이어 실행한다. 예를 들어 Gate를 npm에서 실행한 뒤 publisher만 다른 Node/PATH/npm_lifecycle 환경으로 바꾸고 지문 검사를 우회하지 않는다. 필요 시 Gate도 `node scripts/verify-prepr.mjs`로 직접 실행한다. `--base`는 고정 baseline, `--issue`는 통합 Primary, `--reports`/`--include`는 같은 검증 범위로 반복 지정한다. ORAS는 검증한 1.3.6 binary의 절대 경로, auth file은 Git 밖의 소유자 전용 0600 config다. repository는 `ghcr.io/planner77/mastergantt`, 태그는 clean HEAD에서 만든 고유 `sha-<full SHA>`만 허용한다.

```sh
node scripts/publish-local-image.mjs \
  --mode=publish --base="$MG_BASE_SHA" --issue=912 \
  --reports=.prepr-reports/fast/report.json \
  --reports=.prepr-reports/targeted/report.json \
  --reports=.prepr-reports/docker/report.json \
  --oras="$MG_VERIFIED_ORAS" --auth-file="$MG_PRIVATE_AUTH_FILE" \
  --private-log-dir="$MG_NEW_PRIVATE_LOG_DIR" \
  --report-dir=.prepr-reports/publish-attempt
```

예시의 경로는 실제 생성한 해당 source의 보고서로 바꾸고 게시 승인·정상 main Head를 먼저 확인한다. `plan`/`verify`에도 `--private-log-dir`가 필요하며 help만 예외다. private log root는 **저장소 밖 새 소유자 0700 디렉터리**로 생성하고, 기존 디렉터리나 symlink를 재사용하지 않는다. stdout/stderr 원문은 실행별 AES-256-GCM 파일과 metadata(0600)로 보존하며 별도 `keys/evidence.key`(0600)가 복원에 필요하다. 이 key는 DB backup key와 다르며 Git/이미지/공개 receipt에 넣지 않는다. 공개 가능한 결과에는 opaque attempt/stream ID·hash·bytes/truncated·단계/category/exit/시각만 남긴다. `truncated`가 있으면 수집 한계를 명시하고 원문 전체를 확보했다고 주장하지 않는다.

태그 부재는 임의 서버 오류 문자열이나 literal `404`/`MANIFEST_UNKNOWN`에만 의존하지 않는다. 고정한 ORAS 도구에서 같은 인증·repository의 tag inventory와 정확한 대상/대조 ref 조회를 함께 검증하며 권한·네트워크 오류를 부재로 오인하지 않는다. 해당 도구 경계의 read-only 진단은 2026-11-11T10:24:55.432Z~10:24:58.344Z PASS였고 registry 쓰기는 없었다. 이는 새 candidate의 전체 publish PASS가 아니다.

`publish-receipt.json`은 ignored 보고 경로의 0600 파일이다. 실제 digest/graph/runtime 불일치는 FAIL, 권한·오프라인·출처 부족은 BLOCKED이며 `publicationEligibility=BLOCKED`이면 게시/종료 후속을 중단한다. OCI 복사 뒤 실패하면 `published=true`/`tagState=CREATED` 또는 결과 불명 `UNKNOWN`을 보존하고 검증 완료로 오인하지 않는다. 전체 성공의 `VERIFIED`와 구분하며 태그 삭제·덮어쓰기·무조건 재시도로 원본 실패를 숨기지 않는다.

CLI는 운영 배포·SemVer/rolling/latest 갱신·기존 tag/image 삭제를 하지 않는다. 정상·직전 정상 rollback digest와 호환 backup ID를 보존·원장에 연결하고 이전 digest로의 격리 복귀를 별도 검증한다. 해당 image/backup을 cleanup 후보로 처리하지 않는다.

## 3. 실제 digest Pull·Smoke

Push 결과와 registry 실제 manifest digest를 비교한 후 **exact digest로 새로 Pull**한다. 태그 Pull만으로 GHCR 검증 PASS가 아니다. source revision·architecture·entrypoint·non-root·이미지 정책을 확인하고 운영과 분리한 합성 DB/새 volume에서 아래를 실행한다.

1. runtime 설정 누락/잘못된 URL의 fail-closed와 정상 readiness.
2. native SQLite load/write, migration ledger·foreign key와 실제 Project/Task HTTP read/write·session/Origin/revision 거부.
3. container restart 뒤 같은 Project/Task·DB persistence와 readiness.
4. 빌드 입력/source SHA·Push/Pull digest·smoke 명령/exit·DB schema·Issue와 backup ID(해당 시)를 원장에 연결.

GHCR 권한 부족·오프라인·tag collision·source/digest drift·Smoke FAIL은 Publish 또는 운영 반영을 차단한다. 실패 원본을 보존하고 수정 뒤 같은 새 source로 재검증한다. 정상·직전 정상 rollback digest를 cleanup에서 제외하며, 검증 image를 자동 Finalizer로 지우지 않는다.

## 4. 버전·배포·복구

`package.json.version`이 application version의 원본이며 lockfile과 일치시킨다. 제품 변화가 없는 문서/로컬 도구 정리에서 유지하는 경우 이유를 기록한다. SemVer tag를 새로 발행할 때는 Owner의 exact version·SHA 승인을 별도 기록한다. 사용 중인 immutable tag는 재사용하지 않는다.

운영 배포는 [DEPLOYMENT](DEPLOYMENT.md)의 image-only Compose·기존 project/volume·canonical URL·session·health 계약을 유지한다. 게시 성공과 DEPLOYED_VERIFIED는 다르다. 데이터 위험 배포에는 #912의 일관 백업·새 volume 복원·호환 image 검증이 선행한다. 구 이미지 교체만으로 forward-only DB migration은 취소되지 않는다.

Owner가 통합 승인한 #906 정책·#907 원장/validator·#908 local source gate는 같은 source의 검증·실패 원장에 연결하되 AC별 완료 증거를 구분한다. #909 게시, #911 관리자 전환, #912 복원도 각각 실제 완료 증거가 필요하다. 미완료 선행 이슈를 새 문서나 과거 이미지 성공으로 PASS 처리하지 않는다.
