# Issue #520 Work Packet — 동일 merge SHA Main CI evidence 복구

## 기준

- Issue: #520
- base/main: `36cf2db8ab0c6d04ab904b01c6bc8a0bb6b1cdab`
- application: `0.95.1`
- branch: `fix/issue-520-duplicate-main-ci-evidence`
- release_required=false
- release_authorized=false
- triggering incident: #502 / PR #516 / merge `36cf2db8ab0c6d04ab904b01c6bc8a0bb6b1cdab`

## 사고 증거

- Main #2083.1 / `37624477669`: SUCCESS
  - required quality/e2e/docker SUCCESS
  - main temporary GHCR candidate SUCCESS
  - digest `sha256:9155f413e07bda7e52f69fdf2faaf94d76c886b79bdfd04e35dd75846a5c0438`
- Main #2084.1 / `37624508496`: FAILURE
  - required product/test gates SUCCESS
  - artifact job에서 기존 `ci-36cf2db8...` overwrite 거부로 failure
- Finalizer #90: latest #2084를 기다리며 DEFERRED
- Finalizer #91: #2084 failure 뒤 SKIPPED
- 결과: #502 OPEN, feature branch와 verified temporary candidate가 cleanup 대기

## 변경 계약

1. PR required check latest-run 정책은 변경하지 않는다.
2. exact immutable main SHA의 completed/success run이 존재하면 auto resolver는 성공 run 중 최신 것을 evidence로 선택한다.
3. lifecycle mutation resolver는 run SUCCESS에 더해 해당 run의 main artifact gate가 변경 유형에 맞게 성공/N/A인지 확인한다.
4. successful artifact-valid run이 없으면 최신 exact-SHA run을 diagnostics로 반환하고 mutation을 막는다.
5. failed/cancelled duplicate run은 삭제·재분류하지 않는다.
6. GHCR immutable overwrite 정책은 완화하지 않는다.

## 테스트

- exact main single success
- success → later failure: earlier successful artifact-valid run 재사용
- all failed/cancelled: latest URL diagnostics + fail closed
- wrong SHA: 기존 fail closed 유지
- main artifact missing/invalid: mutation 불가
- 전체 `scripts/verify-issue-lifecycle.py` 및 repository CI

## 완료 후 기대

#520 merge의 Main CI 및 Generic Finalizer가 성공하면 #502 backlog가 #2083.1 evidence로 finalize되어 exact temporary candidate cleanup, branch cleanup, FINAL marker, Issue close가 수행되어야 한다. #517은 영향 없이 OPEN 유지한다.
