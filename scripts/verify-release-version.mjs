import { readFileSync } from "node:fs";

// SemVer 2.0.0 without build metadata. Release images accept prereleases, but
// only stable releases are allowed to move major/minor/latest convenience tags.
const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*))?$/;

function parseSemVer(version) {
  const match = SEMVER.exec(version);
  if (!match) return undefined;
  return {
    major: BigInt(match[1]),
    minor: BigInt(match[2]),
    patch: BigInt(match[3]),
    prerelease: match[4]?.split(".") ?? [],
  };
}

function compareIdentifier(left, right) {
  const leftNumeric = /^\d+$/.test(left);
  const rightNumeric = /^\d+$/.test(right);
  if (leftNumeric && rightNumeric) {
    const leftValue = BigInt(left);
    const rightValue = BigInt(right);
    return leftValue < rightValue ? -1 : leftValue > rightValue ? 1 : 0;
  }
  if (leftNumeric !== rightNumeric) return leftNumeric ? -1 : 1;
  return left < right ? -1 : left > right ? 1 : 0;
}

export function compareSemVer(leftVersion, rightVersion) {
  const left = parseSemVer(leftVersion);
  const right = parseSemVer(rightVersion);
  if (!left || !right) throw new Error("Cannot compare an invalid SemVer version.");

  for (const field of ["major", "minor", "patch"]) {
    if (left[field] < right[field]) return -1;
    if (left[field] > right[field]) return 1;
  }

  if (left.prerelease.length === 0 || right.prerelease.length === 0) {
    if (left.prerelease.length === right.prerelease.length) return 0;
    return left.prerelease.length === 0 ? 1 : -1;
  }

  const length = Math.max(left.prerelease.length, right.prerelease.length);
  for (let index = 0; index < length; index += 1) {
    if (left.prerelease[index] === undefined) return -1;
    if (right.prerelease[index] === undefined) return 1;
    const comparison = compareIdentifier(
      left.prerelease[index],
      right.prerelease[index],
    );
    if (comparison !== 0) return comparison;
  }
  return 0;
}

export function verifyReleaseVersion({ manifest, lockfile, tag, previousTags = [] }) {
  if (typeof manifest.version !== "string" || !parseSemVer(manifest.version)) {
    throw new Error("package.json version must be SemVer without build metadata.");
  }

  const packageLockVersion = lockfile?.version;
  const packageRootVersion = lockfile?.packages?.[""]?.version;
  if (packageLockVersion !== manifest.version || packageRootVersion !== manifest.version) {
    throw new Error("package-lock.json top-level and root package versions must match package.json version.");
  }

  if (tag !== undefined) {
    if (tag !== `v${manifest.version}`) {
      throw new Error(`Tag ${tag} does not exactly match package version v${manifest.version}.`);
    }

    for (const previousTag of previousTags) {
      const previousVersion = previousTag.startsWith("v")
        ? previousTag.slice(1)
        : "";
      if (
        previousVersion !== manifest.version &&
        parseSemVer(previousVersion) &&
        compareSemVer(manifest.version, previousVersion) <= 0
      ) {
        throw new Error(
          `Release version v${manifest.version} must be greater than previous tag ${previousTag}.`,
        );
      }
    }
  }

  return {
    version: manifest.version,
    stable: !manifest.version.includes("-"),
  };
}

function readJson(relativePath) {
  return JSON.parse(readFileSync(new URL(relativePath, import.meta.url)));
}

function main() {
  const tag = process.argv[2];
  const options = process.argv.slice(3);
  const previousTags = [];
  for (let index = 0; index < options.length; index += 2) {
    if (options[index] !== "--previous-tag" || options[index + 1] === undefined) {
      throw new Error("Release validator options must be --previous-tag <tag> pairs.");
    }
    previousTags.push(options[index + 1]);
  }
  const result = verifyReleaseVersion({
    manifest: readJson("../package.json"),
    lockfile: readJson("../package-lock.json"),
    ...(tag === undefined ? {} : { tag }),
    previousTags,
  });
  console.log(`Release version verified: v${result.version} (${result.stable ? "stable" : "prerelease"})`);
}

if (import.meta.url === new URL(process.argv[1], "file:").href) {
  main();
}
