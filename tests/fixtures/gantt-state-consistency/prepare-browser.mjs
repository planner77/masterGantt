import { build } from "esbuild";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";

// esbuild is the installed tsx tool dependency, not a new runtime dependency.
const repositoryRoot = fileURLToPath(new URL("../../../", import.meta.url));
const directory = resolve(repositoryRoot, "output/playwright/issue-663");
await mkdir(directory, { recursive: true });
await build({
  absWorkingDir: repositoryRoot,
  entryPoints: ["tests/fixtures/gantt-state-consistency/browser.tsx"],
  bundle: true, outfile: resolve(directory, "core-reader.js"), format: "iife",
  jsx: "automatic", define: { "process.env.NODE_ENV": '"production"' },
  loader: { ".svg": "dataurl", ".woff2": "dataurl", ".woff": "dataurl" },
});
await writeFile(resolve(directory, "core-reader.html"), `<!doctype html>
<html lang="en"><meta charset="utf-8"><title>Issue 663 synthetic Core reader</title>
<link rel="stylesheet" href="core-reader.css"><style>html,body{margin:0}#fixture{height:600px;width:1440px}</style>
<div id="fixture"></div><script src="core-reader.js"></script></html>\n`);
await writeFile(resolve(directory, "cli-config.json"), JSON.stringify({
  allowUnrestrictedFileAccess: true,
  browser: {
    browserName: "chromium",
    launchOptions: { headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ?? chromium.executablePath() },
    contextOptions: { viewport: { width: 1440, height: 900 }, timezoneId: "Asia/Seoul" },
  },
}, null, 2));
console.log(resolve(directory, "core-reader.html"));
