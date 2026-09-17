from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text(encoding="utf-8")
    if old not in text:
        raise SystemExit(f"anchor not found: {path}: {old[:120]!r}")
    file.write_text(text.replace(old, new, 1), encoding="utf-8")


# 이번 변경에서 새로 작성하거나 의미가 바뀐 workflow 표시 이름은 저장소 정책에 맞춰 한글화한다.
for path, replacements in {
    ".github/workflows/ci.yml": [
        ("name: Publish, verify, and clean up temporary main commit image", "name: Main 임시 commit 이미지 게시·검증·정리"),
        ("- name: Calculate temporary GHCR reference", "- name: 임시 GHCR 참조 계산"),
        ("- name: Refuse to overwrite an existing temporary commit image", "- name: 기존 임시 commit 이미지 덮어쓰기 거부"),
        ("- name: Build and push temporary commit image", "- name: 임시 commit 이미지 빌드·게시"),
        ("- name: Report verified temporary digest", "- name: 임시 이미지 검증 결과 기록"),
        ("- name: Delete temporary main commit image from GHCR", "- name: GHCR 임시 main commit 이미지 삭제"),
    ],
    ".github/workflows/release-image.yml": [
        ("- name: Refuse to overwrite an existing exact release image", "- name: 기존 exact release 이미지 덮어쓰기 거부"),
        ("- name: Delete failed exact release image", "- name: 실패한 exact release 이미지 정리"),
    ],
}.items():
    for old, new in replacements:
        replace_once(path, old, new)

# CI/CD 검증 기준을 새 retention/publish 계약에 맞춘다.
replacements = {
    "| CI07 | Repository 단위 release 직렬화; stable만 latest/major/minor 갱신, prerelease는 exact/commit만 생성; OCI source/revision/version, SBOM/provenance 존재 |":
        "| CI07 | Repository 단위 release 직렬화; stable만 latest/major/minor 갱신, prerelease는 exact SemVer만 보관; OCI source/revision/version, SBOM/provenance 존재 |",
    "| CI08 | Pre-publish local candidate가 production config/migration/readiness/native SQLite/restart를 통과; GHCR에는 commit candidate만 먼저 push하고 digest smoke 및 활성화한 GitHub Attestation 뒤 rolling/exact 승격; exact version/digest를 downstream test에 제공 |":
        "| CI08 | Pre-publish local candidate가 production config/migration/readiness/native SQLite/restart를 통과; PASS 후 GHCR exact SemVer를 직접 push하고 그 build output digest를 재-pull하여 smoke 및 활성화한 GitHub Attestation을 수행한 뒤 stable rolling alias만 승격; exact version/digest를 downstream test에 제공 |",
    "| CI09 | PR·수동 CI는 registry write가 없고 성공한 `main` push만 모든 quality/E2E/container job 뒤 immutable `ci-<full SHA>`를 게시; 기존 tag overwrite와 SemVer/rolling alias 생성을 거부 |":
        "| CI09 | PR·수동 CI는 registry write가 없고 성공한 `main` push만 모든 quality/E2E/container job 뒤 임시 `ci-<full SHA>`를 게시; exact digest 검증 뒤 package version을 삭제하며 기존 tag overwrite와 SemVer/rolling alias 생성을 거부 |",
    "| CI10 | Main commit과 SemVer release image를 각각 build output digest로 새로 pull해 image policy, migration/readiness, Project 생성·edit session·Task 저장, unauthorized write 거부, restart 후 Project/Task 재조회를 검증; BuildKit SBOM/provenance와 optional GitHub Attestation 결과를 구분 |":
        "| CI10 | Main 임시 commit image와 SemVer exact release image를 각각 build output digest로 새로 pull해 image policy, migration/readiness, Project 생성·edit session·Task 저장, unauthorized write 거부, restart 후 Project/Task 재조회를 검증; main 임시 package 삭제까지 확인하고 BuildKit SBOM/provenance와 optional GitHub Attestation 결과를 구분 |",
}
for old, new in replacements.items():
    replace_once("docs/TEST_PLAN.md", old, new)

replace_once(
    "docs/DEPLOYMENT.md",
    "tag push는 [release image workflow](../.github/workflows/release-image.yml)를 실행한다. workflow는 이전 tag보다 큰 version과 annotated tag를 확인하고 전체 quality gate 및 동일 release 설정의 local candidate runtime smoke를 통과한 뒤에만 ephemeral `GITHUB_TOKEN`으로 lowercase GHCR의 immutable `sha-<full-commit>` candidate를 push한다. Registry digest smoke와, 활성화된 경우 GitHub Attestation이 성공한 뒤 stable release의 `major.minor`, `major`, `latest`를 이동하고 exact version을 마지막 완료 표식으로 생성한다. Prerelease는 exact/commit tag만 받는다. Repository 단위 직렬화와 monotonic gate가 낮은 version의 alias rollback을 막으며 기존 exact/commit image는 overwrite하지 않는다. tag workflow의 권한은 `contents: read`, `packages: write`, optional attestation/OIDC에 필요한 `attestations: write` 및 `id-token: write`로 한정된다. Release run은 취소하지 않는다.",
    "tag push는 [release image workflow](../.github/workflows/release-image.yml)를 실행한다. workflow는 이전 tag보다 큰 version과 annotated tag를 확인하고 전체 quality gate 및 동일 release 설정의 local candidate runtime smoke를 통과한 뒤에만 ephemeral `GITHUB_TOKEN`으로 lowercase GHCR exact SemVer image를 직접 게시한다. 게시된 build output digest를 registry에서 다시 pull하여 runtime smoke와, 활성화된 경우 GitHub Attestation을 통과한 뒤 stable release의 `major.minor`, `major`, `latest`만 같은 검증 digest로 이동한다. Prerelease는 exact SemVer tag만 보관한다. Release용 `sha-<full-commit>` GHCR candidate는 만들지 않는다. Repository 단위 직렬화와 monotonic gate가 낮은 version의 alias rollback을 막으며 기존 exact image는 overwrite하지 않는다. tag workflow의 권한은 `contents: read`, `packages: write`, optional attestation/OIDC에 필요한 `attestations: write` 및 `id-token: write`로 한정된다. Release run은 취소하지 않는다."
)

replace_once(
    "docs/SECURITY.md",
    "- Release는 repository 단위로 직렬화하고 이전 tag보다 큰 annotated SemVer만 허용한다. Local candidate를 먼저 검증하고 GHCR에는 immutable commit candidate만 쓴 뒤 digest runtime smoke와, 활성화된 경우 GitHub Attestation이 성공해야 rolling alias와 exact version을 승격한다.",
    "- Release는 repository 단위로 직렬화하고 이전 tag보다 큰 annotated SemVer만 허용한다. Local candidate를 먼저 검증한 뒤 GHCR exact SemVer를 직접 게시하고 그 build output digest의 runtime smoke와, 활성화된 경우 GitHub Attestation이 성공해야 stable rolling alias를 같은 digest로 승격한다. Release commit 고정 `sha-*` image는 보관하지 않는다."
)

replace_once(
    "docs/ARCHITECTURE.md",
    "초기 운영은 한 Node application container와 local persistent SQLite volume이다. Native addon은 빌드·런타임 ABI/libc/architecture를 일치시키고 non-root permission과 restart persistence를 검사한다. PR과 수동 CI는 read-only로 application/browser/container 회귀만 수행한다. 모든 gate를 통과한 `main` push는 immutable `ci-<full SHA>` test image를 별도 tag 공간에 게시한다. Release는 `package.json`과 일치하며 이전 tag보다 큰 annotated Semantic Version만 직렬 처리하고, 별도 `sha-<full SHA>` candidate와 GHCR digest가 통과한 뒤 exact version을 완료 표식으로 승격한다. 두 publish 경로 모두 registry에서 exact digest를 새로 pull해 Project/Task HTTP authorization 저장과 restart persistence까지 확인한다. Consumer와 post-publish smoke는 mutable alias가 아니라 exact version/digest를 사용한다. WAL-aware backup과 production host restore는 별도 경로에서 시험한다. [CI_CD.md](CI_CD.md), [DEPLOYMENT.md](DEPLOYMENT.md) 참조.",
    "초기 운영은 한 Node application container와 local persistent SQLite volume이다. Native addon은 빌드·런타임 ABI/libc/architecture를 일치시키고 non-root permission과 restart persistence를 검사한다. PR과 수동 CI는 read-only로 application/browser/container 회귀만 수행한다. 모든 gate를 통과한 `main` push는 임시 `ci-<full SHA>` image를 게시해 registry exact digest runtime을 검증한 뒤 해당 package version을 삭제한다. Release는 `package.json`과 일치하며 이전 tag보다 큰 annotated Semantic Version만 직렬 처리하고, local candidate 검증 후 GHCR exact SemVer를 직접 게시·재검증한 뒤 stable rolling alias만 같은 digest로 승격한다. Release commit 고정 `sha-*` candidate는 보관하지 않는다. Consumer와 post-publish smoke는 mutable alias가 아니라 exact version/digest를 사용한다. WAL-aware backup과 production host restore는 별도 경로에서 시험한다. [CI_CD.md](CI_CD.md), [DEPLOYMENT.md](DEPLOYMENT.md) 참조."
)
