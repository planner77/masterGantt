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

  it("keeps the entrypoint executable and preserves the standalone startup order", () => {
    const path = resolve(root, "deploy/docker/container-entrypoint.sh");
    const entrypoint = readFileSync(path, "utf8");
    if (process.platform !== "win32") expect(statSync(path).mode & 0o111).not.toBe(0);

    const validation = "node runtime-tools/scripts/runtime/validate-runtime-config.js";
    const migration = "node runtime-tools/scripts/migrate.js";
    const server = "exec node server.js";
    expect(entrypoint).toContain(validation);
    expect(entrypoint).toContain(migration);
    expect(entrypoint).toContain(server);
    expect(entrypoint.indexOf(validation)).toBeLessThan(entrypoint.indexOf(migration));
    expect(entrypoint.indexOf(migration)).toBeLessThan(entrypoint.indexOf(server));
    expect(entrypoint).not.toContain("--import tsx");
    expect(entrypoint).not.toContain("npm run start");
  });

  it("keeps TypeScript loaders out of production dependencies", () => {
    const packageJson = JSON.parse(text("package.json")) as {
      scripts?: Record<string, string>;
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    expect(packageJson.dependencies).not.toHaveProperty("tsx");
    const nextVersion = packageJson.dependencies?.next;
    expect(nextVersion).toMatch(/^\d+\.\d+\.\d+$/);
    expect(packageJson.dependencies?.["@next/env"]).toBe(nextVersion);
    expect(packageJson.devDependencies?.tsx).toBe("4.23.13");
    expect(packageJson.scripts?.build).toContain("node scripts/prepare-standalone-runtime.mjs");
    expect(packageJson.scripts?.start).toBe("node scripts/start-standalone.mjs");

    const prepare = text("scripts/prepare-standalone-runtime.mjs");
    const start = text("scripts/start-standalone.mjs");
    expect(prepare).toContain('resolve(root, distDir, "static")');
    expect(prepare).toContain('resolve(standaloneDir, distDir, "static")');
    expect(prepare).toContain('resolve(root, "public")');
    expect(prepare).toContain('resolve(root, "db", "migrations")');
    expect(prepare).toContain('resolve(standaloneDir, "db", "migrations")');
    expect(start).toContain('require("@next/env")');
    expect(start).toContain("loadEnvConfig(repositoryRoot, false)");
    expect(start).toContain('process.env.NODE_ENV ??= "production"');
    expect(start.indexOf("loadEnvConfig(repositoryRoot, false)")).toBeLessThan(
      start.indexOf("prepareStandaloneRuntime()"),
    );
    expect(start).toContain('"--hostname"');
    expect(start).toContain('"--port"');
    expect(start).toContain("prepareStandaloneRuntime()");
    expect(start).not.toContain("process.chdir(");
    expect(start).toContain("await import(pathToFileURL(serverPath).href)");
  });

  it("preserves runtime paths and pins while relocating the Dockerfile", () => {
    const dockerfile = text("deploy/docker/Dockerfile");
    expect(dockerfile).toContain("deploy/docker/container-entrypoint.sh /usr/local/bin/container-entrypoint");
    expect(dockerfile).toContain('ENTRYPOINT ["/usr/local/bin/container-entrypoint"]');
    expect(dockerfile).toContain('VOLUME ["/data"]');
    expect(dockerfile).not.toContain("/app/db/migrations ./db/migrations");
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
    expect(compose).toContain(
      "LOGISTICS_CATALOG_ADMIN_PASSWORD: ${LOGISTICS_CATALOG_ADMIN_PASSWORD:?Set LOGISTICS_CATALOG_ADMIN_PASSWORD}",
    );
    expect(compose).toContain(
      "PROJECT_MASTER_ADMIN_PASSWORD: ${PROJECT_MASTER_ADMIN_PASSWORD:?Set PROJECT_MASTER_ADMIN_PASSWORD}",
    );
    expect(compose).toContain("name: ${MASTERGANTT_VOLUME_NAME:-mastergantt-data}");

    expect(buildCompose).toContain("build:");
    expect(buildCompose).toContain("context: ..");
    expect(buildCompose).toContain("dockerfile: deploy/docker/Dockerfile");
    expect(buildCompose).toContain("VERSION: ${IMAGE_VERSION:-local}");
    expect(buildCompose).toContain("pull_policy: never");
  });

  it("builds the container once on main and promotes the verified digest for release", () => {
    const ci = text(".github/workflows/ci.yml");
    const release = text(".github/workflows/release-image.yml");
    expect(ci.match(/context: \.\n\s+file: deploy\/docker\/Dockerfile/g)).toHaveLength(2);
    expect(release).not.toContain("docker/build-push-action@");
    expect(release).toContain("Main verified candidate exact digest 확인");
    expect(release).toContain('git rev-parse "refs/tags/${GITHUB_REF_NAME}^{commit}"');
    expect(release).toContain("EXPECTED_SHA: ${{ needs.prepare.outputs.target_sha }}");
    expect(release).toContain("docker buildx imagetools create");
    expect(release).toContain("--prefer-index=false");
    expect(release).toContain("Digest promotion changed the verified digest");
    expect(release).toContain("릴리스 후보 Project·Task API persistence 검증");
    expect(release).toContain("verified candidate digest GitHub Attestation");
    expect(release).toContain("최종 exact·rolling tag를 verified digest로 promotion");
    expect(release.indexOf("릴리스 후보 Project·Task API persistence 검증")).toBeLessThan(
      release.indexOf("최종 exact·rolling tag를 verified digest로 promotion"),
    );
    expect(release.indexOf("verified candidate digest GitHub Attestation")).toBeLessThan(
      release.indexOf("최종 exact·rolling tag를 verified digest로 promotion"),
    );
    expect(text("AGENTS.md")).toContain("successful non-docs main merge의 verified `ci-<SHA>`");
    expect(ci).toContain("version_changed:");
    expect(ci).toContain("BEFORE_SHA: ${{ github.event.before }}");
    expect(ci).toContain("fetch-depth: ${{ github.event_name == 'push' && '0' || '1' }}");
    expect(ci).toContain('git show "$BEFORE_SHA:package.json"');
    expect(ci).not.toContain('git show "${GITHUB_SHA}^1:package.json"');
    expect(ci).toContain("org.opencontainers.image.version=${{ needs.changes.outputs.current_version }}");
    expect(ci).toContain(
      "verified ci-${GITHUB_SHA} retained until Generic Release Finalizer resolves release or cleanup",
    );
    expect(ci).not.toContain("node scripts/delete-ghcr-package-version-by-tag.mjs");
    expect(text("scripts/issue_lifecycle.py")).toContain("cleanup_temporary_main_candidate");
    expect(text("scripts/issue_lifecycle.py")).toContain("scripts/delete-ghcr-package-version-by-tag.mjs");
    expect(text(".github/workflows/release-finalizer.yml")).toContain("packages: write");
    expect(text(".github/workflows/release-finalizer-resume.yml")).toContain("packages: write");
    expect(text(".github/dependabot.yml")).toMatch(/package-ecosystem: docker\n\s+directory: \/deploy\/docker/);
    expect(ci).toContain("bash scripts/verify-compose-smoke.sh");
    expect(ci).toContain(
      "bash scripts/verify-image-size-reduction.sh mastergantt:baseline mastergantt:ci 0 --summary-only",
    );
  });

  it("keeps secret and test exclusions at the build context root", () => {
    const ignore = text(".dockerignore").split(/\r?\n/);
    for (const rule of [".env", ".env.*", ".git", "tests", "node_modules", "*.sqlite3", "*-wal", "*-shm"]) {
      expect(ignore).toContain(rule);
    }
    expect(existsSync(resolve(root, "deploy/docker/Dockerfile.dockerignore"))).toBe(false);
  });
});
