#!/usr/bin/env node
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createPublishReportDirectory, publishLocalImage } from "./local-publish-core.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
export function publishOptions(argv) {
  const options = { root, mode: "plan", reports: [], includes: [] };
  for (const arg of argv) {
    if (arg === "--help" || arg === "-h") return { help: true };
    const match = /^--([a-z-]+)=(.+)$/.exec(arg);
    if (!match) throw new Error("--이름=값 형식이 필요합니다.");
    const [, key, value] = match;
    if (key === "reports") options.reports.push(value);
    else if (key === "include") options.includes.push(value);
    else if (key === "issue") { if (!/^[1-9][0-9]*$/.test(value)) throw new Error("Issue 번호가 유효하지 않습니다."); options.issue = Number(value); }
    else if (["mode", "base", "repository"].includes(key)) options[key] = value;
    else if (key === "oras") options.oras = resolve(value);
    else if (key === "auth-file") options.authFile = resolve(value);
    else if (key === "private-log-dir") options.privateLogDir = resolve(value);
    else if (key === "report-dir") options.reportDir = value;
    else throw new Error("지원하지 않는 옵션입니다.");
  }
  if (!["plan", "verify", "publish"].includes(options.mode)) throw new Error("mode는 plan, verify, publish 중 하나여야 합니다.");
  if (!options.base) throw new Error("고정 baseline --base가 필요합니다.");
  if (!options.privateLogDir) throw new Error("저장소 밖 새 --private-log-dir가 필요합니다.");
  if (options.mode !== "plan" && (!options.oras || !options.authFile || !options.issue || !options.reports.length)) throw new Error("verify/publish에는 --oras, --auth-file, --issue, --reports가 필요합니다.");
  return options;
}
async function main() {
  try {
    const options = publishOptions(process.argv.slice(2));
    if (options.help) {
      console.log("로컬 단일 OCI 수동 게시 (기본 plan, 원격 쓰기 없음)\nnode scripts/publish-local-image.mjs --base=<고정SHA> --private-log-dir=/저장소밖/새실행경로 [--mode=plan|verify|publish] --issue=909 --reports=.prepr-reports/<run>/report.json --oras=/검증도구/oras --auth-file=/비공개/config.json\n--reports/--include는 반복 가능. 원문 출력은 전용0700 경로에서 실행별 AES-256-GCM으로 암호화하며 별도 keys/evidence.key(0600)를 함께 보관합니다. publish는 고유 sha-<HEAD>만 게시하며 exact digest를 검증합니다. 운영 배포·태그 정리·SemVer 승격은 수행하지 않습니다.");
      return;
    }
    options.reportDir = createPublishReportDirectory(root, options.reportDir);
    const receipt = await publishLocalImage(options);
    writeFileSync(resolve(options.reportDir, "publish-receipt.json"), JSON.stringify(receipt, null, 2) + "\n", { flag: "wx", mode: 0o600 });
    console.log(JSON.stringify({ status: receipt.status, mode: receipt.mode, source: receipt.plan?.sourceHead, tag: receipt.plan?.tag, digest: receipt.image?.ociIndexDigest, registryWriteAttempted: receipt.registryWriteAttempted, published: receipt.published, deployment: "NOT TESTED" }));
    process.exitCode = ["FAIL", "BLOCKED"].includes(receipt.status) ? 1 : 0;
  } catch {
    console.error("BLOCKED: 게시 옵션 또는 소유 보고서 경로를 확인하세요.");
    process.exitCode = 2;
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
