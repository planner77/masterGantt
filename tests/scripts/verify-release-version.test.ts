import { describe, expect, it } from "vitest";

import {
  compareSemVer,
  verifyReleaseVersion,
} from "../../scripts/verify-release-version.mjs";

const lockfile = (version: string) => ({ version, packages: { "": { version } } });
const manifest = (version: string) => ({ version });

describe("verifyReleaseVersion", () => {
  it("accepts matching stable and prerelease SemVer versions", () => {
    expect(verifyReleaseVersion({
      manifest: manifest("1.2.3"),
      lockfile: lockfile("1.2.3"),
      tag: "v1.2.3",
    })).toEqual({ version: "1.2.3", stable: true });

    expect(verifyReleaseVersion({
      manifest: manifest("1.2.3-rc.1"),
      lockfile: lockfile("1.2.3-rc.1"),
      tag: "v1.2.3-rc.1",
    })).toEqual({ version: "1.2.3-rc.1", stable: false });
  });

  it("rejects a tag mismatch", () => {
    expect(() => verifyReleaseVersion({
      manifest: manifest("1.2.3"),
      lockfile: lockfile("1.2.3"),
      tag: "v1.2.4",
    })).toThrow("does not exactly match");
  });

  it("rejects malformed versions and build metadata", () => {
    expect(() => verifyReleaseVersion({
      manifest: manifest("01.2.3"),
      lockfile: lockfile("01.2.3"),
    })).toThrow("must be SemVer");
    expect(() => verifyReleaseVersion({
      manifest: manifest("1.2.3+build.9"),
      lockfile: lockfile("1.2.3+build.9"),
    })).toThrow("must be SemVer");
  });

  it("rejects package-lock root version drift", () => {
    expect(() => verifyReleaseVersion({
      manifest: manifest("1.2.3"),
      lockfile: lockfile("1.2.2"),
    })).toThrow("package-lock.json top-level and root package versions");

    expect(() => verifyReleaseVersion({
      manifest: manifest("1.2.3"),
      lockfile: { version: "1.2.3", packages: { "": { version: "1.2.2" } } },
    })).toThrow("package-lock.json top-level and root package versions");
  });

  it("orders stable and prerelease versions according to SemVer precedence", () => {
    expect(compareSemVer("1.2.3", "1.2.3-rc.9")).toBe(1);
    expect(compareSemVer("1.2.3-rc.10", "1.2.3-rc.2")).toBe(1);
    expect(compareSemVer("2.0.0-alpha", "1.99.99")).toBe(1);
    expect(compareSemVer("1.2.3-alpha.1", "1.2.3-alpha.beta")).toBe(-1);
  });

  it("requires a release version to be greater than every prior valid release tag", () => {
    expect(verifyReleaseVersion({
      manifest: manifest("1.3.0"),
      lockfile: lockfile("1.3.0"),
      tag: "v1.3.0",
      previousTags: ["v1.2.9", "v1.3.0-rc.1", "v-not-semver"],
    })).toEqual({ version: "1.3.0", stable: true });

    expect(() => verifyReleaseVersion({
      manifest: manifest("1.2.9"),
      lockfile: lockfile("1.2.9"),
      tag: "v1.2.9",
      previousTags: ["v1.2.9", "v1.3.0"],
    })).toThrow("must be greater than previous tag v1.3.0");
  });
});
