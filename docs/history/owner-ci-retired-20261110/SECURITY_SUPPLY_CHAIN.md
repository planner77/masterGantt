# SECURITY 공급망 정책 보존 원문

비규범적 이력: baseline `4aad8865972e3446f0d34c7ffcfd2bbab439e366`의 `docs/SECURITY.md` 공급망 절 전문이다. 현재 로컬 운영에는 [현행 SECURITY](../../SECURITY.md)와 [Issue Lifecycle](../../ISSUE_LIFECYCLE.md)을 적용한다. 과거 승인·실패·이미지 기록을 새 source의 PASS로 사용하지 않는다.

원본 파일 SHA256: `54739b6106ec848bff62d3f867bb4d196abf361a2c36780cc54de9713b68683f`. 원본 공급망 절 SHA256: `7e8908a59e3623aeaf4fe642b20881c9802e83d4e4e64de97b98812bd3479d59`. 상대 링크는 보존 위치에 맞게 변환했다.

### CI/CD와 image supply chain

- Pull Request Actions는 `contents: read`만 사용하고 registry login, package write, personal token을 제공하지 않는다. `pull_request_target`에서 PR code를 실행하지 않는다.
- PR과 수동 CI는 `contents: read`만 사용한다. 모든 upstream gate를 통과한 `main` commit publish와 SemVer release publish job만 job-scoped `GITHUB_TOKEN`과 최소 `packages: write`를 사용한다.
- 외부 Action은 reviewed full commit SHA, Node base image는 reviewed digest로 고정한다. Dependabot update도 permissions·release notes·runtime smoke를 검토한 뒤 merge한다.
- `.env*`, SQLite/WAL/SHM, backup, log, test artifact, `.git`은 Docker build context와 image layer에서 제외한다.
- Password, token, Cookie, 환경값을 build arg, OCI label, cache key, artifact, workflow summary에 전달하지 않는다.
- Main commit 검증용 `ci-<full SHA>`는 exact digest smoke 직후 package version을 삭제한다. Semantic release는 GHCR `sha-*` candidate를 만들지 않고 exact/rolling SemVer tag만 보관한다. Test/deployment는 mutable `latest`가 아닌 workflow가 검증한 exact digest 또는 exact SemVer를 사용한다.
- Release는 repository 단위로 직렬화하고 이전 tag보다 큰 annotated SemVer만 허용한다. Local candidate를 먼저 검증한 뒤 GHCR exact SemVer를 직접 게시하고 그 build output digest의 runtime smoke와, 활성화된 경우 GitHub Attestation이 성공해야 stable rolling alias를 같은 digest로 승격한다. Release commit 고정 `sha-*` image는 보관하지 않는다.
- Production runtime configuration은 migration 전에 canonical URL/path를 검사하고 readiness도 DB open 전 fail closed한다.
- Commit과 release가 publish한 GHCR digest를 각각 새로 pull하여 image policy, readiness와 Project/Task authorization 저장·restart persistence를 검증하며 BuildKit SBOM/provenance를 생성한다. 세부 계약은 [CI_CD.md](../../CI_CD.md)를 따른다.
- Private repository의 GitHub Artifact Attestation은 Enterprise Cloud에서만 지원된다. `ENABLE_GITHUB_ATTESTATIONS=true`가 명시된 지원 환경에서만 GitHub Attestation step을 실행하며, 그 외에는 BuildKit SBOM/provenance를 필수 증거로 유지하고 attestation 성공을 주장하지 않는다. 현재 optional step이 publish job 안에 있어 attestation/OIDC job 권한은 flag가 꺼진 run에도 선언되는 잔여 범위가 있으며, 엄격한 조건부 권한이 필요하면 별도 gated job으로 분리한다.
- 과거 도구 출력에 노출된 repository credential은 교체가 권고된다. 사용자는 2026-09-12 기존 값 재사용의 잔여 위험을 명시적으로 수용했으며, 이는 안전 판정이나 일반적인 secret rotation 원칙의 완화가 아니다. Credential 평문을 사람이나 모델이 화면에서 열람하거나 출력·문서화·복사하지 않는다. 사용자가 승인한 helper가 값을 process memory로 불러와 HTTPS API 인증에 사용하는 것은 허용하되 값·Authorization header·파생 secret을 stdout/stderr, shell history, artifact 또는 workflow input에 남기지 않는다.

<!-- 원본 보존 본문 끝: 위 원문은 변경하지 않았습니다. -->
