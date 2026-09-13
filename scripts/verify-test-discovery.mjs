import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
function files(directory, suffix) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    return entry.isDirectory() ? files(path, suffix) : entry.name.endsWith(suffix) ? [path] : [];
  });
}
function execute(cwd, args) {
  const result = spawnSync(process.execPath, args, {
    cwd,
    env: { ...process.env, NO_COLOR: "1", FORCE_COLOR: "0" },
    encoding: "utf8",
    timeout: 60_000,
  });
  if (result.error) throw result.error;
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result.stdout.replace(/\x1b\[[0-9;]*m/g, "").trim();
}
const configDirectory = resolve(root, "tests/config");
const unitArgs = [resolve(root, "node_modules/vitest/vitest.mjs"), "list", "--config", resolve(configDirectory, "vitest.config.ts"), "--filesOnly"];
const browserArgs = [resolve(root, "node_modules/@playwright/test/cli.js"), "test", "--config", resolve(configDirectory, "playwright.config.ts"), "--list", "--reporter=list"];
// Vitest prints paths relative to invocation cwd and filesystem traversal order
// is not an API contract. Compare complete sorted absolute paths, not raw text.
function unitPaths(output, cwd) {
  const lines = output.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  assert.ok(lines.length > 0, "Vitest discovered no test files");
  for (const line of lines) assert.ok(line.endsWith(".test.ts"), `Unexpected Vitest discovery output: ${line}`);
  return lines.map((line) => resolve(cwd, line)).sort();
}
const unitFiles = files(resolve(root, "tests"), ".test.ts").sort();
assert.ok(unitFiles.length >= 28);
const unitAtRoot = unitPaths(execute(root, unitArgs), root);
const unitOutside = unitPaths(execute(tmpdir(), unitArgs), tmpdir());
assert.deepEqual(unitAtRoot, unitFiles, "Vitest root discovery omitted, duplicated or added a test file");
assert.deepEqual(unitOutside, unitFiles, "Vitest external-cwd discovery omitted, duplicated or added a test file");
const browserAtRoot = execute(root, browserArgs);
const browserOutside = execute(tmpdir(), browserArgs);
assert.equal(browserOutside, browserAtRoot, "Playwright discovery changed with cwd");
for (const path of files(resolve(root, "tests/e2e"), ".spec.ts")) {
  assert.ok(browserOutside.includes(path.split(/[\\/]/).at(-1)), `Missing browser file: ${path}`);
}
const total = browserOutside.match(/Total: (\d+) tests? in (\d+) files?/);
assert.ok(total, "Missing Playwright discovery totals");
assert.ok(Number(total[1]) >= 10, "Browser coverage was reduced");
console.log(`Test discovery: PASS (${unitFiles.length} unit files; ${total[1]} browser tests; root and external cwd)`);
