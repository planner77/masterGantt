const [tag] = process.argv.slice(2);

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
