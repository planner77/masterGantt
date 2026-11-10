import { spawnSync } from "node:child_process";

export const SMOKE_CONTAINERS = Object.freeze([
  "mastergantt-commit-smoke", "mastergantt-release-smoke", "mastergantt-release-candidate", "mastergantt-w22-local",
]);
const require = (condition, message) => { if (!condition) throw new Error(`BLOCKED: ${message}`); };

export function smokeEndpoint(inspection, name, expected = null) {
  require(SMOKE_CONTAINERS.includes(name), "허용된 격리 smoke container 이름이 아닙니다.");
  require(inspection?.Name === `/${name}` && /^[a-f0-9]{64}$/.test(inspection?.Id ?? "") && /^sha256:[a-f0-9]{64}$/.test(inspection?.Image ?? ""), "smoke container 식별 근거가 잘못되었습니다.");
  require(inspection.State?.Running === true, "smoke container가 실행 중이 아닙니다.");
  require(!expected || inspection.Id === expected.id && inspection.Image === expected.image, "재시작한 smoke container ID/image가 원본과 다릅니다.");
  const published = inspection.NetworkSettings?.Ports?.["3000/tcp"];
  require(Array.isArray(published) && published.length === 1, "smoke의 단일 published port를 확인하지 못했습니다.");
  const mapping = published[0];
  require(mapping.HostIp === "127.0.0.1" && /^[1-9][0-9]{0,4}$/.test(mapping.HostPort ?? "") && Number(mapping.HostPort) <= 65535, "smoke port는 유효한 HTTP IPv4 loopback이어야 합니다.");
  return { id: inspection.Id, image: inspection.Image, baseUrl: `http://127.0.0.1:${mapping.HostPort}` };
}

export function inspectSmokeEndpoint(name, expected = null, inspect = spawnSync) {
  require(SMOKE_CONTAINERS.includes(name), "허용된 격리 smoke container 이름이 아닙니다.");
  const result = inspect("docker", ["container", "inspect", "--format", "{{json .}}", name], { encoding: "utf8", timeout: 15_000 });
  require(result.status === 0 && !result.error && !result.signal, "smoke container 조회를 완료하지 못했습니다.");
  let inspection;
  try { inspection = JSON.parse(result.stdout); } catch { throw new Error("BLOCKED: smoke container 조회 결과가 유효한 JSON이 아닙니다."); }
  return smokeEndpoint(inspection, name, expected);
}

export function validateSmokeBaseUrl(requested, endpoint) {
  let url;
  try { url = new URL(requested); } catch { throw new Error("BLOCKED: smoke URL 형식이 잘못되었습니다."); }
  require(url.protocol === "http:" && url.hostname === "127.0.0.1" && !url.username && !url.password && url.pathname === "/" && !url.search && !url.hash && url.origin === new URL(endpoint.baseUrl).origin, "smoke URL은 확인한 container의 HTTP loopback published port여야 합니다.");
  return endpoint.baseUrl;
}
