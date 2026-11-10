import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = fileURLToPath(new URL("../../", import.meta.url));
const text = (path: string) => readFileSync(resolve(root, path), "utf8");

function activeInstructions(role: string): string {
  const match = /^developer_instructions\s*=\s*"""([\s\S]*?)"""/m.exec(text(`.codex/agents/${role}.toml`));
  expect(match, `${role}: active developer_instructions must exist`).not.toBeNull();
  return match![1];
}

describe("Issues #906/#908 — active local-only agent QA contract", () => {
  const roles = readdirSync(resolve(root, ".codex/agents"))
    .filter((name) => name.endsWith(".toml")).map((name) => name.slice(0, -5));
  for (const role of roles) {
    it(`${role} enforces source-bound local verification and separate Owner acceptance`, () => {
      const instructions = activeInstructions(role);
      for (const value of ["OWNER_MANAGED_LOCAL", "AGENT_LOCAL", "qa_required=true",
        "source/base/fixture/lock", "command/exit/count", "selected/excluded", "DOCUMENTATION_SYNC PASS",
        "FAIL/BLOCKED/NOT TESTED", "Push/Publish/Close 차단", "admission.publishAllowed",
        "REUSE_REVIEW", "TEST_LIFECYCLE_REVIEW", "docs/REGRESSION_INDEX.md", "Owner ACCEPT"])
        expect(instructions, `${role}: ${value}`).toContain(value);
      expect(instructions).toContain("PR 생성·GitHub Actions·원격 CI·Trusted QA·자동 Finalizer 실행은 사용하지 않는다");
      expect(instructions).toContain("HIGH는 테스트·백업/복원 강도만 높이고 PR로 전환하지 않는다");
      expect(instructions).not.toMatch(/default-branch Trusted QA PASS|quality\/e2e\/docker|MERGE_READY|strict 최신 main/);
    });
  }

  it("retains independent read-only role boundaries and forbids fabricated QA", () => {
    for (const role of ["researcher", "ui-ux", "qa-docs"]) {
      expect(activeInstructions(role)).toContain("application/test/docs/GitHub 상태를 수정하지 않는 read-only 역할");
    }
    expect(activeInstructions("qa-docs")).toContain("자체 구현·기계 결과를 독립 QA 또는 Owner ACCEPT로 위조하지 않는다");
  });

  it("guards direct push and publication without authorizing destructive operations", () => {
    const infra = activeInstructions("infra");
    for (const value of ["#911 live Ruleset/Actions snapshot", "force push/branch deletion·태그 보호는 보존",
      "무제한 bypass와 [skip ci] 우회 금지", "고유 sha-<full SHA> tag collision 차단",
      "registry exact digest 새 Pull", "readiness/API/auth/native SQLite/restart smoke",
      "호환 DB snapshot", "운영 배포·SemVer/rolling tag는 별도 명시 범위 승인"])
      expect(infra).toContain(value);
  });

  it("keeps complete legacy policies in a non-normative preservation area", () => {
    const archive = "docs/history/owner-ci-retired-20261110/";
    for (const file of ["AGENTS.md", "ISSUE_LIFECYCLE.md", "QA_REVIEW_POLICY.md", "TEST_PLAN.md", "CI_CD.md"])
      expect(text(archive + file)).toContain("비규범적 이력");
    expect(text(archive + "AGENTS.md")).toContain("successful non-docs main merge의 verified `ci-<SHA>`");
    expect(text(archive + "TEST_PLAN.md")).toContain("Issue #711 — Test Suite Lifecycle");
  });

  it("keeps current operational entry points free of retired mandatory remote gates", () => {
    const current = ["AGENTS.md", "docs/ISSUE_LIFECYCLE.md", "docs/QA_REVIEW_POLICY.md",
      "docs/GITHUB_OPERATIONS.md", "docs/CI_CD.md", "docs/LOCAL_PREPR.md", "docs/REMOTE_VALIDATION.md",
      "docs/TEST_PLAN.md", "docs/DEPLOYMENT.md", "docs/AGENT_PROMPTS.md", "docs/AGENT_CONFIGURATION.md",
      "docs/PREVIEW_PUBLISH.md", "docs/ISSUE_LIFECYCLE_AUTOMATION.md", "docs/GENERIC_RELEASE_FINALIZER.md"];
    for (const file of current) {
      const content = text(file);
      expect(content, file).not.toMatch(/default-branch Trusted QA PASS|GitHub-first 검증|공식 전체 회귀 판정은 GitHub Actions|필수 aggregate 성공.*전에는 merge|PR의 GitHub Actions 결과를 기준/);
    }
  });

  it("documents all lifecycle scenarios and honest pending dependencies", () => {
    const lifecycle = text("docs/ISSUE_LIFECYCLE.md");
    for (const value of ["PLAN", "REUSE_REVIEW", "LOCAL_IMPLEMENTED", "LOCAL_VERIFIED",
      "DOCUMENTATION_SYNC", "MAIN_PUSHED", "GHCR_DIGEST_VERIFIED", "DEPLOYED_VERIFIED", "OWNER_FINAL/CLOSED",
      "LOW UI", "HIGH DB", "docs-only", "실패 재작업", "unknown", "운영 오류", "#907", "#909", "#911", "#912"])
      expect(lifecycle).toContain(value);
    expect(lifecycle).toContain("이미지 `NOT PUBLISHED`, 운영 `NOT DEPLOYED`");
  });
});
