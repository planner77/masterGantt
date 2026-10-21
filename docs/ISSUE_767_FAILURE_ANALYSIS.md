# Issue #767 — 누적 실패 원장

## 목적

`v0.129.1` 교정 릴리스/후속 Issue #767의 새 PR·Main·Release CI 실패를 이슈 단위로 누적한다. 새 Run 전에는 실패를 만들어 기록하지 않으며, 과거 #736의 실패와 분리한다.

## 역사적 출처 (새 Issue 실패로 계산하지 않음)

| 구분 | 근거 | 결과 및 의미 |
| --- | --- | --- |
| #736 Main #3071.1 | [Run 39499988360](https://github.com/planner77/masterGantt/actions/runs/39499988360) | 정확 Assignment 초기 입력 미렌더, 원본 실패 M736-001 |
| #764 PR #3076.1 | [Run 39510892786](https://github.com/planner77/masterGantt/actions/runs/39510892786) | Milestone→Resource→일정 LIFO focus 실패 및 P2 권한 재검사, 원본 F736-004 |
| #764 PR #3092.1 | [Run 39602089760](https://github.com/planner77/masterGantt/actions/runs/39602089760) | Head 5abc658의 원본 Full Success; 새 Head PASS 아님 |
| #764 Trusted #734.1 | [Run 39607021968](https://github.com/planner77/masterGantt/actions/runs/39607021968) | 원본 Head에 대한 trusted SUCCESS; 후속 PR 재실행 필요 |

## 신규 실패 기록

현재 없음. 새 Full PR/Main/Release 실패 발생 시 `F767-001`부터 원본 Run ID/attempt/Job/정확 테스트/증거/원인/대책/새 SHA/반복 시 차이를 추가한다. 단순 실패 run 재실행이나 timeout 확대는 원인 분석 후 승인에 따르며 CI 실패 이력을 덮어쓰지 않는다.
