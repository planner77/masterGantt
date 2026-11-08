## Issues #895–#897 — 재사용 결정·합성 화면 증거·Owner UAT 회귀

- #895: scripts/test_qa_preflight.py 및 scripts/test_qa_final_automated.py의 REUSE_REVIEW 정상/누락/미승인·PENDING/Owner evidence 형식 테스트를 기존 정책 회귀에 추가한다. 구조 검증을 실제 Owner decision authentication으로 오인하지 않는다.
- #896: 기존 tests/e2e/schedule-views.spec.ts의 실제 합성 Fixture/Playwright capture를 확장해 captureSyntheticUiEvidence()로 같은 화면의 PNG SHA256·Bounding box·viewport·locale·Issue/AC/Source full SHA를 기록한다. 스크린샷은 DESIGN 적합 판정이 아닌 관찰 증거이며 승인된 golden 없이는 pixel diff PASS를 만들지 않는다. tests/python/test_ui_evidence.py가 변조된 PNG/비합성/경로 우회/NaN·불완전 AC를 거부한다.
- #897: tests/python/test_preview_uat.py는 Owner 댓글, 같은 Issue/Head/image/evidence Digest, 승인 후 REWORK·drift, 비Owner·다른 Issue·미승인 음성 경계를 검증한다. scripts/preview_uat.py는 GitHub API 읽기 전용이며 Owner UAT의 정확 digest binding을 검증한다.
- 기존 Chromium8·docker·Required3를 삭제/skip하지 않고 test discovery·fixture 정합성을 유지한다. 실제 PR CI/Preview 실접속/최종 Owner UAT·native zoom/실기기 터치는 실행 전 NOT TESTED.

---

