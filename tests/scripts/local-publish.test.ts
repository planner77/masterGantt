import { execFileSync } from "node:child_process";
import { createDecipheriv, createHash } from "node:crypto";
import { chmodSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { assertRemoteHead, assertTagAbsent, createPrivateEvidenceSink, createPublishPlan, createPublishReportDirectory, ORAS_BINARY_SHA256, preserveProcessEvidence, publishLocalImage, registryRuntimeSmoke, validateAuthFile, validateOrasBinary, validateOrasHelp, verifyCopiedGraph } from "../../scripts/local-publish-core.mjs";
import type { PublishDependencies, ProcessOutput } from "../../scripts/local-publish-core.mjs";
import { reportChecksum } from "../../scripts/prepr-core.mjs";
import type { sourceEvidence, environmentEvidence } from "../../scripts/prepr-core.mjs";

const roots: string[] = [];
afterEach(() => { for (const path of roots.splice(0)) rmSync(path, { recursive: true, force: true }); });
function directory() { const root = mkdtempSync(resolve(tmpdir(), "mastergantt-publish-")); roots.push(root); return root; }
const head = "a".repeat(40), digest = "sha256:" + "b".repeat(64);
const source: ReturnType<typeof sourceEvidence> = { baseRef: "baseline", baseSha: "c".repeat(40), headSha: head, workingDiffSha256: "d".repeat(64), fingerprint: "e".repeat(64), dirty: false, changed: ["scripts/local-publish-core.mjs"], contentSha256: "f".repeat(64), indexSha256: "1".repeat(64), fixtureSha256: "2".repeat(64), packageLockSha256: "3".repeat(64), actualMatchesHead: true };
const environment: ReturnType<typeof environmentEvidence> = { node: "v22.14.0", npm: "11.10.0", osRelease: "synthetic", abi: "127", platform: "linux", architecture: "x64", environmentSha256: "4".repeat(64), inputs: {}, fingerprint: "5".repeat(64), invocationTraceSha256: null };
const cpHelp = "--from-oci-layout --to-oci-layout --recursive --to-registry-config --from-registry-config";
const fetchHelp = "--descriptor --registry-config", tagsHelp = "--format --registry-config";
function fixture() {
  const root = directory(), credentials = directory();
  const reportDir = createPublishReportDirectory(root, ".prepr-reports/publish");
  const dockerDir = resolve(root, ".prepr-reports/docker"); mkdirSync(dockerDir);
  writeFileSync(resolve(root, "package.json"), JSON.stringify({ version: "0.145.1" }));
  const authFile = resolve(credentials, "config.json");
  writeFileSync(authFile, JSON.stringify({ auths: { "ghcr.io": { auth: Buffer.from("synthetic-user:synthetic-private-secret").toString("base64") } } }), { mode: 0o600 });
  const oras = resolve(credentials, "oras"); writeFileSync(oras, "synthetic tool bytes");
  const image = { ociArchive: ".prepr-reports/docker/image.oci.tar", ociIndexDigest: digest, id: "sha256:" + "6".repeat(64) };
  writeFileSync(resolve(root, image.ociArchive), "synthetic archive bytes");
  const receipt = { mode: "docker", status: "PASS", sourceStart: source, completedAt: "2026-11-11T00:00:00Z", dockerImage: image, integritySha256: "" };
  receipt.integritySha256 = reportChecksum(receipt);
  writeFileSync(resolve(dockerDir, "report.json"), JSON.stringify(receipt));
  const calls: Array<{command: string; args: string[]}> = [];
  let published = false, smokeCalls = 0, graphCalls = 0;
  const success = (stdout = ""): ProcessOutput => ({ status: 0, stdout, stderr: "" });
  const dependencies: PublishDependencies = {
    source: () => ({ ...source }), environment: () => ({ ...environment }), tool: () => {},
    validateImage: () => ({}) as ReturnType<NonNullable<PublishDependencies["validateImage"]>>,
    verifyGraph: () => { graphCalls++; return { status: "PASS", blobs: 11, indexDigest: digest }; },
    smoke: async () => { smokeCalls++; return { status: "PASS" }; },
    process: (command, args) => {
      calls.push({ command, args });
      if (command === "node") {
        const path = args.find((arg) => arg.startsWith("--report-dir="))!.slice("--report-dir=".length);
        mkdirSync(resolve(root, path));
        const admission = { status: "PASS", admission: { publishAllowed: true }, sourceStart: source, environmentStart: environment, integritySha256: "" };
        admission.integritySha256 = reportChecksum(admission);
        writeFileSync(resolve(root, path, "report.json"), JSON.stringify(admission));
        return success();
      }
      if (command === "git") return success(`${head}\trefs/heads/main\n`);
      if (args[0] === "version") return success("Version:        1.3.6\n");
      if (args.includes("--help")) return success(args[0] === "cp" ? cpHelp : args[0] === "manifest" ? fetchHelp : tagsHelp);
      if (args[0] === "repo") return success(JSON.stringify({ tags: ["stable", "rollback", "0.145.0"] }));
      if (args[0] === "manifest") return published ? success(JSON.stringify({ digest })) : { status: 1, stdout: "", stderr: `Error response from registry: failed to find "${args.at(-1)}": ${args.at(-1)}: not found\n` };
      if (args[0] === "cp") { if (args.includes("--from-oci-layout")) published = true; return success(); }
      throw new Error("unexpected synthetic command");
    },
  };
  const options = { root, base: source.baseSha, issue: 909, reports: [".prepr-reports/docker/report.json"], oras, authFile, privateLogDir: resolve(credentials, "encrypted-evidence"), reportDir, mode: "publish" };
  return { root, options, dependencies, calls, receipt, image, counters: () => ({ smokeCalls, graphCalls }), success };
}
describe("#909 로컬 단일 OCI 수동 게시", () => {
  it("기본 plan은 프로세스/인증/registry를 호출하지 않고 source SHA 고유 tag만 만든다", async () => {
    const f = fixture();
    const result = await publishLocalImage({ ...f.options, mode: "plan" }, f.dependencies);
    expect(result.status).toBe("NOT TESTED"); expect(result.plan?.tag).toBe(`ghcr.io/planner77/mastergantt:sha-${head}`);
    expect(f.calls).toEqual([]); expect(result.registryWriteAttempted).toBe(false);
    expect(() => createPublishPlan({ source, repository: "ghcr.io/other/other:latest" })).toThrow();
    for (const invalid of [{ ...source, dirty: true }, { ...source, actualMatchesHead: false }]) expect(() => createPublishPlan({ source: invalid })).toThrow();
  });
  it("실패 원문을 실행별 AES-GCM으로 정확 보존하고 plaintext·재사용·wrongAAD를 차단한다", () => {
    const root = directory(), parent = directory(), path = resolve(parent, "private-evidence");
    const sink = createPrivateEvidenceSink(root, path);
    const stderr = "provider unknown flag --registry-config; synthetic-token-never-plaintext";
    const output = { status: 1, stdout: "", stderr };
    const proofs = preserveProcessEvidence(sink, { stepId: "step-0001", head, output });
    const metadata = JSON.parse(readFileSync(resolve(path, "step-0001-stderr.json"), "utf8"));
    const ciphertext = readFileSync(resolve(path, "step-0001-stderr.enc"));
    const decipher = createDecipheriv("aes-256-gcm", readFileSync(resolve(path, "keys/evidence.key")), Buffer.from(metadata.nonce, "hex"));
    decipher.setAuthTag(Buffer.from(metadata.tag, "hex")); decipher.setAAD(Buffer.from(metadata.aad));
    expect(Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString()).toBe(stderr);
    const wrong = createDecipheriv("aes-256-gcm", sink.key, Buffer.from(metadata.nonce, "hex"));
    wrong.setAuthTag(Buffer.from(metadata.tag, "hex")); wrong.setAAD(Buffer.from(metadata.aad.replace(head, "0".repeat(40))));
    expect(() => Buffer.concat([wrong.update(ciphertext), wrong.final()])).toThrow();
    expect(lstatSync(path).mode & 0o777).toBe(0o700);
    for (const name of readdirSync(path).filter((name) => name !== "keys")) {
      const file = resolve(path, name); expect(lstatSync(file).mode & 0o777).toBe(0o600);
      expect(readFileSync(file).includes(Buffer.from(stderr))).toBe(false);
    }
    expect(lstatSync(resolve(path, "keys/evidence.key")).mode & 0o777).toBe(0o600);
    expect(JSON.stringify(proofs)).not.toContain(stderr);
    expect(() => preserveProcessEvidence(sink, { stepId: "step-0001", head, output: { ...output, stderr: "replacement" } })).toThrow();
    expect(readFileSync(resolve(path, "step-0001-stderr.enc"))).toEqual(ciphertext);
    expect(() => createPrivateEvidenceSink(root, path)).toThrow(/재사용/);
    expect(() => createPrivateEvidenceSink(root, resolve(root, "inside"))).toThrow(/밖/);
    const linked = resolve(parent, "link"); symlinkSync(root, linked, "dir");
    expect(() => createPrivateEvidenceSink(root, resolve(linked, "child"))).toThrow(/ancestor/);
    const otherGit = directory(); writeFileSync(resolve(otherGit, ".git"), "synthetic git worktree marker");
    expect(() => createPrivateEvidenceSink(root, resolve(otherGit, "logs"))).toThrow(/다른 Git/);
  });
  it("실제 첫 실패 stage/category/exit와 암호화 원문을 보존하며 후속 cp는 실행하지 않는다", async () => {
    const f = fixture();
    f.dependencies.process = () => ({ status: 1, stdout: "", stderr: "unknown flag --registry-config; synthetic-secret-in-memory" });
    const result = await publishLocalImage(f.options, f.dependencies);
    expect(result.status).toBe("BLOCKED"); expect(result.steps).toHaveLength(1);
    expect(result.steps[0]).toMatchObject({ label: "로컬 admission 재검증", category: "UNSUPPORTED_OPTION", exitCode: 1 });
    expect(result.steps[0].evidence).toHaveLength(2);
    expect(JSON.stringify(result)).not.toContain("synthetic-secret-in-memory");
    expect(readFileSync(resolve(f.options.privateLogDir, "step-0001-stderr.enc")).includes(Buffer.from("synthetic-secret-in-memory"))).toBe(false);
    expect(result.registryWriteAttempted).toBe(false);
  });
  it("실제 바이트 해시로 검증도구를 결속하고 인증 파일을 외부0600 일반파일로 제한한다", () => {
    const f = fixture();
    expect(validateAuthFile(f.root, f.options.authFile)).toBe(f.options.authFile);
    chmodSync(f.options.authFile, 0o644); expect(() => validateAuthFile(f.root, f.options.authFile)).toThrow(/0600/);
    chmodSync(f.options.authFile, 0o600);
    const link = resolve(directory(), "config.json"); symlinkSync(f.options.authFile, link); expect(() => validateAuthFile(f.root, link)).toThrow(/symlink/);
    const inside = resolve(f.root, "config.json"); writeFileSync(inside, readFileSync(f.options.authFile), { mode: 0o600 }); expect(() => validateAuthFile(f.root, inside)).toThrow(/저장소 밖/);
    expect(ORAS_BINARY_SHA256).toMatch(/^[a-f0-9]{64}$/); expect(() => validateOrasBinary(f.options.oras)).toThrow(/checksum/);
    expect(() => createPublishReportDirectory(f.root, "../escape")).toThrow();
    expect(() => createPublishReportDirectory(f.root, ".prepr-reports/publish")).toThrow();
  });
  it("F019 ORAS cp 목적지 인증 옵션을 실제 subcommand 계약과 대조한다", () => {
    expect(() => validateOrasHelp("Version: 1.3.6", cpHelp, fetchHelp, tagsHelp)).not.toThrow();
    expect(() => validateOrasHelp("Version: 1.3.6", cpHelp.replace("--to-registry-config", "--registry-config"), fetchHelp, tagsHelp)).toThrow(/to-registry-config/);
    expect(() => validateOrasHelp("Version: 1.3.7", cpHelp, fetchHelp, tagsHelp)).toThrow(/버전/);
  });
  it.each(["unauthorized 401", "denied 403", "connection refused", "timeout", "404 missing route", "<html>404 Not Found</html>", "429 Too Many Requests", "500 Internal Server Error", "503 Service Unavailable", "NAME_UNKNOWN: repository not found", "manifest unknown: not found (404)"])("%s는 태그 부재로 위장할 수 없다", (stderr) => {
    expect(() => assertTagAbsent('{"tags":[]}', { status: 1, stderr }, `ghcr.io/planner77/mastergantt:sha-${head}`)).toThrow();
  });
  it("실제 pinned ORAS 부재 오류의 두 exact reference와 인증된 repo inventory에 결속한다", () => {
    const tag = `ghcr.io/planner77/mastergantt:sha-${head}`;
    const stderr = `Error response from registry: failed to find "${tag}": ${tag}: not found\n`;
    expect(() => assertTagAbsent('{"tags":["stable","rollback"]}', { status: 1, stderr }, tag)).not.toThrow();
    for (const altered of [stderr.replace(tag, "ghcr.io/other/missing:sha-" + head), stderr.replaceAll(tag, "ghcr.io/other/missing:sha-" + head), stderr + "503 Service Unavailable\n", stderr.replace(": not found", ": unauthorized 401"), "not found\n"]) {
      expect(() => assertTagAbsent('{"tags":[]}', { status: 1, stderr: altered }, tag)).toThrow();
    }
    expect(() => assertTagAbsent('{"tags":null}', { status: 1, stderr }, tag)).toThrow();
    expect(() => assertTagAbsent(`{"tags":["sha-${head}"]}`, { status: 1, stderr }, tag)).toThrow(/덮어쓰지/);
    expect(() => assertTagAbsent('{"tags":[]}', { status: null, stderr, signal: "SIGTERM" }, tag)).toThrow();
    expect(() => assertTagAbsent('{"tags":[]}', { status: 1, stderr, error: { code: "ETIMEDOUT" } }, tag)).toThrow();
  });
  it("태그 존재/성공조회/원격main 이동은 모두 차단한다", () => {
    expect(() => assertTagAbsent('{"tags":["sha-test"]}', { status: 1, stderr: "manifest unknown 404" }, "ghcr.io/planner77/mastergantt:sha-test")).toThrow(/덮어쓰지/);
    expect(() => assertTagAbsent('{"tags":[]}', { status: 0 }, "ghcr.io/planner77/mastergantt:sha-test")).toThrow();
    expect(() => assertRemoteHead(`${"0".repeat(40)}\trefs/heads/main\n`, head)).toThrow();
    expect(() => assertRemoteHead(`${head}\trefs/heads/main\n${head}\trefs/heads/other`, head)).toThrow();
  });
  it("같은 OCI@digest만 한번 게시하고 exactgraph와runtime PASS 뒤에만 최종 PASS한다", async () => {
    const f = fixture(), result = await publishLocalImage(f.options, f.dependencies);
    expect(result.status).toBe("PASS"); expect(result.registryWriteAttempted).toBe(true); expect(result.published).toBe(true);
    const writes = f.calls.filter((call) => call.args.includes("--from-oci-layout"));
    expect(writes).toHaveLength(1); expect(writes[0].args).toContain("--to-registry-config"); expect(writes[0].args).not.toContain("--registry-config");
    expect(writes[0].args).toContain(`${resolve(f.root, f.image.ociArchive)}@${digest}`);
    expect(f.calls.filter((call) => call.args.includes("--to-oci-layout"))[0].args).toContain(`ghcr.io/planner77/mastergantt@${digest}`);
    expect(f.counters()).toEqual({ smokeCalls: 1, graphCalls: 1 });
    expect(JSON.stringify(result)).not.toContain("synthetic-private-secret"); expect(JSON.stringify(result)).not.toContain(f.options.authFile);
    expect(result.integritySha256).toBe(reportChecksum(result));
    expect(f.calls.some((call) => call.args.some((arg) => /^(?:push|build|delete|logout|login|tag)$/.test(arg)))).toBe(false);
  });
  it("verify는 모든 사전조건을 검사하되 cp/runtime을 실행하지 않는다", async () => {
    const f = fixture(), result = await publishLocalImage({ ...f.options, mode: "verify" }, f.dependencies);
    expect(result.status).toBe("PASS"); expect(result.registryWriteAttempted).toBe(false); expect(f.calls.some((call) => call.args[0] === "cp" && !call.args.includes("--help"))).toBe(false);
    expect(f.counters().smokeCalls).toBe(0);
  });
  it.each(["admission", "OCI", "source", "environment", "remote", "auth", "collision", "offline"])("%s 실패는 registry write 전에 차단한다", async (failure) => {
    const f = fixture(), processRun = f.dependencies.process!;
    let snapshots = 0;
    if (failure === "source") f.dependencies.source = () => ({ ...source, fingerprint: ++snapshots > 1 ? "changed" : source.fingerprint });
    if (failure === "environment") f.dependencies.environment = () => ({ ...environment, fingerprint: ++snapshots > 1 ? "changed" : environment.fingerprint });
    if (failure === "OCI") f.dependencies.validateImage = () => { throw new Error("tampered archive"); };
    f.dependencies.process = async (command, args, context) => {
      if (failure === "admission" && command === "node") return { status: 1, stdout: "", stderr: "missing evidence" };
      if (failure === "remote" && command === "git") return f.success("0".repeat(40) + "\trefs/heads/main");
      if (failure === "auth" && args[0] === "repo") return { status: 1, stdout: "", stderr: "denied" };
      if (failure === "offline" && args[0] === "manifest" && !args.includes("--help")) return { status: 1, stdout: "", stderr: "connection refused" };
      if (failure === "collision" && args[0] === "repo" && !args.includes("--help")) return f.success(JSON.stringify({ tags: ["sha-" + head] }));
      return await processRun(command, args, context);
    };
    const result = await publishLocalImage(f.options, f.dependencies);
    expect(result.status).toBe("BLOCKED"); expect(result.registryWriteAttempted).toBe(false); expect(f.counters().smokeCalls).toBe(0);
  });
  it.each(["digest", "graph", "runtime"])("게시 후 %s 실패는 후속 단계와 최종PASS를 차단하고 게시한 tag를 삭제하지 않는다", async (failure) => {
    const f = fixture(), processRun = f.dependencies.process!;
    if (failure === "graph") f.dependencies.verifyGraph = () => { throw new Error("FAIL: graph mismatch"); };
    if (failure === "runtime") f.dependencies.smoke = async () => ({ status: "FAIL" });
    if (failure === "digest") f.dependencies.process = async (command, args, context) => {
      const output = await processRun(command, args, context);
      return args[0] === "manifest" && output.status === 0 && !args.includes("--help") ? f.success(JSON.stringify({ digest: "sha256:" + "0".repeat(64) })) : output;
    };
    const result = await publishLocalImage(f.options, f.dependencies);
    expect(result.status).toBe("FAIL"); expect(result.publicationEligibility).toBe("BLOCKED"); expect(result.published).toBe(true); expect(result.registryWriteAttempted).toBe(true);
    if (failure !== "runtime") expect(f.counters().smokeCalls).toBe(0);
    expect(f.calls.some((call) => call.args.includes("delete"))).toBe(false);
  });
  it("게시 중 source drift는 게시 사실을 남기고 graph/runtime 이전에 차단한다", async () => {
    const f = fixture(), processRun = f.dependencies.process!;
    let changed = false;
    f.dependencies.source = () => ({ ...source, fingerprint: changed ? "drifted" : source.fingerprint });
    f.dependencies.process = async (command, args, context) => { const output = await processRun(command, args, context); if (args.includes("--from-oci-layout") && !args.includes("--help")) changed = true; return output; };
    const result = await publishLocalImage(f.options, f.dependencies);
    expect(result.status).toBe("BLOCKED"); expect(result.published).toBe(true); expect(f.counters()).toEqual({ smokeCalls: 0, graphCalls: 0 });
  });
  it.each(["nested", "flat"])("%s OCI의 실제 directory/blob hash·size·root bytes를 검사한다", (format) => {
    const root = directory(), archive = resolve(root, "source.tar"), destination = resolve(root, "layout");
    const bytes = "synthetic-graph-blob", blob = createHash("sha256").update(bytes).digest("hex");
    const rootBytes = JSON.stringify({ schemaVersion: 2, manifests: [{ digest: "sha256:" + blob }] });
    const rootHash = createHash("sha256").update(rootBytes).digest("hex"), rootDigest = "sha256:" + rootHash;
    execFileSync("python3", ["-c", "import io,tarfile,sys\np,b,h,r,rh,fmt=sys.argv[1:]\nwith tarfile.open(p,'w') as t:\n for n in ['blobs','blobs/sha256']:\n  m=tarfile.TarInfo(n);m.type=tarfile.DIRTYPE;t.addfile(m)\n for n,d in [('blobs/sha256/'+h,b.encode())]+([('blobs/sha256/'+rh,r.encode())] if fmt=='nested' else []):\n  m=tarfile.TarInfo(n);m.size=len(d);t.addfile(m,io.BytesIO(d))", archive, bytes, blob, rootBytes, rootHash, format]);
    mkdirSync(resolve(destination, "blobs/sha256"), { recursive: true });
    writeFileSync(resolve(destination, "blobs/sha256", blob), bytes);
    writeFileSync(resolve(destination, "blobs/sha256", rootHash), rootBytes);
    writeFileSync(resolve(destination, "index.json"), JSON.stringify({ manifests: [{ digest: rootDigest }] }));
    expect(verifyCopiedGraph({ archive, destination, digest: rootDigest })).toMatchObject({ status: "PASS", blobs: format === "nested" ? 2 : 1, indexDigest: rootDigest });
    rmSync(resolve(destination, "blobs/sha256", rootHash));
    expect(() => verifyCopiedGraph({ archive, destination, digest: rootDigest })).toThrow(/graph/);
    writeFileSync(resolve(destination, "blobs/sha256", rootHash), "forged root bytes");
    expect(() => verifyCopiedGraph({ archive, destination, digest: rootDigest })).toThrow(/graph/);
    writeFileSync(resolve(destination, "blobs/sha256", rootHash), rootBytes);
    writeFileSync(resolve(destination, "blobs/sha256", blob), "tampered");
    expect(() => verifyCopiedGraph({ archive, destination, digest: rootDigest })).toThrow(/graph/);
  });
  it.each(["PASS", "API_FAIL", "IDENTITY_FAIL"])("실제 runtime orchestration %s에서 같은 digest/소유 ID만 사용하고 실패시도 소유 자원만 정리한다", async (scenario) => {
    const f = fixture(), id = "7".repeat(64), calls: string[][] = [];
    let owner = "";
    const options = {
      root: f.root, authFile: f.options.authFile, reference: `ghcr.io/planner77/mastergantt@${digest}`,
      image: f.image as Parameters<typeof registryRuntimeSmoke>[0]["image"], source,
      inspectEndpoint: () => ({ id: scenario === "IDENTITY_FAIL" ? "8".repeat(64) : id, image: f.image.id, baseUrl: "http://127.0.0.1:32770" }),
      run: async (label: string, command: string, args: string[]) => {
        calls.push([command, ...args]);
        if (label === "Pull 이미지 identity") return f.success(JSON.stringify({ Id: f.image.id, Os: "linux", Architecture: "amd64", Config: { Labels: { "org.opencontainers.image.revision": head, "org.opencontainers.image.source": "https://github.com/planner77/masterGantt" } } }));
        if (label === "격리 runtime 시작") { owner = args[args.indexOf("--label") + 1].split("=")[1]; return f.success(id); }
        if (label === "소유 container 확인") return f.success(JSON.stringify({ Id: id, Config: { Labels: { "mastergantt.local-publish": owner } } }));
        if (label === "격리 API·권한·SQLite 재시작" && scenario === "API_FAIL") throw new Error("synthetic API failure");
        return f.success();
      },
    };
    if (scenario === "PASS") expect((await registryRuntimeSmoke(options)).status).toBe("PASS");
    else await expect(registryRuntimeSmoke(options)).rejects.toThrow();
    expect(calls[0]).toContain(options.reference);
    expect(calls.find((call) => call.includes("run"))).toContain("--pull=never");
    expect(calls.at(-1)).toEqual(["docker", "rm", "--force", "--volumes", id]);
    expect(calls.some((call) => call.includes("image") && call.includes("rm"))).toBe(false);
  });
});
