import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// 설정 파일 위치에서 저장소 루트를 구한다. 실행 cwd에 의존하지 않는다.
const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));

export default defineConfig({
  root: repositoryRoot,
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
