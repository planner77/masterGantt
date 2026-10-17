import { build } from "esbuild";
import { createServer } from "node:http";
import { resolve } from "node:path";

/** Bundle and serve the test-only Core fixture; never installs a production route. */
export async function startBaselineAlignmentHarness() {
  const bundle = await build({
    entryPoints: [resolve(__dirname, "baseline-alignment-harness.tsx")],
    bundle: true, write: false, outdir: "fixture", platform: "browser",
    define: { "process.env.NODE_ENV": '"production"' },
  });
  const js = bundle.outputFiles.find((file) => file.path.endsWith(".js"))!.text;
  const css = bundle.outputFiles.find((file) => file.path.endsWith(".css"))!.text;
  const server = createServer((request, response) => {
    if (request.url === "/fixture.js") { response.setHeader("Content-Type", "text/javascript"); response.end(js); }
    else if (request.url === "/fixture.css") { response.setHeader("Content-Type", "text/css"); response.end(css); }
    else { response.setHeader("Content-Type", "text/html"); response.end('<!doctype html><html><head><link rel="stylesheet" href="/fixture.css"></head><body style="margin:0;font-family:system-ui"><div id="root"></div><script src="/fixture.js"></script></body></html>'); }
  });
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing harness port");
  return { url: `http://127.0.0.1:${address.port}`, close: () => new Promise<void>((done, reject) => server.close((error) => error ? reject(error) : done())) };
}
