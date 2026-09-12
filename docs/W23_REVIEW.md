# W23 Project List Activation

검토일: 2026-09-12. 대상 version: `0.5.0`. 상태: **LOCAL PASS / 독립 QA PASS / Manager ACCEPT**.

## Decision and scope

D02 사용자 승인: 앱 접속 가능한 모든 사용자가 전체 Project 목록을 조회한다. 인터넷 공개나 운영 네트워크 변경을 승인한 것은 아니며 편집은 기존 Project별 비밀번호/session 인증을 유지한다. 기존 프로젝트는 동일 DB에서 조회하므로 재생성이 필요하지 않다.

## Contract

- `GET /api/projects`: `200`, `Cache-Control: private, no-store`, `{data:{projects:[]}}`.
- 공개 항목: `publicId`, `name`, `description`, `createdAt`, `updatedAt`만 반환.
- 최신 수정순과 안정적인 동률 정렬, 빈 배열 허용, DB 실패는 오류로 구분.
- 홈에서 생성/목록 복귀/새로고침/직접 링크 접근 지원.
- 내부 ID·credential·session 제외, 목록 조회는 편집 권한 부여나 session 생성 없음.

## Verification

- Manager: version agreement, typecheck, lint, production build **PASS**. 홈은 dynamic server render로 빌드된다.
- Manager: 전체 Vitest **24 files / 315 tests PASS**. 공개 필드, 빈 목록, DB 오류, 안정 정렬, session 불변과 기존 Mutation 인증 회귀를 포함한다.
- 독립 QA: 관련 Project 테스트 **10 files / 125 tests PASS**, 코드 보안 경계 **PASS**.
- Manager: 설치된 Chromium 1208을 executable override로 사용한 전체 Playwright **8/8 PASS (30.6s)**. 생성→목록 복귀→reload→새 브라우저 목록→direct Readonly 및 기존 Gantt 편집/인증 회귀를 확인했다.
- 재사용 DB에서 전체 **8/8**, 추가로 새 임시 DB에서 생성/목록 시나리오 **2/2 PASS (12.0s)**. 초기 빈 DB 가정, aria-hidden 텍스트 및 빈 상태의 중복 heading/link selector를 보완했다. 사용자 DB는 삭제하지 않았다.
- Backend: 기존 localhost:3101 서버에서 collection GET 200과 기존 Project 반환을 읽기 전용으로 확인했다.
- Markdown 링크 **33 files PASS**, diff whitespace **PASS**. E2E가 변경한 generated type 경로는 기존 `.next/types`로 복구했다.
- 브라우저 테스트는 전용 `.data/playwright.sqlite3`와 `/tmp/mastergantt-w23-e2e.*` 임시 DB를 사용했고 임시 서버는 종료했다. 기존 사용자 DB에 테스트 데이터를 기록하지 않았다. DB schema 변경은 없다.
- 이번 `0.5.0` 코드의 원격 CI/Docker 및 정식 release는 별도 실행 증거 전까지 **NOT TESTED**다. W22의 `0.4.0` 성공 증거로 대체하지 않는다.

## Remaining risks

목록은 승인된 앱 접속자 전체에게 이름과 설명을 공개한다. 운영 네트워크와 TLS/backup은 W16 범위다. 소규모 전체 목록이며 pagination/search는 이번 범위에 포함하지 않는다. `0.4.0` 이미지에는 이 기능이 없으며 새 코드/이미지가 필요하다.
