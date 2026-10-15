import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import manifest from "../../config/gantt-state-conformance.json";
import { validateConformanceManifest } from "../../fixtures/gantt-state-consistency/manifest";

const root = fileURLToPath(new URL("../../../", import.meta.url));
type MutableCase = { file: string; title: string; evidenceLevel: string; status: string; role: string; parameters?: Record<string, (string | number)[]> };
type MutableManifest = Omit<typeof manifest, "scenarios"> & { scenarios: (Omit<typeof manifest.scenarios[number], "cases"> & { cases: MutableCase[] })[] };
const copy = (): MutableManifest => structuredClone(manifest);
const validate = (value: unknown) => validateConformanceManifest(value, root);

describe("GSC machine registration; validation is not scenario execution PASS", () => {
  it("registers SC-01~14 with exact standard owners/rules and existing AST test cases", () => {
    expect(validate(manifest)).toEqual([]);
    expect(manifest.scenarios).toHaveLength(14);
    expect(manifest.scenarios.every(scenario => scenario.productStatus === "NOT TESTED")).toBe(true);
  });
  it.each([null, [], "PASS", 1])("rejects malformed root %s", value => {
    expect(validate(value)).toContain("manifest must be an object");
  });
  it("rejects schema/version or registration purpose changes", () => {
    expect(validate({ ...manifest, schemaVersion: 2, purpose: "PASS" })).toContain("invalid manifest schema/version/purpose");
  });
  it("rejects missing and duplicate scenarios", () => {
    const missing = copy(); missing.scenarios.pop();
    expect(validate(missing)).toContain("missing scenario: SC-14");
    const duplicate = copy(); duplicate.scenarios.push(duplicate.scenarios[0]);
    expect(validate(duplicate)).toContain("duplicate scenario: SC-01");
  });
  it("rejects unknown scenario/GSC and missing cumulative rule coverage", () => {
    const value = copy(); value.scenarios[0].id = "SC-99"; value.scenarios[0].rules = ["GSC-99"];
    expect(validate(value)).toContain("unknown scenario: SC-99");
    expect(validate(value)).toContain("SC-99: unknown GSC GSC-99");
    for (const scenario of value.scenarios) scenario.rules = scenario.rules.filter(rule => rule !== "GSC-10");
    expect(validate(value)).toContain("missing rule coverage: GSC-10");
    expect(validate({ ...manifest, governance: { rules: [], file: "AGENTS.md" } })).toContain("missing GSC-12 governance coverage");
  });
  it("rejects incorrect owners or rule mappings even when every ID still exists", () => {
    const value = copy(); value.scenarios[0].owners = ["U5"]; value.scenarios[0].rules.reverse();
    expect(validate(value)).toContain("SC-01: owner mapping differs from standard");
    expect(validate(value)).toContain("SC-01: GSC mapping differs from standard");
  });
  it("rejects missing files and test cases rather than accepting text in comments", () => {
    const value = copy(); value.scenarios[0].cases[0].file = "tests/no-such-file.test.ts";
    expect(validate(value)).toContain("missing file: tests/no-such-file.test.ts");
    value.scenarios[0].cases[0].file = "tests/features/gantt/canonical-snapshot-sync.test.ts";
    value.scenarios[0].cases[0].title = "imaginary test case";
    expect(validate(value)).toContain("SC-01: missing or ambiguous test case imaginary test case");
  });
  it("rejects empty cases, duplicate references and malformed scenario fields", () => {
    const value = copy(); value.scenarios[0].cases.push(value.scenarios[0].cases[0]);
    expect(validate(value)).toContain("SC-01: duplicate case");
    value.scenarios[0].cases = [];
    expect(validate(value)).toContain("SC-01: missing test cases");
    expect(validate({ ...manifest, scenarios: [null] })).toContain("invalid scenario schema");
    expect(validate({ ...manifest, scenarios: null })).toContain("scenarios must be an array");
  });
  it("rejects unknown or exaggerated evidence levels and execution claims", () => {
    const value = copy(); value.scenarios[0].cases[0].evidenceLevel = "PR_CI";
    expect(validate(value)).toContain("SC-01: unit test cannot claim browser/HTTP evidence");
    value.scenarios[0].cases[0].evidenceLevel = "INDEPENDENT_QA_PASS";
    expect(validate(value)).toContain("SC-01: unknown evidence level");
    value.scenarios[0].productStatus = "PASS"; value.scenarios[0].cases[0].status = "PASS";
    expect(validate(value)).toContain("SC-01: registration must preserve pending product evidence");
    expect(validate(value)).toContain("SC-01: source registration cannot claim execution");
    value.scenarios[0].requiredEvidence = ["UNIT_MODEL"];
    expect(validate(value)).toContain("SC-01: incomplete required evidence");
  });
  it("rejects nonexistent parameter instances and missing parameter declarations", () => {
    const value = copy(); value.scenarios[1].cases[0].parameters = { status: [422] };
    expect(validate(value)).toContain("SC-02: nonexistent parameter case status");
    delete value.scenarios[1].cases[0].parameters;
    expect(validate(value)).toContain("SC-02: parameterized case needs explicit instances");
    value.scenarios[1].cases[0].parameters = { kind: [412] };
    expect(validate(value)).toContain("SC-02: incorrect parameter names");
  });
  it("rejects path traversal and lost bounded trace/isolated HTTP references", () => {
    const value = copy(); value.scenarios[0].cases[0].file = "../outside.test.ts";
    expect(validate(value)).toContain("invalid repository path: ../outside.test.ts");
    expect(validate({ ...manifest, reuse: {} }).some(error => error.startsWith("invalid repository path:"))).toBe(true);
    expect(readFileSync(`${root}${manifest.reuse.boundedTrace}`, "utf8")).toContain("createCoreActionTrace");
  });
});
