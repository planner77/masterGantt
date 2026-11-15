import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = fileURLToPath(new URL("../../", import.meta.url));
const agentsDir = resolve(root, ".codex", "agents");

function setting(contents: string, key: string): string {
  const match = new RegExp(`^${key}\\s*=\\s*"([^"]+)"\\s*$`, "m").exec(contents);
  expect(match, `missing/invalid active TOML setting: ${key}`).not.toBeNull();
  return match![1];
}

const roles: Record<string, {
  model: string;
  effort: string;
  readOnly?: boolean;
}> = {
  "researcher": { model: "gpt-6-luna", effort: "medium", readOnly: true },
  "ui-ux": { model: "gpt-6.1-terra", effort: "medium", readOnly: true },
  "frontend": { model: "gpt-6.1-terra", effort: "medium" },
  "backend": { model: "gpt-6.1-sol", effort: "high" },
  "scheduler": { model: "gpt-6.1-sol", effort: "high" },
  "excel-vba": { model: "gpt-6-luna", effort: "medium" },
  "infra": { model: "gpt-6.1-sol", effort: "high" },
  "qa-docs": { model: "gpt-6.1-sol", effort: "high", readOnly: true },
};

describe("Issue #831 — Terra role selection (configuration contract)", () => {
  it("keeps the same eight Sub-Agent roles", () => {
    expect(readdirSync(agentsDir).filter((name) => name.endsWith(".toml")).sort())
      .toEqual(Object.keys(roles).map((name) => `${name}.toml`).sort());
  });

  for (const [name, config] of Object.entries(roles)) {
    it(`${name} keeps an explicit model, effort and role boundary`, () => {
      const contents = readFileSync(resolve(agentsDir, `${name}.toml`), "utf8");
      expect(setting(contents, "model")).toBe(config.model);
      expect(setting(contents, "model_reasoning_effort")).toBe(config.effort);
      if (config.readOnly) {
        expect(setting(contents, "sandbox_mode")).toBe("read-only");
      } else {
        expect(contents).not.toMatch(/^sandbox_mode\s*=\s*"read-only"/m);
      }
      expect(contents).toMatch(/^developer_instructions\s*=\s*"""/m);
    });
  }

  it("retains the Manager/Sol high policy and six-thread limit", () => {
    const contents = readFileSync(resolve(root, ".codex", "config.toml"), "utf8");
    expect(setting(contents, "model")).toBe("gpt-6.1-sol");
    expect(setting(contents, "model_reasoning_effort")).toBe("high");
    expect(contents).toMatch(/^max_concurrent_threads_per_session\s*=\s*6\s*$/m);
  });

  it("routes model documentation to the same Terra selection and deliberate Sol escalation", () => {
    const instructions = readFileSync(resolve(root, "AGENTS.md"), "utf8");
    const configuration = readFileSync(resolve(root, "docs/AGENT_CONFIGURATION.md"), "utf8");
    expect(instructions).toContain("[AGENT_CONFIGURATION](docs/AGENT_CONFIGURATION.md)");
    expect(configuration).toMatch(/\| ui_ux \| gpt-6\.1-terra \/ medium \|/);
    expect(configuration).toMatch(/\| frontend \| gpt-6\.1-terra \/ medium \|/);
    expect(configuration).toContain("Sol/high 작업별 승격");
    expect(configuration).toContain("조용한 fallback을 하지 않는다");
  });
});
