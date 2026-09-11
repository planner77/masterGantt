# W22 Main Commit GHCR Automation Review

검토일: 2026-09-12. 대상 version: `0.4.0`.

## Summary

W22는 성공한 `main` commit을 사용자·통합 테스트에 바로 사용할 수 있는 immutable GHCR `ci-<full SHA>` image로 게시한다. 기존 Semantic Version release는 별도 workflow와 `sha-<full SHA>` candidate를 유지한다. 두 경로 모두 build output digest를 registry에서 새로 pull해 실제 application persistence를 검증해야 하며, 한 경로의 증거를 다른 경로의 PASS로 대신하지 않는다.

상태는 **IN PROGRESS**다. Repository admin 인증과 private visibility를 확인했다. 최초 push는 PAT `workflow` scope 누락으로 거부됐지만 이후 해당 scope 추가를 확인해 원격 자동화를 재시도한다.

## Requirement Coverage

| ID | 기대 계약 | 현재 상태 |
| --- | --- | --- |
| CI09 | PR·수동 CI read-only, 성공한 main만 upstream quality/E2E/container 뒤 `ci-<full SHA>` 게시, overwrite 거부, release tag 공간 비침범 | IMPLEMENTED / REMOTE NOT TESTED |
| CI10 | Commit/release digest를 각각 새로 pull하여 policy, readiness, Project/Task authorization 저장과 restart 재조회 검증 | IMPLEMENTED / REMOTE NOT TESTED |
| Supply chain | Action SHA와 base digest pin, BuildKit provenance/SBOM 필수, GitHub Attestation plan-aware opt-in | STATIC PASS / 권한 잔여 범위 기록 |
| Repository policy | GHCR private, consumer 최소 `packages: read`, main/tag protection 의도 유지 | AUTH PASS / RULESET NOT ENFORCED·RISK ACCEPTED / PACKAGE NOT CREATED |

## Remote Facts

- 사용자 승인 범위의 credential 사용으로 `planner77/masterGantt` admin 인증이 성공했다. Credential 값은 출력·문서화하지 않았다.
- 최초 push는 PAT `workflow` scope 누락으로 거부됐고 원격 변경은 없었다. 이후 같은 인증 경로의 scope에 `workflow`가 추가된 것을 확인했으며 원격 실행을 재시도한다.
- Repository는 private이며 아직 `mastergantt` container package가 존재하지 않는다.
- Private repository ruleset API는 현재 plan에서 403을 반환했다. GitHub 공식 문서상 private branch/tag ruleset은 Pro, Team 또는 Enterprise Cloud가 필요하다.
- Private repository의 GitHub Artifact Attestation은 Enterprise Cloud가 필요하다. BuildKit registry provenance/SBOM은 별도로 계속 생성할 수 있다.
- 사용자는 private/current plan을 유지하고 branch/tag ruleset 미강제 위험을 명시적으로 수용했다. 보호가 적용됐다고 표시하지 않으며 지정 maintainer와 문서화된 절차를 운영 통제로 유지한다. Private GitHub Artifact Attestation은 비활성이고 BuildKit SBOM/provenance는 필수다.

## Verification Plan

1. Workflow syntax/action pin과 event/permission 조건을 정적으로 검사한다.
2. PR 또는 수동 run에서 publish job이 실행되지 않고 package write가 없는지 확인한다.
3. `main` push에서 quality, E2E, local container가 먼저 통과한 뒤 `ci-<full SHA>`가 한 번만 생성되는지 확인한다.
4. Workflow output digest를 새로 pull해 image content policy와 readiness를 확인한다.
5. 격리 volume의 실제 HTTP API에서 Project 생성, edit session, Task 저장, session 없는 mutation 거부를 확인한다.
6. 같은 digest container를 restart한 후 Project와 Task를 재조회해 persistence를 확인한다.
7. Commit image가 SemVer/major/minor/latest와 release `sha-<SHA>` tag를 만들지 않는지 확인한다.
8. 별도 annotated `v0.4.0` release에서 release digest pull과 동일 HTTP persistence smoke를 확인한다.
9. BuildKit provenance/SBOM을 확인하고, GitHub Attestation은 지원 plan에서 opt-in한 경우에만 별도 PASS로 판정한다.

## Local Test Results

- `0.4.0` application 기준 version/typecheck/lint와 전체 24 files / 310 Vitest: **PASS** — Manager 재검증 증거
- `linux/amd64` `0.4.0` image build: **PASS** — Manager 재검증 증거
- Image content policy와 UID/GID 1001 non-root, `.env`/SQLite/test artifact 제외: **PASS**
- 격리된 local image에서 Project 생성, edit session Cookie, 무인증 Task mutation 401, 인증 Task 생성, readonly snapshot과 container restart 뒤 재조회: **PASS**
- Main/release workflow의 event gate, upstream dependency, immutable tag/overwrite, digest pull, HTTP smoke 인자, Action full SHA와 optional attestation condition: **PASS STATIC**
- GitHub Actions run, GHCR package publish와 registry digest smoke: **NOT TESTED**

Local smoke는 전용 container와 임시 storage만 사용했고 기존 application container 및 사용자 DB를 변경하지 않았다. 위 PASS는 원격 registry에서 digest를 당겨온 증거가 아니다.

## Security Findings

- PR과 수동 CI에 registry credential/write permission을 제공하면 release blocker다.
- Commit image tag overwrite, tag 이름 충돌, digest 대신 mutable tag를 smoke 대상으로 사용하는 경우 release blocker다.
- Credential helper는 평문을 process memory에만 두고 stdout/stderr, shell history, repository, artifact 또는 workflow input에 노출하지 않아야 한다.
- Ruleset 미강제와 GitHub Attestation 비활성은 숨기지 않고 D05 위험 수용 및 원격 evidence와 분리한다.
- Attestation step은 `ENABLE_GITHUB_ATTESTATIONS=true`에서만 실행되지만 같은 publish job의 `attestations: write`와 `id-token: write` 선언은 flag가 꺼져도 존재한다. 별도 gated job으로 분리하지 않는 현재 구조의 최소 권한 잔여 위험으로 기록한다.

## Failures

- 초기 static review에서 main commit workflow가 registry API smoke script의 필수 container 인자를 누락해 항상 실패하는 문제가 발견됐고, `mastergantt-commit-smoke` 인자를 전달하도록 수정됐다.
- 현재 남은 local functional blocker는 없다. PAT scope 누락은 해결됐고 원격 결과는 검증 중이며 D05 위험 수용은 workflow PASS와 별개다.

## Remaining Risks

- 실제 main commit Actions URL, `ci-<SHA>`와 digest, HTTP persistence 결과: **NOT TESTED**
- 실제 SemVer release Actions URL, exact tag/digest와 HTTP persistence 결과: **NOT TESTED**
- Workflow 변경 원격 push: PAT `workflow` scope 확인, 재시도 준비
- Private main/tag ruleset: **NOT ENFORCED / RISK ACCEPTED**
- Private GitHub Artifact Attestation: **DISABLED BY DECISION**; BuildKit SBOM/provenance mandatory
- Production host, proxy/TLS, backup/restore: **BLOCKED / W16**

## Recommendation

**Local implementation PASS / 원격 검증 진행 / D05 RISK ACCEPTED.** Workflow 구현과 격리 local runtime 검증은 ACCEPT할 수 있다. 원격 main commit과 SemVer release를 각각 실행해 evidence를 기록하기 전에는 W22 전체를 완료 처리하지 않는다. Ruleset 미강제와 GitHub Attestation 비활성은 승인된 잔여 위험으로 계속 표시한다.
