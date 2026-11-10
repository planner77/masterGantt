#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve, relative, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";
import { gitLedgerBaseline, validateLedger, validateLedgerFilePrefixes } from "./issue-ledger-core.mjs";

const options = { root: fileURLToPath(new URL("../", import.meta.url)), index: "docs/REGRESSION_INDEX.json", previous: "", base: "", source: null, environment: null };
try {
  for (const arg of process.argv.slice(2)) {
    if (arg === "--help") { console.log("로컬 실패 원장 검증: node scripts/verify-issue-ledger.mjs [--root=PATH] [--index=docs/REGRESSION_INDEX.json] [--base=SHA] [--previous=PATH] [--source=SHA] [--environment=TEXT]"); process.exit(0); }
    const match = /^--(root|index|previous|base|source|environment)=(.+)$/.exec(arg);
    if (!match) throw new Error("알 수 없거나 빈 옵션입니다.");
    options[match[1]] = match[2];
  }
  options.root = resolve(options.root);
  const indexFile = resolve(options.root, options.index);
  const path = relative(options.root, indexFile);
  if (isAbsolute(path) || path === ".." || path.startsWith("../")) throw new Error("인덱스는 저장소 안에 있어야 합니다.");
  const index = JSON.parse(readFileSync(indexFile, "utf8"));
  const baseline = gitLedgerBaseline(options.root, options.index, options.base);
  const result = validateLedger(index, { root: options.root, previous: baseline.previous, expectedSource: options.source, expectedEnvironment: options.environment });
  if (options.previous) {
    const additional = validateLedger(index, { root: options.root, previous: JSON.parse(readFileSync(resolve(options.root, options.previous), "utf8")) });
    result.errors.push(...additional.errors);
    if (additional.status !== "PASS") result.status = "FAIL";
  }
  const markdown = validateLedgerFilePrefixes(options.root, index, baseline.baseSha);
  result.errors.push(...markdown.errors);
  if (markdown.status !== "PASS") result.status = "FAIL";
  console.log(JSON.stringify({ ...result, appendOnly: { status: result.status, baselineSha: baseline.baseSha, bootstrap: baseline.bootstrap, explicitPrevious: Boolean(options.previous), markdownPrefixesCompared: markdown.compared }, notice: "구조·원본 보존 검산이며 테스트/게시/복원 성공이나 인증된 서버 승인이 아닙니다." }, null, 2));
  if (result.status !== "PASS") process.exitCode = 1;
} catch (error) { console.error(`실패 원장 검증 BLOCKED: ${error.message}`); process.exitCode = 1; }
