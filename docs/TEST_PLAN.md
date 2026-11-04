

## Issue #874 — PR/Main Builder와 Release runner 분리 회귀

- 검색 후 EXTEND: tests/python/test_ci_image_release.py 기존 Main Run/Job uniqueness, digest mapping에 exact Main contract artifact/invalid/expired 및 publisher 결손 회귀 추가. ADD: tests/python/test_ci_image_contract.py 의 PR/Main builder와 Release runner 비교 양성/음성. KEEP_UNIQUE: test_ci_image_reuse.py의 OCI index/child/attestation/archive/runtime/PR source/Main fallback; 삭제·skip/retry/timeout 완화 금지.
- Positive: PR/Main ImageVersion=20261101.186.1, Release=20261025.179.1이라도 원본 두 빌더 영수증/OCI subject/Run+Attempt/Publisher가 유효하면 승인. Negative: PR/Main builder or files/base/Tree drift, artifact/Run+Attempt/version/digest/missing Main publisher 모두 BLOCKED.
- Python CI 기존 test discovery 및 Full8 required gates 그대로. 본 요청 결과 원격 새 Head PR CI는 시작 전 NOT TESTED. [Work Packet](exec-plans/active/ISSUE_874.md), [원장](ISSUE_874_FAILURE_ANALYSIS.md).

