import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = fileURLToPath(new URL("../../", import.meta.url));

function activeInstructions(role: string): string {
  const text = readFileSync(resolve(root, ".codex", "agents", `${role}.toml`), "utf8");
  const match = /^developer_instructions\s*=\s*"""([\s\S]*?)"""/m.exec(text);
  expect(match, `${role}: active developer_instructions must exist`).not.toBeNull();
  return match![1];
}

describe("Issue #598 — active QA policy in agent instructions", () => {
  for (const role of ["infra", "frontend", "ui-ux", "qa-docs"]) {
    it(`${role} distinguishes default owner-managed from optional AGENT`, () => {
      const instructions = activeInstructions(role);
      expect(instructions).toContain("OWNER_MANAGED");
      expect(instructions).toContain("AGENT");
      expect(instructions).toContain("qa_required=true");
      expect(instructions).toMatch(/Trusted QA|QA Final — Trusted/);
      expect(instructions).toMatch(/Owner|Manager/);
    });
  }
  it("does not require independent human review for every HIGH/protected change", () => {
    const infra = activeInstructions("infra");
    expect(infra).toContain("HIGH·보호 파일·CI/QA 정책 변경도 독립 인간 Reviewer를 자동 의무화하지 않는다");
    expect(infra).toContain("qa_method=AGENT");
    expect(infra).not.toContain("Gate/Workflow/권한/보안 정책 변경과 Bootstrap PR은 AGENT 독립 QA 필수");
    expect(infra).not.toContain("Gate/Workflow/보안 정책을 변경하는 HIGH는 독립 QA 필수");
    expect(infra).not.toContain("자체 보호 파일은 예외로 독립 Reviewer");
  });
  it("retains exact gate evidence and separate owner acceptance", () => {
    const infra = activeInstructions("infra");
    for (const value of ["quality/e2e/docker", "default-branch Trusted QA PASS",
      "review/thread 0", "DOCUMENTATION_SYNC PASS", "exact-HEAD 최종 ACCEPT"]) {
      expect(infra).toContain(value);
    }
  });
});
