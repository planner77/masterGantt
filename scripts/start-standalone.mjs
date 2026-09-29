import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { prepareStandaloneRuntime } from "./prepare-standalone-runtime.mjs";

const require = createRequire(import.meta.url);
const { loadEnvConfig } = require("@next/env");
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

process.env.NODE_ENV ??= "production";
loadEnvConfig(repositoryRoot, false);

function readOption(args, index, longName, shortName) {
  const current = args[index];
  if (current === longName || current === shortName) {
    const value = args[index + 1];
    if (!value || value.startsWith("-")) {
      throw new Error(`${longName} requires a value.`);
    }
    return { value, consumed: 2 };
  }
  if (current.startsWith(`${longName}=`)) {
    const value = current.slice(longName.length + 1);
    if (!value) throw new Error(`${longName} requires a value.`);
    return { value, consumed: 1 };
  }
  return null;
}

const args = process.argv.slice(2);
for (let index = 0; index < args.length;) {
  const hostname = readOption(args, index, "--hostname", "-H");
  if (hostname) {
    process.env.HOSTNAME = hostname.value;
    index += hostname.consumed;
    continue;
  }

  const port = readOption(args, index, "--port", "-p");
  if (port) {
    if (!/^\d+$/.test(port.value)) throw new Error("--port must be an integer.");
    const numericPort = Number(port.value);
    if (numericPort < 1 || numericPort > 65535) throw new Error("--port must be between 1 and 65535.");
    process.env.PORT = String(numericPort);
    index += port.consumed;
    continue;
  }

  throw new Error(`Unsupported start option: ${args[index]}`);
}

const { serverPath } = prepareStandaloneRuntime();
await import(pathToFileURL(serverPath).href);
