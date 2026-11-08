import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { captureWorkingTreeProvenance } from "../e2e/helpers/ui-evidence";

const sha256 = (data: Buffer) => createHash("sha256").update(data).digest("hex");
const roots: string[] = [];
async function repo() {
  const root = await mkdtemp(join(tmpdir(), "ui-evidence-provenance-"));
  roots.push(root);
  const git = (...args: string[]) => execFileSync("git", args, { cwd: root, stdio: ["ignore", "pipe", "pipe"] });
  git("init", "--quiet");
  git("config", "user.name", "Synthetic Fixture");
  git("config", "user.email", "fixture@example.invalid");
  await writeFile(join(root, "tracked.bin"), Buffer.alloc(16));
  git("add", "tracked.bin");
  git("commit", "--quiet", "-m", "synthetic baseline");
  return { root, git };
}

/** 고정 seed의 비압축성 합성 데이터. 실제 프로젝트/사용자 자료는 사용하지 않는다. */
function binaryFixture(size: number) {
  const bytes = Buffer.alloc(size);
  let state = 0x896902;
  for (let index = 0; index < size; index++) {
    state ^= state << 13; state ^= state >>> 17; state ^= state << 5;
    bytes[index] = state & 255;
  }
  return bytes;
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })));
});

describe("합성 UI 증거 작업 트리 provenance", () => {
  test("작은 변경 digest와 staged/unstaged 양쪽 변경을 보존한다", async () => {
    const { root, git } = await repo();
    expect(await captureWorkingTreeProvenance(root)).toEqual({ workingTreeDirty: false, workingDiffSha256: sha256(Buffer.alloc(0)) });
    await writeFile(join(root, "tracked.bin"), "staged synthetic change");
    git("add", "tracked.bin");
    const staged = await captureWorkingTreeProvenance(root);
    expect(staged).toEqual({ workingTreeDirty: true, workingDiffSha256: sha256(git("diff", "--binary", "HEAD")) });
    await writeFile(join(root, "tracked.bin"), "unstaged synthetic change");
    const unstaged = await captureWorkingTreeProvenance(root);
    expect(unstaged).toEqual({ workingTreeDirty: true, workingDiffSha256: sha256(git("diff", "--binary", "HEAD")) });
    expect(unstaged.workingDiffSha256).not.toBe(staged.workingDiffSha256);
  });

  test("ignored 파일은 clean, untracked 파일은 dirty이고 기존 diff 범위를 유지한다", async () => {
    const { root, git } = await repo();
    await writeFile(join(root, ".gitignore"), "synthetic-ignored.txt\n");
    git("add", ".gitignore"); git("commit", "--quiet", "-m", "ignore synthetic output");
    await writeFile(join(root, "synthetic-ignored.txt"), "synthetic ignored data");
    expect(await captureWorkingTreeProvenance(root)).toEqual({ workingTreeDirty: false, workingDiffSha256: sha256(Buffer.alloc(0)) });
    await writeFile(join(root, "synthetic-untracked.txt"), "synthetic untracked data");
    expect(await captureWorkingTreeProvenance(root)).toEqual({ workingTreeDirty: true, workingDiffSha256: sha256(Buffer.alloc(0)) });
  });

  test("Git 종료 실패와 spawn 실패에서 빈 hash 또는 원문 stderr를 반환하지 않는다", async () => {
    const { root, git } = await repo();
    const driver = join(root, "synthetic-diff-driver");
    await writeFile(driver, "#!" + process.execPath + "\nprocess.stderr.write('SYNTHETIC_PRIVATE_SENTINEL'); process.exit(9);\n", { mode: 0o700 });
    git("config", "diff.external", driver);
    await writeFile(join(root, "tracked.bin"), "synthetic changed data");
    await expect(captureWorkingTreeProvenance(root)).rejects.toThrow(/^UI 증거 Git 명령 실패$/);
    await expect(captureWorkingTreeProvenance(join(root, "missing"))).rejects.toThrow(/^UI 증거 Git 명령 실행 실패$/);
    const emptyRoot = await mkdtemp(join(tmpdir(), "ui-evidence-no-git-"));
    roots.push(emptyRoot);
    await expect(captureWorkingTreeProvenance(emptyRoot)).rejects.toThrow(/^UI 증거 Git 명령 실패$/);
  });

  test("대용량 status 출력도 전체 버퍼 없이 dirty를 확인한다", async () => {
    const { root } = await repo();
    for (let base = 0; base < 4600; base += 100) {
      await Promise.all(Array.from({ length: 100 }, (_, offset) =>
        writeFile(join(root, "x".repeat(235) + String(base + offset).padStart(4, "0")), "")));
    }
    expect(await captureWorkingTreeProvenance(root)).toEqual({ workingTreeDirty: true, workingDiffSha256: sha256(Buffer.alloc(0)) });
  });

  test("1MiB 초과 binary diff 전체를 정확히 해시한다", async () => {
    const { root, git } = await repo();
    const data = binaryFixture(1024 * 1024);
    await writeFile(join(root, "tracked.bin"), data);
    // 기준 digest는 파일로 전달하여 child_process 출력 버퍼에 의존하지 않는다.
    const diff = join(root, "expected.diff");
    git("diff", "--binary", "HEAD", "--output=" + diff);
    const expected = await readFile(diff);
    expect(expected.length).toBeGreaterThan(1024 * 1024);
    const actual = await captureWorkingTreeProvenance(root);
    expect(actual).toEqual({ workingTreeDirty: true, workingDiffSha256: sha256(expected) });
  });
});
