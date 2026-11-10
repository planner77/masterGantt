# 로컬 Build·GHCR 게시 계약

Owner 2026-11-10 결정으로 모든 위험도에 [단일 Issue Lifecycle](ISSUE_LIFECYCLE.md)을 적용한다. 이름이 CI_CD인 이 문서는 현재 **로컬** 검증·수동 GHCR 게시를 규정한다. PR·GitHub Actions·원격 CI·Trusted QA·자동 Finalizer를 실행하지 않는다. 과거 운영 전문은 [보존 구역](history/owner-ci-retired-20261110/CI_CD.md)에 있다.

## 1. 검증과 게시의 선행조건

- [LOCAL_PREPR](LOCAL_PREPR.md)의 공통/영향/위험별 실제 로컬 PASS·같은 clean source admission과 DOCUMENTATION_SYNC, Owner 승인 범위를 확인한다. 검사 FAIL/BLOCKED/NOT TESTED·취소·unknown·source/fixture/환경 drift는 Push·Publish·Close를 차단한다.
- 첫 main Push 이전 #911 live Ruleset/Actions 전환을 실제로 확인한다. 문서 변경이나 `[skip ci]`는 전환 근거가 아니다.
- 최신 main exact commit/tree·lock·Node·Docker/platform·배포 입력을 고정한다. Push 뒤 같은 SHA인지 재조회한다. dirty checkout이나 검증 뒤 변경된 source는 게시하지 않는다.
- 게시 요청과 운영 배포 요청을 분리한다. 고유 SHA 이미지 게시 승인이 SemVer/rolling tag 변경 승인 또는 운영 배포 승인은 아니다. docs-only는 이미지 N/A(reason)를 기록한다.

## 2. Build-once와 고유 태그

#906/#907/#908 통합 범위의 로컬 Docker Gate는 기존 Docker/OCI 검산을 재사용해 검증 image·attested OCI 인계의 최소 경계를 구현한다. #909의 전체 수동 게시·보존 운영 범위는 별도 AC로 유지한다. 도구/권한이 없거나 실제 검증을 하지 않았으면 BLOCKED/NOT TESTED이며 기존 원격 workflow를 대체 실행하지 않는다.

깨끗한 exact source에서 `deploy/docker/Dockerfile`·Buildx와 운영 architecture `linux/amd64`를 사용해 한 번 build한다. build/runtime의 Node major·ABI·distribution/libc·architecture 일치를 확인한다. 실제 commit/tree/lock·빌드 입력을 기록하고 revision/source/version label과 비교한다. label 자기신고만으로 source provenance PASS를 만들지 않는다. BuildKit SBOM/provenance의 실제 생성·보존 여부를 기록하고 미생성이나 유실을 숨기지 않는다.

`verify:prepr --mode=docker`는 고유한 격리 docker-container builder에서 한 번 build하여 SBOM/provenance를 포함한 OCI archive 하나를 출력한다. 검증한 runtime child의 config/layer를 offline에서 안전하게 Docker-load archive로 재포장하여 load·smoke한다. 이는 재빌드나 layer 의미 변경이 아니며 config ID와 비압축 diffID·순서를 대조해 같은 runtime임을 확인한다. version label은 실제 package version을 사용한다. classic Docker store의 runtime image가 OCI index/attestation까지 보존한다고 주장하지 않으며, 게시용 원본 attested OCI는 변경 없이 보존한다.

`report.dockerImage`는 local tag/image ID·source Head/content SHA·platform·실제 version과 OCI archive 경로/SHA256·index/manifest/config digest·SBOM/provenance·build metadata를 연결한다. admission은 source/환경과 함께 archive bytes·OCI layer 도달성·index/manifest/config 관계와 재포장한 runtime의 config ID·비압축 diffID/순서 및 local image identity 일치를 다시 확인한다. Gate는 registry write를 하지 않는다.

Owner가 승인한 `ghcr.io/planner77/mastergantt:sha-<full40SHA>` 같은 고유 태그만 사용한다. registry에서 기존 tag collision을 먼저 검사하고 존재하면 중단한다. 기존 immutable SemVer/Git tag를 덮거나 재발행하지 않는다. 새 exact version이나 rolling alias는 별도 Owner 선택·검증 범위를 기록해야 한다.

수동 게시에서는 검증한 동일 OCI archive를 검증된 ORAS 도구로 고유 태그에 복사한다. 재빌드나 classic store image의 별도 Push로 attestation을 잃지 않도록 archive checksum과 registry index digest를 대조한다. source·archive·image identity가 바뀌면 게시하지 않고 재검증한다.

인증은 로컬 Docker credential store와 최소 package read/write 권한을 사용한다. token/secret을 Git·Issue·명령 출력·image layer·build argument에 남기지 않는다. 과거 CI/PR 메타데이터를 게시 허가 증거로 오인하지 않는다.

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
