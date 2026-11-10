# Test Lifecycle 초기 인벤토리 조회

#711 최초 static/discover 인벤토리·샘플 수·후보/실행 미검증의 전체 기록은 [보존 원본](history/owner-ci-retired-20261110/TEST_LIFECYCLE_INVENTORY_711.md)에 있다. 과거 수치를 현재 파일/케이스 수나 PASS로 표시하지 않는다.

현행 수명주기·선정 기준은 [TEST_PLAN](TEST_PLAN.md)이다. `scripts/test_lifecycle_inventory.py`는 read-only 조사 도구이며 static은 선언 조사, discover는 수집일 뿐 실제 테스트 실행 성공이 아니다. 과거 workflow 정책 선언을 조사해도 신규 원격 실행 gate가 되지 않는다. 현재 source·Node/Vitest/Playwright·환경과 조사 경로·미수집을 기록하고 [Regression Index](REGRESSION_INDEX.md)/관련 원장에서 실제 위험 경계를 확인한다. PR·원격 CI는 실행하지 않는다.
