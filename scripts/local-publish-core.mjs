import { spawnSync } from "node:child_process";
import { createCipheriv, createHash, randomBytes, randomUUID } from "node:crypto";
import { closeSync, existsSync, lstatSync, mkdirSync, openSync, readFileSync, readdirSync, readSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, relative, resolve } from "node:path";
import { environmentEvidence, isPathWithin, reportChecksum, sourceEvidence } from "./prepr-core.mjs";
import { checkedArtifactPath, validateLocalImageEvidence } from "./prepr-docker.mjs";
import { inspectSmokeEndpoint } from "./registry-smoke-core.mjs";

export const ORAS_VERSION = "1.3.6";
// Official linux/amd64 1.3.6 archive checksum verified during #906 publication.
export const ORAS_BINARY_SHA256 = "2be7e2b668fc32329408ca17f104021bdb93407266537b6410668ed7d05c4611";
export const PUBLISH_REPOSITORY = "ghcr.io/planner77/mastergantt";
const require = (ok, message) => { if (!ok) throw new Error(`BLOCKED: ${message}`); };
const contract = (ok, message) => { if (!ok) throw new Error(`FAIL: ${message}`); };
const hash = (value) => createHash("sha256").update(value).digest("hex");
export function fileSha256(path) {
  const fd = openSync(path, "r"), buffer = Buffer.alloc(1024 * 1024), result = createHash("sha256");
  try { let size; while ((size = readSync(fd, buffer, 0, buffer.length, null))) result.update(buffer.subarray(0, size)); }
  finally { closeSync(fd); }
  return result.digest("hex");
}
export function createPrivateEvidenceSink(root, path) {
  require(typeof path === "string" && path === resolve(path), "저장소 밖 --private-log-dir 절대 경로가 필요합니다.");
  const parent = dirname(path);
  let current = parent;
  while (true) {
    const info = lstatSync(current);
    require(info.isDirectory() && !info.isSymbolicLink(), "비공개 증거 경로의 ancestor가 안전하지 않습니다.");
    require(!existsSync(resolve(current, ".git")), "비공개 증거 경로는 다른 Git 저장소 안에도 둘 수 없습니다.");
    const next = dirname(current); if (next === current) break; current = next;
  }
  require(!isPathWithin(realpathSync(root), resolve(realpathSync(parent), basename(path))), "비공개 증거는 Git/build context 밖에 보관해야 합니다.");
  require(!existsSync(path), "기존 비공개 증거 디렉터리를 재사용하지 않습니다.");
  mkdirSync(path, { mode: 0o700 });
  const info = lstatSync(path);
  require(info.uid === process.getuid() && (info.mode & 0o777) === 0o700 && !info.isSymbolicLink(), "비공개 증거 디렉터리 소유/0700 확인에 실패했습니다.");
  mkdirSync(resolve(path, "keys"), { mode: 0o700 });
  const key = randomBytes(32), attemptId = randomUUID();
  writeFileSync(resolve(path, "keys/evidence.key"), key, { flag: "wx", mode: 0o600 });
  return { root: path, key, attemptId };
}
export function preserveProcessEvidence(sink, { stepId, head, output }) {
  require(/^step-[0-9]{4}$/.test(stepId) && /^[a-f0-9]{40}$/.test(head), "암호화 증거 귀속이 유효하지 않습니다.");
  require(lstatSync(sink.root).isDirectory() && !lstatSync(sink.root).isSymbolicLink() && lstatSync(sink.root).uid === process.getuid() && (lstatSync(sink.root).mode & 0o777) === 0o700, "비공개 증거 디렉터리가 변경되었습니다.");
  const proofs = [];
  for (const stream of ["stdout", "stderr"]) {
    const id = `${stepId}-${stream}`, nonce = randomBytes(12);
    const raw = Buffer.isBuffer(output[`${stream}Bytes`]) ? output[`${stream}Bytes`] : Buffer.from(output[stream] ?? "");
    const aad = JSON.stringify({ attemptId: sink.attemptId, stepId, head, stream });
    const cipher = createCipheriv("aes-256-gcm", sink.key, nonce); cipher.setAAD(Buffer.from(aad));
    const bytes = Buffer.concat([cipher.update(raw), cipher.final()]);
    const metadata = { schemaVersion: 1, id, attemptId: sink.attemptId, algorithm: "aes-256-gcm", nonce: nonce.toString("hex"), tag: cipher.getAuthTag().toString("hex"), aad, rawSha256: hash(raw), cipherSha256: hash(bytes), rawBytes: raw.length, truncated: output.error?.code === "ENOBUFS" };
    writeFileSync(resolve(sink.root, id + ".enc"), bytes, { flag: "wx", mode: 0o600 });
    writeFileSync(resolve(sink.root, id + ".json"), JSON.stringify(metadata) + "\n", { flag: "wx", mode: 0o600 });
    proofs.push({ id, attemptId: sink.attemptId, rawSha256: metadata.rawSha256, cipherSha256: metadata.cipherSha256, rawBytes: raw.length, truncated: metadata.truncated });
  }
  return proofs;
}
function regular(path) {
  let current = resolve(path);
  while (true) {
    require(!lstatSync(current).isSymbolicLink(), "symlink 경로는 허용하지 않습니다.");
    const parent = dirname(current); if (parent === current) break; current = parent;
  }
  require(lstatSync(path).isFile(), "일반 파일이 필요합니다.");
  return path;
}
export function validateAuthFile(root, path) {
  const absolute = regular(resolve(path));
  require(!isPathWithin(realpathSync(root), realpathSync(absolute)), "인증 파일은 저장소 밖에 보관해야 합니다.");
  require(basename(absolute) === "config.json" && lstatSync(absolute).uid === process.getuid() && (lstatSync(absolute).mode & 0o777) === 0o600, "인증 파일은 실행자 소유·접근 권한 0600의 config.json이어야 합니다.");
  const config = JSON.parse(readFileSync(absolute, "utf8"));
  require(typeof config.auths?.["ghcr.io"]?.auth === "string" && config.auths["ghcr.io"].auth.length > 0, "GHCR 인증 항목이 필요합니다.");
  return absolute;
}
export function validateOrasBinary(path) {
  regular(resolve(path));
  require(fileSha256(path) === ORAS_BINARY_SHA256, "ORAS 실행 파일 checksum이 고정 버전과 다릅니다.");
}
export function createPublishPlan({ source, repository = PUBLISH_REPOSITORY }) {
  require(repository === PUBLISH_REPOSITORY, "승인된 GHCR 저장소만 허용합니다.");
  require(/^[a-f0-9]{40}$/.test(source.headSha) && !source.dirty && source.actualMatchesHead, "clean exact HEAD가 필요합니다.");
  return { schemaVersion: 1, sourceHead: source.headSha, repository, tag: `${repository}:sha-${source.headSha}`, platform: "linux/amd64", rebuild: false, deployment: "NOT TESTED" };
}
export function validateOrasHelp(version, cp, fetch, tags) {
  require(new RegExp(`^Version:\\s+${ORAS_VERSION.replaceAll(".", "\\.")}$`, "m").test(version), "고정 ORAS 버전이 아닙니다.");
  for (const flag of ["--from-oci-layout", "--to-oci-layout", "--recursive", "--to-registry-config", "--from-registry-config"]) require(cp.includes(flag), `ORAS cp 옵션 ${flag}가 없습니다.`);
  for (const flag of ["--descriptor", "--registry-config"]) require(fetch.includes(flag), `ORAS manifest fetch 옵션 ${flag}가 없습니다.`);
  for (const flag of ["--format", "--registry-config"]) require(tags.includes(flag), `ORAS repo tags 옵션 ${flag}가 없습니다.`);
}
export function assertRemoteHead(output, head) {
  require(output.trim() === `${head}\trefs/heads/main`, "원격 main이 검증 source HEAD와 다릅니다.");
}
export function assertTagAbsent(tags, fetched, tag) {
  const list = JSON.parse(tags);
  require(Array.isArray(list.tags) && list.tags.every((item) => typeof item === "string"), "인증된 태그 목록이 유효하지 않습니다.");
  require(!list.tags.includes(tag.split(":").at(-1)), "기존 SHA 태그는 덮어쓰지 않습니다.");
  require(new RegExp(`^${PUBLISH_REPOSITORY.replaceAll(".", "\\.")}:sha-[a-f0-9]{40}$`).test(tag), "정확한 저장소의 고유 SHA 태그가 필요합니다.");
  // Pinned ORAS 1.3.6 maps the registry's missing manifest to this exact line,
  // without a numeric HTTP status or MANIFEST_UNKNOWN. The authenticated repo
  // inventory above distinguishes an existing repo from repository absence.
  const absent = `Error response from registry: failed to find "${tag}": ${tag}: not found`;
  require(fetched.status === 1 && !fetched.signal && !fetched.error && (fetched.stderr ?? "").replace(/\r?\n$/, "") === absent, "태그 부재를 확인하지 못했습니다.");
}
function reportInventory(root) {
  const files = [];
  const walk = (path) => {
    for (const entry of readdirSync(path, { withFileTypes: true })) {
      if (entry.isSymbolicLink()) continue;
      const child = resolve(path, entry.name);
      if (entry.isDirectory() && !["browser-source", "test-results", "playwright-report"].includes(entry.name)) walk(child);
      else if (entry.isFile() && entry.name === "report.json") files.push({ path: child, sha256: fileSha256(child) });
    }
  };
  walk(resolve(root, ".prepr-reports"));
  return files.sort((a, b) => a.path.localeCompare(b.path));
}
function outputCategory(output) {
  if (output.signal || output.error || output.status === null) return "PROCESS_INTERRUPTED";
  if (output.status === 0) return "SUCCESS";
  const text = output.stderr ?? "";
  if (/unknown flag|unknown option/i.test(text)) return "UNSUPPORTED_OPTION";
  if (/unauthorized|denied|401|403/i.test(text)) return "AUTHORIZATION";
  if (/manifest unknown|MANIFEST_UNKNOWN/i.test(text)) return "MANIFEST_ABSENT";
  if (/timeout|connection|network|dial tcp|no such host/i.test(text)) return "NETWORK";
  return "COMMAND_FAILED";
}
const GRAPH_CHECK = String.raw`
import hashlib,json,pathlib,re,sys,tarfile
archive,destination,digest=sys.argv[1:]
root=pathlib.Path(destination)
assert root.is_dir() and not root.is_symlink(), 'layout directory required'
count=0
seen=set()
with tarfile.open(archive,'r:*') as t:
 for m in t:
  name=m.name.removeprefix('./')
  if name.rstrip('/') in ['blobs','blobs/sha256']:
   name=name.rstrip('/')
   assert m.isdir() and name not in seen, 'unsafe/duplicate blob directory'
   seen.add(name)
   continue
  if not name.startswith('blobs/'):continue
  assert name not in seen, 'duplicate blob'
  seen.add(name)
  assert m.isfile() and re.fullmatch(r'blobs/sha256/[0-9a-f]{64}',name), 'unsafe blob'
  p=root/name
  assert not p.is_symlink() and p.is_file() and not p.parent.is_symlink() and not p.parent.parent.is_symlink(), 'missing/linked blob'
  h=hashlib.sha256()
  with p.open('rb') as f:
   while b:=f.read(1024*1024):h.update(b)
  assert h.hexdigest()==name.split('/')[-1] and p.stat().st_size==m.size, 'copied blob differs'
  count+=1
index=root/'index.json'
assert not index.is_symlink(), 'linked index'
assert digest in [d.get('digest') for d in json.loads(index.read_bytes())['manifests']], 'root digest absent'
assert re.fullmatch(r'sha256:[0-9a-f]{64}',digest), 'invalid root digest'
subject=root/'blobs/sha256'/digest[7:]
assert subject.is_file() and not subject.is_symlink(), 'root blob absent/linked'
assert hashlib.sha256(subject.read_bytes()).hexdigest()==digest[7:], 'root blob bytes differ'
assert count>0, 'empty graph'
print(json.dumps({'status':'PASS','blobs':count,'indexDigest':digest}))
`;
export function verifyCopiedGraph({ archive, destination, digest }) {
  const result = spawnSync("python3", ["-c", GRAPH_CHECK, archive, destination, digest], { encoding: "utf8", timeout: 120000, maxBuffer: 1024 * 1024 });
  require(!result.error && !result.signal && result.status !== null, "OCI graph 검사 도구를 실행하지 못했습니다.");
  contract(result.status === 0, "복사한 OCI graph의 blob bytes/index가 다릅니다.");
  return JSON.parse(result.stdout);
}
export function defaultProcess(command, args, { root }) {
  const result = spawnSync(command, args, { cwd: root, timeout: 20 * 60 * 1000, maxBuffer: 8 * 1024 * 1024 });
  return { ...result, stdoutBytes: result.stdout, stderrBytes: result.stderr, stdout: result.stdout?.toString("utf8") ?? "", stderr: result.stderr?.toString("utf8") ?? "" };
}

export async function registryRuntimeSmoke({ authFile, reference, image, source, run, inspectEndpoint = inspectSmokeEndpoint }) {
  const docker = ["--config", dirname(authFile)];
  await run("정확 digest Pull", "docker", [...docker, "pull", "--platform=linux/amd64", reference]);
  const actual = JSON.parse((await run("Pull 이미지 identity", "docker", [...docker, "image", "inspect", "--format", "{{json .}}", reference])).stdout);
  contract(actual.Id === image.id && actual.Os === "linux" && actual.Architecture === "amd64" && actual.Config?.Labels?.["org.opencontainers.image.revision"] === source.headSha && actual.Config?.Labels?.["org.opencontainers.image.source"] === "https://github.com/planner77/masterGantt", "Pull 이미지 identity가 원본 OCI와 다릅니다.");
  await run("Pull 이미지 정책", "sh", ["scripts/verify-image-policy.sh", reference]);
  const name = "mastergantt-commit-smoke", owner = randomUUID();
  const previous = await run("격리 container 충돌 확인", "docker", ["ps", "--all", "--filter", `name=^/${name}$`, "--format", "{{.ID}}"]);
  require(!previous.stdout.trim(), "기존 smoke container를 중단하거나 재사용하지 않습니다.");
  let id = null, originalError = null;
  try {
    const result = await run("격리 runtime 시작", "docker", ["run", "--pull=never", "--detach", "--name", name, "--label", `mastergantt.local-publish=${owner}`, "--env", "APP_BASE_URL=https://gantt.example.invalid", "--publish", "127.0.0.1::3000", reference]);
    id = result.stdout.trim();
    require(/^[a-f0-9]{64}$/.test(id), "생성한 container ID를 확인하지 못했습니다.");
    const endpoint = inspectEndpoint(name);
    contract(endpoint.id === id && endpoint.image === image.id, "runtime container/image identity가 다릅니다.");
    const readiness = `let ok=false;for(let i=0;i<90;i++){try{if((await fetch(${JSON.stringify(endpoint.baseUrl + "/api/health/ready")},{signal:AbortSignal.timeout(2000)})).ok){ok=true;break;}}catch{}await new Promise(r=>setTimeout(r,1000));}if(!ok)process.exit(1);`;
    await run("격리 readiness", "node", ["--input-type=module", "-e", readiness]);
    await run("격리 API·권한·SQLite 재시작", "node", ["scripts/verify-registry-api-smoke.mjs", endpoint.baseUrl, name]);
    await run("격리 SQLite 무결성", "docker", ["exec", id, "node", "-e", "const D=require('better-sqlite3');const d=new D(process.env.DATABASE_PATH,{readonly:true});if(d.pragma('integrity_check',{simple:true})!=='ok'||d.pragma('foreign_key_check').length)process.exit(1);d.close();"]);
  } catch (error) {
    originalError = error;
    throw error;
  } finally {
    try {
    if (id) {
      const identity = JSON.parse((await run("소유 container 확인", "docker", ["container", "inspect", "--format", "{{json .}}", id])).stdout);
      require(identity.Id === id && identity.Config?.Labels?.["mastergantt.local-publish"] === owner, "소유 확인 실패로 container를 정리하지 않습니다.");
      await run("소유 container 정리", "docker", ["rm", "--force", "--volumes", id]);
    }
    } catch (error) { if (originalError) originalError.cleanupFailed = true; else throw error; }
  }
  return { status: "PASS", imageId: image.id, reference, readiness: "PASS", apiAuthorization: "PASS", sqliteRestart: "PASS", sqliteIntegrity: "PASS" };
}

export async function publishLocalImage(options, injected = {}) {
  const { root, base, issue, reports = [], includes = [], oras, authFile, reportDir, mode = "plan" } = options;
  const source = injected.source ?? (() => sourceEvidence(root, base));
  const environment = injected.environment ?? (() => environmentEvidence(root));
  const processRun = injected.process ?? defaultProcess;
  const validateImage = injected.validateImage ?? validateLocalImageEvidence;
  const verifyGraph = injected.verifyGraph;
  const smoke = injected.smoke ?? registryRuntimeSmoke;
  const result = { schemaVersion: 1, tool: "mastergantt-local-publish", issue, mode, status: "NOT TESTED", publicationEligibility: "NOT TESTED", startedAt: new Date().toISOString(), steps: [], errors: [], registryWriteAttempted: false, published: false, tagState: "NOT WRITTEN", runtime: null, deployment: "NOT TESTED", sourceStable: false, environmentStable: false };
  let lock = null;
  let lockFd = null;
  let sink = null;
  const run = async (label, command, args, allowFailure = false) => {
    const startedAt = new Date().toISOString();
    const output = await processRun(command, args, { root });
    const evidence = preserveProcessEvidence(sink, { stepId: `step-${String(result.steps.length + 1).padStart(4, "0")}`, head: result.sourceStart.headSha, output });
    result.steps.push({ label, command: [command, ...args].map((arg) => arg === authFile || arg === dirname(authFile ?? "") ? "<auth-config>" : arg), startedAt, completedAt: new Date().toISOString(), exitCode: output.status, signal: output.signal ?? null, category: outputCategory(output), evidence });
    if (!allowFailure && (output.status !== 0 || output.signal || output.error)) {
      const category = outputCategory(output);
      const status = ["AUTHORIZATION", "NETWORK", "PROCESS_INTERRUPTED"].includes(category) || label === "로컬 admission 재검증" ? "BLOCKED" : "FAIL";
      throw Object.assign(new Error(`${status}: ${label} 명령이 실패했습니다.`), { stage: label, exitCode: output.status, category });
    }
    return output;
  };
  const stable = () => {
    require(source().fingerprint === result.sourceStart.fingerprint && environment().fingerprint === result.environmentStart.fingerprint, "source 또는 환경이 변경되었습니다.");
  };
  try {
    require(["plan", "verify", "publish"].includes(mode), "지원하지 않는 게시 모드입니다.");
    sink = createPrivateEvidenceSink(root, options.privateLogDir);
    result.evidenceAttemptId = sink.attemptId;
    result.sourceStart = source(); result.environmentStart = environment();
    result.plan = createPublishPlan({ source: result.sourceStart, repository: options.repository });
    if (mode === "plan") return result;
    require(Number.isSafeInteger(issue) && issue > 0 && reports.length > 0, "Issue와 실제 로컬 보고서가 필요합니다.");
    checkedArtifactPath(root, resolve(reportDir, "publish-receipt.json"), { mustExist: false });
    lock = resolve(root, ".prepr-reports", "local-publish.lock");
    lockFd = openSync(lock, "wx", 0o600);
    writeFileSync(lockFd, JSON.stringify({ pid: process.pid, source: result.plan.sourceHead }));
    (injected.tool ?? validateOrasBinary)(oras);
    const auth = (injected.auth ?? validateAuthFile)(root, authFile);
    const authHash = fileSha256(auth);
    const executableHash = fileSha256(oras);
    const admissionDir = resolve(reportDir, "admission");
    const args = ["scripts/verify-prepr.mjs", "--mode=admit", `--base=${base}`, `--issue=${issue}`, `--report-dir=${relative(root, admissionDir)}`, ...reports.map((path) => `--reports=${path}`), ...includes.map((path) => `--include=${path}`)];
    await run("로컬 admission 재검증", "node", args);
    const admission = JSON.parse(readFileSync(checkedArtifactPath(root, resolve(admissionDir, "report.json")), "utf8"));
    require(admission.status === "PASS" && admission.admission?.publishAllowed === true && admission.integritySha256 === reportChecksum(admission) && admission.sourceStart?.fingerprint === result.sourceStart.fingerprint && admission.environmentStart?.fingerprint === result.environmentStart.fingerprint, "admission PASS/동일 source·환경을 확인하지 못했습니다.");
    result.admissionSha256 = fileSha256(resolve(admissionDir, "report.json"));
    const reportHashes = reports.map((path) => ({ path: checkedArtifactPath(root, resolve(root, path)), sha256: fileSha256(resolve(root, path)) }));
    const history = reportInventory(root);
    const receipts = reportHashes.map(({ path }) => JSON.parse(readFileSync(path, "utf8")));
    const docker = receipts.filter((report) => report.mode === "docker" && report.sourceStart?.fingerprint === result.sourceStart.fingerprint).sort((a, b) => Date.parse(b.completedAt) - Date.parse(a.completedAt))[0];
    require(docker?.status === "PASS" && docker.integritySha256 === reportChecksum(docker), "최신 Docker PASS 보고서가 필요합니다.");
    const latestDocker = history.map(({ path }) => JSON.parse(readFileSync(path, "utf8"))).filter((report) => report.mode === "docker" && report.sourceStart?.fingerprint === result.sourceStart.fingerprint).sort((a, b) => Date.parse(b.completedAt) - Date.parse(a.completedAt))[0];
    require(latestDocker?.integritySha256 === docker.integritySha256, "현재 최신 Docker 보고서를 명시해야 합니다.");
    const version = JSON.parse(readFileSync(resolve(root, "package.json"))).version;
    const image = docker.dockerImage;
    const check = () => {
      stable();
      require(fileSha256(auth) === authHash && fileSha256(oras) === executableHash, "인증 파일 또는 ORAS bytes가 변경되었습니다.");
      require(fileSha256(resolve(admissionDir, "report.json")) === result.admissionSha256 && reportHashes.every(({ path, sha256 }) => fileSha256(path) === sha256), "검증 보고서 bytes가 변경되었습니다.");
      require(JSON.stringify(reportInventory(root)) === JSON.stringify(history), "검증 이력이 실행 중 변경되었습니다.");
      validateImage({ root, image, source: result.sourceStart, version });
    };
    check();
    result.image = image;
    const versionOutput = await run("ORAS 버전", oras, ["version"]);
    const cp = await run("ORAS cp 옵션", oras, ["cp", "--help"]);
    const fetch = await run("ORAS fetch 옵션", oras, ["manifest", "fetch", "--help"]);
    const tagsHelp = await run("ORAS tags 옵션", oras, ["repo", "tags", "--help"]);
    validateOrasHelp(versionOutput.stdout, cp.stdout, fetch.stdout, tagsHelp.stdout);
    const remote = async () => assertRemoteHead((await run("원격 main 확인", "git", ["ls-remote", "--exit-code", "https://github.com/planner77/masterGantt.git", "refs/heads/main"])).stdout, result.sourceStart.headSha);
    const absent = async () => {
      const tags = await run("인증된 태그 목록", oras, ["repo", "tags", "--registry-config", auth, "--format", "json", result.plan.repository]);
      const descriptor = await run("SHA 태그 충돌 확인", oras, ["manifest", "fetch", "--descriptor", "--registry-config", auth, result.plan.tag], true);
      assertTagAbsent(tags.stdout, descriptor, result.plan.tag);
    };
    await remote(); await absent(); check();
    if (mode === "verify") { result.status = "PASS"; result.publicationEligibility = "PASS"; return result; }
    // Recheck immediately before the only registry write; never promote/delete tags.
    await remote(); await absent(); check();
    const archive = checkedArtifactPath(root, resolve(root, image.ociArchive));
    result.registryWriteAttempted = true;
    result.tagState = "UNKNOWN";
    await run("동일 OCI 게시", oras, ["cp", "--from-oci-layout", "--recursive", "--to-registry-config", auth, `${archive}@${image.ociIndexDigest}`, result.plan.tag]);
    result.published = true;
    result.tagState = "CREATED";
    check(); await remote();
    const descriptor = JSON.parse((await run("게시 index readback", oras, ["manifest", "fetch", "--descriptor", "--registry-config", auth, result.plan.tag])).stdout);
    contract(descriptor.digest === image.ociIndexDigest, "게시 index digest가 다릅니다.");
    const reference = `${result.plan.repository}@${image.ociIndexDigest}`;
    const destination = resolve(reportDir, "registry-layout");
    require(!existsSync(destination), "기존 graph 디렉터리를 덮어쓰지 않습니다.");
    await run("정확 digest OCI graph Pull", oras, ["cp", "--recursive", "--from-registry-config", auth, "--to-oci-layout", reference, `${destination}:verified`]);
    result.graph = verifyGraph ? verifyGraph({ archive, destination, digest: image.ociIndexDigest }) : JSON.parse((await run("OCI graph bytes 검산", "python3", ["-c", GRAPH_CHECK, archive, destination, image.ociIndexDigest])).stdout);
    contract(result.graph?.status === "PASS", "OCI graph 검증이 실패했습니다.");
    check(); await remote();
    result.runtime = await smoke({ root, authFile: auth, reference, image, source: result.sourceStart, run });
    contract(result.runtime?.status === "PASS", "정확 digest runtime 검증이 실패했습니다.");
    await remote(); check();
    contract(JSON.parse((await run("최종 태그 index 확인", oras, ["manifest", "fetch", "--descriptor", "--registry-config", auth, result.plan.tag])).stdout).digest === image.ociIndexDigest, "최종 태그 digest가 변경되었습니다.");
    result.status = "PASS";
    result.publicationEligibility = "PASS";
    result.tagState = "VERIFIED";
  } catch (error) {
    result.status = error.message?.startsWith("FAIL:") ? "FAIL" : "BLOCKED";
    result.publicationEligibility = "BLOCKED";
    result.failure = { status: result.status, stage: error.stage ?? result.steps.at(-1)?.label ?? "사전조건", exitCode: error.exitCode ?? null, category: error.category ?? "CONTRACT", cleanupFailed: error.cleanupFailed === true };
    // Do not serialize arbitrary tool exceptions which may contain credentials.
    result.errors.push(/^(?:BLOCKED|FAIL):/.test(error.message ?? "") ? error.message : "BLOCKED: 로컬 게시 사전조건 또는 실행에 실패했습니다.");
  } finally {
    if (result.sourceStart) {
      try { result.sourceEnd = source(); result.environmentEnd = environment(); result.sourceStable = result.sourceEnd.fingerprint === result.sourceStart.fingerprint; result.environmentStable = result.environmentEnd.fingerprint === result.environmentStart.fingerprint; stable(); }
      catch { if (result.status !== "FAIL") result.status = "BLOCKED"; result.publicationEligibility = "BLOCKED"; result.errors.push("BLOCKED: 종료 시 source·환경 안정성을 확인하지 못했습니다."); }
    }
    if (lockFd !== null) { closeSync(lockFd); rmSync(lock); }
    result.completedAt = new Date().toISOString();
    result.integritySha256 = reportChecksum(result);
  }
  return result;
}

export function createPublishReportDirectory(root, requested) {
  const path = resolve(root, requested || `.prepr-reports/publish-${new Date().toISOString().replaceAll(":", "-")}-${randomUUID()}`);
  checkedArtifactPath(root, resolve(path, "publish-receipt.json"), { mustExist: false });
  require(!existsSync(path), "기존 게시 보고서를 덮어쓰지 않습니다.");
  mkdirSync(path, { recursive: true });
  return path;
}
