import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(import.meta.url);
const repositoryRoot = resolve(dirname(scriptPath), "..");

function resolveDistDir(env = process.env) {
  const requested = env.NEXT_DIST_DIR;
  if (requested && !/^\.next-[a-z0-9-]+$/.test(requested)) {
    throw new Error("NEXT_DIST_DIR must match .next-<lowercase-name>.");
  }
  return requested ?? ".next";
}

export function prepareStandaloneRuntime({ root = repositoryRoot, env = process.env } = {}) {
  const distDir = resolveDistDir(env);
  const standaloneDir = resolve(root, distDir, "standalone");
  const serverPath = resolve(standaloneDir, "server.js");

  if (!existsSync(serverPath)) {
    throw new Error(`Standalone server was not found at ${serverPath}. Run npm run build first.`);
  }

  const staticSource = resolve(root, distDir, "static");
  const staticTarget = resolve(standaloneDir, distDir, "static");
  if (!existsSync(staticSource)) {
    throw new Error(`Next.js static assets were not found at ${staticSource}.`);
  }
  rmSync(staticTarget, { recursive: true, force: true });
  mkdirSync(dirname(staticTarget), { recursive: true });
  cpSync(staticSource, staticTarget, { recursive: true, force: true });

  const publicSource = resolve(root, "public");
  const publicTarget = resolve(standaloneDir, "public");
  rmSync(publicTarget, { recursive: true, force: true });
  if (existsSync(publicSource)) {
    cpSync(publicSource, publicTarget, { recursive: true, force: true });
  }

  return { distDir, standaloneDir, serverPath };
}

if (process.argv[1] === scriptPath) {
  prepareStandaloneRuntime();
}
