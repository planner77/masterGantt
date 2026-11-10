import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { BUILDKIT_IMAGE, SBOM_GENERATOR, checkedArtifactPath, createBuildPlan, createDockerLoadArchive, validateImageIdentity, validateOciArchive } from "../../scripts/prepr-docker.mjs";
import type { sourceEvidence } from "../../scripts/prepr-core.mjs";

const revision = "a".repeat(40);
const version = "0.145.1";
const roots: string[] = [];
const source: ReturnType<typeof sourceEvidence> = { baseRef: "baseline", baseSha: "b".repeat(40), headSha: revision, workingDiffSha256: "1".repeat(64), fingerprint: "2".repeat(64), dirty: false, changed: ["scripts/prepr-docker.mjs"], contentSha256: "3".repeat(64), indexSha256: "4".repeat(64), fixtureSha256: "5".repeat(64), packageLockSha256: "6".repeat(64), actualMatchesHead: true };
function setup() {
  const root = mkdtempSync(resolve(tmpdir(), "mastergantt-docker-evidence-"));
  roots.push(root);
  const reportDir = resolve(root, ".prepr-reports", "run");
  mkdirSync(reportDir, { recursive: true });
  return { root, reportDir, archive: resolve(reportDir, "fixture.oci.tar") };
}
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });

// This is deliberately synthetic parser evidence, never a build/runtime PASS.
const fixture = String.raw`
import gzip,hashlib,io,json,sys,tarfile
p,rev,ver,options=sys.argv[1:]
o=json.loads(options)
blobs={}
def blob(data,kind):
 b=data if isinstance(data,bytes) else json.dumps(data,separators=(',',':'),sort_keys=True).encode()
 h=hashlib.sha256(b).hexdigest();blobs['blobs/sha256/'+h]=b
 return {'mediaType':kind,'digest':'sha256:'+h,'size':len(b)}
config=blob({'architecture':'amd64','os':'linux','config':{'User':'1001','Labels':{'org.opencontainers.image.revision':rev,'org.opencontainers.image.source':'https://github.com/planner77/masterGantt','org.opencontainers.image.version':ver}},'rootfs':{'type':'layers','diff_ids':['sha256:'+('0'*64 if o.get('wrong_diffid') else hashlib.sha256(b'synthetic-layer').hexdigest())]}},'application/vnd.oci.image.config.v1+json')
layer=blob(gzip.compress(b'synthetic-layer') if o.get('gzip_layer') else b'synthetic-layer','application/vnd.oci.image.layer.v1.tar+gzip' if o.get('gzip_layer') else ('application/vnd.oci.image.layer.v1.tar+zstd' if o.get('unsupported_compression') else 'application/vnd.oci.image.layer.v1.tar'))
runtime=blob({'schemaVersion':2,'mediaType':'application/vnd.oci.image.manifest.v1+json','config':config,'layers':[layer]},'application/vnd.oci.image.manifest.v1+json')
prov={'buildType':'https://mobyproject.org/buildkit@v1','materials':[{'uri':'pkg:docker/node','digest':{'sha256':'f'*64}}]}
if o.get('empty_provenance'):prov={}
if o.get('empty_materials'):prov['materials']=[]
if o.get('wrong_builder'):prov['buildType']='https://example.invalid/self-report'
sbom={'spdxVersion':'SPDX-2.3','SPDXID':'SPDXRef-DOCUMENT','creationInfo':{'creators':['Tool: syft-test-fixture']},'packages':[{'name':'synthetic'}]}
if o.get('empty_sbom'):sbom={'spdxVersion':'SPDX-2.3'}
layers=[]
for kind,predicate in [('https://slsa.dev/provenance/v0.2',prov),('https://spdx.dev/Document',sbom)]:
 if o.get('omit_sbom') and 'spdx' in kind:continue
 if o.get('provenance_v1') and 'slsa' in kind:
  kind='https://slsa.dev/provenance/v1'
  predicate={'buildDefinition':{'buildType':('https://example.invalid/self-report' if o.get('wrong_builder') else 'https://github.com/moby/buildkit/blob/master/docs/attestations/slsa-definitions.md'),'resolvedDependencies':prov.get('materials')},'runDetails':{'builder':{'id':''}}}
 statement={'_type':'https://in-toto.io/Statement/v0.1','subject':[{'name':'synthetic','digest':{'sha256':('0'*64 if o.get('wrong_subject') else runtime['digest'][7:])}}],'predicateType':kind,'predicate':predicate}
 layers.append(blob(statement,'application/vnd.in-toto+json'))
ac=blob({'architecture':'unknown','os':'unknown','rootfs':{'type':'layers','diff_ids':[]}},'application/vnd.oci.image.config.v1+json')
att=blob({'schemaVersion':2,'mediaType':'application/vnd.oci.image.manifest.v1+json','config':ac,'layers':layers},'application/vnd.oci.image.manifest.v1+json')
runtime['platform']={'os':'linux','architecture':'amd64'}
att['platform']={'os':'unknown','architecture':'unknown'}
att['annotations']={'vnd.docker.reference.type':'attestation-manifest','vnd.docker.reference.digest':runtime['digest']}
nested=blob({'schemaVersion':2,'mediaType':'application/vnd.oci.image.index.v1+json','manifests':[runtime,att]},'application/vnd.oci.image.index.v1+json')
nested['annotations']={'org.opencontainers.image.ref.name':'fixture'}
index=json.dumps({'schemaVersion':2,'mediaType':'application/vnd.oci.image.index.v1+json','manifests':[nested]},sort_keys=True).encode()
if o.get('missing_layer'):del blobs['blobs/sha256/'+layer['digest'][7:]]
if o.get('tamper_blob'):blobs['blobs/sha256/'+layer['digest'][7:]]=b'wrong-bytes'
entries={'oci-layout':b'{"imageLayoutVersion":"1.0.0"}','index.json':index,**blobs}
if o.get('unsafe_path'):entries['../unsafe']=b'no'
with tarfile.open(p,'w') as t:
 for name,b in entries.items():
  m=tarfile.TarInfo(name);m.size=len(b);t.addfile(m,io.BytesIO(b))
 if o.get('symlink'):
  m=tarfile.TarInfo('blobs/sha256/'+'1'*64);m.type=tarfile.SYMTYPE;m.linkname='/etc/passwd';t.addfile(m)
 if o.get('duplicate'):
  b=b'{}';m=tarfile.TarInfo('index.json');m.size=len(b);t.addfile(m,io.BytesIO(b))
`;
function archive(options: Record<string, boolean> = {}, overrides: {revision?: string; version?: string} = {}) {
  const files = setup();
  execFileSync("python3", ["-c", fixture, files.archive, overrides.revision ?? revision, overrides.version ?? version, JSON.stringify(options)]);
  return files;
}
function inspectFixture(oci: ReturnType<typeof validateOciArchive>) {
  return { Id: oci.config_digest, Os: "linux", Architecture: "amd64", Config: { User: "1001", Labels: oci.configuration.config.Labels }, RootFS: { Layers: oci.configuration.rootfs?.diff_ids } };
}

describe("로컬 단일 Docker build와 오프라인 OCI 근거", () => {
  it("고정 builder/scanner로 OCI를 한 번 build하며 Docker/registry exporter를 만들지 않는다", () => {
    const { root, reportDir } = setup();
    const plan = createBuildPlan({ root, reportDir, source, version, nonce: "12345678abcd" });
    expect(plan.create).toContain(`image=${BUILDKIT_IMAGE}`);
    expect(BUILDKIT_IMAGE).toMatch(/@sha256:[a-f0-9]{64}$/);
    expect(SBOM_GENERATOR).toMatch(/@sha256:[a-f0-9]{64}$/);
    expect(plan.build.filter((x) => x === "build")).toHaveLength(1);
    expect(plan.build.filter((x) => x === "--output")).toHaveLength(1);
    expect(plan.build).not.toContain("type=docker");
    expect(plan.build).toContain(`type=oci,dest=${plan.archive},compression=gzip,force-compression=true`);
    expect(plan.build).toContain("--provenance=mode=max");
    expect(plan.build).toContain(`--attest=type=sbom,generator=${SBOM_GENERATOR}`);
    expect(plan.build).toContain(`VERSION=${version}`);
    expect(plan.build).not.toContain("--push");
    expect(plan.build.join(" ")).not.toContain("type=registry");
    expect(plan.cleanup).toEqual(["buildx", "rm", plan.builder]);
  });

  it("dirty/실제 Head 불일치·기존 산출물은 build 전에 거부한다", () => {
    const { root, reportDir } = setup();
    for (const bad of [{ ...source, dirty: true }, { ...source, actualMatchesHead: false }]) expect(() => createBuildPlan({ root, reportDir, source: bad, version })).toThrow(/clean exact HEAD/);
    writeFileSync(resolve(reportDir, "buildkit-image.oci.tar"), "existing");
    expect(() => createBuildPlan({ root, reportDir, source, version })).toThrow(/덮어쓰지/);
  });

  it("archive 경로 이탈·부모 symlink·특수 파일을 거부한다", () => {
    const { root, reportDir } = setup();
    expect(() => checkedArtifactPath(root, resolve(root, "outside.tar"))).toThrow(/하위/);
    symlinkSync(tmpdir(), resolve(reportDir, "link"), "dir");
    expect(() => checkedArtifactPath(root, resolve(reportDir, "link", "file.tar"), { mustExist: false })).toThrow(/symlink/);
    expect(() => checkedArtifactPath(root, reportDir)).toThrow(/일반 파일/);
  });

  it("실제 blob hash와 정확 subject·SPDX/provenance를 검산하고 로컬 config/layers에 결속한다", () => {
    const files = archive();
    const oci = validateOciArchive({ root: files.root, archive: files.archive, revision, version });
    expect(oci.attestations).toEqual(["provenance", "sbom"]);
    expect(oci.index_digest).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(oci.index_digest).not.toBe(oci.layout_index_digest);
    expect(validateImageIdentity(inspectFixture(oci), oci, { revision, version })).toBe(true);
    expect(oci.predicate_evidence).toHaveLength(2);
  });

  it("BuildKit v1의 정확 공식 buildType URI를 v0.2와 구분하고 임의 대체는 거부한다", () => {
    const files = archive({ provenance_v1: true });
    expect(validateOciArchive({ root: files.root, archive: files.archive, revision, version }).attestations).toEqual(["provenance", "sbom"]);
    const invalid = archive({ provenance_v1: true, wrong_builder: true });
    expect(() => validateOciArchive({ root: invalid.root, archive: invalid.archive, revision, version })).toThrow(/BuildKit v1/);
  });

  it.each(["tamper_blob", "missing_layer", "wrong_subject", "empty_provenance", "empty_materials", "wrong_builder", "empty_sbom", "omit_sbom", "unsafe_path", "symlink", "duplicate"])("%s OCI 근거는 fail-closed한다", (kind) => {
    const files = archive({ [kind]: true });
    expect(() => validateOciArchive({ root: files.root, archive: files.archive, revision, version })).toThrow(/BLOCKED:/);
  });

  it.each([false, true])("원본 OCI를 보존하고 압축=%s layer의 정확 diffID/config를 runtime import에 보존한다", (compressed) => {
    const files = archive({ gzip_layer: compressed });
    const before = readFileSync(files.archive);
    const oci = validateOciArchive({ root: files.root, archive: files.archive, revision, version });
    const output = resolve(files.reportDir, "runtime-load.tar");
    const result = createDockerLoadArchive({ root: files.root, archive: files.archive, output, tag: "mastergantt-prepr-12345678:check", oci });
    expect(result.config_digest).toBe(oci.config_digest);
    expect(result.original_oci_unchanged).toBe(true);
    expect(result.diff_ids).toEqual(oci.configuration.rootfs?.diff_ids);
    expect(readFileSync(files.archive)).toEqual(before);
    const content = execFileSync("python3", ["-c", "import json,sys,tarfile;t=tarfile.open(sys.argv[1]);print(json.dumps({'names':t.getnames(),'manifest':json.load(t.extractfile('manifest.json'))}))", output], { encoding: "utf8" });
    const parsed = JSON.parse(content);
    expect(parsed.names).toContain(`${oci.config_digest.slice(7)}.json`);
    expect(parsed.manifest[0].RepoTags).toEqual(["mastergantt-prepr-12345678:check"]);
    expect(() => createDockerLoadArchive({ root: files.root, archive: files.archive, output, tag: "mastergantt-prepr-12345678:check", oci })).toThrow(/덮어쓰지/);
  });

  it.each(["wrong_diffid", "unsupported_compression"])("runtime %s를 재포장으로 위장하지 않는다", (kind) => {
    const files = archive({ [kind]: true });
    const oci = validateOciArchive({ root: files.root, archive: files.archive, revision, version });
    expect(() => createDockerLoadArchive({ root: files.root, archive: files.archive, output: resolve(files.reportDir, "runtime-load.tar"), tag: "mastergantt-prepr-12345678:check", oci })).toThrow(/BLOCKED:/);
  });

  it("압축 해제 상한·OCI 교체·output 경로 이탈을 runtime import에서 차단한다", () => {
    const files = archive({ gzip_layer: true });
    const oci = validateOciArchive({ root: files.root, archive: files.archive, revision, version });
    const args = { root: files.root, archive: files.archive, output: resolve(files.reportDir, "runtime-load.tar"), tag: "mastergantt-prepr-12345678:check", oci };
    expect(() => createDockerLoadArchive({ ...args, maxLayerBytes: 4 })).toThrow(/bound exceeded/);
    expect(() => createDockerLoadArchive({ ...args, output: resolve(files.root, "outside.tar") })).toThrow(/하위/);
    expect(() => createDockerLoadArchive({ ...args, output: resolve(files.reportDir, "other.tar"), oci: { ...oci, archive_sha256: "0".repeat(64) } })).toThrow(/입력이 변경/);
  });

  it("다른 source/version·다른 loaded ID/platform/rootfs/root USER를 거부한다", () => {
    const files = archive();
    expect(() => validateOciArchive({ root: files.root, archive: files.archive, revision: "b".repeat(40), version })).toThrow(/revision/);
    expect(() => validateOciArchive({ root: files.root, archive: files.archive, revision, version: "0.0.1" })).toThrow(/version/);
    const oci = validateOciArchive({ root: files.root, archive: files.archive, revision, version });
    const image = inspectFixture(oci);
    for (const bad of [{ ...image, Id: `sha256:${"0".repeat(64)}` }, { ...image, Architecture: "arm64" }, { ...image, RootFS: { Layers: [] } }, { ...image, Config: { ...image.Config, User: "root:1001" } }]) expect(() => validateImageIdentity(bad, oci, { revision, version })).toThrow(/BLOCKED:/);
  });
});
