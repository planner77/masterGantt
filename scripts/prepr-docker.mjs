import { execFileSync, spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { closeSync, existsSync, lstatSync, openSync, readFileSync, readSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { sourceEvidence } from "./prepr-core.mjs";

export const BUILDKIT_IMAGE = "moby/buildkit@sha256:6c2fa84a6b61ccd72899dde4239f8d5717f05f9a8ca6f3cad185fb1a95a94de3";
export const SBOM_GENERATOR = "docker.io/docker/buildkit-syft-scanner@sha256:873a7458c3c8ac8e32c7b796c10e1600b07b963d2aa000a72a2d97aaaa2d6315";
const repository = "planner77/masterGantt";
const moduleRoot = fileURLToPath(new URL("../", import.meta.url));
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
function hashFile(path) {
  const hash = createHash("sha256");
  const buffer = Buffer.alloc(1024 * 1024);
  const fd = openSync(path, "r");
  try { let length; while ((length = readSync(fd, buffer, 0, buffer.length, null)) > 0) hash.update(buffer.subarray(0, length)); }
  finally { closeSync(fd); }
  return hash.digest("hex");
}
const sorted = (value) => JSON.stringify(Object.entries(value ?? {}).sort(([a], [b]) => a.localeCompare(b)));
const digest = /^sha256:[a-f0-9]{64}$/;
const require = (condition, message) => { if (!condition) throw new Error(`BLOCKED: ${message}`); };

// Reuse the existing offline OCI verifier, never its CI authorization callers.
// tarfile reads members; archive paths are never extracted or executed.
const OCI_CHECK = String.raw`
import hashlib,json,pathlib,re,sys,tarfile
sys.path.insert(0,sys.argv[5])
from verified_oci import validate_archive,descriptor_path,require
archive,repo,revision,version=sys.argv[1:5]
try:
 result=validate_archive(archive,repository=repo,revision=revision,version=version)
 with tarfile.open(archive,'r:*') as t:
  entries={m.name.removeprefix('./'):m for m in t if m.isfile()}
  def data(d):
   name=descriptor_path(d)
   require(name in entries,'OCI referenced blob absent')
   require(entries[name].size==d['size'],'OCI referenced blob size mismatch')
   require(d['size']<=64*1024*1024,'OCI JSON evidence too large')
   return json.loads(t.extractfile(entries[name]).read())
  top=json.loads(t.extractfile(entries['index.json']).read())
  descs=top['manifests']
  if len(descs)==1 and descs[0].get('mediaType')=='application/vnd.oci.image.index.v1+json':
   result['oci_reference']=(descs[0].get('annotations') or {}).get('org.opencontainers.image.ref.name')
   descs=data(descs[0])['manifests']
  else: result['oci_reference']=None
  evidence=[]
  for d in descs:
   manifest=data(d)
   for item in [manifest['config'],*manifest.get('layers',[])]:
    name=descriptor_path(item)
    require(name in entries,'OCI referenced blob absent')
    require(entries[name].size==item['size'],'OCI referenced blob size mismatch')
   if d['digest']==result['image_manifest_digest']:
    result['configuration']=data(manifest['config'])
    continue
   for layer in manifest.get('layers',[]):
    if 'in-toto' not in layer.get('mediaType',''): continue
    statement=data(layer)
    require(statement.get('_type') in ['https://in-toto.io/Statement/v0.1','https://in-toto.io/Statement/v1'],'in-toto statement type invalid')
    predicate=statement.get('predicate')
    require(isinstance(predicate,dict) and bool(predicate),'BuildKit predicate is empty')
    kind=statement.get('predicateType','')
    if kind.startswith('https://slsa.dev/provenance/'):
     buildtype=predicate.get('buildType') or (predicate.get('buildDefinition') or {}).get('buildType')
     if kind=='https://slsa.dev/provenance/v0.2':
      require(buildtype=='https://mobyproject.org/buildkit@v1','provenance is not BuildKit v0.2 evidence')
     elif kind=='https://slsa.dev/provenance/v1':
      require(buildtype=='https://github.com/moby/buildkit/blob/master/docs/attestations/slsa-definitions.md','provenance is not BuildKit v1 evidence')
     else:require(False,'unsupported BuildKit provenance version')
     materials=predicate.get('materials') or (predicate.get('buildDefinition') or {}).get('resolvedDependencies')
     require(isinstance(materials,list) and bool(materials),'provenance materials absent')
     require(all(isinstance(m,dict) and isinstance(m.get('uri'),str) and bool(m['uri']) and isinstance(m.get('digest'),dict) and bool(m['digest']) and all(isinstance(v,str) and re.fullmatch(r'[a-f0-9]{40,128}',v) for v in m['digest'].values()) for m in materials),'provenance material identity incomplete')
    elif 'spdx' in kind.lower():
     require(str(predicate.get('spdxVersion','')).startswith('SPDX-'),'SPDX version absent')
     require(predicate.get('SPDXID')=='SPDXRef-DOCUMENT','SPDX document identity absent')
     require(isinstance(predicate.get('packages'),list) and bool(predicate['packages']),'SPDX packages absent')
     require(bool((predicate.get('creationInfo') or {}).get('creators')),'SPDX creator absent')
    elif 'cyclonedx' in kind.lower():
     require(predicate.get('bomFormat')=='CycloneDX' and bool(predicate.get('components')),'CycloneDX document absent')
    evidence.append({'predicate_type':kind,'blob_digest':layer['digest']})
  result['predicate_evidence']=evidence
 print(json.dumps(result,sort_keys=True))
except Exception as e:
 print('BLOCKED: OCI evidence invalid: '+str(e),file=sys.stderr)
 sys.exit(1)
`;

// Docker's classic store cannot import an attested manifest list. Repackage
// only its verified runtime child; preserve every config/layer byte identity.
const DOCKER_LOAD = String.raw`
import gzip,hashlib,io,json,pathlib,sys,tarfile,tempfile
archive,output,tag,expected_archive,manifest_digest,config_digest,max_layer,max_total=sys.argv[1:]
max_layer,max_total=int(max_layer),int(max_total)
def need(ok,why):
 if not ok: raise ValueError(why)
def hashfile(p):
 with open(p,'rb') as f:return hashlib.file_digest(f,'sha256').hexdigest()
try:
 need(hashfile(archive)==expected_archive,'OCI input changed before runtime import')
 with tarfile.open(archive,'r:*') as src:
  entries={m.name.removeprefix('./'):m for m in src if m.isfile()}
  def read(d):
   name='blobs/sha256/'+d[7:];need(name in entries,'runtime blob absent')
   need(entries[name].size<=64*1024*1024,'runtime JSON too large')
   return src.extractfile(entries[name]).read()
  manifest=json.loads(read(manifest_digest));config_bytes=read(config_digest)
  need(hashlib.sha256(config_bytes).hexdigest()==config_digest[7:],'runtime config changed')
  config=json.loads(config_bytes);diffids=config.get('rootfs',{}).get('diff_ids')
  layers=manifest.get('layers')
  need(isinstance(diffids,list) and isinstance(layers,list) and len(diffids)==len(layers) and bool(layers),'runtime layer count mismatch')
  total=0;paths=[]
  with tarfile.open(output,'x') as dst:
   def add(name,data):
    info=tarfile.TarInfo(name);info.size=len(data);info.mode=0o644;info.mtime=0;dst.addfile(info,io.BytesIO(data))
   config_name=config_digest[7:]+'.json';add(config_name,config_bytes)
   for i,layer in enumerate(layers):
    name='blobs/sha256/'+layer['digest'][7:]
    need(name in entries and entries[name].size==layer['size'],'runtime layer missing/size mismatch')
    media=layer['mediaType'];need(media in ['application/vnd.oci.image.layer.v1.tar','application/vnd.oci.image.layer.v1.tar+gzip'],'unsupported runtime layer compression')
    compressed=src.extractfile(entries[name])
    stream=gzip.GzipFile(fileobj=compressed) if media.endswith('+gzip') else compressed
    with tempfile.TemporaryFile(dir=str(pathlib.Path(output).parent)) as tmp:
     size=0;digest=hashlib.sha256()
     while True:
      chunk=stream.read(1024*1024)
      if not chunk:break
      size+=len(chunk);total+=len(chunk)
      need(size<=max_layer and total<=max_total,'runtime decompression bound exceeded')
      digest.update(chunk);tmp.write(chunk)
     need('sha256:'+digest.hexdigest()==diffids[i],'runtime uncompressed diffID mismatch')
     tmp.seek(0);path=layer['digest'][7:]+'/layer.tar';paths.append(path)
     info=tarfile.TarInfo(path);info.size=size;info.mode=0o644;info.mtime=0;dst.addfile(info,tmp)
   add('manifest.json',json.dumps([{'Config':config_name,'RepoTags':[tag],'Layers':paths}],sort_keys=True).encode())
 need(hashfile(archive)==expected_archive,'OCI input changed during runtime import')
 print(json.dumps({'archive_sha256':hashfile(output),'archive_bytes':pathlib.Path(output).stat().st_size,'config_digest':config_digest,'diff_ids':diffids,'layers':len(paths),'original_oci_unchanged':True}))
except Exception as e:
 print('BLOCKED: Docker runtime import invalid: '+str(e),file=sys.stderr);sys.exit(1)
`;

export function checkedArtifactPath(root, path, { mustExist = true } = {}) {
  const base = resolve(root, ".prepr-reports");
  const full = resolve(root, path);
  const suffix = relative(base, full);
  require(suffix && !isAbsolute(suffix) && suffix !== ".." && !suffix.startsWith(`..${sep}`), "Docker artifact는 .prepr-reports 하위여야 합니다.");
  let cursor = resolve(root);
  for (const part of relative(root, full).split(sep)) {
    cursor = resolve(cursor, part);
    if (existsSync(cursor)) require(!lstatSync(cursor).isSymbolicLink(), "Docker artifact symlink를 거부합니다.");
  }
  if (mustExist) require(existsSync(full) && lstatSync(full).isFile(), "Docker artifact 일반 파일이 없습니다.");
  return full;
}

export function validateOciArchive({ root, archive, revision, version }) {
  require(/^[a-f0-9]{40}$/.test(revision), "Docker source SHA가 잘못되었습니다.");
  require(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version), "Docker version이 잘못되었습니다.");
  const full = checkedArtifactPath(root, archive);
  require(lstatSync(full).size > 0 && lstatSync(full).size <= 6 * 1024 ** 3, "OCI archive 크기가 허용 범위를 벗어났습니다.");
  try {
    return JSON.parse(execFileSync("python3", ["-c", OCI_CHECK, full, repository, revision, version, resolve(moduleRoot, "scripts")], { cwd: root, encoding: "utf8", timeout: 180_000, maxBuffer: 8 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] }));
  } catch (error) {
    const reason = error.stderr?.toString().trim().split("\n").at(-1);
    throw new Error(reason?.startsWith("BLOCKED:") ? reason : "BLOCKED: OCI archive 검증을 완료하지 못했습니다.");
  }
}

export function validateImageIdentity(image, oci, { revision, version }) {
  require(image && typeof image === "object" && digest.test(image.Id ?? ""), "로컬 Docker image ID가 잘못되었습니다.");
  require(image.Id === oci.config_digest, "로컬 smoke image와 OCI config digest가 다릅니다.");
  require(image.Os === "linux" && image.Architecture === "amd64", "로컬 Docker platform이 다릅니다.");
  const labels = image.Config?.Labels ?? {};
  require(labels["org.opencontainers.image.revision"] === revision && labels["org.opencontainers.image.version"] === version && labels["org.opencontainers.image.source"] === `https://github.com/${repository}`, "로컬 Docker revision/source/version이 다릅니다.");
  require(sorted(labels) === sorted(oci.configuration?.config?.Labels), "로컬 Docker/OCI labels가 다릅니다.");
  const layers = oci.configuration?.rootfs?.diff_ids;
  require(Array.isArray(layers) && layers.length > 0 && JSON.stringify(image.RootFS?.Layers) === JSON.stringify(layers), "로컬 Docker/OCI rootfs layer가 다릅니다.");
  const user = image.Config?.User;
  require(typeof user === "string" && user && !["0", "root"].includes(user.split(":")[0]), "로컬 Docker USER가 root입니다.");
  return true;
}

export function createDockerLoadArchive({ root, archive, output, tag, oci, maxLayerBytes = 2 * 1024 ** 3, maxTotalBytes = 6 * 1024 ** 3 }) {
  const input = checkedArtifactPath(root, archive);
  const target = checkedArtifactPath(root, output, { mustExist: false });
  require(!existsSync(target), "기존 Docker runtime import archive를 덮어쓰지 않습니다.");
  require(/^mastergantt-prepr-[a-f0-9-]{8,40}:check$/.test(tag), "Docker runtime import tag가 잘못되었습니다.");
  require(digest.test(oci.image_manifest_digest) && digest.test(oci.config_digest) && /^[a-f0-9]{64}$/.test(oci.archive_sha256), "Docker runtime OCI identity가 잘못되었습니다.");
  require(Number.isSafeInteger(maxLayerBytes) && maxLayerBytes > 0 && maxLayerBytes <= 2 * 1024 ** 3 && Number.isSafeInteger(maxTotalBytes) && maxTotalBytes > 0 && maxTotalBytes <= 6 * 1024 ** 3, "Docker runtime 압축 해제 상한이 잘못되었습니다.");
  const labels = oci.configuration?.config?.Labels ?? {};
  const verified = validateOciArchive({ root, archive, revision: labels["org.opencontainers.image.revision"], version: labels["org.opencontainers.image.version"] });
  require(verified.archive_sha256 === oci.archive_sha256 && verified.config_digest === oci.config_digest && verified.image_manifest_digest === oci.image_manifest_digest, "Docker runtime OCI 입력이 변경되었습니다.");
  try {
    return JSON.parse(execFileSync("python3", ["-c", DOCKER_LOAD, input, target, tag, oci.archive_sha256, oci.image_manifest_digest, oci.config_digest, String(maxLayerBytes), String(maxTotalBytes)], { cwd: root, encoding: "utf8", timeout: 180_000, maxBuffer: 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] }));
  } catch (error) {
    const reason = error.stderr?.toString().trim().split("\n").at(-1);
    throw new Error(reason?.startsWith("BLOCKED:") ? reason : "BLOCKED: Docker runtime import archive를 만들지 못했습니다.");
  }
}

export function createBuildPlan({ root, reportDir, source, version, nonce = randomUUID().slice(0, 12) }) {
  require(!source.dirty && source.actualMatchesHead, "Docker build에는 clean exact HEAD가 필요합니다.");
  require(/^[a-f0-9]{40}$/.test(source.headSha), "Docker source SHA가 잘못되었습니다.");
  require(/^[a-f0-9]{64}$/.test(source.contentSha256), "Docker content SHA가 잘못되었습니다.");
  require(/^[a-f0-9-]{8,40}$/.test(nonce), "Docker builder nonce가 잘못되었습니다.");
  require(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version), "Docker version이 잘못되었습니다.");
  const directory = resolve(root, reportDir);
  checkedArtifactPath(root, resolve(directory, "buildkit-image.oci.tar"), { mustExist: false });
  require(existsSync(directory) && lstatSync(directory).isDirectory(), "Docker 보고 디렉터리가 없습니다.");
  const builder = `mastergantt-prepr-${nonce}`;
  const tag = `${builder}:check`;
  const archive = resolve(directory, "buildkit-image.oci.tar");
  const metadata = resolve(directory, "buildkit-metadata.json");
  const ociReport = resolve(directory, "oci-validation.json");
  const loadArchive = resolve(directory, "runtime-load.tar");
  require(!existsSync(archive) && !existsSync(metadata) && !existsSync(loadArchive) && !existsSync(ociReport), "기존 Docker artifact를 덮어쓰지 않습니다.");
  return {
    builder, tag, archive, metadata, loadArchive, ociReport,
    create: ["buildx", "create", "--name", builder, "--driver", "docker-container", "--driver-opt", `image=${BUILDKIT_IMAGE}`],
    build: ["buildx", "build", "--builder", builder, "--platform=linux/amd64", "--provenance=mode=max", `--attest=type=sbom,generator=${SBOM_GENERATOR}`, "--metadata-file", metadata, "--label", `org.opencontainers.image.revision=${source.headSha}`, "--label", `org.opencontainers.image.source=https://github.com/${repository}`, "--file", "deploy/docker/Dockerfile", "--build-arg", `VERSION=${version}`, "--output", `type=oci,dest=${archive},compression=gzip,force-compression=true`, "--tag", tag, "."],
    cleanup: ["buildx", "rm", builder],
  };
}

export async function buildLocalImage({ root, reportDir, source, version, run }) {
  require(typeof run === "function", "Docker 실행 기록 callback이 없습니다.");
  const current = sourceEvidence(root, source.baseSha);
  require(current.fingerprint === source.fingerprint, "Docker source가 검증 시작 입력과 다릅니다.");
  require(JSON.parse(readFileSync(resolve(root, "package.json"), "utf8")).version === version, "Docker version이 package.json과 다릅니다.");
  const plan = createBuildPlan({ root, reportDir, source, version });
  let attemptedCreate = false;
  try {
    const absent = spawnSync("docker", ["buildx", "inspect", plan.builder], { cwd: root, stdio: "ignore", timeout: 15_000 });
    require(absent.status !== 0, "기존 Docker builder를 사용하지 않습니다.");
    attemptedCreate = true;
    if (!await run("Docker builder create", "docker", plan.create)) throw new Error("FAILED: Docker builder create");
    if (!await run("Docker build", "docker", plan.build)) throw new Error("FAILED: Docker build");
    if (!await run("Docker OCI evidence", "python3", [resolve(moduleRoot, "scripts", "verified_oci.py"), "--archive", plan.archive, "--repository", repository, "--revision", source.headSha, "--version", version, "--output", plan.ociReport])) throw new Error("FAILED: Docker OCI evidence");
    const oci = validateOciArchive({ root, archive: plan.archive, revision: source.headSha, version });
    const converted = createDockerLoadArchive({ root, archive: plan.archive, output: plan.loadArchive, tag: plan.tag, oci });
    if (!await run("Docker runtime import", "docker", ["load", "--input", plan.loadArchive])) throw new Error("FAILED: Docker runtime import");
    const loaded = JSON.parse(execFileSync("docker", ["image", "inspect", "--format", "{{json .}}", plan.tag], { cwd: root, encoding: "utf8", timeout: 15_000, stdio: ["ignore", "pipe", "pipe"] }));
    validateImageIdentity(loaded, oci, { revision: source.headSha, version });
    const metadata = checkedArtifactPath(root, plan.metadata);
    const image = {
      tag: plan.tag, id: loaded.Id, sourceHead: source.headSha, sourceContentSha256: source.contentSha256,
      platform: "linux/amd64", version, builder: plan.builder, registryPublished: false,
      ociArchive: relative(root, plan.archive).split(sep).join("/"), ociArchiveSha256: oci.archive_sha256,
      ociIndexDigest: oci.index_digest, ociLayoutIndexDigest: oci.layout_index_digest,
      imageManifestDigest: oci.image_manifest_digest, configDigest: oci.config_digest,
      attestations: oci.attestations, predicateEvidence: oci.predicate_evidence,
      buildMetadata: relative(root, metadata).split(sep).join("/"), buildMetadataSha256: sha256(readFileSync(metadata)),
      builderImage: BUILDKIT_IMAGE, sbomGenerator: SBOM_GENERATOR,
      runtimeLoadArchive: relative(root, plan.loadArchive).split(sep).join("/"), runtimeLoadArchiveSha256: converted.archive_sha256,
    };
    require(sourceEvidence(root, source.baseSha).fingerprint === source.fingerprint, "Docker build 중 source가 변경되었습니다.");
    return image;
  } finally {
    const exists = attemptedCreate && spawnSync("docker", ["buildx", "inspect", plan.builder], { cwd: root, stdio: "ignore", timeout: 15_000 }).status === 0;
    if (exists && !await run("Docker builder cleanup", "docker", plan.cleanup)) throw new Error("BLOCKED: 본 실행의 Docker builder 정리에 실패했습니다.");
  }
}

export function validateLocalImageEvidence({ root, image, source, version }) {
  require(image?.sourceHead === source.headSha && image?.sourceContentSha256 === source.contentSha256, "Docker evidence source가 다릅니다.");
  require(image.version === version && image.platform === "linux/amd64", "Docker evidence version/platform이 다릅니다.");
  require(/^mastergantt-prepr-[a-f0-9-]{8,40}:check$/.test(image.tag ?? ""), "Docker 검증 tag 형식이 다릅니다.");
  const oci = validateOciArchive({ root, archive: image.ociArchive, revision: source.headSha, version });
  for (const [actual, expected] of [[oci.archive_sha256, image.ociArchiveSha256], [oci.index_digest, image.ociIndexDigest], [oci.layout_index_digest, image.ociLayoutIndexDigest], [oci.image_manifest_digest, image.imageManifestDigest], [oci.config_digest, image.configDigest]]) require(actual === expected, "Docker OCI evidence digest가 변경되었습니다.");
  require(JSON.stringify(oci.attestations) === JSON.stringify(image.attestations), "Docker OCI attestations가 다릅니다.");
  const metadata = checkedArtifactPath(root, image.buildMetadata);
  require(sha256(readFileSync(metadata)) === image.buildMetadataSha256, "Docker build metadata가 변경되었습니다.");
  const runtimeArchive = checkedArtifactPath(root, image.runtimeLoadArchive);
  require(hashFile(runtimeArchive) === image.runtimeLoadArchiveSha256, "Docker runtime import archive가 변경되었습니다.");
  let loaded;
  try { loaded = JSON.parse(execFileSync("docker", ["image", "inspect", "--format", "{{json .}}", image.tag], { cwd: root, encoding: "utf8", timeout: 15_000, stdio: ["ignore", "pipe", "pipe"] })); }
  catch { throw new Error("BLOCKED: 로컬 검증 Docker image를 확인하지 못했습니다."); }
  require(loaded.Id === image.id, "로컬 Docker tag의 image ID가 변경되었습니다.");
  validateImageIdentity(loaded, oci, { revision: source.headSha, version });
  return oci;
}
