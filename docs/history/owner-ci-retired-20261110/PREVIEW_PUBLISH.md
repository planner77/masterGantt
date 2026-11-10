# 보존 기록 — docs/PREVIEW_PUBLISH.md

> 2026-11-10 Owner 결정 이전의 비규범적 이력이다. 신규 작업·Push·게시·종료의 gate로 사용하지 않는다. 원본 기준 commit: `4aad8865972e3446f0d34c7ffcfd2bbab439e366`. 아래 본문은 누락 없이 보존하고 로컬 링크 경로만 보존 위치에 맞게 조정했다. 현재 계약은 [Issue Lifecycle](../../ISSUE_LIFECYCLE.md)을 따른다.

---

## Issue #896 — v2 증거와 Preview 연결 (2026-11-09)

v2 manifest의 source Head와 Preview source를 일치시킨다. CI checkout/test-merge SHA를 PR Head로 표시하지 않는다. 로컬 dirty 캡처는 working 지문을 보존하고 clean Preview 동등성으로 수용하지 않는다. PNG/geometry·fixture digest와 실제 flow를 확인해도 #897 Owner UAT·Manager ACCEPT는 별도다. 본 #896 구현은 Preview 이미지를 게시하지 않는다. public에는 합성 fixture만 허용하며 실운영 UAT는 승인된 private 위치에 보존한다. [계약](../../UI_EVIDENCE.md).

## Issues #896–#897 — 기존 GHCR Preview의 Visual Evidence·Owner UAT 연결 (2026-11-08)

현재 워크플로는 시험용 이미지의 정확 SHA·GHCR digest와 Docker/API/SQLite Smoke만 보장한다. **접속 가능한 사내 Preview 웹서버와 실제 사용자 UAT는 별도**다. 기존 #703 workflow_dispatch/Owner authorize/Build-once/격리 Compose를 재사용하고 운영 DB·Secrets를 사용하거나 새 정식 GHCR 태그를 만들지 않는다.

UI 변경은 기존 Playwright 합성 Fixture screenshot·geometry 및 정확 sourceSha/Issue·AC의 manifest와 연결한다. scripts/ui_evidence.py가 파일과 PNG SHA256 무결성을 확인하더라도 사람의 디자인 적합성은 검증되지 않는다. 공개 GitHub에 사내 URL·업무 데이터가 든 UAT screenshot을 올리지 않는다.

Owner가 실제 Preview 접속·흐름 검토 후 아래 6행 형식의 **GitHub Issue 댓글**에 단일 결정을 기록한다. 승인자가 repo Owner인지, Issue·이미지 digest·manifest digest·PR 최신 SHA인지 scripts/preview_uat.py가 읽기 전용으로 재검증한다. ACCEPT 이후 REWORK 또는 소스 변경은 승인 재사용 불가. 아직 UAT되지 않은 경우 미승인 상태를 BLOCKED/NOT TESTED로 남긴다.

    mastergantt-preview-uat:v1
    issue: 889
    source_sha: <정확한 40자리 소문자 Git SHA>
    image_digest: sha256:<64자리 소문자 hex>
    evidence_sha256: sha256:<64자리 소문자 hex>
    decision: ACCEPT

위 꺾쇠 부분은 안내용 placeholder이며 실제 댓글은 검증된 값으로 교체한다. 이 Owner UAT는 기존 Manager merge ACCEPT/Trusted QA·Full PR CI·Main/Release 검증과 **서로 다른 단계**다. 새로운 Ruleset required check 자동 등록 없음; 최초 수용은 Manager가 병합 전 실제 확인한다. 아래 #703 원문에 남은 6-shard 언급은 구현 당시 이력이며 **현행 Full PR은 8-shard**다.

---

# Preview-first, Release-after-CI — GHCR 시험용 이미지 (#703)

> 상태: 구현 후보. **Preview는 정식 릴리스, CI/QA PASS, 병합 승인 또는 운영 이미지가 아니다.** [Issue #703](https://github.com/planner77/masterGantt/issues/703)의 명시적 분리 기능이다.

## 목적 및 신뢰 경계

Full PR CI의 Chromium 6-shard/Required Gate가 반복 실패하는 동안 개발 중인 기능을 실제 **격리 컨테이너**에서 확인할 수 있도록 별도 GHCR Preview 이미지를 빌드·게시한다. 제품/도메인 기능을 변경하지 않고 기존 [CI/CD](../../CI_CD.md), [QA 정책](../../QA_REVIEW_POLICY.md), [로컬 검증](../../LOCAL_PREPR.md), [원격 검증](../../REMOTE_VALIDATION.md)을 유지한다.

- 기존 \`.github/workflows/ci.yml\`의 Full PR CI/3 Required Check, Trusted QA, unresolved thread 0, 최신 main 정렬, Owner 승인, Main 검증 \`ci-<full SHA>\`, SBOM/provenance·정식 SemVer/Release·Finalizer를 변경하거나 우회하지 않는다.
- **Preview 패키지는 별도** \`ghcr.io/planner77/mastergantt-preview:issue-<N>-<full40SHA>\`. 정식 \`ghcr.io/planner77/mastergantt:ci-<SHA>\`/\`X.Y.Z\`/\`latest\`를 덮어쓰지 않는다.
- GHCR 태그는 외부 사용자에 의해 변경 불가능하다고 가정하지 않는다. 이 워크플로는 기존 태그를 감지하면 차단하지만 서버 차원의 tag immutability 보호를 제공하지는 못한다. 실행 환경에서는 확인된 **digest**로만 Pull/Pin한다.
- Workflow는 trusted default \`main\`에 병합된 **이후**에만 실제 \`workflow_dispatch\` 사용 가능하다. 해당 Workflow 자체의 PR 검증은 정식 필수 CI를 모두 수행한다.
- 실행은 저장소 Owner의 수동 지시만 가능하다. 이슈/branch/SHA는 기본 브랜치의 고정된 검증기에서 GitHub API 원본으로 확인한다. 테스트 코드의 작성자 댓글/PR 본문은 Owner 인증이 아니다.
- Preview의 실사용 검증과 운영 투입/업무 데이터 보존은 완전히 별개다.

## 준비: PR 이전 로컬 검증

1. 해당 Issue에 귀속되는 독립 Branch(\`ci/issue-703-preview-publish\`, \`feat/issue-704-...\` 등)에서 소스를 고정한다. Branch HEAD와 40자리 소문자 SHA를 확인한다.
2. [로컬 사전 검증](../../LOCAL_PREPR.md)의 \`npm run verify:prepr -- --mode=fast --base=origin/main --issue=N --risk=HIGH\` 및 영향 범위의 \`--mode=targeted\`, \`--mode=docker\`를 실시한다. \`--dry-run\`은 PASS가 아니다.
3. 실제 report의 base/head·명령/exit/환경/UNKNOWN·누락 테스트를 Work Packet에 남긴다. 외부 CI PASS로 주장하지 않는다.
4. GHCR Preview는 **같은 고정 SHA**에 대해 Owner가 수동으로 요청한다. PR을 열거나 변경 Push를 할 경우 기존 \`pull_request\`의 \`opened/synchronize\`가 전체 CI를 자동 시작할 수 있으므로 최초 효율 경로는 **PR 열기 전**이다.

## 실행 방법

GitHub Actions → **Preview 시험용 GHCR 이미지 게시** → **Run workflow**에서
- 대상 branch: 반드시 \`main\` (workflow 자체를 trusted default main에서 시작)
- \`issue_number\`: 열려 있는 실제 Issue의 번호
- \`branch\`: 같은 저장소의 작업 branch (\`issue-<N>\` 포함)
- \`source_sha\`: 그 branch HEAD의 **소문자 full SHA**
- \`reason\`: 로컬 검증 또는 기능 확인 목적; 승인·성공 증거로 사용하지 않음

GitHub API 조회/원본 SHA/Owner/main이 불명확하면 발행하지 않는다. 검사 중 main이 이동해 신뢰된 워크플로 실행 SHA와 달라지거나 작업 branch가 이동하면 Fail-closed로 종료한다. 다시 최신 SHA를 고정하고 요청한다.

세 Job의 권한 분리:

| Job | 코드 출처·권한 | 동작 |
| --- | --- | --- |
| \`authorize\` | trusted main, \`contents/issues:read\` | GitHub Issue·Owner·main·branch SHA 인증 |
| \`build\` | trusted main 검증기 + 별도 source SHA, \`contents:read\` | 정확 SHA Docker Build, trusted image policy, migration/health/API/SQLite/restart Smoke, 같은 Run artifact 생성 |
| \`publish\` | trusted main, \`packages:write\` | 같은 Run artifact SHA256 검사, 인증 재조회·tag 부재 확인, 동일 이미지 \`docker load/tag/push\`, digest pull/revision 검증 |

소스 branch의 Dockerfile/앱은 \`build\`에서 실행되므로 그 Job에는 GHCR write Secret이 없다. \`publish\`는 원본 코드를 checkout/실행·재빌드하지 않는다. Build-once archive 인계는 빌드 컨테이너/네트워크·캐시를 포함해 시간이 들고, 로컬 smoke가 누락한 회귀는 남는다. SBOM/provenance가 정식 Release 증거와 동일하다고 주장하지 않는다.

성공한 Run의 Job Summary에 \`UNVERIFIED_PREVIEW\`, source SHA, 인증된 digest를 출력한다. 실패 후 Registry에 일부 전송된 이미지가 있더라도 자동 재게시·임의 삭제하지 않는다. 반드시 Registry 실원장을 확인한 뒤 Owner가 처리한다.

## 시험 환경 적용 (운영과 격리)

정확한 digest를 \`docker pull ghcr.io/planner77/mastergantt-preview@sha256:<검증된 Digest>\`로 Pull한다. 비공개 패키지는 적절한 GHCR **read** 권한으로 \`docker login ghcr.io\`가 필요하다. 로컬 운영 Compose에 포함시키지 말고 **별도 Compose 프로젝트·포트·볼륨**을 사용한다.

예시 (호스트 이름/인증 정보는 시험 환경에 맞게 교체):

~~~yaml
services:
  preview:
    image: ghcr.io/planner77/mastergantt-preview@sha256:REPLACE_WITH_VERIFIED_DIGEST
    environment:
      APP_BASE_URL: https://preview.example.invalid
      DATABASE_PATH: /data/mastergantt.sqlite3
    ports:
      - "127.0.0.1:3180:3000"
    volumes:
      - preview_data:/data
    restart: "no"

volumes:
  preview_data:
~~~

Reverse proxy/TLS 테스트는 해당 URL의 인증된 시험 전용 호스트를 이용한다. **운영 DB의 원본 파일·SQLite WAL/SHM·운영 Secrets·공유 volume·운영 호스트 포트를 연결하지 않는다.** DB 변경 위험이 높은 이슈는 빈 DB 또는 검증된 백업 복제본과 별도 restore 점검이 필수다.

Preview 결함 확인 시: (1) 로그/재현 조건과 image digest 기록 → (2) 시험 인스턴스 중단 → (3) 기존 확인된 정상 digest로 별도 시험 인스턴스 복구 → (4) 데이터가 변경되었으면 별도 보존한 백업으로 restore 후 무결성 확인 → (5) 같은 Issue/Branch의 수정 SHA로 새 Preview 게시. 앱 컨테이너만 되돌린다고 DB migration이 자동 rollback 되지는 않는다.

태그 삭제·보존은 Owner 정책 및 GHCR Package 권한에 따른 **수동 관리**로 한다. Preview 삭제가 정식 \`ci-<SHA>\`/SemVer/tag/Release/Issue lifecycle을 변경해서는 안 된다.

## 최종 정식 릴리스

Preview 확인 완료 시 PR 생성 → 변경 파일에 따른 사전 검증 → Required Quality/Chromium E2E 6 shard/Docker aggregate의 정확한 최신 Head/base/test-merge Run+attempt 성공 → Trusted QA 및 미해결 리뷰 thread 0/충돌 0 → Owner 명시 위험 수용·병합 승인 → Main CI → 기존 verified candidate \`ci-<mergeSHA>\` → 정식 버전별 Release 승인 → Finalizer 절차 순으로 진행한다. Preview 성공으로 이 단계를 우회하지 않는다.

## 비용·시간 평가

- 전/후 동등 workload에서 \`time-to-first-preview\`, Preview Build/Smoke/artifact upload/publish 각각의 시간, PR full CI run 수, E2E shard runner-minutes, 수정→실제 사용 대기 시간을 관측한다.
- **이미 열린 PR의 업데이트는 기존 CI를 자동 시작할 수 있다.** Preview 게시만 추가하면 실행 비용이 오히려 증가할 수 있다. 전체 CI trigger 변경과 Ruleset Required 완화는 이번 범위에 없다.
- 3개 유효한 시험 Run 비교 이전 절감 시간·비율, end-to-end Preview 게시/실사용 성공은 \`NOT TESTED\`이다.
- 위험·비용이 높으면 해당 워크플로를 비활성화하고 GHCR Preview 사용을 중단한다. 기존 PR/Main/Release 규칙은 변경하지 않았으므로 별도 기존 경로 복구 조치가 필요 없다.

## 보안 음성 시나리오

\`tests/python/test_preview_publish.py\`는 Owner가 아닌 Actor, main 아닌 실행, Issue 누락/폐쇄·PR 오인, branch 잘못된 소속/위조·SHA stale, 최초 main SHA stale, 다른 repo, GHCR 200/401/403/429/5xx, 출력 개행 주입, Preview와 Main/Release 워크플로 분리를 검증한다. 신규 Workflow를 실제 main에 병합한 후 새 Issue branch에서 최소 1회 수동 smoke를 수행하기 전 **Preview GHCR 실발행 성공은 NOT TESTED**이다.

**문서 영향:** \`AGENTS.md\`, \`docs/CI_CD.md\`, \`docs/LOCAL_PREPR.md\`, \`docs/REMOTE_VALIDATION.md\`, \`docs/ISSUE_LIFECYCLE.md\`, \`docs/TEST_PLAN.md\`은 Preview 경로를 별도 문서로 연결한다. \`docs/QA_REVIEW_POLICY.md\`는 권한·QA 규칙 불변으로 N/A, \`DESIGN.md\`는 UI 없음으로 N/A, \`docs/API.md\`/\`docs/DB_SCHEMA.md\`는 제품 API·Schema 변경 없음으로 N/A.
