# 로컬 격리 UAT와 시각 증거

#897은 PR 병합 전 Preview Gate에서 **PR 없는 로컬 격리 UAT**로 전환한다. 기존 합성 fixture·#896 screenshot/geometry/source manifest·격리 DB/Compose·exact digest 기술 요소를 재사용한다. PR·원격 CI·GitHub Actions Preview workflow는 시작하지 않는다. 게시 자체는 [CI_CD](CI_CD.md), 운영 DB 안전성은 [DEPLOYMENT](DEPLOYMENT.md)를 따른다.

## 현재 수용 경계

영향 범위에 맞는 실제 사용자 흐름을 Owner가 로컬 격리 환경에서 조작한다. source SHA·image digest(이미지 사용 시)·PNG/geometry manifest digest·Issue/AC·viewport/locale·결정 시각/주체·ACCEPT/REWORK/NOT TESTED를 Issue 원장에 기록한다. `scripts/ui_evidence.py`의 무결성 검사나 로컬 테스트 성공만으로 사람의 디자인/UAT PASS를 만들지 않는다.

이미지 없이 소스 서버에서 UAT하면 image digest를 N/A(미사용)로 기록하고 source/fixture 지문에 연결한다. GHCR 이미지가 필요하면 Owner의 명확한 게시 범위 승인과 같은 source의 로컬 admission·고유 태그·exact digest smoke를 선행한다. UAT 성공과 정식 게시·운영 반영·Owner 최종 종료는 별개다.

source/fixture/image/manifest 변경·REWORK 뒤의 이전 수용은 stale이며 해당 흐름을 다시 확인한다. 실제 UAT하지 않은 상태는 NOT TESTED다. 공개 GitHub에는 합성 화면만 허용한다. 실운영/업무 UAT 자료는 승인된 비공개 위치에 보존한다.

기존 `scripts/preview_uat.py`의 PR/원격 provenance 검사와 `preview-publish.yml`은 과거 경로다. 신규 local UAT를 위해 호출하거나 새 required check로 연결하지 않는다. 이전 전체 형식/실행 절차는 [보존 기록](history/owner-ci-retired-20261110/PREVIEW_PUBLISH.md)이다.
