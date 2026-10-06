import { defineConfig, devices } from "@playwright/test";
import { resolve } from "node:path";

// 별도 production 컨테이너/Nginx를 scripts/verify-transport-smoke.sh가 준비한다.
// 개발 서버·localhost secure-context 예외·인증서 검증 생략을 사용하지 않는다.
const root = resolve(__dirname, "../..");
const http = process.env.TRANSPORT_HTTP_ORIGIN;
const https = process.env.TRANSPORT_HTTPS_ORIGIN;
if (!http || !https) throw new Error("전송 검증용 HTTP/HTTPS origin 설정이 필요합니다.");

export default defineConfig({
  testDir: resolve(root, "tests/transport"),
  outputDir: resolve(root, "test-results/transport"),
  reporter: "list",
  workers: 1,
  fullyParallel: false,
  retries: 0,
  timeout: 180_000,
  expect: { timeout: 15_000 },
  use: {
    ...devices["Desktop Chrome"],
    viewport: { width: 1440, height: 1000 },
    ignoreHTTPSErrors: false,
    // 인증 테스트에서는 비밀번호·쿠키가 trace/artifact에 저장되지 않게 한다.
    trace: "off",
    screenshot: "off",
    video: "off",
    // Hosted runner의 Chromium이 /etc/hosts 반영 직후 일시적으로 DNS 실패하지 않도록
    // 테스트 전용 hostname만 loopback에 고정한다. URL/Host/TLS hostname은 그대로 유지한다.
    launchOptions: {
      args: ["--host-resolver-rules=MAP plain.gantt.test 127.0.0.1,MAP secure.gantt.test 127.0.0.1"],
    },
  },
  projects: [
    { name: "production-http", use: { baseURL: http } },
    { name: "production-https", use: { baseURL: https } },
  ],
});
