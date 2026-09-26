import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = fileURLToPath(new URL("../../", import.meta.url));
const text = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("deployment repository layout", () => {
  it("keeps deployment files together and removes the old entry points", () => {
    for (const path of [
      "deploy/docker/Dockerfile",
      "deploy/compose.yml",
      "deploy/compose.build.yml",
      "deploy/docker/container-entrypoint.sh",
    ]) {
      expect(existsSync(resolve(root, path)), path).toBe(true);
    }
    for (const path of ["Dockerfile", "docker-compose.yml", "scripts/container-entrypoint.sh"]) {
      expect(existsSync(resolve(root, path)), path).toBe(false);
    }
  });

  it("preserves the entrypoint bytes and executable mode", () => {
    const path = resolve(root, "deploy/docker/container-entrypoint.sh");
    const bytes = readFileSync(path);
    const sha = createHash("sha1").update(`blob ${bytes.length}\0`).update(bytes).digest("hex");
    expect(sha).toBe("9492419ffdce7295132a41b6a66210032d9f1400");
    if (process.platform !== "win32") expect(statSync(path).mode & 0o111).not.toBe(0);
  });

  it("preserves runtime paths and pins while relocating the Dockerfile", () => {
    const dockerfile = text("deploy/docker/Dockerfile");
    expect(dockerfile).toContain("deploy/docker/container-entrypoint.sh /usr/local/bin/container-entrypoint");
    expect(dockerfile).toContain('ENTRYPOINT ["/usr/local/bin/container-entrypoint"]');
    expect(dockerfile).toContain('VOLUME ["/data"]');
    expect(dockerfile).toContain("USER mastergantt");
    const bases = Array.from(dockerfile.matchAll(/^FROM (node:\S+@sha256:[a-f0-9]{64}) /gm), ([, base]) => base);
    expect(bases).toHaveLength(2);
    expect(new Set(bases).size).toBe(1);
  });

  it("separates production image pulls from local/CI source builds", () => {
    const compose = text("deploy/compose.yml");
    const buildCompose = text("deploy/compose.build.yml");
    expect(compose).toContain("name: ${COMPOSE_PROJECT_NAME:?");
    expect(compose).toContain("image: ${IMAGE_NAME:?Set IMAGE_NAME");
    expect(compose).toContain("pull_policy: always");
    expect(compose).not.toContain("build:");
    expect(compose).toContain("127.0.0.1:${HOST_PORT:-3000}:3000");
    expect(compose).toContain(
      "RESOURCE_CATALOG_ADMIN_PASSWORD: ${RESOURCE_CATALOG_ADMIN_PASSWORD:?Set RESOURCE_CATALOG_ADMIN_PASSWORD}",
    );
    expect(compose).toContain("name: ${MASTERGANTT_VOLUME_NAME:-mastergantt-data}");

    expect(buildCompose).toContain("build:");
    expect(buildCompose).toContain("context: ..");
    expect(buildCompose).toContain("dockerfile: deploy/docker/Dockerfile");
    expect(buildCompose).toContain("VERSION: ${IMAGE_VERSION:-local}");
    expect(buildCompose).toContain("pull_policy: never");
  });

  it("updates all CI/release builds and the Docker dependency scan", () => {
    for (const file of [".github/workflows/ci.yml", ".github/workflows/release-image.yml"]) {
      expect(text(file).match(/context: \.\n\s+file: deploy\/docker\/Dockerfile/g), file).toHaveLength(2);
    }
    expect(text(".github/dependabot.yml")).toMatch(/package-ecosystem: docker\n\s+directory: \/deploy\/docker/);
    expect(text(".github/workflows/ci.yml")).toContain("bash scripts/verify-compose-smoke.sh");
  });

  it("keeps secret and test exclusions at the build context root", () => {
    const ignore = text(".dockerignore").split(/\r?\n/);
    for (const rule of [".env", ".env.*", ".git", "tests", "node_modules", "*.sqlite3", "*-wal", "*-shm"]) {
      expect(ignore).toContain(rule);
    }
    expect(existsSync(resolve(root, "deploy/docker/Dockerfile.dockerignore"))).toBe(false);
  });
});
