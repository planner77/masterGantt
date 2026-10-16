## Issue #622 — CLOSED/FINAL 누락 이력의 제한된 Owner 복구 (2026-10-15)

기존 #622는 Owner가 병합된 최종 PR의 Main CI 완료 전 `CLOSED`로 전환하여, Generic Resolver가 `non-actionable ordering barrier`로 건너뛰었다. 따라서 동일 #622의 PR #684/#686/#691 3개 작업 브랜치와 Release/임시 GHCR 후보 정리 및 bot-origin FINAL 기록은 누락된 반면 후속 #665/#666의 FINAL은 성공했다. 사용자 승인 범위 내 **#622에 한정**된 read-only 감사 후 적법한 재진입 경로를 허용한다.

- 신규 이슈나 신규 독립 one-shot workflow 없이 **기존 `release-finalizer.yml`의 제한된 Owner issue_comment Job**에서만 `scripts/closed_issue_622_recovery.py`를 실행한다. 지정 issue #622, authenticated repository OWNER 실제 댓글과 `mastergantt-closed-622-recovery:v1`의 가장 최신 정확한 `pr`, `main_sha`, `release_sha=1449190af8d4f97d4737d17ae67e9dcb044549a7`, `version=0.114.0`, `note` 및 승인 Boolean이 필수다. 코멘트가 다른 곳에 복사되거나 HEAD/댓글 변경 시 BLOCKED한다.
- 복구 PR 자체가 latest main two-parent merge여야 하며 first parent는 검증한 #691 merge `c1dbf61be427934569593796dd7892d0e4ddc2bf`, second parent는 정확한 승인 PR Head여야 한다. #684 original `bd54205741da65a0211cf77f9cb086d3cdb1ab2a`(Main FAIL), #686 교정 `1449190af8d4f97d4737d17ae67e9dcb044549a7`(Main/Release SUCCESS), #691 교정 `c1dbf61be427934569593796dd7892d0e4ddc2bf`가 같은 main first-parent 역순이며 PR Refs #622/Head/Base/merge 일치해야 한다. 동시에 후속 #665/#666의 인증된 bot FINAL 및 #622 CLOSED 상태와 신규 FINAL 중복/충돌을 검증한다.
- `v0.114.0`은 기존 immutable annotated tag가 **교정 #686 SHA**를 가리키고, 해당 exact `release-image` Run SUCCESS, 승인된 Owner version marker, #686의 Main CI+GHCR candidate gate가 PASS해야 한다. **태그 이동·재생성·정식 릴리스 재게시를 하지 않는다.** GitHub Release 객체가 없는 경우 자동 생성·발행 권한을 추론하지 않는다.
- `issue_lifecycle.resolve_context`를 사용하여 가장 최신 복구 PR의 Required 3종, Main CI+verified ci-SHA, non-docs/version0.114.0을 확인한다. 전체 작업 브랜치에 대한 `safe_branch_cleanup.py` SHA lease·보호 여부·외부 열린 PR 참조·Main ancestry를 사전 검사하고, #691 및 복구 PR의 임시 GHCR 후보가 다른 tag를 공유하지 않는다는 `--check-only`도 완료한 뒤에만 mutation한다. #686의 정식 릴리스 후보는 참조 보존한다.
- 실제 mutation은 먼저 #691의 과거 검증된 임시 후보만 안전 정리하고, **기존 `issue_lifecycle.finalize()`**에 `--resolver-ordered`/정확 Main SHA/`--cleanup-pr 684 686 691`을 전달한다. 이 함수의 기존 branch cleanup, latest ci candidate cleanup, trusted `github-actions[bot]` FINAL 기록, closed 상태 유지, 재진입 멱등성·snapshot gate를 변경하지 않는다. 비정상 200/404·SHA 변경·중복/누락 원장은 중단한다.
- 작업 브랜치 삭제 이후 REST Git Ref가 잠시 HTTP 200을 반환하는 경우 `safe_branch_cleanup.confirm_deleted_ref`는 **최대10회·간격2초** 정확한 같은 tip만 관측하고 **404가 나와야** 완료로 간주한다. 다른 SHA·지속 200이면 BLOCKED. 브랜치 삭제는 항상 기존 `--force-with-lease` SHA를 유지한다.

실행은 이 코드의 보호된 전체 PR CI/Trusted QA·Owner 위험 수용·Main CI 성공 **이후에** #622에 정확한 version/PR/Main SHA의 새로운 Owner 댓글을 기록하는 것으로만 시작한다. COMMENT/자동 QA 자체를 복구 승인으로 해석하지 않고 추적 전용 bot FINAL을 수동으로 위조하지 않는다. 후속 원격 완료/브랜치 정리/FINAL/Issue state는 실제 Job 결과로 판정한다.

## Issue #622 — 최초 Main FAIL 이후 정식 교정 태그 Resume #35 보호 (2026-10-15)

[Release #170.1](https://github.com/planner77/masterGantt/actions/runs/38701345395)은 `v0.114.0`의 immutable tag를 교정 PR #686 merge `1449190af8d4f97d4737d17ae67e9dcb044549a7`에 생성·정식 GHCR 이미지로 promotion했다. 그러나 [Resume #35.1](https://github.com/planner77/masterGantt/actions/runs/38704333977)은 `auto_release_finalizer.execute`가 first-parent 실패 원본 PR #684 `bd54205741da65a0211cf77f9cb086d3cdb1ab2a`의 tag state를 **supersession 판정 전에** 조회하여 교정 SHA를 잘못된 태그로 거부했다. 이는 기존 원본 Main 실패를 승격할 근거가 아니며 정상적인 fail-closed가 교정 복구를 막은 실행 순서 결함이다.

복구 정책: main first-parent 원장의 **CI 실패** 원본과 **동일 Issue, 동일 application version, 중간에 이종 Issue·docs-only·버전 변경 없이 연결된**, 성공한 exact Main CI의 교정 PR을 먼저 읽기 전용으로 판정한다. 원본 태그 조회에서 실제 annotated Git tag가 **그 교정 SHA**를 가리키는 경우만 `superseded-by-corrective`로 분류한다. 세 번째 SHA, 임의의 새 Issue/버전, Main FAIL 교정, 범위 축소, 성공한 원본 Main, 태그 유형 불일치는 기존처럼 FAIL/BLOCKED로 차단한다. 실제 릴리스 완료 증거는 반드시 교정 SHA 자체의 tag/release-image 성공과 exact candidate digest·Owner 승인으로 재검증하고서만 `release_finalize`한다.

원본 Main #2771.1 실패 및 #622 원본 PR #684은 불변이며 기존 immutable v0.114.0 tag의 이동·삭제·동일 버전 재게시 없이 기존 실패 Resume #35를 보완 코드 병합 후 재실행한다. Cleanup/FINAL/Issue close는 실제 Actions 결과 확인 전 NOT TESTED다. #622 기능 또는 #666 Gantt 제품 완료 증거로 사용하지 않는다.

## Issue #670 — v0.108.0 승계 준비와 Finalizer 차단 경계 (2026-10-14)

- [감사 #19](https://github.com/planner77/masterGantt/actions/runs/38452926077)의 `PREPARE_ONLY`는 #616 Owner의 `v0.107.0` 철회 및 `v0.108.0` *준비* marker가 감사 SHA `bdfd1ea1b9d3453c3b8d97de80820b35ed22ee12`에 대해 유효하다는 독립 read-only 결과다. 신규 릴리스의 발행 권한·`v0.108.0` tag/source SHA로 해석하지 않는다.
- Issue #670 준비 PR은 `package.json`·`package-lock.json` 후보 `0.108.0`으로 변경하며 `release_required=true`, `release_authorized=false`. 정식 GHCR release, annotated tag, rolling alias 변경 및 Issue #616 종료는 실행하지 않는다.
- Owner가 이후 **새로운 정확한 merge SHA·SemVer·출처**에 대한 정식 게시를 별도로 승인하기 전에는 Generic Finalizer 또는 `issue-lifecycle release_finalize`의 승인된 릴리스 경계를 통과한 것으로 취급하지 않는다. 릴리스 전 새 push Main CI Required3와 인증된 보존 `ci-<SHA>` OCI digest/SBOM/provenance·정식 버전 충돌 부재를 검증한다.
- 최종 publication/Finalizer 성공만으로 #616 Target F2 업무 AC가 자동 수락되거나 역사적 #2621.1 FAIL이 소급 성공하는 것은 아니다. 이미 발행된 `v0.106.1` tag/digest와 버전별 Owner 철회 원장 불변; 감사/권한 불명확 때 BLOCKED 유지.

## Issue #651 — 이미 발행된 v0.106.1 승계 감사 (2026-10-13)

- #649의 모든 선행 SemVer ABSENT 가정은 잘못됨. #633의 v0.106.1 annotated tag 원본 SHA `09bee924032b4126ff794ec7a485542fd72dd7bf`, verified candidate/promotion digest `sha256:0ab78272f2637ca73ae0a1e7bec4f41b24fcc35e35f13cfc94b7e13a9cad560f`, Main CI #2579.1 및 Release #165.2 성공을 원장에 보존한다. GitHub Releases API by-tag 404는 tag/GHCR 부재가 아니다.
- `release_succession_preflight.py`는 v0.106.1 PRESENT를 exact SHA/digest로 인정하고 v0.105.0/v0.106.0 미발행 퇴역, v0.107.0 미발행, v0.108.0 후보 미게시를 구분한다. GHCR 전체 인증 조회·Git tag peeled SHA·GitHub Release 전체 페이지·Main/Release CI/Owner/퇴역 bot 원장·first-parent가 모두 검증돼야 한다. `evidence` 객체는 순수 함수의 입력이므로 자기 신고를 인증으로 간주하지 않는다. 실제 read-only runner 수집 및 provenance 연결이 없으면 운영 판정은 BLOCKED/NOT TESTED다.
- #616의 v0.107.0 기존 Owner 승인 철회와 신규 v0.108.0 준비 결정은 별도 인증 Owner marker가 필요하며 아직 확보되지 않았다. 이번 #651은 `release_required=false`, `release_authorized=false`, HIGH/OWNER_MANAGED; publication, retirement, Issue #616 종료, 기존 태그 삭제/이동 금지. PR CI Quality/E2E6/Docker 및 Trusted QA는 새 Head에서 별도 검증한다.

## Issue #645 — original SHA Main CI source PR provenance false-negative 보완 (2026-10-13)

- 복구 source `/commits/{sha}/pulls` 인덱스가 비어 있는 경우만 `/pulls?state=closed` 전수 read-only 조회로 원본 `merge_commit_sha`/PR 번호/실제 merged_at의 **유일성**을 검증한다. 독립 `GET /pulls/{PR}`, 병합 커밋 두 부모↔PR base/head, first-parent, Owner/Issue/PR/version/recovery approval 등은 추가 확인이므로 보안 강도를 낮추지 않는다.
- missing/ambiguous/pagination failure/foreign PR/미병합 API는 `BLOCKED`; 성공·실패 Run을 지우거나 기존 태그/후속 릴리스 부채를 재작성하지 않는다. #645 PR은 `release_required=false` 운영 검증기 변경이며, #616 원본 SHA의 Quality/E2E6/Docker·private GHCR digest·SBOM/provenance·정식 v0.107.0 Finalizer까지 수행한 증거가 아니다. 그 작업은 별도 인증 Owner 복구 dispatch와 immutable Run 결과가 필요하다.

## Issue #643 — 수동 Main 복구 Run 원본 확인 및 False-negative 방지 (2026-10-13)

- `scripts/main_ci_recovery.py::completed_evidence`는 trusted default-main에서 정확한 원본 CI workflow metadata (`ci.yml`의 id/name/path/state)와 Actions Run `workflow_id`·`path`·`repository/head_repository`를 교차 확인한다. `run.name`은 `run-name`이 있는 모든 워크플로에서 가변 표시명이므로 인증/임계치에 사용하면 안 된다.
- Run은 여전히 정확한 `workflow_dispatch/main/completed/success`, active Owner actor, SHA/Issue/PR/version/first-parent, 변경 불가 artifact Run/Attempt, 필수 Quality/E2E6/Docker Job SUCCESS 및 GHCR exact candidate digest를 요구한다. metadata ID 불일치/비활성/UNKNOWN 또는 다른 source는 **fail-closed**. 일반 수동 진단이 GHCR 게시/Finalizer를 통과하도록 변경하지 않는다.
- 현재는 source verifier의 offline fixture와 새 PR CI 대상 변경만 허용한다. 실제 #616 수동 recovery run, formal v0.107.0 release/cleanup/Issue 종료는 별도 Owner 승인과 원격 증거 확보 전 `NOT TESTED`.

## Issue #639 — invalid Main merge subject 후속 교정 (2026-10-13)

- `5c79b658c83b86f163826055fa7da6efadef4e63` (#639/#641)은 불변의 Main CI #2606.1 trace FAILURE이며 GHCR 검증 후보가 없다. `main_ci_run_name.py`의 30자 한글 canonical title은 릴리스 증거 자격이 아닌 **CI 사전조건**이다.
- 같은 #639의 새 PR에서 유효한 제목·세 Required PR CI·Trusted QA를 통과해 병합되더라도 Finalizer는 자체 규칙으로 원본 first-parent 실패/후속 동일-Issue corrective의 허용 범위와 검증된 exact commit candidate를 판단해야 한다. 기존 실패 Run을 PASS로 바꾸지 않는다. #616 release authority는 다른 Issue이며 자동 승계/태그 재지정 금지.
- 병합 전 CLI `--as-merge-payload`와 `--validate-title`의 실제 제목·Head SHA preflight가 필수이다. `main` 보호, 자동 release 권한, candidate immutable digest 정책은 변경하지 않는다.

## Issue #639 — PR #641 P1 review correction (2026-10-13)

- Write-token `release-finalizer.yml` always checks out trusted `main` without persisted credentials and verifies the current HEAD.
- The `workflow_dispatch` manual recovery verifier runs **after** Buildx setup and authenticated `docker/login-action` for private GHCR. `GH_TOKEN` is only GitHub API authentication; it must not be treated as Docker registry credentials.
- Root-running inline Python imports `from scripts import main_ci_recovery as recovery` (not a top-level `main_ci_recovery`). The authenticated exact source CI run/attempt, target SHA, Owner marker, required Quality/E2E6/Docker and immutable `ci-<SHA>` digest must pass before the Generic First-Parent Finalizer runs. Source `head_sha` is matched against the verified controller SHA.
- Original push CI handling is preserved. Regular manual diagnostic runs cannot satisfy the recovery source gate. Remote GHCR/Finalizer end-to-end acceptance remains NOT TESTED until #639 has merged and #616 separately authorizes recovery.

## Issue #639 — immutable Main CI recovery (2026-10-12)

- #616 / PR #631 merge `b97709df8b5c0974f3c8252ac97819f45f73a5b9` has no original push CI; never rewrite or mark historical checks retroactively. GitHub Actions `GITHUB_TOKEN` event suppression is a plausible mechanism, not established cause without original token/event provenance.
- Trusted default-main `CI workflow_dispatch` with target_sha/target_issue/target_pr/expected_version/owner_comment_id: isolated `manual_recovery` path; only repository Owner actor and most recent authenticated exact-scoped recovery marker plus independent positive exact-version release marker. A normal manual diagnostic cannot publish.
- Validate target first-parent ancestor, single merged PR, issue, versions, current main controller snapshot, absent original push run, no changed release version. Checkout immutable target for Quality / Chromium six shards / Docker and candidate image. Three aggregates + implementation jobs must succeed on exact attempt; verified artifact and immutable SHA/digest allow trusted Finalizer evidence. Old push path stays unchanged.
- Auth/rate limit/registry UNKNOWN, stale main, competing runs, version/tag mismatch, missing Owner marker, ambiguous PR or failed tests => BLOCKED without releasing or retroactively marking old runs PASS. Publish job must verify candidate absence by authenticated package inventory. Recovery never deletes existing formal tags or candidates automatically.
- Application 0.107.0 unchanged; #639 itself release_required=false, release_authorized=false; HIGH, OWNER_MANAGED. Owner must separately authorize merger and specific #616 recovery. PR CI/Trusted QA required prior to merge. Run/attempt and remote GHCR are NOT TESTED until Actions evidence.

- **Area impact:** Trusted manual_recovery provenance may supplement missing push run on exact immutable historical merge SHA only after fresh evidence verification. Default branch verifier reauthenticates CI source workflow/run/attempt, artifact, full Quality/E2E6/Docker job conclusions, ancestor, PR, Owner marker, GHCR digest. Neither diagnostic workflow_dispatch nor failed/older run is equivalent to main push SUCCESS. Oldest-first barriers and release authority are unchanged.

## Issue #633 — Authenticated GHCR 404 교차 확인 및 원본 v0.106.1 Release SHA 유지 (2026-10-12)

- GHCR Docker manifest 조회 generic 404/`not found`를 직접 ABSENT로 해석하지 않는다. 동일 저장소에 대해 Github Packages 사용자 Container Versions API의 인증된 200/모든 페이지·`metadata.container.tags` 완전 조회 후 exact tag가 없는 경우만 ABSENT를 반환한다. 토큰 문제·응답 오염·pagination 미완료면 UNKNOWN을 유지하여 Finalizer mutation 차단.
- 안전한 same-Issue audit-only main correction이 병합되어도 B2 `Plan.sha`는 원래 Owner가 승인한 v0.106.1 Merge `09bee924032b4126ff794ec7a485542fd72dd7bf`로 유지한다. 최신 audit correction Merge SHA는 `Plan.main_sha`로 별도 검증하고 경합 방지·branch cleanup target에만 사용한다. version jump/other Issue/여러 PR CI를 통한 authority 확대는 금지.
- 이전 불변 FAIL Main CI 및 Owner marker를 변경하지 않고, original Release 성공과 exact digest 일치가 입증된 이후에만 B2 퇴역 원장을 finalize한다. 모든 신규 정책 변경은 PR full Required CI/QA Trusted와 Owner 검증 후 병합한다.

## Issue #633 — Owner B2 두 미발행 SemVer 안전 복구 (2026-10-12)

- #550 v0.105.0과 #615 v0.106.0은 최초 Main CI FAIL/교차 Issue 변경 때문에 기존 same-Issue supersession 경로를 절대로 사용하지 않는다. 기존 일반 계약은 변경 없이 별도 `scripts/release_debt_recovery.py`의 exact historical SHA, Owner revoke+v2 authorization, 새 Issue #633 release `v0.106.1`로 **한정된 예외만** 분리한다.
- `mastergantt-release-debt-authorization:v2`는 Owner/원본 다섯 Issue·PR·SHA/새 PR·Main SHA·버전/사유를 식별한다. 이전 v0.105.0/v0.106.0 게시 승인은 `authorized=false`인 해당 버전별 최신 Owner marker로 명시 철회한 뒤에만 실행. 새 v0.106.1 발행 승인은 별도 v1 marker다. 어느 것도 PR 본문/CI PASS에서 추론하지 않는다.
- Generic Finalizer는 `issue_comment` Owner 신원/Issue #633만 재진입하고 무조건 default main trusted code를 checkout한다. 사전 감사를 통한 old exact Git tag/Release/GHCR 모두 ABSENT·새 정확 main CI verified candidate·new release owner authorization 없으면 원본 실패 barrier를 유지한다. 새 formal release 성공과 digest 비교 후에만 source 5개 브랜치 안전 cleanup 및 two old candidates 삭제/각 old Issue의 `release-debt-retired:v1` 독립 감사 증거·close를 수행한다. 구 FAIL SHA는 FINAL/PASS로 표시하지 않는다.
- 기존 `release-finalizer.yml`·`release-finalizer-resume.yml`에 pinned GHCR 인증 검사와 동일 concurrency 권한 내 Owner 재개만 추가한다. tag 충돌/등록된 다른 image·권한 오류·경쟁 main 이동에는 fail-closed. [상세](ISSUE_633_RELEASE_DEBT.md).

## Issue #633 — GHCR 감사의 태그·인증 구분 (2026-10-12)

- GitHub/Git의 immutable annotated `vX.Y.Z`와 GHCR의 exact image `:X.Y.Z`는 서로 다른 naming 계약이다. 기본 브랜치 수동 read-only 감사는 `packages: read` + `docker/login-action`으로 private GHCR 인증 후 실제 `:X.Y.Z` manifest/digest를 조회한다.
- 레지스트리 권한/네트워크·HTTP 404가 모호하면 `UNKNOWN`으로 fail-closed; 이미 발행된 이미지 digest는 미발행 버전 폐기를 차단한다. Generic Finalizer의 cross-Issue supersession 정책·tag mutation/Release 권한은 변경하지 않는다.

## Issue #633 — 교차 Issue 미발행 Release 부채 감사 (2026-10-12)

- #550 v0.105.0 실패 Main CI와 #615 v0.106.0 중간 병합은 같은 Issue/동일 버전 자동 승계가 아니다. 과거 실패를 PASS로 재해석하거나 release-required=false로 숨기지 않는다.
- `scripts/release_debt_audit.py` 및 `.github/workflows/release-debt-audit.yml`은 **trusted main read-only** 감사 전용이며, Owner의 별도 exact SHA·버전별 복구 결정과 GHCR digest·tag 상태를 판정한다. 결과 `READY_FOR_SEPARATE_TRUSTED_RECOVERY`도 정식 tag·GHCR 게시·Issue close 권한이 아니다.
- 독립 QA/Owner HIGH 승인, PR Required 세 종, Main candidate digest/SBOM/provenance, immutable SemVer/Release/Resume/cleanup 순서는 유지한다. 자세한 결정·실패 감사 원장·rollback은 [Issue #633 복구 계획](ISSUE_633_RELEASE_DEBT.md)을 참조한다.

## Issue #615 — Main CI 단일 행 병합 실패 및 승인된 v0.106.0 승계 (2026-10-12)

- PR #627 병합 `c8949da48e7465db45d871887c3f55f9fb6dc743`의 추가 본문으로 Main CI #2526.1 trace가 FAIL하고 세 필수 quality/E2E/Docker 및 임시 GHCR 검증은 SKIPPED되었다. 기존 SHA/Run은 불변 FAIL이며 force-rewrite·gate 완화·rerun으로 PASS 처리하지 않는다.
- 해당 실패는 이미 version `0.105.0 → 0.106.0`을 main에 반영했으나 annotated tag/release가 시작되기 전이다. 뒤따르는 **동일 Issue의 비문서 교정 PR**이 동일한 `0.106.0`을 유지하면서 exact Main CI 성공 시, 원본 릴리스 의무(`0.105.0` baseline)를 명시적으로 inherited release baseline으로 전달한다. 물리적 first-parent version은 `0.106.0 → 0.106.0`으로 보존한다.
- 릴리스 승계는 원본 Main CI 미성공, 중간에 **동일 Issue·non-docs·동일 version**만 존재, 교정 exact Main CI 성공일 때에만 가능하다. 종료된 Issue의 non-actionable barrier를 포함해 다른 Issue가 중간에 있거나 docs-only, release-tag 시도·불변 tag 충돌, 이종 version이면 조용히 상속하지 않고 이전 FAIL을 blocker로 유지한다. 정식 release 승인 marker도 그대로 필요한 별도 gate이다.
- Generic Resolver는 supersession 뒤 교정 SHA의 exact SemVer tag 존재·target 검증을 **재수행**하며, v0.106.0 release_start → exact digest release-image → Resume / 원본·교정 브랜치 cleanup / Issue 종료 순으로 처리한다. 기존 Main CI #2526.1 실패 및 원본 SHA와 PR의 cleanup 부채는 기록한다.
- 후속 PR 병합에는 `main_ci_run_name.py --as-merge-payload --expected-head-sha`를 사용하여 `commit_title`은 한 줄 한글 표준 형식, `commit_message`는 빈 문자열, `merge_method=merge` 및 lease를 함께 넘긴다. 개발 중 로컬 정적 회귀 PASS는 원격 CI/GHCR PASS가 아니다.

# Generic Release Finalizer


### 동일 SHA의 PR required check 재실행 선택

GitHub는 같은 PR head SHA에서 이전 attempt의 실패/cancelled check-run과 최신 재실행의 성공 check-run을 함께 반환할 수 있다. Generic Finalizer는 required check 이름별로 **가장 큰 check-run ID(최신 실행)** 하나만 판정하며, 오래된 실패가 최신 성공을 덮어쓰거나 오래된 성공이 최신 실패를 가리는 것을 허용하지 않는다. 최신 required check가 모두 GitHub Actions SUCCESS인 경우에만 PR gate를 PASS로 취급한다.

## 실행 인스턴스 추적 (#361 / #582)

Generic Finalizer의 workflow 식별자와 trigger는 유지한다. #582부터 `run-name`은 원본 Main의 한 줄 canonical `workflow_run.head_commit.message`를 사용하며 `workflow_run.run_number.run_attempt`와 자체 `github.run_number.github.run_attempt`를 구분하여 표시한다. 예: `Finalizer · Issue #530 · PR #579 · Gantt 복원 경합 보완 · Main #2315.1 · Run #117.1`. 과거 multi-line merge, 신형 prefix 뒤에 개행·본문이 있는 pseudo-canonical 메시지, 직접 Push는 triggering `workflow_run.head_sha`의 짧은 fallback을 사용한다. JSON-escaped CR/LF 검사로 Main CI/Finalizer의 멀티라인 표시를 방지한다. 표시명은 승인·릴리스 권한이 아니며 정확한 SHA → merged PR → canonical `Refs #Issue`를 별도로 확인한다.

승인된 release 경로에서 `issue_lifecycle.py`는 `release-image.yml` workflow dispatch에 Primary Issue와 PR 번호를 input으로 전달한다. 이 metadata는 표시용이며 release authorization, version/tag authority, exact SHA/digest 검증이나 first-parent 처리 순서를 대체하지 않는다.

Issue #350에서 Issue별 one-shot finalizer를 제거하고 main CI 이후 lifecycle을 하나의 공용 경로로 통합한다.

## Trigger

`.github/workflows/release-finalizer.yml`은 `CI`의 `workflow_run.completed` 중 triggering branch가 `main`인 경우만 생성된다. Job mutation은 추가로 triggering event=`push`, head branch=`main`, conclusion=`success`를 모두 요구한다. 따라서 PR CI, feature branch CI, 수동 CI, 실패/취소 main CI는 lifecycle mutation을 수행하지 않는다.

Generic Finalizer와 수동 lifecycle mutation checkout은 credential persistence를 사용하지 않는다. SemVer tag의 존재 확인(`ls-remote`), exact tag fetch, push는 모두 command-scoped auth helper를 사용한다. helper는 inherited `http.extraHeader`를 reset한 뒤 job-scoped `GITHUB_TOKEN` Authorization header 하나만 주입하므로 private repository의 tag read/fetch와 write가 동일한 인증 경계에서 동작하고 `Duplicate header: Authorization`도 방지한다.

Release 완료 재개는 `.github/workflows/release-finalizer-resume.yml`이 담당한다. 이 workflow는 `Publish release image`의 successful `workflow_run.completed`를 fallback으로 구독하는 동시에 `workflow_dispatch(target_sha, release_run_id)`를 지원한다. `release-image.yml`의 publish 성공 후에는 GitHub가 `GITHUB_TOKEN`에 명시적으로 허용하는 `workflow_dispatch`로 Resume을 호출하므로 implicit event delivery 하나에만 의존하지 않는다. Explicit handoff는 source Release run이 아직 active일 수 있으므로 Resume이 exact `release_run_id`를 polling해 `completed/success`, workflow path, head SHA를 확인한 뒤 Generic resolver를 실행한다. 대기는 최대 10분으로 제한하고, 그 안에 completed/success evidence를 확보하지 못하면 Resume만 FAIL하여 lifecycle mutation을 중단한다.

Resume workflow는 write 권한을 가지므로 triggering tag/manual ref의 repository code를 실행하지 않는다. 항상 trusted `main`을 checkout하고 release의 exact target SHA는 lifecycle resolver 입력 데이터로만 전달한다.

## Exact mapping

`scripts/auto_release_finalizer.py`는 workflow가 시작될 때의 **현재 main snapshot**을 authority로 잡고 first-parent chain을 뒤로 탐색한다. **exact target SHA의 FINAL marker만 강한 완료 boundary**로 사용한다. FINAL marker가 없는 closed Issue merge는 재오픈·branch cleanup·release/finalize mutation 대상에서는 제외하지만, first-parent 수집 중에는 **non-actionable ordering barrier**로 유지한다. adjacent same-Issue corrective coalesce가 끝난 뒤에만 해당 barrier를 lifecycle target에서 필터링하므로, closed merge 양쪽의 retry가 인접한 것으로 오인되지 않으면서 더 오래된 미완료 target 탐색도 계속된다. 최종 actionable merge는 oldest → newest 순서로 처리한다.

1. 각 merge commit과 연결된 PR 중 `merge_commit_sha == target SHA`, base=`main`, same repository, merged=true인 PR이 정확히 1개여야 한다.
2. PR body에는 정확히 하나의 canonical `Refs #<Issue>` 줄이 있어야 한다.
3. 선행 merge의 exact main CI가 아직 SUCCESS가 아니면 mutation 없이 `DEFERRED`하고, 이후 main CI 완료 이벤트가 backlog를 다시 계산한다.
4. CI 완료 이벤트 순서가 main first-parent 순서와 달라도 release/finalize는 first-parent oldest → newest 순서를 유지한다.
5. 인접한 same-Issue corrective merge는 각 merge의 immediate first-parent diff가 모두 docs-only이거나 모두 non-docs인 경우에만 최신 target으로 수렴한다. 검증 scope가 다르면 coalesce하지 않아 앞선 실패 merge를 우회하지 않는다.
6. coalesce된 모든 PR identity를 보존하고 formal release가 필요하면 release 성공 후 각 merged branch를 `safe_branch_cleanup.py`로 검증·정리한다. 모든 branch cleanup이 PASS하기 전에는 FINAL marker와 Issue close를 수행하지 않는다.
7. ambiguity 또는 누락은 fail-closed이며 branch/tag/Issue mutation을 하지 않는다.
8. exact main CI는 SUCCESS지만 immutable version tag의 exact `release-image`가 completed non-success로 끝난 경우, later same-Issue corrective merge가 exact main CI SUCCESS이고 validation scope가 동등 이상이면 오래된 release target을 supersede할 수 있다. 실패한 tag는 이동·덮어쓰기하지 않고 이전 PR branch cleanup 의무를 corrective target으로 이관한다. exact release가 아직 실행 중이면 `DEFERRED`하며 supersede하지 않는다.

## Release required 판정

merge commit의 first parent와 merge target의 `package.json.version`을 비교한다.

- version 동일 → `release_required=false` → 기존 `issue_lifecycle.py finalize`
- version 변경 → `release_required=true` → 명시적 release 승인 필요

CI 성공이나 version bump 자체는 release 승인이 아니다.

## Release authorization marker

정식 release 승인은 **Issue comment**에 version-scoped marker로 남긴다. Manager/승인된 운영 도구는 사용자의 명시적 정식 release 요청을 확인한 뒤 merge 전에 다음 형식으로 기록한다.

```text
<!-- mastergantt-release-authorization:v1 {"authorized":true,"expected_version":"0.59.0","note":"사용자가 GHCR 정식 게시를 명시적으로 승인함"} -->
```

검증 규칙:

- 현재 개인 소유 저장소에서는 `author_association=OWNER`인 comment만 신뢰한다. 조직 저장소로 이전할 경우 별도 permission-check 설계 없이 이 범위를 넓히지 않는다.
- Issue comment를 100개 단위로 끝까지 pagination한 뒤 **해당 exact application version**의 trusted marker 가운데 가장 최신 comment ID를 authority로 사용한다. 같은 Issue에 서로 다른 버전의 Release가 있더라도 다른 버전의 승인·철회는 현재 버전의 결정을 덮어쓰지 않는다. 동일 버전의 최신 철회는 반드시 BLOCKED이며, 100번째 이후의 승인·철회도 반영한다.
- `expected_version`이 merge target version과 정확히 일치해야 한다.
- `authorized=false`는 동일 version의 명시적 철회다.
- version이 변경됐는데 유효 marker가 없으면 finalizer는 `BLOCKED`로 실패하고 mutation하지 않는다.
- 승인 marker를 추가한 뒤 기존 failed finalizer job을 재실행하는 것이 기본 복구 경로다.

## Release / Finalize

승인된 release는 기존 `scripts/issue_lifecycle.py release_finalize`를 호출한다. 이 경로는 annotated SemVer tag, `release-image.yml`, GHCR exact image/digest smoke, stable alias promotion, safe branch cleanup, FINAL marker, Issue close를 그대로 재사용한다. same-Issue corrective merge가 수렴된 경우에는 latest PR뿐 아니라 함께 보존한 이전 PR branch도 모두 cleanup 대상이다.

No-release 변경은 `finalize`만 호출하여 동일한 multi-PR safe branch cleanup을 완료한 뒤 FINAL marker와 Issue close를 수행한다.

## Concurrency

`release-finalizer.yml`, `issue-lifecycle.yml`, `release-image.yml`은 동일 mutation 종류를 직렬화하고 GitHub Actions의 `queue: max`를 사용한다. `queue: max`는 burst 실행의 pending 보존에 사용하지만 **semantic release 순서를 보장하는 근거로 사용하지 않는다**. GitHub는 concurrency 처리 순서를 보장하지 않으므로 Generic Finalizer가 현재 main first-parent backlog를 매 실행마다 재계산하고 oldest → newest 순서로 처리한다. 따라서 CI 완료 이벤트가 뒤집혀도 낮은 version merge가 높은 version merge보다 먼저 lifecycle을 통과한다.

## Legacy workflow policy

다음 Issue별 lifecycle 파일 패턴은 금지한다.

- `issue-<N>-release-helper.yml`
- `issue-<N>-release-finalizer.yml`
- `issue-<N>-finalizer.yml`
- lifecycle 용도의 `issue-<N>-cleanup.yml`

`scripts/verify-issue-lifecycle.py`가 이를 CI에서 검사한다. 독립 evidence/test workflow는 lifecycle mutation을 수행하지 않는 경우에만 별도 목적과 근거를 명시하여 유지한다.

## Recovery

- release approval 부족 → 승인 marker 기록 후 failed generic finalizer 재실행
- safe branch cleanup blocker → stacked/open PR dependency 정리 후 기존 run 재실행
- release-image 실패 → 동일 immutable tag를 반복 덮어쓰지 않는다. 동일 source에서 재실행 가능한 일시 실패면 기존 release run을 재개하고, 결정적 제품/회귀 결함이면 later same-Issue corrective merge를 새 SemVer로 검증해 release-failure supersession 경로를 사용한다.
- 수동 `issue-lifecycle.yml workflow_dispatch`는 generic 자동 경로가 사용할 수 없는 복구 상황의 fallback으로만 사용한다.

## Issue #435 Event-driven release completion

Generic Finalizer는 release-required target을 하나의 장시간 동기 job으로 처리하지 않는다.

1. Main CI SUCCESS event에서 backlog를 oldest → newest로 해석한다.
2. release가 필요 없으면 기존 `finalize`를 즉시 실행한다.
3. release가 필요하고 승인되었으며 state가 `not-started`이면 내부 전용 `release_start` operation으로 annotated tag와 `release-image.yml` dispatch까지만 수행하고 종료한다.
4. `tagged` 또는 `in-progress`이면 mutation 없이 DEFERRED한다.
5. `failed`이면 Issue/branch를 유지하고 기존 release run 재실행을 기다린다. 새 tag나 duplicate release를 만들지 않는다.
6. `Publish release image`의 exact/rolling tag promotion이 성공하면 release workflow가 `release-finalizer-resume.yml`을 `workflow_dispatch(target_sha, release_run_id)`로 명시적으로 호출한다. 기존 `workflow_run.completed` 구독도 fallback으로 유지한다.
7. Explicit Resume은 source Release run이 `completed/success`가 될 때까지 exact run ID를 polling하고, source workflow path와 `head_sha == target_sha`까지 확인한다. 그 뒤 exact tag/head SHA의 successful release evidence가 있을 때만 `release_finalize`를 호출해 safe cleanup, FINAL marker, Issue close를 수행한다.
8. publication 이후 handoff job은 `continue-on-error`로 release 성공 자체를 뒤집지 않는다. explicit dispatch가 실패해도 workflow_run fallback과 이후 Main CI backlog 재평가가 복구 경로로 남는다.

따라서 release 실행시간만큼 Finalizer runner를 polling에 묶지 않으며, 정상 경로에서는 release 성공 후 lifecycle이 자동 재개된다. Release workflow 자체의 repository-wide serialization과 immutable/stable alias 정책은 그대로 유지한다.


## Main verified candidate lifecycle handoff (#452)

Main CI의 successful non-docs `publish-commit-image`는 verified `ci-<SHA>`를 Generic Finalizer 판단 전에 삭제하지 않는다. 즉 artifact job의 책임은 **build/push + exact digest 검증 + handoff**까지다.

- `release_required=false`: lifecycle `finalize`가 branch cleanup과 함께 exact temporary `ci-<merge SHA>` package version을 fail-closed helper로 정리한다.
- `release_required=true`: candidate는 `release_start`/Release workflow가 동일 digest를 formal tag로 promotion할 수 있도록 유지한다.
- release/cleanup 판단 전 Main CI가 version 변경 여부만으로 candidate를 삭제하지 않는다. same-Issue corrective convergence가 immediate merge의 version delta와 다른 lifecycle delta를 가질 수 있기 때문이다.
- no-release candidate cleanup을 수행하는 Generic Finalizer/Resume은 최소 `packages: write`를 사용한다. PR CI/일반 CI 권한은 확대하지 않는다.
- failed immutable release tag는 이동하거나 덮어쓰지 않는다. 결정적 workflow 결함은 새 SemVer corrective merge로 복구한다.


## Issue #483 Resume 후속 Release dispatch 권한

Release completion Resume는 단순한 완료 확인기만이 아니다. 선행 Release를 `release_finalize`한 뒤 first-parent backlog의 다음 target이 `release_required=true`이면 같은 trusted main의 `auto_release_finalizer.py`가 `release-image.yml`을 `workflow_dispatch`할 수 있다.

- 따라서 `release-finalizer-resume.yml`에는 `actions: write`가 필요하다. `actions: read`만 있으면 tag 생성 뒤 `POST /actions/workflows/release-image.yml/dispatches`가 HTTP 403 `Resource not accessible by integration`으로 실패한다.
- Resume는 계속 `ref: main`, `persist-credentials:false`, exact source Release run/SHA/workflow 검증을 유지한다. 권한 확대는 Actions dispatch에만 사용하며 제품 코드나 triggering tag의 코드를 실행하지 않는다.
- Generic `release-finalizer.yml`도 같은 이유로 `actions: write`를 유지한다.
- `scripts/verify-issue-lifecycle.py`가 두 workflow의 `actions: write` 계약을 정적으로 검사한다.
- Issue #461의 `v0.87.1`은 이미 생성된 annotated tag를 authority로 유지하며 tag 이동/재생성 없이 Release dispatch를 재개한다.


## Issue #520 동일 merge SHA 중복 Main CI evidence 선택

PR required check는 같은 head SHA에서도 최신 check-run을 판정하는 기존 정책을 유지한다. 반면 merge 이후의 `main` commit은 immutable하므로, 동일 merge SHA에 여러 push CI가 등록된 경우 lifecycle evidence는 다음과 같이 해석한다.

- `auto_release_finalizer.py`는 동일 exact SHA의 completed/success Main CI가 하나 이상 있으면 성공 run 중 가장 최신 것을 CI evidence로 사용한다.
- `issue_lifecycle.py`는 Main CI run 자체의 SUCCESS만으로 충분하지 않다. 해당 run의 변경 유형에 맞는 `Main 임시 commit 이미지 게시·검증·정리` gate까지 성공/N/A인 run만 authoritative evidence로 선택한다.
- 이후 중복 run의 failed/cancelled 기록은 삭제하거나 성공으로 바꾸지 않는다. successful evidence가 전혀 없으면 최신 exact-SHA run URL을 diagnostics로 보존하고 mutation은 계속 fail-closed한다.
- 이 규칙은 immutable `ci-<SHA>`를 overwrite하는 허용이 아니다. 이미 검증된 exact SHA evidence를 lifecycle이 재사용하는 규칙이다.

#502 merge SHA `36cf2db8ab0c6d04ab904b01c6bc8a0bb6b1cdab`에서 #2083.1 SUCCESS 뒤 #2084.1이 기존 `ci-<SHA>` overwrite 거부로 실패한 사례가 #520의 회귀 기준이다.


## Issue #586 — 동일 Issue 다중 Merge의 불변 FINAL (2026-10-10)

설계 결정·대안 비교·운영 복구 조건은 [#586 ADR](ISSUE_586_FINAL_MARKER_ADR.md)을 따른다.

최초 완료 PR의 FINAL marker는 변경하지 않는다. 이후 같은 Issue의 PR이 병합되더라도 각 exact merge SHA의 PR Quality/E2E/Docker, Main CI, docs-only 분류 및 필요한 GHCR candidate 검증을 별도 수행한다. coalesce는 검증된 성공 merge를 삭제하지 않는다. 실패 target의 명시적 corrective supersession만 제한적으로 유지한다.

**first-parent backlog의 완료 경계 판정 전** 그리고 FINAL 기록 전에 모든 기존 FINAL comment를 pagination하여 marker 형식·작성자·PR number·canonical Refs·head SHA/branch·base main·동일 repo·exact merge SHA·main first-parent 계보를 검증한다. 다른 사용자/PR/SHA가 넣은 위조 marker는 정상 완료 경계로 SKIPPED하지 않고 FAIL 처리한다. 동일한 bot-origin PR identity·SHA로 중복 생성된 과거 marker는 중복 mutation 없이 멱등하게 해석하되, 충돌하는 PR identity는 거부한다. 이어서 관련 브랜치(리스·보호·참조·조상)와 GHCR candidate(다른 tag 공유 없음)를 읽기 전용 preflight한다. 안전하지 않은 경우 삭제·FINAL 기록 전에 FAIL한다.

수동 `issue-lifecycle.yml`과 자동 `release-finalizer.yml`/Resume는 `mastergantt-release-finalizer` concurrency group을 공유하고 `queue: max`로 직렬화한다. 동일 SHA의 병렬 FINAL 쓰기 경쟁을 줄이되, 기존에 생성된 완전히 동일한 인증 marker의 멱등 처리는 유지한다. 후속 같은 Issue merge가 미완료라면 앞선 target의 FINAL을 기록하되 Issue close는 지연한다. 정확히 같은 SHA/PR의 재진입은 중복 FINAL/정리 없이 멱등 통과한다. 부수효과 도중 중단된 경우 기존 브랜치 404와 GHCR candidate absent를 안전하게 재검증하고 이어서 진행한다. 새로운/위조된 marker는 무시하지 않고 BLOCKED한다.

실제 #565: PR #583 merge `1ed682dd062012f3d04c2517110835bf7c28ac13`의 기존 FINAL은 불변. PR #585 merge `1839ddb138808068ca06590163ad687d12cab50a`의 Main CI [37954486201](https://github.com/planner77/masterGantt/actions/runs/37954486201) SUCCESS 및 기존 Resume Run [37958294541](https://github.com/planner77/masterGantt/actions/runs/37958294541) FAIL은 과거 증거로 유지한다. 새 버전이 main에 병합되기 전에는 #585 FINAL을 성공으로 소급 기록하지 않으며 GHCR 현재 잔존 여부는 별도 조회해야 한다.

- risk_level=HIGH / qa_required=true; 독립 Reviewer의 exact PR Head 검토 필요
- version 0.103.1 유지; release_required=false / release_authorized=false
- PR 단계에는 병합·Main CI·정식 tag/release·#565 자동 복구를 포함하지 않는다

### #586 수동 Lifecycle 호출의 oldest-first 검증

수동 `issue-lifecycle.yml`의 `finalize`와 `release_finalize`는 Generic Resolver가 사용하는 first-parent pending backlog를 재검사한다. 선택된 PR이 oldest actionable 대상이 아니거나 같은 Issue에 나중 PR이 미완료이면 **변경 전 BLOCKED**하고 자동 Generic Finalizer의 ordered resume을 사용한다. 자동 경로만 `--resolver-ordered`를 전달하며, 수동은 전달하지 않는다. 기존 FINAL을 수동으로 재호출해도 다른 후속 PR의 진행 상태를 확인하지 않고 Issue를 재종료하지 않는다.

### #586 FINAL 이후 close-only 복구

Resolver는 최신 인증 FINAL 경계를 따로 보존하고 OPEN Issue이며 같은 Issue 후속 병합이 없을 때만 `close_resume`을 호출한다. 원본 FINAL·후보/브랜치 cleanup·정식 release는 재실행하지 않는다. 하위 Lifecycle은 Resolver main snapshot을 재검증하여 변경된 first-parent에서 잘못된 종료를 금지한다.

### Issue #586 — 잘못된 Merge 메시지와 실패 Main CI의 복구 (2026-10-11)

원본 PR #588의 merge SHA 490c4ab70b0868729c8415f9f613bd45aa84926a는 여러 줄의 Merge message로 Main CI #2445.1 trace 검증에서 실패했다. 구 SHA의 CI FAIL 및 GHCR/Finalizer SKIPPED 기록을 변경하지 않는다.

기존 supersede_failed_issue_retries 계약에 따라, 같은 Issue #586의 후속 **비문서(non-docs) PR**에서 새 Main CI·GHCR 검증이 성공한 경우에만 이전 실패를 SUPERSEDED ATTEMPT로 표시하고 PR #588의 브랜치 정리 의무를 교정 PR에 인계한다. 후속 PR이 docs-only이거나 Main CI가 실패하면 이전 SHA는 여전히 blocker이다. 다른 Issue가 중간에 있으면 first-parent 순서를 유지한다.

새 교정 PR 병합 시 main_ci_run_name.py의 --as-merge-payload 및 --expected-head-sha로 한 줄 commit_title, 빈 commit_message, 정확한 expected_head_sha를 함께 생성하고 merge_method=merge로 호출한다. 새 exact Main CI/verified GHCR/Finalizer 근거 없이 FINAL 및 Issue close를 완료 주장하지 않는다. 정식 GHCR tag/release는 release_required=false이므로 허용하지 않는다.


#### Connector / REST head lease 경계 (Codex P2 후속)

GitHub 연결 도구의 merge_pull_request 입력은 expected_head_sha이며, GitHub REST /pulls/{number}/merge POST는 sha이다. --as-merge-payload의 기본 --merge-api connector는 expected_head_sha를 출력하고 --merge-api rest는 sha를 출력한다. 동일 요청에 두 필드를 섞지 않는다. 각각 body=""와 merge_method=merge, canonical title을 유지하고, 잘못된 대상 값은 거부한다. 해당 양쪽 CLI·helper 회귀를 추가했다.


## Issue #649 — 신규 SHA 릴리스 승계 준비 (2026-10-13)

원본 #616 v0.107.0 SHA 및 실패 CI는 불변이며, #647 교정의 성공 기록은 #616 정식 게시 증거가 아니다. HIGH/OWNER_MANAGED, 신규 버전 게시 승인 없음. 읽기 전용 준비 검증은 [Issue #649 실행 원장](exec-plans/active/ISSUE_649.md)을 따르며 Git/GitHub Release/GHCR 인증 감사 UNKNOWN·중복 태그·불분명한 Owner 승인은 BLOCKED로 유지한다. 신규 v0.108.0은 제안일 뿐이며 정확한 SHA·버전 범위 신규 Owner 승인이 없는 자동 승계·발행·부채 폐기·#616 종료를 금지한다. 기존 workflow, CI required 3종, Trusted QA, first-parent, release Finalizer 정책은 변경하지 않는다.
