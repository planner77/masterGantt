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
  readonly?: boolean;
}> = {
  "researcher": { model: "gpt-6-luna", effort: "medium", readonly: true },
  "ui-ux": { model: "gpt-6.1-terra", effort: "medium", readonly: true },
  "frontend": { model: "gpt-6.1-terra", effort: "medium" },
  "backend": { model: "gpt-6.1-sol", effort: "high" },
  "scheduler": { model: "gpt-6.1-sol", effort: "high" },
  "excel-vba": { model: "gpt-6-luna", effort: "medium" },
  "infra": { model: "gpt-6.1-sol", effort: "high" },
  "qa-docs": { model: "gpt-6.1-sol", effort: "high", readonly: true },
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
      if (config.readonly) {
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

  it("documents Terra selection and a deliberate Sol escalation", () => {
    const instructions = readFileSync(resolve(root, "AGENTS.md"), "utf8");
    expect(instructions).toMatch(/ui_ux\s+→ GPT-6\.1 Terra \/ Medium/);
    expect(instructions).toMatch(/frontend\s+→ GPT-6\.1 Terra \/ Medium/);
    expect(instructions).toContain("GPT-6.1 Sol/High");
    expect(instructions).toContain("조용히 대체하지 않는다");
  });
});
