# Issue #83 — Project Task / Resource 검색·필터

## 목적

Project Workspace의 일정 및 리소스 탭에서 canonical Project 데이터를 변경하지 않고 검색/필터 view를 제공한다.

## 구현 계약

### Task

- Toolbar 통합 검색은 `name + description + externalId`를 대소문자 구분 없이 contains 검색한다.
- effective `start/end` 기준으로 기간 겹침, 완전 포함, 시작일 범위, 종료일 범위를 지원한다.
- Task type, schedule mode, progress, duration, 할당됨/미할당을 조합하며 서로 다른 조건은 AND다.
- 특정 Resource/Group은 Project에 실제 할당된 target을 이용하고 ANY/ALL을 지원한다.
- Group member를 direct Resource assignment로 추론하지 않는다.
- 직접 match한 child를 보여주기 위한 ancestor Summary는 context row로 유지하지만 match count에는 포함하지 않는다.
- 양 endpoint가 모두 표시되는 dependency만 Gantt에 전달해 dangling line을 만들지 않는다.
- 검색/필터는 mutation, revision 증가, DB 저장, 전체 페이지 reload를 발생시키지 않는다.

### Resource

- assigned-target metadata의 `description`을 기존 public-read 응답에 추가해 readonly에서도 name/code/description 검색을 수행한다.
- 기존 Resource workload의 Group → Resource → Task 구조를 유지한다.
- 이름/code, Resource/Group 종류, 활성 상태, 연결 Task effective 기간 조건을 제공한다.
- 비활성 target도 기존 Project assignment에 포함되어 있으면 검색 대상이다.
- 날짜 조건은 표시할 연결 Task만 제한한다.
- 기존 workload summary는 전체 Project 집계를 유지하며 UI에 이를 명시한다.

## 데이터와 API

새 DB schema 또는 mutation API를 추가하지 않는다.

- Project canonical snapshot: tasks, links, assignments
- `GET /api/projects/{publicId}/assigned-targets`: 할당된 Resource/Group의 이름, code, active
- `GET /api/projects/{publicId}/resource-workload`: Resource workload 표시 데이터

모든 검색 endpoint는 기존 public read 계약을 그대로 사용한다.

## 상태

필터는 React page-session state다.

- 일정 ↔ 리소스 탭을 전환해도 각 mounted view의 상태를 유지한다.
- 새로고침 시 초기화 가능하다.
- saved preset, URL query 공유, 서버 영속화는 범위 제외다.

## 접근성

- 검색 input과 Field/Operator/Value control에 label 또는 accessible name을 제공한다.
- 결과 개수를 text status로 제공한다.
- 초기화와 필터 열기/닫기는 keyboard 접근 가능한 native control을 사용한다.
- active/filter state를 색상만으로 표현하지 않는다.

## 성능

Gantt 가시성은 SVAR 2.7.3 공개 `filter-tasks` action으로 적용하고 canonical tasks/links는 유지한다. Task predicate는 assignment lookup을 Map/Set으로 구성하고 Task × Resource 전체 중첩 탐색을 피한다. Filter 결과 계산은 canonical input과 filter state에 대해 결정적으로 수행한다.

## 버전

사용자에게 노출되는 신규 UI 기능이므로 `0.22.0 → 0.23.0` MINOR 변경이다.

## 검증

- Unit: text normalization, inclusive overlap, contained/start/end, milestone, number range, enum, assigned/unassigned, direct Resource/Group ANY/ALL, ancestor context.
- Remote CI: version/typecheck/lint/Vitest/build, Chromium E2E, Docker smoke.
- main: 병합 SHA의 CI와 임시 GHCR exact digest smoke.
- Release: 승인된 `v0.23.0` tag와 정식 GHCR image exact digest 검증.
