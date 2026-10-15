import { readFileSync, existsSync } from "node:fs";
import { resolve, sep } from "node:path";
import ts from "typescript";

const levels = ["UNIT_MODEL", "ACTUAL_CORE", "PRODUCT_BROWSER", "HTTP_SQLITE", "PR_CI"];
const rules = Array.from({ length: 12 }, (_, i) => `GSC-${String(i + 1).padStart(2, "0")}`);
const ids = Array.from({ length: 14 }, (_, i) => `SC-${String(i + 1).padStart(2, "0")}`);
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const strings = (value: unknown): value is string[] => Array.isArray(value) && value.every(v => typeof v === "string");
const equal = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right);

/** Registration and source-reference validation only. Never reports scenario execution PASS. */
export function validateConformanceManifest(input: unknown, repositoryRoot: string): string[] {
  const errors: string[] = [];
  const fail = (message: string) => errors.push(message);
  const file = (value: unknown): string | undefined => {
    if (typeof value !== "string" || !value || value.includes("\\") || value.startsWith("/") || value.split("/").includes("..")) {
      fail(`invalid repository path: ${String(value)}`); return;
    }
    const full = resolve(repositoryRoot, value);
    if (!full.startsWith(resolve(repositoryRoot) + sep) || !existsSync(full)) { fail(`missing file: ${value}`); return; }
    return full;
  };
  if (!object(input)) return ["manifest must be an object"];
  if (input.schemaVersion !== 1 || input.standardVersion !== "1.0.0-candidate" || input.purpose !== "REGISTRATION_ONLY") fail("invalid manifest schema/version/purpose");
  if (!object(input.governance) || !equal(input.governance.rules, ["GSC-12"])) fail("missing GSC-12 governance coverage");
  else file(input.governance.file);
  if (!object(input.reuse)) fail("missing existing diagnostic/HTTP fixture reuse");
  else for (const name of ["boundedTrace", "coreBrowserSpec", "isolatedHttpFixture"]) file(input.reuse[name]);
  if (!Array.isArray(input.scenarios)) return [...errors, "scenarios must be an array"];
  const standard = readFileSync(resolve(repositoryRoot, "docs/GANTT_STATE_CONFORMANCE.md"), "utf8");
  const mapping = new Map(standard.split("\n").filter(line => line.startsWith("| SC-")).map(line => {
    const columns = line.split("|").slice(1, -1).map(value => value.trim());
    return [columns[0], { rules: columns[3].split(",").map(n => `GSC-${n.padStart(2, "0")}`), owners: columns[4].match(/U[1-5]|#573/g) ?? [] }];
  }));
  const seen = new Set<string>();
  const covered = new Set<string>(object(input.governance) && strings(input.governance.rules) ? input.governance.rules : []);
  for (const scenario of input.scenarios) {
    if (!object(scenario) || typeof scenario.id !== "string") { fail("invalid scenario schema"); continue; }
    const id = scenario.id;
    if (!ids.includes(id)) fail(`unknown scenario: ${id}`);
    if (seen.has(id)) fail(`duplicate scenario: ${id}`);
    seen.add(id);
    const expected = mapping.get(id);
    if (!strings(scenario.rules) || !scenario.rules.length || new Set(scenario.rules).size !== scenario.rules.length) fail(`${id}: invalid rules`);
    else for (const rule of scenario.rules) { if (!rules.includes(rule)) fail(`${id}: unknown GSC ${rule}`); covered.add(rule); }
    if (!expected || !equal(scenario.rules, expected.rules)) fail(`${id}: GSC mapping differs from standard`);
    if (!expected || !equal(scenario.owners, expected.owners)) fail(`${id}: owner mapping differs from standard`);
    if (scenario.productStatus !== "NOT TESTED" || typeof scenario.pending !== "string" || !scenario.pending.trim()) fail(`${id}: registration must preserve pending product evidence`);
    if (!strings(scenario.requiredEvidence) || !equal(scenario.requiredEvidence, ["PRODUCT_BROWSER", "HTTP_SQLITE", "PR_CI"])) fail(`${id}: incomplete required evidence`);
    if (!Array.isArray(scenario.cases) || !scenario.cases.length) { fail(`${id}: missing test cases`); continue; }
    const caseKeys = new Set<string>();
    for (const reference of scenario.cases) {
      if (!object(reference) || typeof reference.title !== "string" || !reference.title.trim()) { fail(`${id}: invalid case schema`); continue; }
      const key = JSON.stringify([reference.file, reference.title, reference.parameters]);
      if (caseKeys.has(key)) fail(`${id}: duplicate case`);
      caseKeys.add(key);
      if (!levels.includes(String(reference.evidenceLevel))) fail(`${id}: unknown evidence level`);
      if (typeof reference.file === "string" && reference.file.startsWith("tests/features/") && reference.evidenceLevel !== "UNIT_MODEL") fail(`${id}: unit test cannot claim browser/HTTP evidence`);
      if (typeof reference.file === "string" && reference.file.startsWith("tests/e2e/") && !["PRODUCT_BROWSER", "HTTP_SQLITE", "ACTUAL_CORE"].includes(String(reference.evidenceLevel))) fail(`${id}: invalid E2E evidence level`);
      if (reference.status !== "NOT TESTED" || reference.role !== "REGRESSION_REFERENCE") fail(`${id}: source registration cannot claim execution`);
      const path = file(reference.file);
      if (!path) continue;
      const source = ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true);
      const matches: ts.CallExpression[] = [];
      const visit = (node: ts.Node) => {
        if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && ["it", "test"].includes(node.expression.text)) {
          const title = node.arguments[0];
          if (title && (ts.isStringLiteral(title) || ts.isNoSubstitutionTemplateLiteral(title) || ts.isTemplateExpression(title))) {
            const text = ts.isTemplateExpression(title) ? title.getText(source).slice(1, -1) : title.text;
            if (text === reference.title) matches.push(node);
          }
        }
        ts.forEachChild(node, visit);
      };
      visit(source);
      if (matches.length !== 1) { fail(`${id}: missing or ambiguous test case ${reference.title}`); continue; }
      const title = matches[0].arguments[0];
      if (ts.isTemplateExpression(title)) {
        if (!object(reference.parameters) || !Object.keys(reference.parameters).length) { fail(`${id}: parameterized case needs explicit instances`); continue; }
        const loops = new Map<string, unknown[]>();
        let ancestor: ts.Node | undefined = matches[0].parent;
        while (ancestor) {
          if (ts.isForOfStatement(ancestor) && ts.isVariableDeclarationList(ancestor.initializer)) {
            const name = ancestor.initializer.declarations[0]?.name;
            let values = ancestor.expression;
            if (ts.isAsExpression(values)) values = values.expression;
            if (name && ts.isIdentifier(name) && ts.isArrayLiteralExpression(values)) {
              loops.set(name.text, values.elements.map(v => ts.isStringLiteral(v) ? v.text : ts.isNumericLiteral(v) ? Number(v.text) : undefined));
            }
          }
          ancestor = ancestor.parent;
        }
        const parameterNames = title.templateSpans.map(span => ts.isIdentifier(span.expression) ? span.expression.text : undefined);
        if (parameterNames.some(name => !name) || !equal(Object.keys(reference.parameters).sort(), [...new Set(parameterNames)].sort())) fail(`${id}: incorrect parameter names`);
        for (const [name, values] of Object.entries(reference.parameters)) {
          if (!Array.isArray(values) || !values.length || !loops.has(name) || values.some(value => !loops.get(name)!.includes(value)) || new Set(values).size !== values.length) fail(`${id}: nonexistent parameter case ${name}`);
        }
      } else if (reference.parameters !== undefined) fail(`${id}: parameters on literal test case`);
    }
  }
  for (const id of ids) if (!seen.has(id)) fail(`missing scenario: ${id}`);
  for (const rule of rules) if (!covered.has(rule)) fail(`missing rule coverage: ${rule}`);
  return errors;
}
