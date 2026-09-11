import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function collectMarkdown(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const filename = resolve(directory, entry.name);
    if (entry.isDirectory()) return collectMarkdown(filename);
    return entry.isFile() && entry.name.endsWith(".md") ? [filename] : [];
  });
}

const root = resolve(import.meta.dirname, "..");
const rootMarkdown = readdirSync(root, { withFileTypes: true })
  .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
  .map((entry) => resolve(root, entry.name));
const files = [...new Set([...rootMarkdown, ...collectMarkdown(resolve(root, "docs"))])].sort();
const broken = [];

for (const filename of files) {
  const source = readFileSync(filename, "utf8");
  for (const match of source.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/g)) {
    const rawTarget = match[1].trim().replace(/^<|>$/g, "");
    if (!rawTarget || rawTarget.startsWith("#") || /^(?:https?:|mailto:|tel:)/i.test(rawTarget)) continue;
    const target = rawTarget.split("#", 1)[0];
    if (!existsSync(resolve(filename, "..", target))) broken.push(`${filename}: ${rawTarget}`);
  }
}

if (broken.length > 0) {
  console.error(`Broken local Markdown links:\n${broken.join("\n")}`);
  process.exit(1);
}

console.log(`Verified local Markdown links in ${files.length} files.`);
