import { describe, expect, it } from "vitest";
import { inspectSmokeEndpoint, smokeEndpoint, validateSmokeBaseUrl } from "../../scripts/registry-smoke-core.mjs";
import { inventory, publicationRequirements, selectImpact } from "../../scripts/prepr-core.mjs";
import { resolve } from "node:path";

const name = "mastergantt-w22-local";
function container(port = "32770") {
  return { Id: "a".repeat(64), Image: "sha256:" + "b".repeat(64), Name: "/" + name, State: { Running: true }, NetworkSettings: { Ports: { "3000/tcp": [{ HostIp: "127.0.0.1", HostPort: port }] } } };
}
describe("registry API smoke endpoint identity", () => {
  it("follows a changed published port only for the same running container and image", () => {
    const original = smokeEndpoint(container(), name);
    const after = smokeEndpoint(container("32771"), name, original);
    expect(original.baseUrl).toBe("http://127.0.0.1:32770");
    expect(after).toEqual({ ...original, baseUrl: "http://127.0.0.1:32771" });
    expect(() => smokeEndpoint({ ...container(), Id: "c".repeat(64) }, name, original)).toThrow(/ID\/image/);
    expect(() => smokeEndpoint({ ...container(), Image: "sha256:" + "c".repeat(64) }, name, original)).toThrow(/ID\/image/);
    expect(() => smokeEndpoint({ ...container(), State: { Running: false } }, name, original)).toThrow(/실행 중/);
  });
  it("preserves fixed-port CI callers and rejects stale or external supplied URLs", () => {
    const fixed = smokeEndpoint(container("3000"), name);
    expect(validateSmokeBaseUrl("http://127.0.0.1:3000", fixed)).toBe("http://127.0.0.1:3000");
    expect(validateSmokeBaseUrl("http://127.0.0.1:3000/", fixed)).toBe(fixed.baseUrl);
    for (const url of ["http://127.0.0.1:32769", "https://127.0.0.1:3000", "http://example.invalid:3000", "http://127.0.0.1:3000/path", "http://user:synthetic@127.0.0.1:3000", "http://127.0.0.1:3000?token=synthetic", "http://127.0.0.1:3000#fragment"]) expect(() => validateSmokeBaseUrl(url, fixed)).toThrow(/loopback/);
  });
  it("rejects non-loopback, invalid, absent or ambiguous Docker mappings", () => {
    const original = container();
    for (const mapping of [[], [{ HostIp: "0.0.0.0", HostPort: "3000" }], [{ HostIp: "::1", HostPort: "3000" }], [{ HostIp: "127.0.0.1", HostPort: "0" }], [{ HostIp: "127.0.0.1", HostPort: "65536" }], [{ HostIp: "127.0.0.1", HostPort: "3000;command" }], [...original.NetworkSettings.Ports["3000/tcp"], ...original.NetworkSettings.Ports["3000/tcp"]]]) expect(() => smokeEndpoint({ ...original, NetworkSettings: { Ports: { "3000/tcp": mapping } } }, name)).toThrow(/port/);
  });
  it("fails closed on inspection failure, malformed responses or an unexpected container", () => {
    let calls = 0;
    const inspect = (command: string, args: string[]) => { calls++; expect(command).toBe("docker"); expect(args).toEqual(["container", "inspect", "--format", "{{json .}}", name]); return { status: 0, stdout: JSON.stringify(container()) }; };
    expect(inspectSmokeEndpoint(name, null, inspect).baseUrl).toBe("http://127.0.0.1:32770");
    expect(calls).toBe(1);
    expect(() => inspectSmokeEndpoint("production-app", null, inspect)).toThrow(/허용/);
    expect(calls).toBe(1);
    expect(() => inspectSmokeEndpoint(name, null, () => ({ status: 1, stdout: "" }))).toThrow(/조회/);
    expect(() => inspectSmokeEndpoint(name, null, () => ({ status: 0, stdout: "not JSON" }))).toThrow(/JSON/);
    expect(() => inspectSmokeEndpoint(name, null, () => ({ status: 0, stdout: JSON.stringify({ ...container(), Name: "/production-app" }) }))).toThrow(/식별/);
  });
  it("maps the helper to real identity regression and keeps Docker runtime verification mandatory", () => {
    const tests = inventory(resolve(__dirname, "../.."));
    const selected = selectImpact({ changed: ["scripts/verify-registry-api-smoke.mjs", "scripts/registry-smoke-core.mjs"], tests, risk: "HIGH" });
    expect(selected.state).toBe("READY");
    expect(selected.selected.map((test) => test.path)).toContain("tests/scripts/registry-smoke.test.ts");
    expect(publicationRequirements({ changed: ["scripts/verify-registry-api-smoke.mjs"] } as Parameters<typeof publicationRequirements>[0], selected).docker).toBe(true);
  });
});
