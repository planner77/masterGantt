# Issue #918 — 실행 지침 라우팅 실패·재검증 원장

## F918-001 · 모델 문서 검증 소비자의 이전 AGENTS 위치 고정

2026-11-15T00:58:47.390Z~00:59:02.030Z targeted01에서 bda204af5d87b175db3c4b5c6a14aa3b11f29014 exact source/fingerprint844122f900d42c45d88dbd28c858f9985a6ac6ea62fccda376b30c00d9acb1fb의 기존5파일119case 중118PASS/1FAIL, exit1을 관측했다. 뒤의 동일source fast01 공통 전체 Unit도 같은 문서 위치 assertion으로FAIL했다. 원본 report/log/runnerJSON은 LOCAL:918-fast01 및 LOCAL:918-targeted01에 보존한다. Linux/Node22.14.0/npm11.10.0·제품0.146.0에서 실행했고 PR/원격CI는 N/A다.

원인: 모델표를 책임 문서 AGENT_CONFIGURATION으로 옮겼지만 `agent-model-selection.test.ts`의 마지막 문서 검사가 이전 AGENTS literal을 계속 요구했다. 실제8역할 TOML·Manager Sol/high·6thread·read-only 역할 검증은 모두 그대로 유지한다. 마지막 문서 검증만 AGENTS의 실제포인터+책임문서의 ui_ux/frontend Terra/medium·Sol/high 승격·조용한 fallback금지로 이관한다. 테스트 삭제/skip/timeout/assertion약화는 하지 않는다. 교정 후 새 exact source 공통/영향/Docker/admit와 독립 QA를 별도로 실행한다. 테스트파일변경이 포함돼 보수적 admission은 Docker도 필요하며 실제실행 전 PASS를 주장하지 않는다. 제품실행입력 변경0이므로 #918 단독GHCR은 N/A다.


## F918-002 · 원래 local main ancestry 사전 차단과 사용자 파일 보존

2026-11-15원래worktree의localmain2fcb079272196641c8f9c7299ae1bf4b1c7f9a03은origin/main0bf의ancestor가아니었다. read-only `git merge-base --is-ancestor main origin/main`이exit1로차단해파일수정전에중단했다(개별exact실패시각미수집). 이를force/이력교체로우회하지않고기존localmain과593branchref를보존했다.

03:21:52.772807+00:00표기원본alignmentreceipt의새branchlocal/issues-918-891은검증된origin/main0bf에서정상생성됐다. 원래AGENTS는7288bytes이며ComposeSHA6e97a1bdde44882023da1a6db5cbc6dd8f50ec00a8494b18d91d208ba4277e52와untracked27파일SHA가모두원래값과같다. 사전외부privatebackup을보존했고운영container/volume/DB작업0이다. 이Git/bytes검산은원래dirty사용자폴더에서전체gate를실행했다는뜻이아니며정식#918검증source는0bf그대로다. source외부LOCAL:891-root-alignment에실제명령·ref·bytes영수증을보존한다.
