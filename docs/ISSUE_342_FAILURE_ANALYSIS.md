# Issue #342 — 누적 PR CI 실패 분석

Primary [Issue #342](https://github.com/planner77/masterGantt/issues/342) · 역사적 [PR #346](https://github.com/planner77/masterGantt/pull/346) · 갱신일 2026-10-31 · [공통 원장 정책](PR_CI_FAILURE_TRIAGE.md)

## 1. 출처와 검증 범위

- 최신 구현 기준 main `ce8ca4ec7f0eb2ba63d883b7c22786c5d033aa14`, 새 브랜치 `feat/issue-342-country-catalog-current`. #342의 최신 지시에 따라 오래된 #346을 단독 병합하지 않고 새 PR을 구성한다. 옛 성공은 신규 source PASS가 아니다.
- 공개 REST branch 전체 Actions `per_page=100,page=1`에서 total_count=61/목록61을 회수했다. `.github/workflows/ci.yml` **54Run은 전부 attempt1**, **18 FAIL / 33 CANCELLED / 3 PASS**다. 별도 #118 레이아웃 증거 workflow7개는 CI에 합산하지 않는다.
- 54Run 모두 `/attempts/1/jobs?per_page=100`을 조회했고 오류0이다. 실제 오류 Step가 있는 **FAIL Job36개**와 실행 중 취소된 **CANCELLED Job109개**의 로그를 읽었고 조회 오류0이다. 취소6개 E2E Job에도 실제 테스트 FAIL이 있었다. 환경 준비 이전 취소/미실행을 PASS로 추산하지 않는다.
- Q/E/D는 Required aggregate, S/F/C/K는 전체 Job의 PASS/FAIL/CANCELLED/SKIPPED 건수다. 파생 aggregate FAIL을 독립 제품 실패로 중복 합산하지 않는다.
- base는 Run API `pull_requests[].base.sha` 보고값이다. 전체 test-merge SHA는 #2085 checkout 로그의 `84f119be64e6a56dce15c283fdf659d3f3490fea`만 이 원장에 확정했다. 다른 Run의 전체 test-merge SHA는 UNKNOWN이며 현재 PR base와 섞지 않는다.
- #1345/#2042/#2085 현재 artifact 목록에서 당시 Playwright report를 찾지 못했다. 당시 로그 artifact URL은 남지만 trace 재열람은 **INCOMPLETE**다. Run/Attempt/Job/직접 오류 로그 회수와 전체 trace 재감사를 구분한다.
- 원본 API 전체와 정제 로그 요약은 작업 환경 `/tmp/issue342-old-ci.json`, `/tmp/issue342-failed-job-summaries.json`, `/tmp/issue342-cancelled-job-summaries.json`에 보존했다. Git에는 아래 정제 판정만 남기며 runtime DB·인증정보·raw trace/log를 추가하지 않는다.

## 2. Run/Attempt 전체 목록

모두 PR #346 / pull_request / ci.yml. METADATA는 실제 metadata Job 실행 여부, UNKNOWN은 PASS가 아니다.

| Run·발생일 UTC | 분기·결론 | Head SHA | API 보고 base SHA | Q / E / D | Job S/F/C/K |
| --- | --- | --- | --- | --- | --- |
| [#1345.1 / 36702114357](https://github.com/planner77/masterGantt/actions/runs/36702114357) · 2026-09-30T10:23:22Z | FULL / FAIL | `7f59049cda234e115b63a755a931845a3b5863b0` | `36cf2db8ab0c6d04ab904b01c6bc8a0bb6b1cdab` | FAIL / FAIL / FAIL | 4/10/0/1 |
| [#1348.1 / 36709929160](https://github.com/planner77/masterGantt/actions/runs/36709929160) · 2026-09-30T11:39:57Z | FULL / CANCELLED | `4b42a743abed5c27faa9b264793dc78829dc8cca` | `36cf2db8ab0c6d04ab904b01c6bc8a0bb6b1cdab` | FAIL / FAIL / FAIL | 1/3/11/0 |
| [#1349.1 / 36709948115](https://github.com/planner77/masterGantt/actions/runs/36709948115) · 2026-09-30T11:40:08Z | FULL / CANCELLED | `ce8f7ba93ba530a867d71b5152fe65664d6762d3` | `36cf2db8ab0c6d04ab904b01c6bc8a0bb6b1cdab` | NOT RUN / NOT RUN / NOT RUN | 0/0/0/0 |
| [#1350.1 / 36709994244](https://github.com/planner77/masterGantt/actions/runs/36709994244) · 2026-09-30T11:40:34Z | FULL / CANCELLED | `7d35fa957ced85ce95956807a858ee73473fd9f5` | `36cf2db8ab0c6d04ab904b01c6bc8a0bb6b1cdab` | FAIL / FAIL / FAIL | 0/3/9/0 |
| [#1352.1 / 36710113840](https://github.com/planner77/masterGantt/actions/runs/36710113840) · 2026-09-30T11:41:44Z | FULL / FAIL | `d541bf968cf24f571591e8f98382b4386cd9d714` | `36cf2db8ab0c6d04ab904b01c6bc8a0bb6b1cdab` | FAIL / PASS / PASS | 12/2/0/1 |
| [#1354.1 / 36712586395](https://github.com/planner77/masterGantt/actions/runs/36712586395) · 2026-09-30T12:05:38Z | FULL / CANCELLED | `a2182e83ea9e8359ff145782b069360488427ec0` | `36cf2db8ab0c6d04ab904b01c6bc8a0bb6b1cdab` | FAIL / FAIL / FAIL | 1/3/11/0 |
| [#1355.1 / 36712626051](https://github.com/planner77/masterGantt/actions/runs/36712626051) · 2026-09-30T12:06:01Z | FULL / FAIL | `54d219f53e598decea8682f06339d7b87964b919` | `36cf2db8ab0c6d04ab904b01c6bc8a0bb6b1cdab` | PASS / FAIL / PASS | 12/2/0/1 |
| [#1844.1 / 37317394429](https://github.com/planner77/masterGantt/actions/runs/37317394429) · 2026-10-05T13:30:56Z | FULL / PASS | `48e4e930219c30c56eed386c81a51386a3c8ac67` | `36cf2db8ab0c6d04ab904b01c6bc8a0bb6b1cdab` | PASS / PASS / PASS | 16/0/0/2 |
| [#1845.1 / 37317489001](https://github.com/planner77/masterGantt/actions/runs/37317489001) · 2026-10-05T13:31:40Z | METADATA / PASS | `48e4e930219c30c56eed386c81a51386a3c8ac67` | `36cf2db8ab0c6d04ab904b01c6bc8a0bb6b1cdab` | PASS / PASS / PASS | 5/0/0/8 |
| [#1850.1 / 37326333819](https://github.com/planner77/masterGantt/actions/runs/37326333819) · 2026-10-05T14:38:29Z | FULL / FAIL | `0836d7d2b401079efd454af8f655080f11830931` | `36cf2db8ab0c6d04ab904b01c6bc8a0bb6b1cdab` | PASS / FAIL / PASS | 14/2/0/2 |
| [#1851.1 / 37326540777](https://github.com/planner77/masterGantt/actions/runs/37326540777) · 2026-10-05T14:40:02Z | METADATA / FAIL | `0836d7d2b401079efd454af8f655080f11830931` | `36cf2db8ab0c6d04ab904b01c6bc8a0bb6b1cdab` | FAIL / FAIL / FAIL | 1/4/0/8 |
| [#1855.1 / 37366320724](https://github.com/planner77/masterGantt/actions/runs/37366320724) · 2026-10-05T19:53:38Z | FULL / FAIL | `98d165cac9e3b4b6c706ef94c8f110f26fe04701` | `36cf2db8ab0c6d04ab904b01c6bc8a0bb6b1cdab` | FAIL / FAIL / FAIL | 0/3/1/9 |
| [#1858.1 / 37366349115](https://github.com/planner77/masterGantt/actions/runs/37366349115) · 2026-10-05T19:53:54Z | FULL / CANCELLED | `98d165cac9e3b4b6c706ef94c8f110f26fe04701` | `36cf2db8ab0c6d04ab904b01c6bc8a0bb6b1cdab` | CANCELLED / CANCELLED / CANCELLED | 0/0/5/8 |
| [#1959.1 / 37469067830](https://github.com/planner77/masterGantt/actions/runs/37469067830) · 2026-10-06T13:13:07Z | FULL / CANCELLED | `dd76f8093ee1decdc7eb1a3caa4f8ba68b936e50` | `36cf2db8ab0c6d04ab904b01c6bc8a0bb6b1cdab` | FAIL / FAIL / FAIL | 3/4/10/1 |
| [#1960.1 / 37469213241](https://github.com/planner77/masterGantt/actions/runs/37469213241) · 2026-10-06T13:14:15Z | FULL / FAIL | `52826bce49c90b31db73f8eca415cda404c36e2d` | `36cf2db8ab0c6d04ab904b01c6bc8a0bb6b1cdab` | FAIL / PASS / PASS | 14/2/0/2 |
| [#1961.1 / 37469302239](https://github.com/planner77/masterGantt/actions/runs/37469302239) · 2026-10-06T13:14:56Z | METADATA / FAIL | `52826bce49c90b31db73f8eca415cda404c36e2d` | `36cf2db8ab0c6d04ab904b01c6bc8a0bb6b1cdab` | FAIL / FAIL / FAIL | 1/4/0/8 |
| [#1962.1 / 37472312247](https://github.com/planner77/masterGantt/actions/runs/37472312247) · 2026-10-06T13:37:46Z | FULL / CANCELLED | `0c823f68a7f4a99073829cf8b281a0c8fe3b76e7` | `36cf2db8ab0c6d04ab904b01c6bc8a0bb6b1cdab` | FAIL / FAIL / FAIL | 3/3/11/1 |
| [#1964.1 / 37472433779](https://github.com/planner77/masterGantt/actions/runs/37472433779) · 2026-10-06T13:38:42Z | FULL / PASS | `ef8feda89d7fa01e5a1ca81bf1716173f9cae25e` | `36cf2db8ab0c6d04ab904b01c6bc8a0bb6b1cdab` | PASS / PASS / PASS | 16/0/0/2 |
| [#1968.1 / 37475768026](https://github.com/planner77/masterGantt/actions/runs/37475768026) · 2026-10-06T14:03:22Z | FULL / CANCELLED | `96dfa2495c8313d93c1831286cf68199aced632b` | `36cf2db8ab0c6d04ab904b01c6bc8a0bb6b1cdab` | PASS / FAIL / FAIL | 7/2/8/1 |
| [#1969.1 / 37475955991](https://github.com/planner77/masterGantt/actions/runs/37475955991) · 2026-10-06T14:04:43Z | FULL / CANCELLED | `b67900b88404107b950ace8d359f33eeab816e29` | `36cf2db8ab0c6d04ab904b01c6bc8a0bb6b1cdab` | FAIL / FAIL / FAIL | 1/3/13/1 |
| [#1970.1 / 37476125085](https://github.com/planner77/masterGantt/actions/runs/37476125085) · 2026-10-06T14:05:57Z | FULL / CANCELLED | `a07d0efdefa4b133759dc32f5761f79988e3d6f2` | `36cf2db8ab0c6d04ab904b01c6bc8a0bb6b1cdab` | NOT RUN / NOT RUN / NOT RUN | 0/0/0/0 |
| [#1971.1 / 37476172736](https://github.com/planner77/masterGantt/actions/runs/37476172736) · 2026-10-06T14:06:18Z | FULL / CANCELLED | `8c598dae3bd70fef1789f059408b58ef74bfcb04` | `36cf2db8ab0c6d04ab904b01c6bc8a0bb6b1cdab` | NOT RUN / NOT RUN / NOT RUN | 0/0/0/0 |
| [#1972.1 / 37476330759](https://github.com/planner77/masterGantt/actions/runs/37476330759) · 2026-10-06T14:07:26Z | FULL / CANCELLED | `bb70685c1524e9fda9e5132e67aa455e751405b0` | `36cf2db8ab0c6d04ab904b01c6bc8a0bb6b1cdab` | FAIL / FAIL / FAIL | 1/3/13/1 |
| [#1973.1 / 37476433385](https://github.com/planner77/masterGantt/actions/runs/37476433385) · 2026-10-06T14:08:12Z | FULL / CANCELLED | `583a2172acb2db63c7d7a59b9b5a738ef5b9713b` | `36cf2db8ab0c6d04ab904b01c6bc8a0bb6b1cdab` | NOT RUN / NOT RUN / NOT RUN | 0/0/0/0 |
| [#1974.1 / 37476472455](https://github.com/planner77/masterGantt/actions/runs/37476472455) · 2026-10-06T14:08:30Z | FULL / CANCELLED | `9f3a6102f3c7b3030f876ebee1b584914fc63d43` | `36cf2db8ab0c6d04ab904b01c6bc8a0bb6b1cdab` | FAIL / FAIL / FAIL | 1/3/13/1 |
| [#1975.1 / 37476782511](https://github.com/planner77/masterGantt/actions/runs/37476782511) · 2026-10-06T14:10:44Z | FULL / CANCELLED | `c0f94d3d236c655d1cc01ed58b327588eb7b153a` | `36cf2db8ab0c6d04ab904b01c6bc8a0bb6b1cdab` | FAIL / FAIL / FAIL | 4/7/6/1 |
| [#1976.1 / 37477677585](https://github.com/planner77/masterGantt/actions/runs/37477677585) · 2026-10-06T14:17:11Z | FULL / CANCELLED | `3f8e2c3fd35b1704371b64add1d69fa2180e80c4` | `36cf2db8ab0c6d04ab904b01c6bc8a0bb6b1cdab` | NOT RUN / NOT RUN / NOT RUN | 0/0/0/0 |
| [#1977.1 / 37477691257](https://github.com/planner77/masterGantt/actions/runs/37477691257) · 2026-10-06T14:17:17Z | FULL / CANCELLED | `b1cf96f522c6b958c3a5bf5119802b12d470325d` | `36cf2db8ab0c6d04ab904b01c6bc8a0bb6b1cdab` | PASS / FAIL / FAIL | 7/2/8/1 |
| [#1978.1 / 37478162348](https://github.com/planner77/masterGantt/actions/runs/37478162348) · 2026-10-06T14:20:42Z | FULL / CANCELLED | `7c40cb11df89d088d3dc67474bf2e9e644a9896b` | `36cf2db8ab0c6d04ab904b01c6bc8a0bb6b1cdab` | NOT RUN / NOT RUN / NOT RUN | 0/0/0/0 |
| [#1979.1 / 37478178758](https://github.com/planner77/masterGantt/actions/runs/37478178758) · 2026-10-06T14:20:49Z | FULL / CANCELLED | `648f8014712e9e5e367009538799a9d0b1a1bcdc` | `36cf2db8ab0c6d04ab904b01c6bc8a0bb6b1cdab` | FAIL / FAIL / FAIL | 2/3/12/1 |
| [#1980.1 / 37478371401](https://github.com/planner77/masterGantt/actions/runs/37478371401) · 2026-10-06T14:22:11Z | FULL / CANCELLED | `dc82af285b9c27ae00a0428c57607c1bc3c91aaf` | `36cf2db8ab0c6d04ab904b01c6bc8a0bb6b1cdab` | FAIL / FAIL / FAIL | 3/3/11/1 |
| [#1983.1 / 37478671695](https://github.com/planner77/masterGantt/actions/runs/37478671695) · 2026-10-06T14:24:20Z | FULL / CANCELLED | `12e47018a9834a3d9318cf627e8ff1356e419751` | `36cf2db8ab0c6d04ab904b01c6bc8a0bb6b1cdab` | PASS / FAIL / FAIL | 7/2/8/1 |
| [#1984.1 / 37479268394](https://github.com/planner77/masterGantt/actions/runs/37479268394) · 2026-10-06T14:28:33Z | FULL / CANCELLED | `2b7106300c37fc77d0aac917fe593cf793a3294f` | `36cf2db8ab0c6d04ab904b01c6bc8a0bb6b1cdab` | NOT RUN / NOT RUN / NOT RUN | 0/0/0/0 |
| [#1985.1 / 37479280641](https://github.com/planner77/masterGantt/actions/runs/37479280641) · 2026-10-06T14:28:39Z | FULL / CANCELLED | `153a1eaa983daed917dfe8ff29048658b0239c78` | `36cf2db8ab0c6d04ab904b01c6bc8a0bb6b1cdab` | NOT RUN / NOT RUN / NOT RUN | 0/0/0/0 |
| [#1986.1 / 37479297122](https://github.com/planner77/masterGantt/actions/runs/37479297122) · 2026-10-06T14:28:46Z | FULL / CANCELLED | `dae6cba95cc0c701243b9589a57be6c302c487aa` | `36cf2db8ab0c6d04ab904b01c6bc8a0bb6b1cdab` | NOT RUN / NOT RUN / NOT RUN | 0/0/0/0 |
| [#1987.1 / 37479386075](https://github.com/planner77/masterGantt/actions/runs/37479386075) · 2026-10-06T14:29:24Z | FULL / CANCELLED | `d64a539bea288a86723016f06312ba687a932e17` | `36cf2db8ab0c6d04ab904b01c6bc8a0bb6b1cdab` | NOT RUN / NOT RUN / NOT RUN | 0/0/0/0 |
| [#1988.1 / 37479396751](https://github.com/planner77/masterGantt/actions/runs/37479396751) · 2026-10-06T14:29:28Z | FULL / CANCELLED | `6fe5f1207f6e606550166acf5d4549b6d7ad1973` | `36cf2db8ab0c6d04ab904b01c6bc8a0bb6b1cdab` | FAIL / FAIL / FAIL | 5/3/9/1 |
| [#1989.1 / 37479641264](https://github.com/planner77/masterGantt/actions/runs/37479641264) · 2026-10-06T14:31:11Z | FULL / FAIL | `1f28f8ec2d4cd1ca2646d8422b8e37177e76890d` | `36cf2db8ab0c6d04ab904b01c6bc8a0bb6b1cdab` | PASS / FAIL / PASS | 14/2/0/2 |
| [#1995.1 / 37526967216](https://github.com/planner77/masterGantt/actions/runs/37526967216) · 2026-10-06T20:30:29Z | FULL / CANCELLED | `46fd7b020f6645df3942aa7d0fc5afd667d4e855` | `36cf2db8ab0c6d04ab904b01c6bc8a0bb6b1cdab` | FAIL / FAIL / FAIL | 2/7/8/1 |
| [#1997.1 / 37527187097](https://github.com/planner77/masterGantt/actions/runs/37527187097) · 2026-10-06T20:32:11Z | METADATA / FAIL | `46fd7b020f6645df3942aa7d0fc5afd667d4e855` | `36cf2db8ab0c6d04ab904b01c6bc8a0bb6b1cdab` | FAIL / FAIL / FAIL | 1/4/0/8 |
| [#1998.1 / 37527392747](https://github.com/planner77/masterGantt/actions/runs/37527392747) · 2026-10-06T20:33:50Z | FULL / CANCELLED | `bd1977996e53e46b1477231416d7f511206184aa` | `36cf2db8ab0c6d04ab904b01c6bc8a0bb6b1cdab` | FAIL / FAIL / PASS | 7/3/7/1 |
| [#1999.1 / 37528078929](https://github.com/planner77/masterGantt/actions/runs/37528078929) · 2026-10-06T20:39:15Z | FULL / CANCELLED | `1dbaffdfd1ac78712c1501d789c2143656c66995` | `36cf2db8ab0c6d04ab904b01c6bc8a0bb6b1cdab` | FAIL / FAIL / FAIL | 1/3/13/1 |
| [#2000.1 / 37528222608](https://github.com/planner77/masterGantt/actions/runs/37528222608) · 2026-10-06T20:40:23Z | METADATA / CANCELLED | `fc9eb1163592e76f4e22a22f9869d7f8be106a26` | `36cf2db8ab0c6d04ab904b01c6bc8a0bb6b1cdab` | FAIL / FAIL / FAIL | 0/3/10/0 |
| [#2001.1 / 37528427479](https://github.com/planner77/masterGantt/actions/runs/37528427479) · 2026-10-06T20:42:03Z | FULL / CANCELLED | `210d1fe0f3c0aa053e41abf9b2a2ab5456c137a0` | `36cf2db8ab0c6d04ab904b01c6bc8a0bb6b1cdab` | NOT RUN / NOT RUN / NOT RUN | 0/0/0/0 |
| [#2002.1 / 37528434939](https://github.com/planner77/masterGantt/actions/runs/37528434939) · 2026-10-06T20:42:06Z | FULL / CANCELLED | `a1956fe368865da71ea92e1088a8bf76e1d106f9` | `36cf2db8ab0c6d04ab904b01c6bc8a0bb6b1cdab` | FAIL / FAIL / FAIL | 1/3/13/1 |
| [#2003.1 / 37528504361](https://github.com/planner77/masterGantt/actions/runs/37528504361) · 2026-10-06T20:42:39Z | FULL / FAIL | `8488c3a797c62a80b22baf6284c52473117e38a5` | `36cf2db8ab0c6d04ab904b01c6bc8a0bb6b1cdab` | PASS / FAIL / PASS | 14/2/0/2 |
| [#2031.1 / 37558757715](https://github.com/planner77/masterGantt/actions/runs/37558757715) · 2026-10-07T01:46:34Z | FULL / FAIL | `ea772947a3553d3963573357033a7d02101224a7` | `36cf2db8ab0c6d04ab904b01c6bc8a0bb6b1cdab` | PASS / FAIL / PASS | 14/2/0/2 |
| [#2032.1 / 37558899508](https://github.com/planner77/masterGantt/actions/runs/37558899508) · 2026-10-07T01:48:19Z | METADATA / FAIL | `ea772947a3553d3963573357033a7d02101224a7` | `36cf2db8ab0c6d04ab904b01c6bc8a0bb6b1cdab` | FAIL / FAIL / FAIL | 1/4/0/8 |
| [#2034.1 / 37561192247](https://github.com/planner77/masterGantt/actions/runs/37561192247) · 2026-10-07T02:16:25Z | FULL / FAIL | `fe7166764a2e8d46a33f63d2a2f3ce854b0afd80` | `36cf2db8ab0c6d04ab904b01c6bc8a0bb6b1cdab` | PASS / FAIL / PASS | 14/2/0/2 |
| [#2036.1 / 37563367685](https://github.com/planner77/masterGantt/actions/runs/37563367685) · 2026-10-07T02:43:48Z | FULL / FAIL | `d90340b8852566de21eedcd78fde85132c8e0f75` | `36cf2db8ab0c6d04ab904b01c6bc8a0bb6b1cdab` | PASS / FAIL / PASS | 13/3/0/2 |
| [#2041.1 / 37566433451](https://github.com/planner77/masterGantt/actions/runs/37566433451) · 2026-10-07T03:22:19Z | FULL / CANCELLED | `b682d5a5941499736af8ba13b5a99915598015c5` | `36cf2db8ab0c6d04ab904b01c6bc8a0bb6b1cdab` | FAIL / FAIL / FAIL | 1/3/13/1 |
| [#2042.1 / 37566474453](https://github.com/planner77/masterGantt/actions/runs/37566474453) · 2026-10-07T03:22:51Z | FULL / FAIL | `8a6b4fd99280c899005d4b7c9a6e876f46ce0856` | `36cf2db8ab0c6d04ab904b01c6bc8a0bb6b1cdab` | PASS / FAIL / PASS | 14/2/0/2 |
| [#2085.1 / 37630888221](https://github.com/planner77/masterGantt/actions/runs/37630888221) · 2026-10-07T13:44:15Z | FULL / FAIL | `297ae4ff1c1c016727c7814c5d689fb9acd202bf` | `36cf2db8ab0c6d04ab904b01c6bc8a0bb6b1cdab` | PASS / FAIL / PASS | 12/4/0/2 |
| [#2086.1 / 37631235279](https://github.com/planner77/masterGantt/actions/runs/37631235279) · 2026-10-07T13:46:50Z | METADATA / FAIL | `297ae4ff1c1c016727c7814c5d689fb9acd202bf` | `36cf2db8ab0c6d04ab904b01c6bc8a0bb6b1cdab` | FAIL / FAIL / FAIL | 1/4/0/8 |

## 3. 누적 실패 파일 합집합

로그의 실제 `✘`/실패 case 요약/`FAIL`에서 추출했다. 같은 Job의 PASS/SKIPPED 파일을 실패 합집합에 섞지 않는다.

- `tests/e2e/country-calendar-admin.spec.ts`
- `tests/e2e/project-gantt-stability.spec.ts`
- `tests/e2e/project-grid-reorder-persistence.spec.ts`
- `tests/e2e/project-notifications.spec.ts`
- `tests/e2e/project-repeated-input-accessibility.spec.ts`
- `tests/e2e/project-status.spec.ts`
- `tests/e2e/task-editor-form-density.spec.ts`
- `tests/e2e/workspace-header-version.spec.ts`
- `tests/server/calendars/country-calendar-catalog.test.ts`
- `tests/server/calendars/country-calendar-integration.test.ts`
- `tests/server/db/database.test.ts`

## 4. Cross-run 실패 매트릭스

| ID·Run | 실제 오류·분류 | 최신 후보 보완·검증 경계 |
| --- | --- | --- | --- |
| F342-001 · #1345/#1352 | Catalog TS2345 unknown→number; country admin effect 동기 setState ESLint. build/Docker 동일 타입오류 파생. PRODUCT/정적 계약 | 엄격 country/year narrowing 및 hook 상태전이. 신규 typecheck/lint·서버 test로 확인. |
| F342-002 · #1345/#1348/#1972/#1975/#1977/#1983/#1988/#1989 | country admin 삭제 버튼2개·미확보2개·국가2개로 strict locator 위반. TEST_CONTRACT | 정확 역할/label/scope와 안정 DOM으로 교정. timeout/assertion 완화 금지. |
| F342-003 · #1345/#2085 | notifications320/360/361/375/390/400/401/414/768/1440px 메뉴link 기대4/실제5; header 폭 기대≤424/실제467.859375. PRODUCT/통합 | 최신 Main global4nav 보존, 국가 Catalog는 기준정보 아래 연결. header/notifications 인접 재검증. |
| F342-004 · #1355 | Grid DnD 뒤 inline rename focus 대상 없음. helper grid-task-reorder.ts:37, spec:72. UNKNOWN | 최신 Main Grid/Editor 보존, 해당 실제 spec 선정. flaky 단정 금지. |
| F342-005 · #1850 | project-status:197 apiRequestContext.get read ECONNRESET. INIT_TRANSPORT 관측/근본원인 미확정 | 실제 HTTP/SQLite spec 선정. #1851 metadata는 Full 실패 파생. |
| F342-006 · #1959/#1960 | database.test:139 migration pending 기대1/실제2. #1959는 Run취소 안 실제UnitFAIL. TEST_CONTRACT | 0034→0035 real Project/Task/calendar/session 보존 및 count/list 갱신. |
| F342-007 · #1972/#1974/#1975 | Catalog:356 metadata TS2322 string/null/undefined→string/null. 취소typecheck/build에도 관측. PRODUCT | PATCH null/undefined와 내부 nullable provenance 분리 및 음성 테스트. |
| F342-008 · #1995 | Catalog test PreviewMismatchError 미import TS2552; applyImport3인수에2개 TS2554; integration:70 중첩 test등록. TEST_CONTRACT | 현행 호출·수집/Preview token binding 검증. |
| F342-009 · #1995/#1998 | production audit sharp<0.35.5, CVE-2026-96889/GHSA-wq5f-xc86-pv6w high1. POLICY_CI/dependency | 최신 Main lockfile과 audit 유지. npm install 성공은 audit PASS가 아님; 신규 원격 audit NOT TESTED. |
| F342-010 · #1998/#2003/#2031/#2034/#2036/#2042 | 조회 실패 뒤 metadata 저장 DOM소멸/국가 전환 draft 처리 실패. #2042:194 disabled 대상없음, 이전 selectOption timeout30초. PRODUCT/TEST_CONTRACT | metadata/action DOM 유지·snapshot폐기·mutation잠금·dirty 확인·file epoch/412/dialog/focus 회귀. |
| F342-011 · #2036 | project-gantt-stability:169/181 첫 NativeAdd 요청 waitForRequest timeout30초. UNKNOWN/요청미관측 | 최신 Main Gantt 보존, 실제 첫 요청/보호오류 회귀. 과거 unrelated Gantt patch 전체 이식 금지. |
| F342-012 · #2085 | repeated-input-accessibility:103 summary focus 기대focused/실제inactive 390/768/1024/1440px. TEST_CONTRACT 후보 | 현재 Save는 유효Preview 전 disabled. Preview keyboard validation focus 검증, 실행 전 확정PASS 금지. |
| F342-013 · #2085 | form-density:193 metadata 저장뒤 chartScroll/publicViewport.left120→91; api/instance/fullscreen/scope 동일. PRODUCT/viewport 관측 | 최신 Main 보존코드 유지 및 동일 케이스 재검증. instance 유지로 scroll PASS 대체금지. |
| F342-014 · #1851/#1961/#1997/#2032/#2086 | metadata 동일Head 성공Full 증거 제한시간내 미확보. #2086 job112825846712은 #2085FAIL파생. POLICY_CI | 새PR 완성metadata 최초생성. metadata 실패를 독립 제품실패로 합산하거나 FullFAIL 덮기 금지. |

## 5. 직접 실패 Job 원본

각 Job의 Run/Head/base는 위 전체 목록에 연결한다. 짧은 오류는 원본 관측값이며 현재 대응은 위 매트릭스를 따른다.

| Run | Job·실패 Step | 실제 오류/테스트 |
| --- | --- | --- |
| #1345.1 | [109843778470](https://github.com/planner77/masterGantt/actions/runs/36702114357/job/109843778470) · Next.js production build · FAIL · Run npm run build | ##[error]src/server/calendars/country-calendar-catalog-core.ts(124,65): error TS2345: Argument of type 'unknown' is not assignable to parameter of type 'number'. |
| #1345.1 | [109843778514](https://github.com/planner77/masterGantt/actions/runs/36702114357/job/109843778514) · TypeScript 타입 검사 · FAIL · Run npm run typecheck | ##[error]src/server/calendars/country-calendar-catalog-core.ts(124,65): error TS2345: Argument of type 'unknown' is not assignable to parameter of type 'number'. |
| #1345.1 | [109843778562](https://github.com/planner77/masterGantt/actions/runs/36702114357/job/109843778562) · ESLint · FAIL · Run npm run lint | 108:32  error  Error: Calling setState synchronously within an effect can trigger cascading renders |
| #1345.1 | [109843778653](https://github.com/planner77/masterGantt/actions/runs/36702114357/job/109843778653) · Chromium E2E shard 1/4 · FAIL · E2E shard 실행 | ✘   1 [chromium] › tests/e2e/country-calendar-admin.spec.ts:69:5 › Issue #342: 관리자에서 Import Preview/Apply와 휴일 CRUD를 완료한다 (1.8s); [WebServer] [browser] ⨯ unhandledRejection: TypeError: Failed to fetch; [WebServer] [browser] ⨯ unhandledRejection: TypeError: Failed to fetch |
| #1345.1 | [109843778681](https://github.com/planner77/masterGantt/actions/runs/36702114357/job/109843778681) · Chromium E2E shard 2/4 · FAIL · E2E shard 실행 | ✘  49 [chromium] › tests/e2e/project-notifications.spec.ts:146:7 › 320px에서 브랜드·메뉴·알림 버튼의 hit area가 분리된다 (6.0s); ✘  50 [chromium] › tests/e2e/project-notifications.spec.ts:146:7 › 360px에서 브랜드·메뉴·알림 버튼의 hit area가 분리된다 (6.1s); ✘  51 [chromium] › tests/e2e/project-notifications.spec.ts:146:7 › 361px에서 브랜드·메뉴·알림 버튼의 hit area가 분리된다 (6.2s) |
| #1345.1 | [109843778774](https://github.com/planner77/masterGantt/actions/runs/36702114357/job/109843778774) · Chromium E2E shard 4/4 · FAIL · E2E shard 실행 | ✘  61 [chromium] › tests/e2e/workspace-header-version.spec.ts:6:5 › #136 공통 헤더에 빌드 버전을 표시하고 홈 링크와 탐색을 유지한다 (770ms); Error: expect(received).toBeLessThanOrEqual(expected); Expected: <= 424 |
| #1345.1 | [109843778780](https://github.com/planner77/masterGantt/actions/runs/36702114357/job/109843778780) · Docker smoke 구현 · FAIL · Docker image build | #15 10.72 1 high severity vulnerability; #17 14.09 src/server/calendars/country-calendar-catalog-core.ts(124,65): error TS2345: Argument of type 'unknown' is not assignable to parameter of type 'number'.; 14.09 src/server/calendars/country-calendar-catalog-core.ts(124,65): error TS2345: Argument of type 'unknown' is not assignable to parameter of type 'number'. |
| #1352.1 | [109869708216](https://github.com/planner77/masterGantt/actions/runs/36710113840/job/109869708216) · ESLint · FAIL · Run npm run lint | 109:10  error  Error: Calling setState synchronously within an effect can trigger cascading renders |
| #1355.1 | [109878375387](https://github.com/planner77/masterGantt/actions/runs/36712626051/job/109878375387) · Chromium E2E shard 2/4 · FAIL · E2E shard 실행 | ✘  19 [chromium] › tests/e2e/project-grid-reorder-persistence.spec.ts:6:5 › Grid DnD 확정 후 이름·진행률·재조회와 Context Move는 서버 순서를 보존한다 (18.1s); Error: expect(locator).toBeFocused() failed; Expected: focused |
| #1850.1 | [111818009101](https://github.com/planner77/masterGantt/actions/runs/37326333819/job/111818009101) · Chromium E2E shard 4/6 · FAIL · E2E shard 실행 | ✘  20 [chromium] › tests/e2e/project-status.spec.ts:135:5 › 생성 기본값과 설정 변경은 canonical 상태를 목록·읽기 화면에 반영하고 revision 충돌을 보존한다 (10.4s); Error: apiRequestContext.get: read ECONNRESET |
| #1851.1 | [111818718356](https://github.com/planner77/masterGantt/actions/runs/37326540777/job/111818718356) · PR metadata가 기존 전체 CI 증거를 보존하는지 검증 · FAIL · 동일 head SHA의 전체 PR CI 완료 증거 대기 | 동일 Head 성공 Full CI 증거 미확보(제한시간 종료) |
| #1959.1 | [112287551760](https://github.com/planner77/masterGantt/actions/runs/37469067830/job/112287551760) · Vitest 단위·통합 테스트 · FAIL · Run npm test | stderr  /  tests/server/projects/task-handlers.test.ts > W07 task handlers > maps hierarchy conflict ParentConversionRequiredError: Converting a task to a summary requires explicit confirmation. to stable 409 code PARENT_CONVERSION_REQUIRED; stderr  /  tests/server/projects/task-handlers.test.ts > W07 task handlers > maps hierarchy conflict InvalidParentTaskError: The selected task cannot contain child tasks. to stable 409 code INVALID_PARENT_TASK; stderr  /  tests/server/projects/task-handlers.test.ts > W07 task handlers > maps hierarchy conflict EmptySummaryNotAllowedError: Deleting the l… |
| #1960.1 | [112288431724](https://github.com/planner77/masterGantt/actions/runs/37469213241/job/112288431724) · Vitest 단위·통합 테스트 · FAIL · Run npm test | stderr  /  tests/server/projects/task-handlers.test.ts > W07 task handlers > maps hierarchy conflict ParentConversionRequiredError: Converting a task to a summary requires explicit confirmation. to stable 409 code PARENT_CONVERSION_REQUIRED; stderr  /  tests/server/projects/task-handlers.test.ts > W07 task handlers > maps hierarchy conflict InvalidParentTaskError: The selected task cannot contain child tasks. to stable 409 code INVALID_PARENT_TASK; stderr  /  tests/server/projects/task-handlers.test.ts > W07 task handlers > maps hierarchy conflict EmptySummaryNotAllowedError: Deleting the l… |
| #1961.1 | [112288396135](https://github.com/planner77/masterGantt/actions/runs/37469302239/job/112288396135) · PR metadata가 기존 전체 CI 증거를 보존하는지 검증 · FAIL · 동일 head SHA의 전체 PR CI 완료 증거 대기 | 동일 Head 성공 Full CI 증거 미확보(제한시간 종료) |
| #1975.1 | [112314790412](https://github.com/planner77/masterGantt/actions/runs/37476782511/job/112314790412) · Next.js production build · FAIL · Run npm run build | ##[error]src/server/calendars/country-calendar-catalog-core.ts(356,63): error TS2322: Type 'string  /  null  /  undefined' is not assignable to type 'string  /  null'.; ##[error]src/server/calendars/country-calendar-catalog-core.ts(356,78): error TS2322: Type 'string  /  null  /  undefined' is not assignable to type 'string  /  null'. |
| #1975.1 | [112314790612](https://github.com/planner77/masterGantt/actions/runs/37476782511/job/112314790612) · Docker smoke 구현 · FAIL · Docker image build | #17 25.44 src/server/calendars/country-calendar-catalog-core.ts(356,63): error TS2322: Type 'string  /  null  /  undefined' is not assignable to type 'string  /  null'.; #17 25.44 src/server/calendars/country-calendar-catalog-core.ts(356,78): error TS2322: Type 'string  /  null  /  undefined' is not assignable to type 'string  /  null'.; 25.44 src/server/calendars/country-calendar-catalog-core.ts(356,63): error TS2322: Type 'string  /  null  /  undefined' is not assignable to type 'string  /  null'. |
| #1975.1 | [112314790829](https://github.com/planner77/masterGantt/actions/runs/37476782511/job/112314790829) · TypeScript 타입 검사 · FAIL · Run npm run typecheck | ##[error]src/server/calendars/country-calendar-catalog-core.ts(356,63): error TS2322: Type 'string  /  null  /  undefined' is not assignable to type 'string  /  null'.; ##[error]src/server/calendars/country-calendar-catalog-core.ts(356,78): error TS2322: Type 'string  /  null  /  undefined' is not assignable to type 'string  /  null'. |
| #1975.1 | [112314790833](https://github.com/planner77/masterGantt/actions/runs/37476782511/job/112314790833) · Chromium E2E shard 1/6 · FAIL · E2E shard 실행 | ✘   5 [chromium] › tests/e2e/country-calendar-admin.spec.ts:74:5 › Issue #342: 관리자에서 Import Preview/Apply와 휴일 CRUD를 완료한다 (1.2s); Error: expect(locator).toBeVisible() failed; Expected: visible |
| #1989.1 | [112324429197](https://github.com/planner77/masterGantt/actions/runs/37479641264/job/112324429197) · Chromium E2E shard 1/6 · FAIL · E2E shard 실행 | ✘   5 [chromium] › tests/e2e/country-calendar-admin.spec.ts:74:5 › Issue #342: 관리자에서 Import Preview/Apply와 휴일 CRUD를 완료한다 (1.7s); ✘   8 [chromium] › tests/e2e/country-calendar-admin.spec.ts:168:5 › Issue #342: 조회 실패는 선택 target과 이전 snapshot을 섞지 않는다 (851ms); Error: expect(locator).toBeVisible() failed |
| #1995.1 | [112486407731](https://github.com/planner77/masterGantt/actions/runs/37526967216/job/112486407731) · TypeScript 타입 검사 · FAIL · Run npm run typecheck | ##[error]tests/server/calendars/country-calendar-catalog.test.ts(128,17): error TS2552: Cannot find name 'CountryCalendarCatalogPreviewMismatchError'. Did you mean 'CountryCalendarCatalogRevisionMismatchError'?; ##[error]tests/server/calendars/country-calendar-catalog.test.ts(200,29): error TS2554: Expected 3 arguments, but got 2. |
| #1995.1 | [112486407770](https://github.com/planner77/masterGantt/actions/runs/37526967216/job/112486407770) · 정책·저장소 계약 검사 · FAIL · production dependency audit | 1 high severity vulnerability |
| #1995.1 | [112486407841](https://github.com/planner77/masterGantt/actions/runs/37526967216/job/112486407841) · Vitest 단위·통합 테스트 · FAIL · Run npm test | stderr  /  tests/server/projects/task-handlers.test.ts > W07 task handlers > maps hierarchy conflict ParentConversionRequiredError: Converting a task to a summary requires explicit confirmation. to stable 409 code PARENT_CONVERSION_REQUIRED; stderr  /  tests/server/projects/task-handlers.test.ts > W07 task handlers > maps hierarchy conflict InvalidParentTaskError: The selected task cannot contain child tasks. to stable 409 code INVALID_PARENT_TASK; stderr  /  tests/server/projects/task-handlers.test.ts > W07 task handlers > maps hierarchy conflict EmptySummaryNotAllowedError: Deleting the l… |
| #1995.1 | [112486407858](https://github.com/planner77/masterGantt/actions/runs/37526967216/job/112486407858) · Next.js production build · FAIL · Run npm run build | ##[error]tests/server/calendars/country-calendar-catalog.test.ts(128,17): error TS2552: Cannot find name 'CountryCalendarCatalogPreviewMismatchError'. Did you mean 'CountryCalendarCatalogRevisionMismatchError'?; ##[error]tests/server/calendars/country-calendar-catalog.test.ts(200,29): error TS2554: Expected 3 arguments, but got 2. |
| #1997.1 | [112487319643](https://github.com/planner77/masterGantt/actions/runs/37527187097/job/112487319643) · PR metadata가 기존 전체 CI 증거를 보존하는지 검증 · FAIL · 동일 head SHA의 전체 PR CI 완료 증거 대기 | 동일 Head 성공 Full CI 증거 미확보(제한시간 종료) |
| #1998.1 | [112488592367](https://github.com/planner77/masterGantt/actions/runs/37527392747/job/112488592367) · 정책·저장소 계약 검사 · FAIL · production dependency audit | 1 high severity vulnerability |
| #2003.1 | [112492253619](https://github.com/planner77/masterGantt/actions/runs/37528504361/job/112492253619) · Chromium E2E shard 1/6 · FAIL · E2E shard 실행 | ✘   8 [chromium] › tests/e2e/country-calendar-admin.spec.ts:177:5 › Issue #342: 조회 실패는 선택 target과 이전 snapshot을 섞지 않는다 (30.1s); ✘  11 [chromium] › tests/e2e/country-calendar-admin.spec.ts:235:5 › Issue #342: 국가 전환은 신규 날짜와 파일 draft를 폐기한다 (30.2s); Error: locator.selectOption: Test timeout of 30000ms exceeded. |
| #2031.1 | [112591045149](https://github.com/planner77/masterGantt/actions/runs/37558757715/job/112591045149) · Chromium E2E shard 1/6 · FAIL · E2E shard 실행 | ✘   8 [chromium] › tests/e2e/country-calendar-admin.spec.ts:177:5 › Issue #342: 조회 실패는 선택 target과 이전 snapshot을 섞지 않는다 (30.0s); ✘  11 [chromium] › tests/e2e/country-calendar-admin.spec.ts:235:5 › Issue #342: 국가 전환은 신규 날짜와 파일 draft를 폐기한다 (30.2s); Error: locator.selectOption: Test timeout of 30000ms exceeded. |
| #2032.1 | [112591493191](https://github.com/planner77/masterGantt/actions/runs/37558899508/job/112591493191) · PR metadata가 기존 전체 CI 증거를 보존하는지 검증 · FAIL · 동일 head SHA의 전체 PR CI 완료 증거 대기 | 동일 Head 성공 Full CI 증거 미확보(제한시간 종료) |
| #2034.1 | [112598676021](https://github.com/planner77/masterGantt/actions/runs/37561192247/job/112598676021) · Chromium E2E shard 1/6 · FAIL · E2E shard 실행 | ✘   8 [chromium] › tests/e2e/country-calendar-admin.spec.ts:177:5 › Issue #342: 조회 실패는 선택 target과 이전 snapshot을 섞지 않는다 (5.7s); ✘  11 [chromium] › tests/e2e/country-calendar-admin.spec.ts:237:5 › Issue #342: 국가 전환은 신규 날짜와 파일 draft를 폐기한다 (5.8s); Error: expect(locator).toBeEnabled() failed |
| #2036.1 | [112605490311](https://github.com/planner77/masterGantt/actions/runs/37563367685/job/112605490311) · Chromium E2E shard 3/6 · FAIL · E2E shard 실행 | ✘  20 [chromium] › tests/e2e/project-gantt-stability.spec.ts:117:7 › Issue #3 stable Gantt instance › 확인 팝업 없이 첫 하위 작업을 추가하고 모든 보호 오류에서 유령 작업을 남기지 않는다 (30.2s); Error: page.waitForRequest: Test timeout of 30000ms exceeded. |
| #2036.1 | [112605490318](https://github.com/planner77/masterGantt/actions/runs/37563367685/job/112605490318) · Chromium E2E shard 1/6 · FAIL · E2E shard 실행 | ✘   8 [chromium] › tests/e2e/country-calendar-admin.spec.ts:177:5 › Issue #342: 조회 실패는 선택 target과 이전 snapshot을 섞지 않는다 (5.7s); ✘  11 [chromium] › tests/e2e/country-calendar-admin.spec.ts:237:5 › Issue #342: 국가 전환은 신규 날짜와 파일 draft를 폐기한다 (5.9s); Error: expect(locator).toBeEnabled() failed |
| #2042.1 | [112615374357](https://github.com/planner77/masterGantt/actions/runs/37566474453/job/112615374357) · Chromium E2E shard 1/6 · FAIL · E2E shard 실행 | ✘   8 [chromium] › tests/e2e/country-calendar-admin.spec.ts:177:5 › Issue #342: 조회 실패는 선택 target과 이전 snapshot을 섞지 않는다 (5.8s); Error: expect(locator).toBeDisabled() failed; Expected: disabled |
| #2085.1 | [112824673717](https://github.com/planner77/masterGantt/actions/runs/37630888221/job/112824673717) · Chromium E2E shard 3/6 · FAIL · E2E shard 실행 | ✘  63 [chromium] › tests/e2e/project-notifications.spec.ts:191:7 › 375px에서 브랜드·메뉴·알림 버튼의 hit area가 분리된다 (6.7s); ✘  64 [chromium] › tests/e2e/project-notifications.spec.ts:191:7 › 390px에서 브랜드·메뉴·알림 버튼의 hit area가 분리된다 (6.7s); ✘  65 [chromium] › tests/e2e/project-notifications.spec.ts:191:7 › 400px에서 브랜드·메뉴·알림 버튼의 hit area가 분리된다 (6.7s) |
| #2085.1 | [112824673762](https://github.com/planner77/masterGantt/actions/runs/37630888221/job/112824673762) · Chromium E2E shard 6/6 · FAIL · E2E shard 실행 | ✘  42 [chromium] › tests/e2e/task-editor-form-density.spec.ts:148:5 › #456 비기본 WBS fullscreen scroll tree column scale selection은 Editor와 metadata 저장 후 유지된다 (10.1s); ✘  74 [chromium] › tests/e2e/workspace-header-version.spec.ts:6:5 › #136 공통 헤더에 빌드 버전을 표시하고 홈 링크와 탐색을 유지한다 (834ms); Error: expect(received).toEqual(expected) // deep equality |
| #2085.1 | [112824673911](https://github.com/planner77/masterGantt/actions/runs/37630888221/job/112824673911) · Chromium E2E shard 4/6 · FAIL · E2E shard 실행 | ✘   2 [chromium] › tests/e2e/project-repeated-input-accessibility.spec.ts:41:7 › #119 1024px 캘린더 반복 규칙의 오류는 Preview·Save 요청 전에 구분된다 (11.0s); ✘   5 [chromium] › tests/e2e/project-repeated-input-accessibility.spec.ts:41:7 › #119 1440px 캘린더 반복 규칙의 오류는 Preview·Save 요청 전에 구분된다 (11.3s); Error: expect(locator).toBeFocused() failed |
| #2086.1 | [112825846712](https://github.com/planner77/masterGantt/actions/runs/37631235279/job/112825846712) · PR metadata가 기존 전체 CI 증거를 보존하는지 검증 · FAIL · 동일 head SHA의 전체 PR CI 완료 증거 대기 | 동일 Head 성공 Full CI 증거 미확보(제한시간 종료) |

## 6. 취소 Job 내부 실제 실패·미실행

실행단계에 도달한 취소109Job 로그 중 다음6개 E2E Job에 실제 FAIL이 있었다. 나머지 취소Job 전체를 PASS/실패0으로 바꾸지 않는다.

| Run | CANCELLED Job | 내부 관측 |
| --- | --- | --- |
| #1348.1 | [109869056694](https://github.com/planner77/masterGantt/actions/runs/36709929160/job/109869056694) | country-calendar-admin Import/CRUD 또는 target조회·전환 실제 FAIL |
| #1972.1 | [112312733779](https://github.com/planner77/masterGantt/actions/runs/37476330759/job/112312733779) | country-calendar-admin Import/CRUD 또는 target조회·전환 실제 FAIL |
| #1977.1 | [112317868264](https://github.com/planner77/masterGantt/actions/runs/37477691257/job/112317868264) | country-calendar-admin Import/CRUD 또는 target조회·전환 실제 FAIL |
| #1983.1 | [112321318189](https://github.com/planner77/masterGantt/actions/runs/37478671695/job/112321318189) | country-calendar-admin Import/CRUD 또는 target조회·전환 실제 FAIL |
| #1988.1 | [112323489171](https://github.com/planner77/masterGantt/actions/runs/37479396751/job/112323489171) | country-calendar-admin Import/CRUD 또는 target조회·전환 실제 FAIL |
| #1998.1 | [112488592536](https://github.com/planner77/masterGantt/actions/runs/37527392747/job/112488592536) | country-calendar-admin Import/CRUD 또는 target조회·전환 실제 FAIL |

- #1972/#1974 취소 TypeScript/build Job에도 Catalog TS2322:356이 기록됐다. 종료 CANCELLED와 내부 오류를 동시 보존한다.
- 시작하지 않은 Job·준비중 취소·SKIPPED와 runner 미실행 케이스는 NOT RUN이다. Job 수로 고유 testcase수나 전체 성공을 추산하지 않는다.
- 옛 #1844/#1845/#1964 PASS3개는 당시 source의 성공이며 #2085/신규 Head FAIL을 상쇄하지 않는다.

## 7. 최신 후보 제한적 확대 진단

선정표이며 아래 미실행 항목은 PASS가 아니다. 구현자가 동결 source에서 실행하고 수정된 파일은 재검증한다.

| 범위 | 선정 테스트 | 상태 |
| --- | --- | --- |
| 직접/과거 실패 | country-calendar-admin; country-calendar-catalog; country-calendar-integration; database/migration | 구현 Agent 최종 영수증을 후속 기록 |
| Calendar 인접·음성 | project-work-calendar-preview; project-resource-calendar-exceptions; strictJSON/CSV·지연body·권한회수·Origin/revision·token expiry/no-op | 구현 Agent 최종 영수증을 후속 기록 |
| 과거 실패8E2E 합집합 | country-calendar-admin; project-gantt-stability; project-grid-reorder-persistence; project-status; project-notifications; project-repeated-input-accessibility; task-editor-form-density; workspace-header-version | 새후보 실제 bounded 검증 진행중; 완료 전 NOT TESTED |

## 8. 최초 로컬 실패·보완 이력

- 최초 root gh API `HTTP401 Bad credentials`. Public fetch/connector read는 성공했지만 git fetch 성공은 write 권한 증명이 아니다. npm 설치는 이후 성공. ENVIRONMENT/BLOCKED 뒤 복구 경로는 별도 기록한다.
- backend 첫6파일95테스트:91PASS/4FAIL. migration-cli34→35, database 신규3table inventory, route inventory 정렬, JSON/CSV 예제 누락. 계약/fixture 정합으로 수정했고 assertion완화 없음. `/tmp/issue342-backend-fast.log`.
- 추가 migration7파일97테스트:96PASS/1FAIL. #623 pending-count10→11 반영. `/tmp/issue342-migration-regressions.log`.
- backend 첫tsc TS18047 builtin descriptor nullable은 실제 builtin 반환type을 강화하여 수정. `/tmp/issue342-backend-typecheck-final.log` PASS.
- Manager 검토에서 옛 verified-data VN2026override가 최신 Main effective2026을 변경함을 발견했다. 해당 override제거 및 7국가 effective2026 golden hash 회귀를 추가했다. 과거 builtin literal보존만으로 effective보존을 주장하지 않는다.
- backend16파일207PASS 뒤 golden1개추가 최종208개 재실행중. `/tmp/issue342-backend-final-tests.log`와 `/tmp/issue342-backend-frozen-tests.log`를 구분하며 최종 실행 완료 전208PASS를 주장하지 않는다.
- `npm run verify:prepr -- --mode=targeted --base=origin/main --issue=342 --risk=HIGH --dry-run`: UNKNOWN6/selected41, 자동선정 BLOCKED. page/nav/catalogwrapper/defaultseed/verifieddata/strictjson을 실제 country/Calendar 소비자로 수동매핑한다. `.prepr-reports/2026-10-31T04-18-03.274Z-365872-a97da20e`. 정책skip이나 QA수준 하향 없음.
- Markdown 최초검사3링크 실패는 본 원장 미작성 참조였다. 파일작성 뒤 재검증한다. `/tmp/issue342-links.log`. Version check0.139.0은 PASS.
- frontend401 session expiry P2 보완은 최종 재실행 결과를 후속기록한다.

## 9. 문서·리뷰·게시 경계

- [Work Packet](exec-plans/active/ISSUE_342.md)의 DOC_SYNC/AC매핑·위험도·QA경로는 Manager가 확정한다.
- 옛 #346 미해결6스레드: 지연body후 관리자세션 재검사, 412reload실패 잠금, dialog내부 오류, 날짜변경뒤focus복원, nullstatus거부, CSV닫힌quote후문자거부. 새 구현/테스트 증거를 연결한 뒤 실제 resolved상태를 확인한다. 원장작성만으로 resolved를 주장하지 않는다.
- 새branch는 최신 Main에서 시작하며 옛 conflict tree를 병합하지 않는다. 게시 직전 최신 main ancestry/diff/충돌·리뷰를 재확인한다.
- 승인된 종료점은 구현·문서·Local Fast Feedback·리뷰/충돌 정리·원장 기록 뒤 **새 PR CI 시작**이다. 신규 quality/e2e/docker·TrustedQA·ManagerACCEPT는 실행 전 NOT TESTED. CI모니터링·병합·Main/GHCR·Release·Issue종료는 범위 밖. release_required=true/release_authorized=false.
- 신규 Run/Head/Attempt는 Issue/PR 댓글에 연결하고 완료를 기다리지 않는다. 원본 remote/local FAIL을 삭제하거나 소급PASS로 바꾸지 않는다.

## 10. 2026-10-31 동결 후보 검증 영수증

- backend 동결34파일/471,901bytes manifest SHA256 `e1aa14f6ad23f81c6d6f9122a9fdd4915bf7361f882d811dfc71fc3af91ef48b`; `/tmp/issue342-backend-file-manifest.json`. 최종16파일 **208PASS/0FAIL**,11.68초(`/tmp/issue342-backend-frozen-tests.log`). 이전207개와별도실행이며중복합산하지않는다. ESLint exit0/0errors/2warnings(기존unused import·destructure), typecheck PASS다. 실제command/파일목록·원문지문은 `/tmp/issue342-backend-result.json`에보존한다.
- 별도 qa_docs가 catalog/integration/data3파일을직접실행해 **53PASS**(3.04초)를확인했다(`/tmp/issue342-independent-qa-unit.log`). 구현208개와겹치므로고유검증수를261로합산하지않는다.
- 첫브라우저선택 country5 + ProjectCalendar3 + ResourceCalendar1은 **9PASS/0FAIL**,3.7분(`/tmp/issue342-frontend-e2e.log`). 이후401 modal폐기·설계보완이있어국가관리6개와과거실패합집합의새동결검증은별도진행한다. 첫9개PASS만으로최종UI전체PASS를주장하지않는다.
- Markdown link 재검사 **391files PASS**, version `v0.139.0` PASS, dirty+untracked 전체경로의 main `docs_gate`에 AC1~15를적용해 DOCUMENTATION_SYNC/ACmapping 구조PASS. 구조검사는의미QA/원격PASS가아니다.
- `git fetch origin main` 재조회에서 baseline `ce8ca4ec7f0eb2ba63d883b7c22786c5d033aa14` 유지. 새main과소스충돌은없고옛PR346을현재branch로merge하지않는다.

### frontend 최초 준비·사전 검토 실패 보존

- backend 타입 수정 중 `country-calendar-data.test.ts:15` nullable TypeScript 오류를 frontend에서도 관측했다. builtin 반환type 강화 뒤 typecheck를 다시 실행했다.
- node_modules symlink를 제거하고 최신main 의존성으로 `npm ci`하는 동안 Playwright `--list`가 `MODULE_NOT_FOUND @playwright/test`로 실패했다. 설치 완료 후 발견이 성공했으며 테스트실행PASS로계산하지않는다.
- 별도 qa_docs가 401→재로그인 뒤 날짜/파일 dialog 상태가 다시 나타나는 P2를 발견했다. 날짜/파일초안·모달·확인을인증해제때폐기하고metadata는최신값비교전잠금을유지했다. 전용6번째E2E에서검증한다.
- 첫수정의effect 동기setState가 `country-calendar-admin.tsx:49` ESLint `react-hooks/set-state-in-effect`로실패했다. 조건부render-state reset으로교정해lint를통과했으며rule을비활성화하지않았다. 이수정후국가관리6개를포함한26개bounded검증을새source에서수행한다.

### VN2026 원표 재검증 후 Manager 설계 정정

초기에는 oldcandidate override를 출처 확인 없이 적용하지 않기 위해 제거하고7국가2026 보존을 검증했다. 이후 Manager가 이미 발표된 정정의 누락 가능성을 추가 제기했고, researcher와독립qa_docs가정부문서12729/2025·Resolution28/2026/QH16(2026-07-01시행)·10065/2026-10-02 원문을직접대조했다. **Jan2 NON_WORKING/Jan10 WORKING/Nov24 NON_WORKING의3행은공식확정**이며공공부문주5일범위에적용된다. 제안단계Nov23/Nov28은배제한다. 상세URL은[국가데이터 운영](COUNTRY_CALENDAR_DATA.md)에보존한다.

따라서검증된정정까지제거한채불완전14행을OFFICIAL로유지하지않고, 기존14행+공식3행과새sourceVersion을반영하도록설계를정정했다. 나머지6국가2026은원본동일성golden을유지한다. 기존Project materialized Calendar/Task/revision·oldsourceVersion은자동변경하지않는다. 앞208PASS는VN정정이전source영수증이고, 정정후backend재실행은별도로기록한다. 이정정은초기발견·제거역사를삭제하거나PASS로덮어쓰지않는다.

### 추가 발견·국소 재검증 경계

- 최종26개 bounded Chromium 실행은 **26PASS/0FAIL**,6.5분이다. 국가6개/과거실패 인접20개를포함한다. 실행중국가파일사례가끝난뒤 `readFile(undefined)`에서이전파일읽기를취소하면 `fileReading`이남는경계를발견했다. hook1행과기존파일E2E의취소assert를보완하여그사례만최신bytes에서재실행한다. 따라서앞26PASS를새hook전체동결PASS로표시하지않고기존25사례+수정1사례재검증으로연결한다. 고유테스트수를27로합산하지않는다.
- VN정정첫16파일210개실행은 **209PASS/1FAIL**이다(`/tmp/issue342-backend-vn-final-tests.log`). 새legacyVN14 golden의JSON property배치순서가원래DTO(dayType/sourceKey)와달라hash만불일치했다. 날짜/출처뜻의차이가아닌테스트재구성오류로판단하고원래순서로정규화했으며제품날짜/검증assertion을완화하지않았다. 재실행은 `/tmp/issue342-backend-vn-final-tests-2.log`에별도보존한다.

- VN정정 후 backend16파일 **210PASS/0FAIL**,10.32초(`/tmp/issue342-backend-vn-final-tests-2.log`). 새34파일/479,530bytes manifest SHA256 `6761ef63bf9ba2a3f68e9de65608389787e223892fa6aef048d6b4e5c8822b30`(`/tmp/issue342-backend-vn-file-manifest.json`). 기존208/독립53과중복합산하지않는다.
- 파일읽기취소 보완사례의첫실행은 **1FAIL**(`/tmp/issue342-frontend-fileclear.log`): `role=status`가파일상태와toast2개에일치한strictlocator오류다. 실제파일상태에는정상적으로'파일을선택하세요'가표시됐다. 구체적인파일상태selector로교정하고같은기능사례를재실행한다. timeout증가/force/guard제거로통과시키지않는다.

### 최종 Local Fast Feedback과 증거 귀속

- 파일취소사례 최신bytes 재실행 **1PASS/0FAIL**,2.8초(전체22.6초), `/tmp/issue342-frontend-fileclear-fixed.log`. 기존26개중해당1개재검증이며고유사례추가가아니다. 앞선첫locator실패는그대로보존한다.
- 별도qa_docs는VN정정뒤3파일 **55PASS**,1.82초(`/tmp/issue342-independent-qa-unit-final.log`)를직접실행했다. backend210개와중복합산하지않는다.
- 브라우저는첫선택9개중Country5개가뒤26개와겹친다. 최종한정고유범위는Country6+과거실패인접20+ProjectCalendar3+ResourceCalendar1=**30개**다.26개실행뒤fileclear hook1행·해당case를추가수정했고이1개를재검증했다.26개는VN3행정정이전실행이고,KR/US를사용하는UI소비자의한정증거로재사용한다. 모든최종bytes의전체회귀PASS로확대하지않는다.
- geometry[정제파일](evidence/issue342/country-calendar-admin-geometry.json) SHA256 `c42ca5ab3e4d38edbe0dccec08965dcb4f5ce86d8f2b40fb79a29f4f225e67e5`. 같은실행의390/1440px·keyboard390PNG만Git에보존한다. 합성US2031이며실제builtinOFFICIAL자료증거가아니다.5폭문서overflow0/fine40px/coarse44px·nativekeyboard는같은실제Next/인증/SQLite happyflow에속한다.
- 환경: LinuxWSL2/Node22.14.0/npm11.10.0, Next16.4.2/React19.3.0/SVAR2.7.3, Playwright1.63.0/Chromium153.0.8010.12. npm ci로현재main frozen lock을설치했다. locale/timezone/DPR/rootfont/zoom은geometry원문에기록한다. native125%·실제운영·WindowsExcel/DRM은NOT TESTED다.

서버최종명령(210PASS):

```sh
npx vitest run --config tests/config/vitest.config.ts tests/server/calendars tests/server/db/database.test.ts tests/server/migration-cli.test.ts tests/server/projects/edit-authorization-handlers.test.ts tests/server/projects/project-issues.test.ts tests/server/db/issue-623-target-migration.test.ts tests/server/process-catalog/process-context-service.test.ts tests/server/process-catalog/process-catalog-service.test.ts tests/server/logistics/logistics-targets-acceptance.test.ts tests/server/logistics/task-target-bindings.test.ts tests/server/resources/project-resource-memberships.test.ts
```

과거실패합집합 bounded 명령(26PASS;후속fileclear1사례재검증은별도):

```sh
npx playwright test --config tests/config/playwright.config.ts tests/e2e/country-calendar-admin.spec.ts tests/e2e/project-gantt-stability.spec.ts tests/e2e/project-grid-reorder-persistence.spec.ts tests/e2e/project-notifications.spec.ts tests/e2e/project-repeated-input-accessibility.spec.ts tests/e2e/project-status.spec.ts tests/e2e/task-editor-form-density.spec.ts tests/e2e/workspace-header-version.spec.ts --grep 'SQLite 관리자|첫 조회 오류|412와 401|파일 UTF|412 후 canonical|날짜 편집 중 401|keeps the instance|첫 하위 작업|Grid DnD 확정|hit area|캘린더 반복|생성 기본값과 설정 변경|비기본 WBS fullscreen|공통 헤더' --project chromium --workers 1 --output output/playwright/issue342-current
```

모든브라우저실행은설정의retries0을유지한다.원시trace/runtimeDB/민감로그는Git에넣지않는다.

- 최종frontend12파일 manifest SHA256 `d1775b8389fd4a8d12b0b5fbb3a50bc57f01b1a8df154a575dd1a8193d95a82f` (`/tmp/issue342-frontend-manifest.json`).26개실행시manifest는 `44dcf273220d99df00d72d3f30f76e8e254a1673a1074868c9d9f8b649ef4f38` (`/tmp/issue342-frontend-manifest-bounded.json`)이며차이는fileclear hook/해당E2E2파일뿐이다. geometry지문과이실행당시manifest·위실제명령을결속한다. frontend현재12파일과backend현재34파일의개별SHA256를Manager가모두대조했다.
- Dev가생성한next-env.d.ts/tsconfig.json의임시isolated출력경로만baselinebytes로복원했다. 제품설정/CI출력경로를변경한것이아니다. 링크최종PASS로그는 `/tmp/issue342-links-final.log`(391files),versioncheck0.139.0 PASS다.

- frontend 최종 clean-config typecheck·소유경로 ESLint·diff-check **PASS/exit0**, session60678. 최종 영수증 `/tmp/issue342-frontend-result.json` SHA256 `2594e77c7202549df4163dc9bcdd3402305c12303249e7a24a890886c5f09592`. 실제 실행 수는 첫9PASS+26PASS+filecase1FAIL+재검증1PASS=37회이며 한정 고유 사례30개다. 재실행 수를 고유 테스트로 합산하지 않는다.
- backend VN정정후 typecheck·변경3파일ESLint(0error/0warning)·diff-check도PASS다. 최초전체backend lint의2개기존경고와현재변경3파일무경고를구분한다.
- 과거형상검증이생성한tracked `output/playwright/issue-456/after/gantt-state.json/png`는본작업원본을 `/tmp/issue342-generated-issue456`에보존하고baselinebytes로복원했다. #342정제화면4파일외raw출력·trace는게시하지않는다.

- 실제별도 `/root/qa_docs` 독립PRE_QA **PASS**. 최종46개제품·테스트경로검토지문 `bdf3e91cf5a2672ee093fa78d667bedae09f2f997c9dfe45a74e374f4fb12b21`. AC1~14의로컬구현/관련증거/문서범위와미해결6개코드교정을대조했고새P1/P2없음. AC15/Required3·Trusted/보호인간QA_FINAL·Manager ACCEPT는 **NOT TESTED**다.

## 11. 원격 게시·실제 리뷰 해결 후 PR CI 인계

2026-10-31 원격1단계는 [commit153c58fb](https://github.com/planner77/masterGantt/commit/153c58fba28e39eb9b22f922a1ca955569247b22), tree `1573e91b2e18f3738a9360472624517bfa21f12b`, parent/base `ce8ca4ec7f0eb2ba63d883b7c22786c5d033aa14`다. GitData tree가동결localtree와일치하고원격fetch로commit/tree/parent를검증했다. branch만게시했으므로CI가실행되지않았다. 기존CI의non-mainpush미수신/PRopened전체검증계약을유지한다.

Manager는게시commit의교정소스·서버210/브라우저고유30한정증거·PRE_QA와원격미검증경계를인용하여PR346의아래6개에실제답변하고resolve했다. GraphQL재조회는전체25스레드/미해결0이다.

| thread | 지적 | 실제처리 |
| --- | --- | --- |
| PRRT_kwDOUUB7Bc6pudAc | 지연body후admin재검사 | reply4430508687·resolved |
| PRRT_kwDOUUB7Bc6pudAf | 412재조회실패mutation잠금 | reply4430508986·resolved |
| PRRT_kwDOUUB7Bc6pudAh | 열린모달오류전달 | reply4430509298·resolved |
| PRRT_kwDOUUB7Bc6pudAl | 날짜rename후초점 | reply4430509506·resolved |
| PRRT_kwDOUUB7Bc6pudAo | metadata status:null거부 | reply4430509768·resolved |
| PRRT_kwDOUUB7Bc6pudAr | CSV닫힌따옴표suffix거부 | reply4430509971·resolved |

최신Issue의'새PR재구성/구PR단독병합금지'지시에따라구PR346은2026-10-31T04:32:15Z에 **CLOSED / merged=false**로대체종료했다. 원래branch/103commit·리뷰·실패이력은삭제하지않았다. Issue342는OPEN이며새branch는현재main직접기반으로충돌파일0이다. 새PR의mergeability·review상태는생성직후별도확인한다.

이절과Work Packet의처리결과를동일branch의문서전용후속commit에반영한뒤ReadyPR을생성하여FullCI를시작한다. 정확한최종Head/PR/Run/Attempt는Issue와PR댓글에남긴다. 시작시quality/e2e/docker·Trusted/보호인간QA_FINAL/Manager ACCEPT는 **NOT TESTED**이며CI결과를모니터링하지않는다.

CSV예제는원본CRLF를유지하므로기본staged diff-check는CR을trailing-whitespace로보고했다. 형식계약에맞춰 `git -c core.whitespace=cr-at-eol diff --cached --check`로검사해PASS이며파일bytes나CSV검증정책을변경하지않았다.
