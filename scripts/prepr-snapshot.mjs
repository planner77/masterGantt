import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, symlinkSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { isPathWithin, sourceEvidence } from "./prepr-core.mjs";

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const git = (root, ...args) => execFileSync("git", args, { cwd: root, encoding: "utf8", maxBuffer: 48 * 1024 * 1024 }).trim();
const GENERATED_FILES = new Set(["next-env.d.ts", "tsconfig.json"]);
const NEXT_BROWSER_DIST = /^\.next-e2e(?:-isolated-[a-z0-9-]+)?(?:\/dev)?$/;
const NEXT_BROWSER_INCLUDE = /^\.next-e2e(?:-isolated-[a-z0-9-]+)?(?:\/dev)?\/types\/\*\*\/\*\.ts$/;

function assertRegularAncestors(root, target) {
  if (!isPathWithin(root, target)) throw new Error("BLOCKED: snapshot 경로가 허용 범위를 벗어났습니다.");
  let current = resolve(root);
  for (const part of relative(root, target).split(sep).filter(Boolean)) {
    current = join(current, part);
    if (existsSync(current) && lstatSync(current).isSymbolicLink()) throw new Error("BLOCKED: snapshot 경로의 symlink를 거부합니다.");
  }
}

function entries(root) {
  const names = git(root, "ls-files", "-z").split("\0").filter(Boolean).sort();
  return names.map((path) => {
    const absolute = resolve(root, path);
    assertRegularAncestors(root, resolve(absolute, ".."));
    if (!existsSync(absolute)) return { path, mode: "missing", sha256: null, contentSha256: null };
    const stat = lstatSync(absolute);
    if (stat.isSymbolicLink()) throw new Error(`BLOCKED: snapshot source symlink는 별도 검증이 필요합니다: ${path}`);
    if (!stat.isFile()) throw new Error(`BLOCKED: snapshot 특수 파일을 거부합니다: ${path}`);
    const bytes = readFileSync(absolute);
    return { path, mode: stat.mode & 0o111 ? "100755" : "100644", sha256: sha256(bytes), contentSha256: sha256(Buffer.concat([Buffer.from(`file:${stat.mode & 0o111}:`), bytes])) };
  });
}

function generatedText(root) {
  return Object.fromEntries([...GENERATED_FILES].map((path) => {
    const absolute = resolve(root, path);
    if (!existsSync(absolute)) return [path, null];
    if (!lstatSync(absolute).isFile() || lstatSync(absolute).isSymbolicLink()) throw new Error("BLOCKED: 생성 metadata는 일반 파일이어야 합니다.");
    return [path, readFileSync(absolute, "utf8")];
  }));
}

// Next's installed generator uses exactly this declaration shape. A future
// generator change is blocked until reviewed instead of broadly ignoring it.
function nextDeclarations(dist, eol) {
  return [
    '/// <reference types="next" />',
    '/// <reference types="next/image-types/global" />',
    `import "./${dist}/types/routes.d.ts";`,
    `import "./${dist}/types/root-params.d.ts";`,
    "",
    "// NOTE: This file should not be edited",
    "// see https://nextjs.org/docs/app/api-reference/config/typescript for more information.",
    "",
  ].join(eol);
}

export function validateNextGenerated(before, after) {
  const changes = [];
  for (const path of GENERATED_FILES) {
    const initial = before[path], final = after[path];
    if (initial === final) continue;
    if (typeof initial !== "string" || typeof final !== "string") throw new Error(`BLOCKED: 생성 metadata 추가/삭제는 허용하지 않습니다: ${path}`);
    if (path === "next-env.d.ts") {
      const beforeEol = initial.includes("\r\n") ? "\r\n" : "\n";
      const initialDist = initial.match(/^import "\.\/(.+)\/types\/routes\.d\.ts";\r?$/m)?.[1];
      const finalDist = final.match(/^import "\.\/(.+)\/types\/routes\.d\.ts";\r?$/m)?.[1];
      if (!initialDist || !(initialDist === ".next" || NEXT_BROWSER_DIST.test(initialDist)) || !finalDist || !NEXT_BROWSER_DIST.test(finalDist) || initial !== nextDeclarations(initialDist, beforeEol) || final !== nextDeclarations(finalDist, beforeEol)) {
        throw new Error("BLOCKED: next-env.d.ts 변경이 설치 Next의 표준 browser 선언과 다릅니다.");
      }
    } else {
      const first = JSON.parse(initial), last = JSON.parse(final);
      if (!Array.isArray(first.include) || !Array.isArray(last.include)) throw new Error("BLOCKED: tsconfig include 배열이 없습니다.");
      const { include: beforeInclude, ...beforeOptions } = first;
      const { include: afterInclude, ...afterOptions } = last;
      if (JSON.stringify(beforeOptions) !== JSON.stringify(afterOptions) || afterInclude.length < beforeInclude.length || beforeInclude.some((value, index) => value !== afterInclude[index])) throw new Error("BLOCKED: tsconfig 기존 option/include 변경을 거부합니다.");
      const added = afterInclude.slice(beforeInclude.length);
      if (!added.length || added.some((value) => typeof value !== "string" || !NEXT_BROWSER_INCLUDE.test(value)) || new Set(afterInclude).size !== afterInclude.length) throw new Error("BLOCKED: tsconfig browser 생성 include 외의 변경을 거부합니다.");
      // Next JSON output is JSON.stringify with two-space indentation. Do not
      // accept comments, duplicate keys, or arbitrary trailing source text.
      if (final !== JSON.stringify(last, null, 2) + "\n") throw new Error("BLOCKED: tsconfig 생성 JSON 형식이 다릅니다.");
    }
    changes.push({ path, beforeSha256: sha256(initial), afterSha256: sha256(final), beforeText: initial, afterText: final });
  }
  return changes;
}

export function validateSnapshotAudit(audit, source) {
  if (audit?.schemaVersion !== 1 || audit.headSha !== source.headSha || audit.inputContentSha256 !== source.contentSha256 || !Array.isArray(audit.before) || !Array.isArray(audit.after) || !Array.isArray(audit.untracked) || audit.untracked.length) throw new Error("BLOCKED: snapshot 입력/Head/파일 목록 근거가 다릅니다.");
  if (audit.indexBeforeSha256 !== source.indexSha256 || audit.indexAfterSha256 !== audit.indexBeforeSha256) throw new Error("BLOCKED: snapshot Git index가 실행 중 변경되었습니다.");
  if (!audit.before.length || audit.before.length !== audit.after.length) throw new Error("BLOCKED: snapshot source 파일 수가 변경되었습니다.");
  const digest = createHash("sha256");
  let previous = "";
  for (const entry of audit.before) {
    if (typeof entry?.path !== "string" || !entry.path || entry.path <= previous || entry.path.startsWith("/") || entry.path.includes("\\") || entry.path.split("/").some((part) => part === ".." || part === ".") || !["100644", "100755"].includes(entry.mode) || !/^[a-f0-9]{64}$/.test(entry.sha256 ?? "") || !/^[a-f0-9]{64}$/.test(entry.contentSha256 ?? "")) throw new Error("BLOCKED: snapshot manifest schema/경로가 유효하지 않습니다.");
    previous = entry.path;
    digest.update(JSON.stringify([entry.path, entry.contentSha256]));
  }
  if (digest.digest("hex") !== source.contentSha256) throw new Error("BLOCKED: snapshot manifest가 원본 입력 content에 결속되지 않았습니다.");
  const changes = validateNextGenerated(audit.generatedBefore, audit.generatedAfter);
  const allowed = new Map(changes.map((change) => [change.path, change]));
  for (let index = 0; index < audit.before.length; index++) {
    const first = audit.before[index], last = audit.after[index];
    if (!first || !last || first.path !== last.path || first.mode !== last.mode) throw new Error("BLOCKED: snapshot 파일 경로/mode가 변경되었습니다.");
    if (first.sha256 !== last.sha256 || first.contentSha256 !== last.contentSha256) {
      const generated = allowed.get(first.path);
      if (first.mode !== "100644" || generated?.beforeSha256 !== first.sha256 || generated?.afterSha256 !== last.sha256 || sha256(`file:0:${generated.beforeText}`) !== first.contentSha256 || sha256(`file:0:${generated.afterText}`) !== last.contentSha256) throw new Error(`BLOCKED: snapshot source/fixture 변경을 거부합니다: ${first.path}`);
    }
  }
  return { status: "PASS", generatedChanges: changes, beforeManifestSha256: sha256(JSON.stringify(audit.before)), afterManifestSha256: sha256(JSON.stringify(audit.after)) };
}

export function createBrowserSnapshot(root, reportDir, source) {
  const snapshotRoot = resolve(reportDir, "browser-source");
  if (source.dirty || !source.actualMatchesHead) throw new Error("BLOCKED: browser snapshot은 clean exact HEAD checkout이 필요합니다.");
  if (sourceEvidence(root, source.baseSha).fingerprint !== source.fingerprint) throw new Error("BLOCKED: snapshot 생성 전 원본 source가 변경되었습니다.");
  assertRegularAncestors(resolve(root, ".prepr-reports"), snapshotRoot);
  if (existsSync(snapshotRoot)) throw new Error("BLOCKED: 기존 browser snapshot 경로를 재사용하지 않습니다.");
  if (!existsSync(resolve(root, "node_modules"))) throw new Error("BLOCKED: 설치된 로컬 의존성이 필요합니다.");
  git(root, "worktree", "add", "--detach", snapshotRoot, source.headSha);
  try {
    // Git's directory-only node_modules/ ignore does not cover a symlink at
    // that path. Keep a real ignored directory and share only install entries.
    mkdirSync(resolve(snapshotRoot, "node_modules"));
    for (const entry of readdirSync(resolve(root, "node_modules"))) symlinkSync(resolve(root, "node_modules", entry), resolve(snapshotRoot, "node_modules", entry), lstatSync(resolve(root, "node_modules", entry)).isDirectory() ? "junction" : "file");
    const input = sourceEvidence(snapshotRoot, source.baseSha);
    if (input.dirty || input.headSha !== source.headSha || input.contentSha256 !== source.contentSha256) throw new Error("BLOCKED: snapshot 입력 bytes가 검증 source와 다릅니다.");
    return {
      root, snapshotRoot, headSha: source.headSha, inputContentSha256: input.contentSha256, indexSha256: input.indexSha256,
      before: entries(snapshotRoot), generatedBefore: generatedText(snapshotRoot),
      nextGeneratorSha256: sha256(readFileSync(resolve(root, "node_modules/next/dist/lib/typescript/writeAppTypeDeclarations.js"))),
    };
  } catch (error) {
    git(root, "worktree", "remove", "--force", snapshotRoot);
    throw error;
  }
}

export function inspectBrowserSnapshot(snapshot, source) {
  const current = sourceEvidence(snapshot.snapshotRoot, source.baseSha);
  if (current.headSha !== snapshot.headSha) throw new Error("BLOCKED: snapshot HEAD가 실행 중 변경되었습니다.");
  const audit = {
    schemaVersion: 1, headSha: snapshot.headSha, inputContentSha256: snapshot.inputContentSha256,
    indexBeforeSha256: snapshot.indexSha256, indexAfterSha256: current.indexSha256,
    before: snapshot.before, after: entries(snapshot.snapshotRoot),
    untracked: git(snapshot.snapshotRoot, "ls-files", "--others", "--exclude-standard", "-z").split("\0").filter(Boolean),
    generatedBefore: snapshot.generatedBefore, generatedAfter: generatedText(snapshot.snapshotRoot),
    nextGeneratorSha256: snapshot.nextGeneratorSha256,
  };
  return { audit, verification: validateSnapshotAudit(audit, source) };
}

export function removeBrowserSnapshot(snapshot) {
  const registered = git(snapshot.root, "worktree", "list", "--porcelain").split("\n\n").find((block) => block.split("\n")[0] === `worktree ${snapshot.snapshotRoot}`);
  if (!registered || !registered.split("\n").includes(`HEAD ${snapshot.headSha}`) || !registered.split("\n").includes("detached")) throw new Error("BLOCKED: 이 실행이 생성한 exact snapshot worktree만 정리할 수 있습니다.");
  git(snapshot.root, "worktree", "remove", "--force", snapshot.snapshotRoot);
}

export function snapshotRunnerRoot(reportDirectory, runnerRoot) {
  const expected = resolve(reportDirectory, "browser-source");
  if (runnerRoot !== expected) throw new Error("BLOCKED: runner source 경로가 해당 보고서의 snapshot과 다릅니다.");
  return expected;
}
