from pathlib import Path


def read(path: str) -> str:
    return Path(path).read_text(encoding="utf-8")


def write(path: str, text: str) -> None:
    Path(path).write_text(text, encoding="utf-8")


def replace_once(path: str, old: str, new: str) -> None:
    text = read(path)
    if old not in text:
        raise SystemExit(f"anchor not found in {path}: {old[:140]!r}")
    write(path, text.replace(old, new, 1))


cleanup_script = '''const [tag] = process.argv.slice(2);

if (!tag || process.argv.length !== 3) {
  throw new Error("Usage: node scripts/delete-ghcr-package-version-by-tag.mjs <tag>");
}

const token = process.env.GITHUB_TOKEN;
const repository = process.env.GITHUB_REPOSITORY;
const owner = process.env.GITHUB_REPOSITORY_OWNER ?? repository?.split("/")[0];
const repositoryName = repository?.split("/")[1];
const ownerType = (process.env.GHCR_OWNER_TYPE ?? "User").toLowerCase();
const packageName = (process.env.GHCR_PACKAGE_NAME ?? repositoryName ?? "").toLowerCase();
const apiUrl = process.env.GITHUB_API_URL ?? "https://api.github.com";

if (!token || !repository || !owner || !packageName) {
  throw new Error("GITHUB_TOKEN, GITHUB_REPOSITORY, repository owner, and package name are required.");
}

const scope = ownerType === "organization"
  ? `orgs/${encodeURIComponent(owner)}`
  : `users/${encodeURIComponent(owner)}`;
const packagePath = `${scope}/packages/container/${encodeURIComponent(packageName)}`;
const headers = {
  Accept: "application/vnd.github+json",
  Authorization: `Bearer ${token}`,
  "X-GitHub-Api-Version": "2026-03-10",
};

async function request(path, options = {}) {
  const response = await fetch(`${apiUrl}/${path}`, {
    ...options,
    headers: { ...headers, ...options.headers },
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`${options.method ?? "GET"} ${path} failed: ${response.status} ${body}`);
  }
  if (response.status === 204) return undefined;
  return response.json();
}

async function listVersions() {
  const versions = [];
  for (let page = 1; page <= 100; page += 1) {
    const batch = await request(`${packagePath}/versions?per_page=100&page=${page}`);
    if (!Array.isArray(batch)) {
      throw new Error("GitHub Packages API returned a non-array version list.");
    }
    versions.push(...batch);
    if (batch.length < 100) break;
  }
  return versions;
}

function matchesTag(version) {
  return version?.metadata?.container?.tags?.includes(tag) ?? false;
}

const matches = (await listVersions()).filter(matchesTag);
if (matches.length === 0) {
  console.log(`GHCR tag ${tag} is already absent; nothing to delete.`);
  process.exit(0);
}
if (matches.length !== 1) {
  throw new Error(`Expected one GHCR package version for ${tag}, found ${matches.length}.`);
}

const version = matches[0];
const tags = version?.metadata?.container?.tags ?? [];
const otherTags = tags.filter((candidate) => candidate !== tag);
if (otherTags.length > 0) {
  throw new Error(
    `Refusing to delete GHCR package version ${version.id}: ${tag} shares the version with ${otherTags.join(", ")}.`,
  );
}

await request(`${packagePath}/versions/${version.id}`, { method: "DELETE" });

for (let attempt = 1; attempt <= 10; attempt += 1) {
  if (!(await listVersions()).some(matchesTag)) {
    console.log(`Deleted temporary GHCR package version for tag ${tag}.`);
    process.exit(0);
  }
  await new Promise((resolve) => setTimeout(resolve, 1500));
}

throw new Error(`GHCR tag ${tag} is still visible after deleting package version ${version.id}.`);
'''
Path("scripts/delete-ghcr-package-version-by-tag.mjs").write_text(cleanup_script, encoding="utf-8")

# CI: registry publish/pull smoke는 유지하되 commit image는 검증 직후 삭제한다.
replace_once(
    ".github/workflows/ci.yml",
    "  # Each main SHA has its own immutable image. PRs share a group so an obsolete\n  # head can be cancelled, while no main publish is displaced while pending.\n",
    "  # PRs share a group so obsolete heads can be cancelled. Main runs keep a SHA-specific\n  # group while their temporary registry publish/pull/cleanup sequence is in progress.\n",
)
replace_once(
    ".github/workflows/ci.yml",
    "    # PR and manual runs stay read-only. A successful push to main is the sole\n    # event that may publish a commit image for user/integration testing.\n    name: Publish and verify immutable main commit image\n",
    "    # PR and manual runs stay read-only. A successful push to main may publish a\n    # temporary commit image only long enough to verify registry pull/runtime behavior.\n    name: Publish, verify, and clean up temporary main commit image\n",
)
replace_once(
    ".github/workflows/ci.yml",
    "      packages: write\n      attestations: write\n      id-token: write\n",
    "      packages: write\n",
)
replace_once(
    ".github/workflows/ci.yml",
    "      - name: Calculate lowercase immutable GHCR reference\n",
    "      - name: Calculate temporary GHCR reference\n",
)
replace_once(
    ".github/workflows/ci.yml",
    "      - name: Refuse to overwrite an existing commit image\n",
    "      - name: Refuse to overwrite an existing temporary commit image\n",
)
replace_once(
    ".github/workflows/ci.yml",
    "Refusing to overwrite immutable commit image:",
    "Refusing to overwrite temporary commit image:",
)
replace_once(
    ".github/workflows/ci.yml",
    "      - name: Build and push immutable commit image\n",
    "      - name: Build and push temporary commit image\n",
)
replace_once(
    ".github/workflows/ci.yml",
    '''      - name: Attest the verified commit image digest
        id: attest
        # Private repositories below Enterprise Cloud leave this variable unset.
        # BuildKit SBOM/provenance above remains mandatory in every publish.
        if: vars.ENABLE_GITHUB_ATTESTATIONS == 'true'
        # actions/attest v4.2.2
        uses: actions/attest@1e69f48acb82d1966a394da916b4c1698aa569d6
        with:
          subject-name: ${{ steps.image.outputs.name }}
          subject-digest: ${{ steps.push.outputs.digest }}
          push-to-registry: true
''',
    "",
)
replace_once(
    ".github/workflows/ci.yml",
    "      - name: Report published digest\n",
    "      - name: Report verified temporary digest\n",
)
replace_once(
    ".github/workflows/ci.yml",
    "            echo \"## Published main commit image\"\n",
    "            echo \"## Verified temporary main commit image\"\n",
)
replace_once(
    ".github/workflows/ci.yml",
    "            echo \"- BuildKit SBOM/provenance: generated. GitHub attestation: ${{ steps.attest.outcome || 'disabled' }}.\"\n",
    "            echo \"- BuildKit SBOM/provenance: generated for registry verification.\"\n            echo \"- Retention: the temporary ci-<SHA> package version is deleted after verification.\"\n",
)
replace_once(
    ".github/workflows/ci.yml",
    '''      - name: Remove smoke-test container
        if: always()
        run: docker rm --force --volumes mastergantt-commit-smoke || true
''',
    '''      - name: Remove smoke-test container
        if: always()
        run: docker rm --force --volumes mastergantt-commit-smoke || true
      - name: Delete temporary main commit image from GHCR
        if: always() && steps.push.outcome == 'success'
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          GHCR_OWNER_TYPE: ${{ github.event.repository.owner.type }}
        run: |
          node scripts/delete-ghcr-package-version-by-tag.mjs "ci-${{ github.sha }}"
          echo "- GHCR cleanup: temporary ci-${{ github.sha }} package version deleted." >> "$GITHUB_STEP_SUMMARY"
''',
)

# Release: GHCR sha-* candidate를 만들지 않고 local candidate PASS 후 exact SemVer를 직접 게시한다.
replace_once(
    ".github/workflows/release-image.yml",
    "      candidate_image: ${{ steps.tags.outputs.candidate_image }}\n",
    "",
)
replace_once(
    ".github/workflows/release-image.yml",
    "            echo \"candidate_image=$image_name:sha-$GITHUB_SHA\"\n",
    "",
)
replace_once(
    ".github/workflows/release-image.yml",
    "            # Prereleases have only exact and immutable-SHA tags. Stable releases\n            # alone move major/minor/latest consumer convenience tags.\n",
    "            # Prereleases keep only the exact SemVer tag. Stable releases alone\n            # move major/minor/latest consumer convenience tags after digest verification.\n",
)
replace_once(
    ".github/workflows/release-image.yml",
    '''      - name: Refuse to overwrite an immutable exact or commit tag
        shell: bash
        env:
          EXACT_IMAGE: ${{ needs.prepare.outputs.exact_image }}
          CANDIDATE_IMAGE: ${{ needs.prepare.outputs.candidate_image }}
        run: |
          set -euo pipefail
          for immutable_image in "$EXACT_IMAGE" "$CANDIDATE_IMAGE"; do
            if docker manifest inspect "$immutable_image" >/dev/null 2>&1; then
              echo "Refusing to overwrite existing immutable release image: $immutable_image" >&2
              echo "Create a new SemVer version and commit for a replacement release." >&2
              exit 1
            fi
          done
''',
    '''      - name: Refuse to overwrite an existing exact release image
        shell: bash
        env:
          EXACT_IMAGE: ${{ needs.prepare.outputs.exact_image }}
        run: |
          set -euo pipefail
          if docker manifest inspect "$EXACT_IMAGE" >/dev/null 2>&1; then
            echo "Refusing to overwrite existing exact release image: $EXACT_IMAGE" >&2
            echo "Create a new SemVer version and commit for a replacement release." >&2
            exit 1
          fi
''',
)
replace_once(
    ".github/workflows/release-image.yml",
    '''          # The immutable commit tag is a candidate until digest smoke passes.
          # Exact/rolling release tags are promoted from that verified digest below.
          tags: ${{ needs.prepare.outputs.candidate_image }}
''',
    '''          # Local candidate smoke already passed. Publish the exact SemVer tag, then
          # verify its registry digest before moving any stable rolling aliases.
          tags: ${{ needs.prepare.outputs.exact_image }}
''',
)
replace_once(
    ".github/workflows/release-image.yml",
    '''      - name: Mark the verified digest with the immutable exact version
        env:
          VERIFIED_IMAGE: ${{ needs.prepare.outputs.image_name }}@${{ steps.push.outputs.digest }}
          EXACT_IMAGE: ${{ needs.prepare.outputs.exact_image }}
        run: docker buildx imagetools create --tag "$EXACT_IMAGE" "$VERIFIED_IMAGE"
''',
    "",
)
replace_once(
    ".github/workflows/release-image.yml",
    '''      - name: Remove smoke-test container
        if: always()
        run: docker rm --force --volumes mastergantt-release-smoke || true
''',
    '''      - name: Remove smoke-test container
        if: always()
        run: docker rm --force --volumes mastergantt-release-smoke || true
      - name: Delete failed exact release image
        if: always() && failure() && steps.push.outcome == 'success'
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          GHCR_OWNER_TYPE: ${{ github.event.repository.owner.type }}
        run: node scripts/delete-ghcr-package-version-by-tag.mjs "${{ needs.prepare.outputs.version }}"
''',
)

# Agent/검증 정책.
replace_once(
    "AGENTS.md",
    "→ GHCR immutable ci-<full SHA>\n→ exact digest pull smoke\n",
    "→ GHCR 임시 ci-<full SHA> 게시\n→ exact digest pull smoke\n→ 임시 ci-<full SHA> package version 삭제\n",
)
replace_once(
    "AGENTS.md",
    "`main` push에서는 동일 gate를 다시 통과한 뒤에만 immutable `ci-<full SHA>` image를 GHCR에 게시한다. 게시한 image는 exact digest로 다시 pull하여 policy, readiness, native SQLite, Project/Task API authorization/persistence, restart persistence를 검증하고 SBOM/provenance를 생성한다.\n",
    "`main` push에서는 동일 gate를 다시 통과한 뒤에만 임시 `ci-<full SHA>` image를 GHCR에 게시한다. 게시한 image는 exact digest로 다시 pull하여 policy, readiness, native SQLite, Project/Task API authorization/persistence, restart persistence를 검증하고 SBOM/provenance를 생성한 뒤 해당 GHCR package version을 삭제한다. `ci-*`는 운영·rollback artifact로 보관하지 않는다.\n",
)
replace_once(
    "AGENTS.md",
    "main immutable GHCR publish/exact digest smoke를 주 담당한다.",
    "main 임시 GHCR publish/exact digest smoke와 검증 후 package cleanup을 주 담당한다.",
)
replace_once(
    "AGENTS.md",
    "main CI gate PASS, immutable `ci-<full SHA>` publish, exact GHCR digest runtime smoke PASS, SBOM/provenance 확인",
    "main CI gate PASS, 임시 `ci-<full SHA>` publish, exact GHCR digest runtime smoke PASS, SBOM/provenance 확인과 임시 package version 삭제",
)

replace_once(
    "docs/REMOTE_VALIDATION.md",
    "| Main Artifact Validation | GitHub Actions + GHCR | PR 수준 gate + immutable `ci-<full SHA>` publish + exact digest pull + readiness/API/auth/restart persistence + SBOM/provenance | `main` commit container artifact 검증 |",
    "| Main Artifact Validation | GitHub Actions + GHCR | PR 수준 gate + 임시 `ci-<full SHA>` publish + exact digest pull + readiness/API/auth/restart persistence + SBOM/provenance + 검증 후 package version 삭제 | `main` commit registry 경로 검증 |",
)
replace_once(
    "docs/REMOTE_VALIDATION.md",
    "8. `main`의 완료 보고에는 대상 commit SHA, CI run 결과, GHCR `ci-<full SHA>`와 exact digest 검증 결과를 기록한다.",
    "8. `main`의 완료 보고에는 대상 commit SHA, CI run 결과, 임시 GHCR `ci-<full SHA>`와 exact digest 검증 결과, package version 삭제 결과를 기록한다.",
)
replace_once(
    "docs/REMOTE_VALIDATION.md",
    "- immutable `ci-<full SHA>` image를 GHCR에 게시\n- 기존 동일 commit tag overwrite 거부\n",
    "- 임시 `ci-<full SHA>` image를 GHCR에 게시\n- 기존 동일 commit tag overwrite 거부\n",
)
replace_once(
    "docs/REMOTE_VALIDATION.md",
    "- Project/Task API persistence 및 authorization denial 검증\n",
    "- Project/Task API persistence 및 authorization denial 검증\n- 검증 완료 후 `ci-<full SHA>` package version 삭제\n",
)

replace_once(
    "docs/REQUIREMENTS.md",
    "| R30 | 모든 품질 gate를 통과한 `main` commit은 immutable GHCR `ci-<full SHA>` test image로 게시하고, SemVer release의 `sha-<full SHA>`/exact/rolling tag와 분리; 두 경로 모두 게시 digest를 새로 pull해 image policy, readiness, Project/Task authorization 저장과 restart persistence를 검증 | [CI/CD](CI_CD.md), [Deployment](DEPLOYMENT.md), [Test Plan](TEST_PLAN.md) CI09–CI10 |",
    "| R30 | 모든 품질 gate를 통과한 `main` commit은 임시 GHCR `ci-<full SHA>` image를 게시해 exact digest로 image policy, readiness, Project/Task authorization 저장과 restart persistence를 검증한 뒤 package version을 삭제한다. Semantic release는 registry `sha-*` candidate를 만들지 않고 local candidate PASS 후 exact SemVer를 직접 게시·검증하며 stable release만 exact/rolling tag로 보관한다. | [CI/CD](CI_CD.md), [Deployment](DEPLOYMENT.md), [Test Plan](TEST_PLAN.md) CI09–CI10 |",
)

replace_once(
    "docs/GITHUB_OPERATIONS.md",
    "기존 불변식을 유지한다. PR/수동 CI는 readonly, 품질 gate를 통과한 main push는 immutable `ci-<full SHA>`, annotated SemVer release는 별도 `sha-<full SHA>` candidate와 exact version을 사용한다. Publish job만 최소 권한의 `GITHUB_TOKEN`을 쓰며 개인 PAT를 workflow에 추가하지 않는다. Local candidate 검사, registry digest 재다운로드 smoke, SBOM/provenance와 활성화된 attestation 검증을 구분한다. Release 직렬화, monotonic version, exact/commit overwrite 금지와 exact version 최종 생성 순서는 [CI_CD.md](CI_CD.md)를 따른다.\n",
    "기존 불변식을 유지한다. PR/수동 CI는 readonly다. 품질 gate를 통과한 main push의 `ci-<full SHA>`는 registry publish/pull smoke를 위한 임시 tag이며 검증이 끝나면 package version을 삭제한다. Annotated SemVer release는 GHCR `sha-*` candidate를 만들지 않고 local candidate PASS 후 exact version을 직접 게시·검증하며 stable release만 exact/rolling tag를 보관한다. Publish/cleanup job만 최소 권한의 `GITHUB_TOKEN`을 쓰며 개인 PAT를 workflow에 추가하지 않는다. Local candidate 검사, registry digest 재다운로드 smoke, SBOM/provenance와 활성화된 attestation 검증을 구분한다. Release 직렬화, monotonic version과 exact overwrite 금지는 [CI_CD.md](CI_CD.md)를 따른다.\n",
)
replace_once(
    "docs/GITHUB_OPERATIONS.md",
    "정상 승인 workflow가 수행하는 기존 main 이미지 자동 게시 정책은 그대로 유지한다.",
    "정상 승인 workflow의 main 임시 이미지 publish/pull/cleanup 및 SemVer release 정책은 그대로 유지한다.",
)

# CI/CD source of truth.
replace_once(
    "docs/CI_CD.md",
    "- Main commit image: 위 gate를 모두 통과한 `main` push만 immutable `ci-<full SHA>`를 GHCR에 게시하고 exact digest를 pull하여 HTTP Project/Task authorization·저장·재시작 persistence 검증\n",
    "- Main commit registry smoke: 위 gate를 모두 통과한 `main` push만 임시 `ci-<full SHA>`를 GHCR에 게시하고 exact digest를 pull하여 HTTP Project/Task authorization·저장·재시작 persistence를 검증한 뒤 package version 삭제\n",
)
replace_once(
    "docs/CI_CD.md",
    "성공한 `main` push의 사용자·통합 테스트 image는 다음 immutable tag 하나만 게시한다.\n",
    "성공한 `main` push의 registry 검증 image는 다음 임시 tag 하나를 게시한다.\n",
)
replace_once(
    "docs/CI_CD.md",
    "같은 tag가 이미 존재하면 덮어쓰지 않고 실패한다. Commit workflow는 SemVer exact/major/minor/latest 또는 release candidate `sha-<commit>` tag를 만들지 않는다. PR과 수동 `workflow_dispatch`는 검증만 수행하고 registry에 로그인하거나 쓰지 않는다.\n",
    "같은 tag가 이미 존재하면 덮어쓰지 않고 실패한다. Exact digest pull/runtime 검증이 끝나면 해당 `ci-<commit>` package version을 삭제한다. Commit workflow는 SemVer exact/major/minor/latest tag를 만들지 않는다. PR과 수동 `workflow_dispatch`는 검증만 수행하고 registry에 로그인하거나 쓰지 않는다.\n",
)
text = read("docs/CI_CD.md")
text = text.replace("latest\nsha-<40-character-commit>\n", "latest\n")
text = text.replace("1.5.0-rc.1\nsha-<40-character-commit>\n", "1.5.0-rc.1\n")
text = text.replace("docker pull ghcr.io/<owner>/<repository>:ci-<full-commit>\n", "")
text = text.replace(
    "Main commit workflow는 quality, Chromium E2E와 local container smoke가 모두 성공한 뒤 별도 publish job을 실행한다. `ci-<full SHA>`를 push한 후 tag가 아니라 build output의 digest로 다시 pull하고 image content policy, migration/readiness, Project 생성과 edit session, root Task 저장, unauthorized mutation 거부, container restart 뒤 Project/Task 재조회를 검증한다. Commit image의 성공은 SemVer release 승인이 아니며 stable alias를 이동하지 않는다.",
    "Main commit workflow는 quality, Chromium E2E와 local container smoke가 모두 성공한 뒤 별도 publish job을 실행한다. `ci-<full SHA>`를 push한 후 tag가 아니라 build output의 digest로 다시 pull하고 image content policy, migration/readiness, Project 생성과 edit session, root Task 저장, unauthorized mutation 거부, container restart 뒤 Project/Task 재조회를 검증한다. 검증 성공 여부와 무관하게 push가 완료된 임시 package version은 cleanup step에서 삭제하며 `ci-*`를 배포·rollback용으로 보관하지 않는다."
)
text = text.replace(
    "Release workflow는 전체 application/E2E gate 뒤 동일 source·version·platform 설정의 local release candidate를 먼저 build하여 image policy, production runtime config 거부, migration, readiness, native SQLite와 재시작 persistence를 확인한다. 이 pre-publish gate가 통과해야 registry write가 시작된다. Registry에는 먼저 immutable `sha-<commit>` candidate만 push하고 그 digest를 새로 pull해 같은 runtime 동작을 다시 확인한다. Digest 검증과, 활성화된 경우 GitHub Attestation이 성공한 뒤에만 stable rolling alias를 이동하며 immutable exact version tag는 완료 표식으로 마지막에 생성한다.",
    "Release workflow는 전체 application/E2E gate 뒤 동일 source·version·platform 설정의 local release candidate를 먼저 build하여 image policy, production runtime config 거부, migration, readiness, native SQLite와 재시작 persistence를 확인한다. 이 pre-publish gate가 통과해야 registry write가 시작된다. Registry에는 commit 고정 `sha-*` candidate를 만들지 않고 exact SemVer tag를 직접 push한 뒤 그 build output digest를 새로 pull해 같은 runtime 동작을 다시 확인한다. Digest 검증과, 활성화된 경우 GitHub Attestation이 성공한 뒤에만 stable rolling alias를 이동한다."
)
text = text.replace("Exact와 commit tag가 이미 있으면 overwrite하지 않는다.", "Exact version tag가 이미 있으면 overwrite하지 않는다.")
text = text.replace("immutable `ci-<full SHA>` publish와 digest HTTP persistence smoke", "임시 `ci-<full SHA>` publish/digest smoke와 검증 후 package cleanup")
text = text.replace("Immutable commit candidate의 registry digest smoke와, 활성화한 경우 GitHub Attestation 뒤 rolling alias 및 exact version promotion이 끝났는지 workflow summary에서 확인한다.", "Exact SemVer image의 registry digest smoke와, 활성화한 경우 GitHub Attestation 뒤 stable rolling alias promotion이 끝났는지 workflow summary에서 확인한다.")
text = text.replace("기존 exact/commit image", "기존 exact image")
write("docs/CI_CD.md", text)

text = read("docs/DEPLOYMENT.md")
text = text.replace(
    "`main` push의 application, Chromium과 local container job이 모두 성공하면 `.github/workflows/ci.yml`의 publish job이 `ghcr.io/planner77/mastergantt:ci-<full SHA>`를 한 번만 게시한다. 기존 commit tag가 있으면 overwrite하지 않는다. PR과 수동 CI는 image를 게시하지 않는다.",
    "`main` push의 application, Chromium과 local container job이 모두 성공하면 `.github/workflows/ci.yml`의 publish job이 `ghcr.io/planner77/mastergantt:ci-<full SHA>`를 임시로 게시한다. 기존 commit tag가 있으면 overwrite하지 않는다. PR과 수동 CI는 image를 게시하지 않으며, digest 검증이 끝난 `ci-*` package version은 자동 삭제한다."
)
text = text.replace("아래 release workflow는 별도 `sha-<full SHA>` candidate를 사용한다.", "아래 release workflow는 GHCR에 commit 고정 candidate를 남기지 않고 local candidate 검증 후 exact SemVer를 직접 게시한다.")
text = text.replace("release `sha-<full SHA>` candidate", "local release candidate")
write("docs/DEPLOYMENT.md", text)

text = read("docs/SECURITY.md")
text = text.replace(
    "- Main commit image `ci-<full SHA>`, release candidate `sha-<full SHA>`, SemVer exact/rolling tag를 분리한다. Test/deployment는 mutable `latest`가 아닌 commit/release output의 exact digest를 사용한다.",
    "- Main commit 검증용 `ci-<full SHA>`는 exact digest smoke 직후 package version을 삭제한다. Semantic release는 GHCR `sha-*` candidate를 만들지 않고 exact/rolling SemVer tag만 보관한다. Test/deployment는 mutable `latest`가 아닌 workflow가 검증한 exact digest 또는 exact SemVer를 사용한다."
)
write("docs/SECURITY.md", text)

text = read("README.md")
text = text.replace("`main` commit별 immutable GHCR 테스트 image", "`main` commit별 임시 GHCR registry 검증 image")
text = text.replace("immutable `ci-<SHA>`와 SemVer release를 exact digest로 원격·로컬 검증; PR publish skipped", "임시 `ci-<SHA>`를 exact digest로 검증 후 자동 삭제하고 SemVer release만 보관; PR publish skipped")
text = text.replace("main commit test image와 Semantic Version release", "main commit 임시 registry 검증과 Semantic Version release")
text = text.replace(
    "성공한 `main` push는 모든 gate 뒤 `ci-<full SHA>` image를 게시하고 workflow가 출력한 digest를 새로 pull해 Project/Task API authorization과 restart persistence까지 검사한다. PR과 수동 CI는 registry에 쓰지 않는다. 이 commit image는 SemVer release가 아니며 stable alias를 만들지 않는다.",
    "성공한 `main` push는 모든 gate 뒤 `ci-<full SHA>` image를 임시 게시하고 workflow가 출력한 digest를 새로 pull해 Project/Task API authorization과 restart persistence까지 검사한 뒤 해당 package version을 삭제한다. PR과 수동 CI는 registry에 쓰지 않는다. `ci-*`는 SemVer release나 운영/rollback artifact로 남기지 않는다."
)
text = text.replace("`sha-<full SHA>` candidate", "GHCR에 남지 않는 local candidate")
write("README.md", text)
