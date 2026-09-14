"""One-time, reviewed source transformation on the dedicated Issue #8 branch.
Removed before PR; never run against an operator's checkout or database.
"""
from pathlib import Path
import json
import re
import subprocess

ROOT = Path.cwd()
assert subprocess.check_output(['git', 'branch', '--show-current'], text=True).strip() == 'feat/issue-8-internal-http'

def put(path, content):
    p = ROOT / path
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(content, encoding='utf-8')

def edit(path, old, new, count=None):
    p = ROOT / path
    text = p.read_text()
    found = text.count(old)
    assert found > 0 and (count is None or found == count), (path, old[:70], found, count)
    p.write_text(text.replace(old, new), encoding='utf-8')

# One pure parser defines runtime/startup/readiness/route/share URL policy.
p = 'src/server/security/origin-core.ts'
edit(p, '  environment: string | undefined,\n): URL {', '  environment: string | undefined,\n  allowInsecureHttp?: string,\n): URL {\n  const allowHttp = parseAllowInsecureHttp(allowInsecureHttp);', 1)
edit(p, '(environment === "production" && url.protocol !== "https:")', '(environment === "production" && url.protocol === "http:" && !allowHttp)', 1)
with (ROOT / p).open('a') as f:
    f.write('''
/** Only a server-side deployment value may opt into clear-text production HTTP. */
export function parseAllowInsecureHttp(value: string | undefined): boolean {
  if (value === undefined || value === "false") return false;
  if (value === "true") return true;
  throw new ConfigurationError("ALLOW_INSECURE_HTTP must be true or false.");
}

/** Mapping only; callers validate inside their normal error boundary. */
export function readApplicationConfiguration(env: Readonly<Record<string, string | undefined>>) {
  return {
    applicationBaseUrl: env.APP_BASE_URL,
    environment: env.NODE_ENV,
    allowInsecureHttp: env.ALLOW_INSECURE_HTTP,
  };
}
''')

# URL is now required when selecting/parsing cookies. No HTTP fallback in HTTPS.
p = 'src/server/security/cookie-core.ts'
edit(p, 'editSessionCookieName(environment: string | undefined)', 'editSessionCookieName(environment: string | undefined, applicationUrl: URL)', 1)
edit(p, 'return environment === "production"\n', 'return environment === "production" && applicationUrl.protocol === "https:"\n', 1)
edit(p, '  environment: string | undefined,\n): string[] {\n  const secure = environment === "production" || applicationUrl.protocol === "https:";', '): string[] {\n  const secure = applicationUrl.protocol === "https:";', 1)
edit(p, 'editSessionCookieName(environment)', 'editSessionCookieName(environment, applicationUrl)')
edit(p, 'cookieAttributes(applicationUrl, environment)', 'cookieAttributes(applicationUrl)')
edit(p, '  environment: string | undefined,\n): ParsedEditSessionCookie {', '  environment: string | undefined,\n  applicationUrl: URL,\n): ParsedEditSessionCookie {', 1)

# Thread the opt-in through handler dependency contracts and URL validation.
p = 'src/server/projects/project-handlers-core.ts'
edit(p, '  applicationBaseUrl: string | undefined;\n', '  applicationBaseUrl: string | undefined;\n  allowInsecureHttp?: string;\n', 3)
edit(p, '        dependencies.environment,\n      );', '        dependencies.environment,\n        dependencies.allowInsecureHttp,\n      );', 3)
edit(p, '      request.headers.get("cookie"),\n      dependencies.environment,\n', '      request.headers.get("cookie"),\n      dependencies.environment,\n      applicationUrl,\n', 2)

p = 'src/server/projects/edit-session-handlers-core.ts'
edit(p, 'interface CommonDependencies {\n', 'interface CommonDependencies {\n  applicationBaseUrl: string | undefined;\n  allowInsecureHttp?: string;\n', 1)
edit(p, '  environment: string | undefined,\n): URL {', '  environment: string | undefined,\n  allowInsecureHttp?: string,\n): URL {', 1)
edit(p, 'parseApplicationBaseUrl(configured, environment)', 'parseApplicationBaseUrl(configured, environment, allowInsecureHttp)', 1)
edit(p, '      dependencies.applicationBaseUrl,\n      dependencies.environment,\n', '      dependencies.applicationBaseUrl,\n      dependencies.environment,\n      dependencies.allowInsecureHttp,\n', 3)
edit(p, '    const cookie = parseEditSessionCookie(\n', '    const cookie = parseEditSessionCookie(\n', 3)
# The GET current-session route also needs the validated public URL.
s = (ROOT/p).read_text()
start = s.index('export function handleCurrentEditSession(')
pos = s.index('    const cookie = parseEditSessionCookie(', start)
s = s[:pos] + '    const url = applicationUrl(dependencies.applicationBaseUrl, dependencies.environment, dependencies.allowInsecureHttp);\n' + s[pos:]
s = s.replace('      request.headers.get("cookie"),\n      dependencies.environment,\n', '      request.headers.get("cookie"),\n      dependencies.environment,\n      url,\n')
put(p, s)

p = 'src/server/projects/task-handlers-core.ts'
edit(p, '  applicationBaseUrl: string | undefined;\n', '  applicationBaseUrl: string | undefined;\n  allowInsecureHttp?: string;\n', 1)
edit(p, '      dependencies.applicationBaseUrl,\n      dependencies.environment,\n', '      dependencies.applicationBaseUrl,\n      dependencies.environment,\n      dependencies.allowInsecureHttp,\n', 1)
edit(p, '  environment: string | undefined,\n): AuthorizedEditSession {', '  environment: string | undefined,\n  applicationUrl: URL,\n): AuthorizedEditSession {', 1)
edit(p, 'parseEditSessionCookie(request.headers.get("cookie"), environment)', 'parseEditSessionCookie(request.headers.get("cookie"), environment, applicationUrl)', 1)
edit(p, '    requireOrigin(request, requireApplicationUrl(dependencies));', '    const applicationUrl = requireApplicationUrl(dependencies);\n    requireOrigin(request, applicationUrl);', 3)
edit(p, '      service,\n      dependencies.environment,\n', '      service,\n      dependencies.environment,\n      applicationUrl,\n', 3)

for p, obj in [('scripts/validate-runtime-config.ts', 'configuration'), ('src/server/health/readiness-service-core.ts', 'options')]:
    edit(p, '  applicationBaseUrl: string | undefined;\n', '  applicationBaseUrl: string | undefined;\n  allowInsecureHttp?: string;\n', 1)
    text = (ROOT / p).read_text()
    pattern = r'(parseApplicationBaseUrl\(\s*' + obj + r'\.applicationBaseUrl,\s*' + obj + r'\.environment,)(\s*\);)'
    text, n = re.subn(pattern, r'\1\n    ' + obj + '.allowInsecureHttp,\\2', text)
    assert n == 1, p
    put(p, text)
# Direct environment injection is mapped consistently; no request-derived input.
for path in list((ROOT/'src/app/api').rglob('route.ts')) + [ROOT/'src/server/health/readiness.ts', ROOT/'scripts/validate-runtime-config.ts']:
    s = path.read_text()
    if 'environment: process.env.NODE_ENV,' not in s:
        continue
    s = re.sub(r'applicationBaseUrl: process\.env\.APP_BASE_URL,\s*environment: process\.env\.NODE_ENV,', '...readApplicationConfiguration(process.env),', s)
    s = s.replace('environment: process.env.NODE_ENV,', '...readApplicationConfiguration(process.env),')
    rel = path.relative_to(ROOT).as_posix()
    origin = '@/server/security/origin-core' if rel.startswith('src/app/') else '../security/origin-core' if rel.startswith('src/server/health/') else '../src/server/security/origin-core'
    s = 'import { readApplicationConfiguration } from "' + origin + '";\n' + s
    put(rel, s)
edit('scripts/validate-runtime-config.ts', 'Check DATABASE_PATH and APP_BASE_URL.', 'Check DATABASE_PATH, APP_BASE_URL and ALLOW_INSECURE_HTTP.', 1)

p = 'src/server/projects/project-share-url-core.ts'
edit(p, '  publicId: string,\n', '  publicId: string,\n  allowInsecureHttp?: string,\n', 1)
edit(p, 'parseApplicationBaseUrl(applicationBaseUrl, environment)', 'parseApplicationBaseUrl(applicationBaseUrl, environment, allowInsecureHttp)', 1)
for p in ['src/app/page.tsx', 'src/app/projects/[publicId]/page.tsx']:
    edit(p, 'buildProjectShareUrl(process.env.APP_BASE_URL, process.env.NODE_ENV, publicId)', 'buildProjectShareUrl(process.env.APP_BASE_URL, process.env.NODE_ENV, publicId, process.env.ALLOW_INSECURE_HTTP)', 1)

# Use the TypeScript parser to add a URL to legacy cookie parser tests, not a
# text substitution over unrelated function calls. No test is removed or skipped.
subprocess.run(['node', '-e', r'''
const ts = require('typescript');
const fs = require('node:fs');
const path = require('node:path');
function walk(dir) {
  for (const ent of fs.readdirSync(dir, {withFileTypes:true})) {
    const name = path.join(dir,ent.name);
    if (ent.isDirectory()) { walk(name); continue; }
    if (!name.endsWith('.test.ts')) continue;
    let text = fs.readFileSync(name,'utf8');
    const file = ts.createSourceFile(name,text,ts.ScriptTarget.Latest,true);
    const edits = [];
    function visit(node) {
      if (ts.isCallExpression(node) && node.expression.getText(file) === 'parseEditSessionCookie' && node.arguments.length === 2) {
        const arg = node.arguments[1];
        const base = arg.getText(file).includes('production') ? 'https://gantt.example.com' : 'http://127.0.0.1:3000';
        edits.push([arg.end, ', new URL('+JSON.stringify(base)+')']);
      }
      if (ts.isCallExpression(node) && node.expression.getText(file) === 'editSessionCookieName' && node.arguments.length === 1) {
        edits.push([node.arguments[0].end, ', new URL("https://gantt.example.com")']);
      }
      ts.forEachChild(node,visit);
    }
    visit(file);
    for (const [pos,addition] of edits.sort((a,b)=>b[0]-a[0])) text=text.slice(0,pos)+addition+text.slice(pos);
    if(edits.length) fs.writeFileSync(name,text);
  }
}
walk('tests');
'''], check=True)

p = 'deploy/compose.yml'
edit(p, '      APP_BASE_URL: ${APP_BASE_URL:?APP_BASE_URL must be a canonical HTTPS origin}', '      APP_BASE_URL: ${APP_BASE_URL:?Set the canonical browser origin}\n      # 미설정은 HTTPS-only. 내부망 HTTP는 명시적인 true만 허용한다.\n      ALLOW_INSECURE_HTTP: ${ALLOW_INSECURE_HTTP-false}', 1)
edit(p, '      SESSION_COOKIE_SECURE: "true"\n', '', 1)
edit(p, '실제 canonical HTTPS origin', '실제 canonical 외부 origin')
# The old reservation is not an independent security switch.
p = '.env.example'
s = (ROOT/p).read_text()
s = re.sub(r'^SESSION_COOKIE_SECURE=.*\n', '', s, flags=re.M)
s += '\n# 내부망 HTTP를 명시적으로 허용할 때만 true. 빈 값/오타는 시작 오류다.\n# APP_BASE_URL=http://192.168.10.20:8080\n# HTTPS 배포에서는 true여도 Secure 쿠키를 유지한다.\nALLOW_INSECURE_HTTP=false\n'
put(p,s)
p = 'scripts/verify-compose-smoke.sh'
s = (ROOT/p).read_text().replace('export LOG_LEVEL="info"', 'export LOG_LEVEL="info"\nexport ALLOW_INSECURE_HTTP="false"')
s = s.replace("assert str(app['environment']['SESSION_COOKIE_SECURE']).lower() == 'true'", "assert str(app['environment']['ALLOW_INSECURE_HTTP']).lower() == 'false'\nassert 'SESSION_COOKIE_SECURE' not in app['environment']")
put(p,s)

# Stage workflow edits outside .github; the connected GitHub workflow-capable
# writer will install these exact blobs and remove all preparation files.
for p in ['.github/workflows/ci.yml', '.github/workflows/release-image.yml']:
    s = (ROOT/p).read_text()
    s = re.sub(r'^\s*--env SESSION_COOKIE_SECURE=true \\\n', '\n', s, flags=re.M)
    # Existing invalid-HTTP test remains; extra transport matrix is mandatory.
    if p.endswith('/ci.yml'):
        marker = '      - name: Verify relocated Compose configuration and persistence\n'
        assert marker in s
        extra = '''      - name: production HTTP·HTTPS 브라우저 검증 도구 준비
        uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020
        with:
          node-version: 22
      - name: production 전송 정책과 실제 쿠키·인증·영속성 검증
        run: |
          npm ci
          npx --no-install playwright install --with-deps chromium
          sudo apt-get update
          sudo apt-get install --yes nginx libnss3-tools
          bash scripts/verify-transport-smoke.sh mastergantt:ci
'''
        s = s.replace(marker, extra+marker)
        # Re-test HTTP mode through the exact published digest as well.
        marker = '      - name: Attest the verified commit image digest\n'
        assert marker in s
        s = s.replace(marker, '''      - name: 게시 digest의 HTTP·HTTPS 브라우저 검증
        run: |
          npm ci
          npx --no-install playwright install --with-deps chromium
          sudo apt-get update
          sudo apt-get install --yes nginx libnss3-tools
          bash scripts/verify-transport-smoke.sh "${{ steps.digest.outputs.image }}"
'''+marker)
    else:
        marker = '      - name: Verify candidate image content policy\n'
        assert marker in s
        s = s.replace(marker, '''      - name: 릴리스 후보 HTTP·HTTPS 브라우저 검증
        uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020
        with:
          node-version: 22
      - name: 릴리스 후보 전송 정책 회귀 검사
        run: |
          npm ci
          npx --no-install playwright install --with-deps chromium
          sudo apt-get update
          sudo apt-get install --yes nginx libnss3-tools
          bash scripts/verify-transport-smoke.sh mastergantt:release-candidate
'''+marker)
    put('_issue8_staging/'+Path(p).name, s)

# Documentation must explain current exceptions alongside the original defaults.
notice = '''\n> **Issue #8 전송 정책:** production 기본값은 HTTPS다. `ALLOW_INSECURE_HTTP=true`와 canonical HTTP `APP_BASE_URL`을 함께 설정한 내부망은 production HTTP도 지원한다. 시작·readiness·공유 URL·모든 인증 경로는 같은 정책을 사용한다. `SESSION_COOKIE_SECURE`는 미사용 예약값이며 제거했다. HTTP에서는 `mastergantt_edit`, HTTPS production에서는 `__Host-mastergantt_edit; Secure`를 사용하고 HttpOnly·SameSite=Strict·Path=/·TTL 및 Domain 미설정을 유지한다. 아래 과거 검증 이력의 HTTPS-only 표현은 당시 기준이다. 현재 운영·전환 절차는 [HTTP_OPERATION](HTTP_OPERATION.md)을 따른다.\n'''
for p in ['docs/SECURITY.md','docs/DEPLOYMENT.md','docs/API.md','docs/REQUIREMENTS.md','docs/CI_CD.md','docs/TEST_PLAN.md','docs/REMOTE_VALIDATION.md','docs/REPOSITORY_STRUCTURE.md','docs/PROJECT_UX.md']:
    s = (ROOT/p).read_text()
    first, rest = s.split('\n',1)
    put(p, first+'\n'+notice+'\n'+rest)
with (ROOT/'docs/DECISIONS.md').open('a') as f:
    f.write('''\n## Issue #8 — 내부망 production HTTP의 명시적 허용 (2026-09-14)\n\n사용자 요구에 따라 HTTPS 기본값은 유지하면서 `ALLOW_INSECURE_HTTP=true` opt-in을 채택한다. HTTP URL만 지정하거나 빈/잘못된 boolean 값이면 fail-closed. 요청 Host/Origin/forwarded header로 설정을 변경하지 않는다. HTTP 전송은 암호화되지 않으므로 조직 승인·네트워크 접근 제한이 별도로 필요하며 HTTPS와 동등한 보안으로 보지 않는다. 쿠키는 포트별로 격리되지 않는다. 운영 전환은 기존 Compose 프로젝트·volume 보존 및 재로그인을 전제로 한다. 코드/브라우저 검증은 [HTTP_OPERATION](HTTP_OPERATION.md)에 정의하고 실제 PASS는 PR/run/head 증거로 판단한다.\n''')
for p in ['AGENTS.md','.codex/agents/backend.toml','.codex/agents/infra.toml','.codex/agents/qa-docs.toml']:
    s = (ROOT/p).read_text()
    instruction = 'Issue #8: production HTTPS 기본값과 명시적 ALLOW_INSECURE_HTTP=true 내부망 HTTP를 함께 지원한다. 공용 URL parser와 검증된 외부 URL 기반 쿠키 정책을 사용하고 HTTP 때문에 Origin/session/revision 검증을 제거하지 않는다. docs/HTTP_OPERATION.md 및 실제 production HTTP/HTTPS browser CI를 확인한다.'
    if p.endswith('.toml'):
        # A TOML comment changes no role config syntax; append inside developer
        # instructions before the final triple quote so the role actually reads it.
        pos = s.rfind('"""')
        assert pos >= 0
        s = s[:pos]+'\n'+instruction+'\n'+s[pos:]
    else:
        s += '\n## 내부망 HTTP 운영 (#8)\n\n'+instruction+'\n'
    put(p,s)
p = 'CHANGELOG.md'
edit(p, '## [Unreleased]\n', '## [Unreleased]\n\n### Added\n\n- Issue #8: production 내부망 HTTP opt-in, 외부 URL 기반 쿠키 정책, Nginx HTTP 예제 및 production HTTP/HTTPS 브라우저·영속성 CI.\n', 1)
with (ROOT/'docs/exec-plans/active/PLAN.md').open('a') as f:
    f.write('\n## Issue #8 — 내부망 HTTP\n\n전용 브랜치에서 URL/쿠키/설정 주입/공유 URL과 문서를 갱신한다. PR quality/E2E/Docker 및 HTTP·HTTPS 실제 브라우저 검증 후 리뷰·병합하고 main exact digest 결과를 별도로 기록한다. 본 계획 추가만으로 PASS가 아니며 운영 Windows/WSL2 전환은 별도 미검증이다.\n')
# README keeps complete HTTP and HTTPS examples, without claiming TLS is mandatory.
p = 'README.md'
s = (ROOT/p).read_text()
s = s.replace('production은 HTTPS 필수', 'production은 기본 HTTPS, ALLOW_INSECURE_HTTP=true일 때 내부망 HTTP 허용')
s = s.replace('production에서는 HTTPS만 허용한다.', 'production에서는 기본 HTTPS만 허용하며, 명시적 ALLOW_INSECURE_HTTP=true일 때 HTTP도 허용한다.')
s = s.replace('production은 HTTPS 필수', 'production은 기본 HTTPS이며 HTTP는 명시적 허용 필요')
s = s.replace('`TRUST_PROXY`, `SESSION_COOKIE_SECURE`, `LOG_LEVEL`', '`TRUST_PROXY`, `LOG_LEVEL`')
s = s.replace('`TRUST_PROXY`·`SESSION_COOKIE_SECURE`·`LOG_LEVEL`', '`TRUST_PROXY`·`LOG_LEVEL`')
s = s.replace('Cookie `Secure`와 `__Host-` 이름은 `NODE_ENV`와 `APP_BASE_URL`에서 강제', 'Cookie 속성은 검증된 외부 APP_BASE_URL과 NODE_ENV로 결정; HTTP/HTTPS 정책은 아래 운영 절 참조')
marker = '### Nginx Reverse Proxy 운영\n'
assert marker in s
s = s.replace(marker, marker+'\n**내부망 HTTP:** 인증서 없이 운영할 때는 아래 HTTP 전용 절과 [상세 운영 정책](docs/HTTP_OPERATION.md)을 먼저 적용한다. 뒤의 HTTPS 예제는 선택 가능한 별도 구성이다.\n\n<!-- ISSUE8_HTTP_EXAMPLE -->\n')
put(p,s)
# Minimal inspection output only; do not print credentials or runtime environment.
subprocess.run(['git','diff','--check'],check=True)
print('Issue #8 source/docs transformation prepared; NOT TESTED until PR CI.')
