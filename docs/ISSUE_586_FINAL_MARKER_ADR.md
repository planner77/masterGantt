# ADR — 동일 Issue 다중 PR의 FINAL 기록·종료 계약 (#586)

- 상태: **Accepted for PR validation** (2026-10-10, HEAD PR CI/독립 QA Final 및 병합 전)
- 소유: infra / 위험 수준: HIGH, `qa_required=true`
- 적용 지점: 본 PR이 정확한 검증·독립 QA 및 Manager ACCEPT를 거쳐 main에 병합된 이후
- 관련 구현: `scripts/auto_release_finalizer.py`, `scripts/issue_lifecycle.py`, `scripts/delete-ghcr-package-version-by-tag.mjs`

## 배경과 불변식

Issue #565는 PR #583(docs-only, `1ed682dd062012f3d04c2517110835bf7c28ac13`)에 대한 FINAL을 남긴 뒤, 후속 PR #585(non-docs, `1839ddb138808068ca06590163ad687d12cab50a`)에서 다른 marker 충돌로 중단되었다. 브랜치 및 GHCR candidate cleanup은 먼저 수행되었으나 후속 PR의 불변 FINAL 증거가 누락되었다.

모든 성공 merge의 정확한 SHA에서 PR Quality/E2E/Docker, Main CI, 비문서 GHCR 검증 또는 docs-only N/A와 branch cleanup 의무를 보존한다. 최초 FINAL이 마지막 PR의 완료 근거가 되어서는 안 된다. `release_required`/OWNER 승인/immutable tag 계약은 불변이다.

## 대안 평가

| 대안 | 평가 |
| --- | --- |
| 기존 단일 FINAL + 다른 SHA marker 거부 유지 | 동일 Issue 후속 PR 처리 실패 재발. 기각 |
| 여러 PR을 합쳐 단일 aggregate FINAL | 동일 검증 범위일 때라도 성공 SHA의 개별 CI/GHCR 및 정리 증거를 별도 유지해야 하므로 복잡하며 누락 위험. 기각 |
| **Per-target immutable FINAL + 후속 종료 지연** | PR/SHA별 감사 가능. 기존 #583 증거 수정 불필요. 채택 |

## 결정

1. 자동 해석은 main first-parent merge를 oldest→newest로 처리하며, 정상 성공 Merge SHA를 coalesce하여 검증 의무를 축약하지 않는다. 미성공 target의 후속 검증 완료 supersession만 기존 fail-closed 예외를 유지한다.
2. `issue-lifecycle-final:<Issue>:<Merge SHA>`는 정확한 PR, head SHA/branch, canonical `Refs #Issue`, main base·same repository, merge SHA, first-parent ancestry와 신뢰된 `github-actions[bot]` 작성자를 모두 검증해야 한다. **완료 경계 판단 전**과 실제 mutation 전 양쪽에서 감사한다. 위조/불일치/불분명한 record는 SKIPPED가 아니라 FAIL이다.
3. 동일 identity·SHA의 반복 FINAL은 멱등으로 해석하고 임의 재기록하지 않는다. 역사적으로 완전히 동일한 봇 기록이 중복되어도 각각 인증한 뒤 동일 identity만 허용한다. 서로 다른 PR identity는 fail-closed이다.
4. 후속 미완료 merge가 있으면 해당 target의 FINAL을 남겨도 Issue close를 지연한다. 중간 다른 Issue와 이미 CLOSED인 Issue가 존재해도 순서와 완료 경계를 보존한다.
5. Branch SHA lease/보호·OPEN PR 참조/ancestry와 GHCR tag-sharing 검사는 삭제 **이전**에 비파괴적으로 실시한다. cleanup 도중 장애 발생 시 이미 삭제된 branch(404)와 단독 candidate absent를 검증 후 안전하게 재개한다. 단, 다른 tag가 달린 candidate 삭제는 금지한다.
6. 수동 `issue-lifecycle.yml`·범용 `release-finalizer.yml`·Resume는 `mastergantt-release-finalizer` concurrency group으로 직렬화한다. 이중 기록이 남았을 때는 3항을 따른다.
7. 정식 release는 **해당 exact application version**에 대한 신뢰된 가장 최신 승인/철회 marker만 판정한다. 같은 Issue의 다른 버전 승인/철회가 이를 덮어쓰지 않는다. version-scoped 승인 자체가 없다면 BLOCKED이다.

## 검증 및 운영 복구

`scripts/verify-issue-lifecycle.py`의 marker 작성자·PR identity/다중 버전·revocation·중복·closed boundary·coalescence 시나리오와 `scripts/verify-safe-branch-cleanup.py`의 lease/OPEN PR/ancestry를 실행한다. 변경된 exact PR Head의 Quality/E2E/Docker 및 HIGH 독립 QA_FINAL이 공식 병합 전 Gate다.

기존 #565의 #583 FINAL은 수정·삭제하지 않는다. PR #585의 Main CI [37954486201](https://github.com/planner77/masterGantt/actions/runs/37954486201) 및 실패한 Resume [37958294541](https://github.com/planner77/masterGantt/actions/runs/37958294541)은 과거 불변 증거다. #585의 GHCR candidate/branch는 독립 조회를 통해 상태를 확인한 뒤 새 코드가 main에 반영되었을 때 exact target을 멱등 재개한다. 실패 Run을 성공으로 소급 변경하거나 무조건 tag 재게시·Issue reopen을 수행하지 않는다.

이 ADR은 PR 단계에서 운영 복구가 실행되었다는 주장이나 정식 GHCR 릴리스 승인이 아니다.

### 수동 fallback 순서 검증 (2026-10-10, 추가 P1 보완)

`issue-lifecycle.yml`의 수동 `finalize`/`release_finalize`는 자동 Resolver의 합류·대기·Issue 종료 지연 판단을 우회할 수 없다. 수동 호출은 현재 main first-parent backlog를 다시 해석하고 **선택한 PR이 최초 actionable 대상**이어야만 처리한다. 선행 다른 Issue나 같은 Issue의 미완료 PR이 있거나 선택한 Issue에 후속 PR이 남으면 기존 Generic Finalizer로 복구하도록 FAIL/BLOCKED 한다. 동일 SHA의 기존 FINAL로 수동 재진입할 때는 무조건 close하지 않고 변경 없는 멱등 응답만 반환한다. 자동 Resolver는 이미 순서 검증을 마친 경우에만 `--resolver-ordered` 플래그를 전달한다. 수동 workflow는 이 내부 플래그를 전달하지 않는다.

테스트는 선행 동일 Issue A/B, 중간 다른 Issue, 이미 완료된 PR의 재호출, main 변경 및 잘못된 PR 번호에 대해 side effect 전 거부되는지 확인한다.
