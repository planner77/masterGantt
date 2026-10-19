import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const action = readFileSync(join(root, ".github/actions/node-setup/action.yml"), "utf8");
const workflow = readFileSync(join(root, ".github/workflows/ci.yml"), "utf8");
const anchor = workflow.split("    steps: &e2e_shard_steps")[1]?.split("\n  # PR E2E")[0];

describe("Issue #751 E2E native Node headers without external node-gyp download", () => {
  it("opts in only on the shared E2E 6-shard steps, leaving other npm installation jobs unchanged", () => {
    expect(anchor).toContain('use-local-node-headers: "true"');
    expect(workflow).toContain("steps: *e2e_shard_steps");
    expect(workflow.slice(0, workflow.indexOf("    steps: &e2e_shard_steps"))).not.toContain("use-local-node-headers:");
    expect(action).toContain('default: "false"');
    expect(action).toContain('export npm_config_nodedir="$node_root"');
    expect(action).toContain('npm ci --prefer-offline --no-audit');
  });

  it("resolves the installed runtime's local header root and requires exact bundled headers", () => {
    const installedRoot = dirname(dirname(process.execPath));
    expect(installedRoot).toBeTruthy();
    if (process.platform === "linux" && process.env.CI === "true") {
      expect(existsSync(join(installedRoot, "include/node/node.h"))).toBe(true);
      expect(existsSync(join(installedRoot, "include/node/common.gypi"))).toBe(true);
    }
    // A missing Node header is a setup failure, never an E2E test PASS.
    expect(action).toContain("Matching Node headers are absent");
    expect(action).toContain("exit 1");
  });
});
