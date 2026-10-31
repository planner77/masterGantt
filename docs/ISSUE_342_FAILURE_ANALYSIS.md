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

## 12. PR #864 Full #3455.1 — 필수 QA 선언 누락과 파생 실패 (2026-10-31)

### 전체 이력 재대조와 원본 출처

이번 REWORK는 위 1~11절과 [공통 실패 처리 순서](PR_CI_FAILURE_TRIAGE.md)를 먼저 전부 읽고 시작했다. 옛 #346의54CI Run/36FAIL Job/109취소Job/11실패테스트파일·선행보완을 유지했다. 신규 branch 전체 Actions 조회는 total_count=2/목록2로, **Full CI1개와 참고용 FAST1개**, 모두 attempt1이다. #3455 이후 추가 Full/metadata rerun은 이 조사 시점에 없다. 별도 기본브랜치 workflow_run4개를 분리했다. 정제 원격 영수증은 `/tmp/issue342-rework1-ci.json`, 검증한4개 artifact 내용·지문은 `/tmp/issue342-rework1-artifacts.json`이다.

- PR: [#864](https://github.com/planner77/masterGantt/pull/864), branch `feat/issue-342-country-catalog-current`.
- 원본 Head: `cf9458c15bceb2dddadc3a40903feeede39707e8`; base/validator: `ce8ca4ec7f0eb2ba63d883b7c22786c5d033aa14`; test-merge: `978a89b2f4eda1c7501370c98909febe032a83f8`.
- [Full #3455.1](https://github.com/planner77/masterGantt/actions/runs/41169048995), Run `41169048995`, attempt `1`, `pull_request/opened`, 생성 `2026-10-31T04:33:23Z`, 결론 **FAIL**. schema/repository/PR/Run/attempt/Head/base/test-merge가 원본 source artifact와 API 보고에 일치한다. ZIP은 JSON으로만 읽었고 실행·PR코드 checkout을 하지 않았다.
- 전체23Job: **SUCCESS3 / FAIL5 / SKIPPED15 / CANCELLED0**. 실제 E2E shard가 실행된 뒤 취소된 Job은 없고 새 실패 테스트파일도 **0개**다. 비용 차단에 따른 skipped를 검증 PASS로 바꾸지 않는다.

| 실행 | event·source | 결과와 실제 의미 |
| --- | --- | --- |
| [Full #3455.1 / 41169048995](https://github.com/planner77/masterGantt/actions/runs/41169048995) | pull_request · Head cf9458c1 | FAIL; QA Preflight 실제 실패, Required3 파생 FAIL; 실제 품질·E2E·Docker NOT RUN |
| [FAST #235.1 / 41169048982](https://github.com/planner77/masterGantt/actions/runs/41169048982) | pull_request · 같은 Head | SKIPPED1Job; Ready PR의 비권위 참고 경로이며 PASS 아님 |
| [Trusted #1101.1 / 41169147423](https://github.com/planner77/masterGantt/actions/runs/41169147423) | workflow_run · default SHA ce8ca4ec | FAIL1Job; 원본 CI 자체 미성공의 파생. 독립 인간 QA/Owner 영수증을 검증하기 전 차단 |
| [진단 #296.1 / 41169144957](https://github.com/planner77/masterGantt/actions/runs/41169144957) | workflow_run · default SHA ce8ca4ec | 권고 출처확인1Job SUCCESS/나머지5Job SKIPPED; 실제 별도 E2E 진단·댓글 미실행, Required PASS 아님 |
| [메타데이터 복구 #1001.1 / 41169144927](https://github.com/planner77/masterGantt/actions/runs/41169144927) | workflow_run · default SHA ce8ca4ec | SUCCESS1Job은 복구 Controller의 결과이며 Full CI 실패를 복구한 증거 아님 |
| [준비도 #1042.1 / 41169144896](https://github.com/planner77/masterGantt/actions/runs/41169144896) | workflow_run · default SHA ce8ca4ec | SKIPPED1Job; 새 캐시/실행 성공 근거 아님 |

### F342-015 — PR metadata의 qa_required 선언 누락

첫 실제 오류는 [QA Preflight Job124442902691](https://github.com/planner77/masterGantt/actions/runs/41169048995/job/124442902691)의 `원본 base SHA의 QA Preflight 실행 (read-only)` Step에서 2026-10-31T04:34:03Z에 발생했다. 기본브랜치 검증기는 정확한 base SHA의 코드를 실행했다. 관측된 결정적 실패2개는 다음과 같고, 독립 근본원인은 선언 누락 **1개**다.

```text
FAIL / QA_REQUIRED: PR body: qa_required — qa_required: 정확히 한 개의 선언 필요
FAIL / PATH_POLICY: PR diff (rename 원본 포함), risk_level/qa_required/release 플래그 — 위험도/QA 선언 오류를 먼저 수정
```

PRIMARY_ISSUE/RISK_LEVEL/QA_METHOD/ISSUE_AC/DOCUMENTATION_SYNC는 PASS였다. `qa_required=true`는 Work Packet에 있었지만 **PR 본문 독립행 선언**이 없었다. HIGH/AGENT를 유지한 상태로 단 한 개의 `qa_required: true` 행을 추가해야 한다. **분류는 POLICY_CI/게시 준비 절차 누락**이며 새 Calendar 제품·서버·브라우저 오류를 입증한 결과가 아니다.

이전 게시 전 docs_gate/AC 매핑은 확인했지만 현재 base의 실제 `qa_preflight.check` 필수 metadata 선언까지 재현하지 않은 것이 준비 절차의 누락이다. 문서 구조 PASS를 Preflight 전체 PASS로 과대 사용한 경계를 교정한다. 검증기의 fail-closed 동작은 정상이며 validator/권한/CI/Required Gate를 수정하거나 AGENT를 다른 경로로 바꿔 통과시키지 않는다.

### 실제 Job·Step 전체 행렬

| Job ID·원본 | 표시 이름 | 결론 | 실제 실패 Step 또는 미실행 |
| --- | --- | --- | --- |
| [124442820397](https://github.com/planner77/masterGantt/actions/runs/41169048995/job/124442820397) | 변경 경로 판정 | PASS | 실제 완료; Required/업무 QA 권한과 별개 |
| [124442821093](https://github.com/planner77/masterGantt/actions/runs/41169048995/job/124442821093) | QA Final 신뢰 경계 확인 | PASS | 실제 완료; Required/업무 QA 권한과 별개 |
| [124442902691](https://github.com/planner77/masterGantt/actions/runs/41169048995/job/124442902691) | QA Preflight — 정책·문서 사전 검사 | FAIL | 원본 base SHA의 QA Preflight 실행 (read-only) |
| [124442903972](https://github.com/planner77/masterGantt/actions/runs/41169048995/job/124442903972) | Low E2E policy plan (trusted base) | SKIPPED | NOT RUN |
| [124442903998](https://github.com/planner77/masterGantt/actions/runs/41169048995/job/124442903998) | PR metadata가 기존 전체 CI 증거를 보존하는지 검증 | SKIPPED | NOT RUN |
| [124442974569](https://github.com/planner77/masterGantt/actions/runs/41169048995/job/124442974569) | PR 빠른 검사 판정 | FAIL | PR 필수 빠른 검사 결과 검증 |
| [124442974853](https://github.com/planner77/masterGantt/actions/runs/41169048995/job/124442974853) | ESLint | SKIPPED | NOT RUN |
| [124442975144](https://github.com/planner77/masterGantt/actions/runs/41169048995/job/124442975144) | Chromium E2E shard ${{ matrix.shard }}/8 | SKIPPED | NOT RUN |
| [124442975186](https://github.com/planner77/masterGantt/actions/runs/41169048995/job/124442975186) | Vitest 단위·통합 테스트 | SKIPPED | NOT RUN |
| [124442975271](https://github.com/planner77/masterGantt/actions/runs/41169048995/job/124442975271) | github.event_name == 'pull_request' && 'Main Docker smoke (PR 비대상)' || 'Docker smoke 구현' | SKIPPED | NOT RUN |
| [124442975292](https://github.com/planner77/masterGantt/actions/runs/41169048995/job/124442975292) | TypeScript 타입 검사 | SKIPPED | NOT RUN |
| [124442975397](https://github.com/planner77/masterGantt/actions/runs/41169048995/job/124442975397) | Next.js production build | SKIPPED | NOT RUN |
| [124442975590](https://github.com/planner77/masterGantt/actions/runs/41169048995/job/124442975590) | 정책·저장소 계약 검사 | SKIPPED | NOT RUN |
| [124443032078](https://github.com/planner77/masterGantt/actions/runs/41169048995/job/124443032078) | Build, static checks, and unit tests | FAIL | 병렬 quality 결과 집계 |
| [124443032090](https://github.com/planner77/masterGantt/actions/runs/41169048995/job/124443032090) | Docker build and runtime smoke test | FAIL | Docker smoke 결과 집계 |
| [124443032135](https://github.com/planner77/masterGantt/actions/runs/41169048995/job/124443032135) | Chromium end-to-end tests | FAIL | E2E shard 결과 집계 |
| [124443032606](https://github.com/planner77/masterGantt/actions/runs/41169048995/job/124443032606) | Chromium E2E shard ${{ matrix.shard }}/8 · PR | SKIPPED | NOT RUN |
| [124443032729](https://github.com/planner77/masterGantt/actions/runs/41169048995/job/124443032729) | PR Next.js production build | SKIPPED | NOT RUN |
| [124443032752](https://github.com/planner77/masterGantt/actions/runs/41169048995/job/124443032752) | Low E2E targeted execution | SKIPPED | NOT RUN |
| [124443033034](https://github.com/planner77/masterGantt/actions/runs/41169048995/job/124443033034) | Docker smoke 구현 | SKIPPED | NOT RUN |
| [124443047382](https://github.com/planner77/masterGantt/actions/runs/41169048995/job/124443047382) | 변경 영향 Shadow 계획 · advisory only (#770) | PASS | 실제 완료; Required/업무 QA 권한과 별개 |
| [124443048235](https://github.com/planner77/masterGantt/actions/runs/41169048995/job/124443048235) | QA Final — Automated | SKIPPED | NOT RUN |
| [124443048254](https://github.com/planner77/masterGantt/actions/runs/41169048995/job/124443048254) | Main 임시 commit 이미지 게시·검증·정리 | SKIPPED | NOT RUN |

- PR Fast Gate `124442974569`는 PREFLIGHT_RESULT=failure와 필수 구현Job skipped를 보고 FAIL했다. Required quality `124443032078`/E2E `124443032135`/Docker `124443032090`은 모두 **QA Preflight 미성공**을 보고 FAIL했다. 4개의 파생 실패를 독립 제품 결함4개로 세지 않는다.
- 정책 검사/typecheck/lint/Vitest/Next build와 PR E2E/Docker 구현은 전부 **NOT RUN**이다. matrix 확장 이전 placeholder가 SKIPPED라서 8Shard 테스트 성공·실패 건수를 추정할 수 없다.
- Trusted Job `124443120430` 원문 사유는 **원본 PR CI run 자체가 성공하지 않았습니다**다. `validator_sha=ce8ca4ec...`, independent_qa/manager_decision은 NOT TESTED. 이번 실패를 신뢰된 인간 Reviewer 부재 차단으로 잘못 분류하지 않는다. 다만 보호 경로 AGENT 최종 영수증 의무는 이후에도 유지된다.

### 원본 Artifact 무결성과 보존

아래4개 ZIP을 읽기 전용 다운로드하여 API digest와 직접 계산한 SHA256가 일치함을 확인했다. archive를 추출·실행하지 않고 크기가 제한된 JSON 멤버만 읽었다. signed 다운로드 URL·인증정보·원시 runtime 로그는 원장이나 Git에 저장하지 않는다.

| Artifact ID·이름 | ZIP bytes·SHA256 | 실제 내용·판정 |
| --- | --- | --- |
| 13029749285 · qa-preflight-41169048995-1 | 1318 · `351b231416c207a4fac3d7020047f87f27ed593eedd3c3db4eb57cdca6a3a8d2` | Preflight FAIL2/DEFERRED5; QA_REQUIRED 누락과 PATH_POLICY 파생 |
| 13029634287 · ci-pr-source-41169048995-1 | 419 · `fd8d37b79ae36ff97db8667698157bb71bba1004f4d78f3ae600a93bf88a46ca` | PR864/Run41169048995/attempt1 및 Head/base/test-merge 출처 일치 |
| 13029614618 · ci-impact-shadow-41169048995-1 | 326 · `d13e7e59caadf641423304db7bd39aeeaffe8705c6354f63b70629b22a54737d` | ADVISORY_NOT_REQUIRED_NOT_QA_NOT_RELEASE; UNSAFE_DIFF_PATH/UNKNOWN/FULL_REQUIRED. 참고 경로 성공을 검증 PASS로 사용하지 않음 |
| 13030730049 · qa-final-trusted-41169048995-41169147423-1 | 461 · `7d928c0221a89cf2cd3606b8ddda08f0592aaaa783c4757c9f751e7db502551e` | 자동 QA FAIL: 원본 PR CI run 자체가 성공하지 않았습니다; 독립 QA/Manager NOT TESTED |

Preflight JSON 멤버 SHA256는 `29daf39b0223a0fbd0146752687fdbbf04074a8d92929ac17de3dffad642bafb`, source JSON 멤버는 `34a48c103393d015600b4aeef5cdb4aa397909f8d9b8871932196e56fcfdf2cd`다. source artifact 자체는 PR 측 비신뢰 데이터이며 원본 API/commit 출처와 교차 확인한 범위만 사용한다.

### 원격 FAIL 재현과 metadata 보완 검증

Manager는 실제 연결된 PR/Issue/69개 변경파일 API snapshot과 현재 Work Packet을 사용하여 **현재 base와 동일한** `qa_preflight.check`를 로컬에서 재현했다. API를 기록된 snapshot으로 공급한 **로컬 결정적 정책 replay**이며 새로운 원격 CI/독립 QA/Owner 승인을 실행한 것이 아니다. 원래 body와 한 줄 추가 body를 각각 비교했다.

```sh
python3 /tmp/issue342-rework1-preflight-replay.py
```

```text
before FAIL deterministic_failures=2 [('QA_REQUIRED', 'qa_required: 정확히 한 개의 선언 필요'), ('PATH_POLICY', '위험도/QA 선언 오류를 먼저 수정')]
after PASS deterministic_failures=0 []
PASS: only qa_required:true changes; HIGH/AGENT and all existing deterministic checks retained; final CI/QA/Owner deferred
```

- 최초 최소 재현은 실제 저장 body에 `_unique_field(body, "qa_required", {"true", "false"})`를 실행해 같은 메시지/exit1을 관측한 것이다. 위 full replay가 전체 결정적 검사를 추가 확인했다. stdout `/tmp/issue342-rework1-preflight-replay.log`, 결과 `/tmp/issue342-rework1-preflight-replay.json`, 원본 snapshot `/tmp/issue342-rework1-preflight-snapshot.json`을 보존한다.
- 기존 Preflight 단위검사 **11PASS**(`/tmp/issue342-rework1-preflight-tests.log`)와 Final QA 단위검사 **37PASS**(`/tmp/issue342-rework1-final-qa-tests.log`)를 확인했다. 후자의 예상 음성 case `API 부재 → BLOCKED` 출력은 suite 실패가 아니며 `Ran 37 tests / OK`와 구분했다. 기존 테스트는 KEEP_UNIQUE, assertion/skip/timeout/retry 변경0이다.
- backend34+frontend12개 경로의 저장된 최종 source 지문을 모두 재대조해 일치를 확인했다. 이번 보완은 PR metadata와 원장/계획/검증 문서만 변경한다. 새 실제 제품 실패파일이 없으므로 이전11개 합집합·직접 Calendar/API/DB·간접 Project/헤더/Gantt·음성권한/경합 경계를 유지하고, source가 같은 한정 Local Fast Feedback 영수증을 재사용한다. 이 재사용은 새 Head의 원격 Required3 전체 실행을 면제하지 않는다.
- Protected 인간 QA_FINAL/Owner 영수증·최신Head/base Full8/Required3·Trusted QA는 계속 별도 필수 Gate다. 여기서 `qa_method=AGENT`, `risk_level=HIGH`, `qa_required=true`, version0.139.0, release_required=true/release_authorized=false를 유지한다.

### 원장 갱신 후 다음 Full CI 인계

같은 PR864/branch를 재사용한다. 문서 동기화·별도 사전 검토 후 변경 원장의 새 후보 commit을 만들되 아직 ref는 이동하지 않는다. 완성 PR 본문에 필수 한 줄과 정확한 새 Head를 **한 번** 반영한 다음 현재 Head를 lease로 지정한 **한 번의 비강제 ref 갱신**으로 새 synchronize Full CI를 시작한다. 이미 게시된 #3455 FAIL은 그대로 보존한다.

PR body edited 이벤트는 자동 metadata-only Run을 만들 수 있다. 이를 숨기거나 승인/성공으로 간주하지 않고 원래 Head의 metadata 사건으로 보존한다. 이어 새 Head가 게시되면 옛 Head 사건은 SUPERSEDED/N/A이며 새 Full CI의 PASS 증거가 아니다. Draft 왕복·기존 Run 무조건 rerun·gate 우회는 사용하지 않는다.

종료점은 **원장/문서/리뷰/충돌 확인 뒤 새 정확 Head Full PR CI 등록까지**다. 새 Run/Attempt는 등록 직후 운영 댓글에 연결하고 결과는 모니터링하지 않는다. 신규 Required3/Trusted/인간 QA_FINAL/Manager ACCEPT는 NOT TESTED이며 병합·Main/GHCR·Release·Issue 종료는 승인 범위 밖이다.

### REWORK1 로컬 검증·도구 한계와 독립 검토

- `npm run verify:prepr -- --mode=targeted --base=cf9458c15bceb2dddadc3a40903feeede39707e8 --issue=342 --pr=864 --risk=HIGH`를 실제 실행했다. 이 delta의 자동선정은READY/selected0/UNKNOWN0이며 명령이 없어 결과는 **NOT TESTED / exit1**이다. `.prepr-reports/2026-10-31T04-44-39.253Z-445246-f290704f/{SUMMARY.md,report.json}`, sourceStable=true/working fingerprint `1666ab1ab5b7b361e9c441614a8c924d7ab2ef718c51d2de150428a471087606`. 이 보고서를 LOCAL_VALIDATED/PASS로표시하지않는다. PR본문은Git diff 밖의입력이므로 별도실제snapshot replay와기존48개정책테스트가그경계를검증한다. 선택기/CI코드는변경하지않는다.
- 별도qa_docs가 실제API에서PR본문/Issue342 AC15/69파일을독립적으로읽고, 원격동일gitshow cf9458 Packet을사용해동일검증기를직접재생했다. BEFORE2FAIL/AFTER0deterministicFAIL·5개최종검증DEFERRED를확인했고기존11+37개도직접실행해48PASS(`/tmp/issue342-rework1-independent-qa-policy.log`)다. Manager48개와고유수에중복합산하지않는다.
- 독립재현준비의첫본문동일성guard는저장파일추가마지막newline1개때문에차이를보고했다. 최종newline만정규화한뒤API원본문직접재생을수행했으며선언·내용차이를숨기지않았다. 실제제품/정책실패가아닌재현입력준비관측으로구분한다. Manager의source지문검사준비에서도list/dict분기누락TypeError를고친뒤backend34/frontend12의모든hash일치를재확인했다.
- 링크검사391파일PASS(`/tmp/issue342-rework1-links.log`). 새docdelta를포함한문서/AC구조·버전·리뷰/충돌은게시직전에다시확인하며, 새Head의Required3/Trusted/인간QA_FINAL/Manager는NOT TESTED로남긴다.

- REWORK1 독립 `/root/qa_docs` PRE_QA **PASS**: 원격원본로그, 별도API snapshot의before2FAIL/after0deterministicFAIL, 기존48개실행, 현재46파일동일성, 4문서동기화/391링크를직접검토했다. 남은사전지적은없다. 두주체의동일suite48개를96개로합산하지않는다. 이는보호경로의인간QA_FINAL/Owner·새Head원격게이트PASS가아니다.

## 13. PR #864 Full #3457.1 — 신규 관리자 spec의 명시 샤드 등록 누락 (2026-10-31)

### 누적 이력과 원본 실행 재수집

조사 전에 이 원장1~12절과 [PR CI 실패 처리 지침](PR_CI_FAILURE_TRIAGE.md)을 전부 읽었다. 옛 PR346의54CI Run/36실패Job/109취소Job/11실패테스트파일과 REWORK1의 metadata 누락 이력을 그대로 유지한다. 이번에는 PR864 branch 전체조회 total_count=5/목록5와 모든 Run의 attempt1 Job을 다시 회수했다. **Full2개(#3455/#3457), metadata1개(#3456), 비권위 FAST2개(#235/#236)**이며 추가 attempt는 없다. 별도 default-branch workflow_run12개도 각 Job 목록을 조회했다.

- 신규 실패 Head `fb93818a7decea0bfc92d131381f663bb5f10bda`; base/validator `ce8ca4ec7f0eb2ba63d883b7c22786c5d033aa14`; test-merge `95edd95818930c3df9e1816332f8c87fc253aa86`.
- [Full #3457.1](https://github.com/planner77/masterGantt/actions/runs/41170081603), Run41170081603/attempt1, pull_request/synchronize, 생성2026-10-31T04:49:01Z, 전체23Job **SUCCESS7/FAIL5/SKIPPED11/CANCELLED0**. 이전 qa_required 선언 교정은 실제 원격 QA Preflight PASS로 확인됐다.
- 정제 전체 영수증 `/tmp/issue342-rework2-ci.json`, 실제 읽은6개 Artifact JSON·지문 `/tmp/issue342-rework2-artifacts.json`. Runtime DB·signed URL·인증정보·raw trace/log는 Git에 추가하지 않는다.

| PR864 실행 | Head·구분 | Job S/F/C/K | 결과·해석 |
| --- | --- | --- | --- |
| [#235.1 / 41169048982](https://github.com/planner77/masterGantt/actions/runs/41169048982) | `cf9458c15bceb2dddadc3a40903feeede39707e8` · FAST | 0/0/0/1 | SKIPPED; 참고용 미실행; Full PASS 아님 |
| [#3455.1 / 41169048995](https://github.com/planner77/masterGantt/actions/runs/41169048995) | `cf9458c15bceb2dddadc3a40903feeede39707e8` · FULL | 3/5/0/15 | FAILURE; REWORK1 필수선언 누락/Preflight 실패 보존 |
| [#3456.1 / 41170078618](https://github.com/planner77/masterGantt/actions/runs/41170078618) | `cf9458c15bceb2dddadc3a40903feeede39707e8` · METADATA | 5/1/0/17 | FAILURE; 옛 Head metadata SUPERSEDED/N/A; 전체Run FAIL 보존 |
| [#236.1 / 41170081587](https://github.com/planner77/masterGantt/actions/runs/41170081587) | `fb93818a7decea0bfc92d131381f663bb5f10bda` · FAST | 0/0/0/1 | SKIPPED; 참고용 미실행; Full PASS 아님 |
| [#3457.1 / 41170081603](https://github.com/planner77/masterGantt/actions/runs/41170081603) | `fb93818a7decea0bfc92d131381f663bb5f10bda` · FULL | 7/5/0/11 | FAILURE; Unit 실제1FAIL, Fast Gate/Required3 파생FAIL |

### #3456 metadata 사건과 Trusted 판정 분리

- [metadata #3456.1](https://github.com/planner77/masterGantt/actions/runs/41170078618)는 REWORK1에서 PR 본문을1회 고친 뒤 ref를1회 갱신하는 사이의 edited 사건이다. event Head cf9458c1과 current Head fb93818a가 다르다. QA Final 신뢰 경계 Job124445941278은 **최신 PR/head/base 귀속 검증 실패**로 BLOCKED했다.
- metadata evidence Job124446013565의 실제 출력은 **SUPERSEDED · event_sha=cf9458c15bceb2dddadc3a40903feeede39707e8 · current_sha=fb93818a7decea0bfc92d131381f663bb5f10bda · full_run=N/A · 이벤트 Head가 현재 PR Head와 달라 비권위/N/A 종료**다. Required aggregate3개 SUCCESS는 이 stale-event 종료의 표시이며 Full 테스트 성공이 아니다. 전체 #3456 Run은 FAIL로 보존한다.
- [Trusted #1102.1](https://github.com/planner77/masterGantt/actions/runs/41170130965)/Job124446099726은 **API pull_requests와 원본 artifact 불일치 → BLOCKED**다. 옛 source artifact의 Head cf9458c1과 갱신된 API PR 귀속을 억지로 같다고 만들지 않는다. 현재 Head의 Full 실패로 중복 계산하지 않는다.
- [Trusted #1103.1](https://github.com/planner77/masterGantt/actions/runs/41170302070)/Job124446618719은 **원본 PR CI run 자체가 성공하지 않았습니다 → FAIL**이다. #3457 Unit 실패의 파생이며 보호 인간 QA 영수증 검사 단계에 도달한 실패가 아니다. Independent QA/Manager는 NOT TESTED로 남는다.

| 후속 default-branch Run | workflow | Job S/F/C/K | 의미 |
| --- | --- | --- | --- |
| [#1042.1 / 41169144896](https://github.com/planner77/masterGantt/actions/runs/41169144896) | `.github/workflows/ci-setup-readiness.yml` | 0/0/0/1 | SKIPPED; 캐시 준비도 미실행 |
| [#296.1 / 41169144957](https://github.com/planner77/masterGantt/actions/runs/41169144957) | `.github/workflows/issue-752-diagnostics.yml` | 1/0/0/5 | SUCCESS; 비차단 진단 권고; 실제 E2E 진단 미실행 |
| [#1001.1 / 41169144927](https://github.com/planner77/masterGantt/actions/runs/41169144927) | `.github/workflows/pr-metadata-reconcile.yml` | 1/0/0/0 | SUCCESS; metadata 복구 Controller 결과; Full PASS 아님 |
| [#1101.1 / 41169147423](https://github.com/planner77/masterGantt/actions/runs/41169147423) | `.github/workflows/qa-final-trusted.yml` | 0/1/0/0 | FAILURE; 원본FAIL 또는 stale 출처 차단; 독립 QA/승인 아님 |
| [#1102.1 / 41170130965](https://github.com/planner77/masterGantt/actions/runs/41170130965) | `.github/workflows/qa-final-trusted.yml` | 0/1/0/0 | FAILURE; 원본FAIL 또는 stale 출처 차단; 독립 QA/승인 아님 |
| [#1043.1 / 41170131008](https://github.com/planner77/masterGantt/actions/runs/41170131008) | `.github/workflows/ci-setup-readiness.yml` | 0/0/0/1 | SKIPPED; 캐시 준비도 미실행 |
| [#297.1 / 41170130969](https://github.com/planner77/masterGantt/actions/runs/41170130969) | `.github/workflows/issue-752-diagnostics.yml` | 1/0/0/5 | SUCCESS; 비차단 진단 권고; 실제 E2E 진단 미실행 |
| [#1002.1 / 41170130963](https://github.com/planner77/masterGantt/actions/runs/41170130963) | `.github/workflows/pr-metadata-reconcile.yml` | 1/0/0/0 | SUCCESS; metadata 복구 Controller 결과; Full PASS 아님 |
| [#1044.1 / 41170302038](https://github.com/planner77/masterGantt/actions/runs/41170302038) | `.github/workflows/ci-setup-readiness.yml` | 0/0/0/1 | SKIPPED; 캐시 준비도 미실행 |
| [#298.1 / 41170302084](https://github.com/planner77/masterGantt/actions/runs/41170302084) | `.github/workflows/issue-752-diagnostics.yml` | 2/0/0/4 | SUCCESS; 비차단 진단 권고; 실제 E2E 진단 미실행 |
| [#1103.1 / 41170302070](https://github.com/planner77/masterGantt/actions/runs/41170302070) | `.github/workflows/qa-final-trusted.yml` | 0/1/0/0 | FAILURE; 원본FAIL 또는 stale 출처 차단; 독립 QA/승인 아님 |
| [#1003.1 / 41170302048](https://github.com/planner77/masterGantt/actions/runs/41170302048) | `.github/workflows/pr-metadata-reconcile.yml` | 1/0/0/0 | SUCCESS; metadata 복구 Controller 결과; Full PASS 아님 |

진단 #298.1은 출처확인과 비차단 권고 댓글2Job만 SUCCESS이고 실제 수동 진단/E2E/정제/필수검사 변경4Job은 SKIPPED다. 이 자동 권고를 actual E2E·QA·Owner 승인으로 사용하지 않는다. 모든 관련 Run의 취소Job은0이므로 숨은 취소Shard 내부 테스트 FAIL은 이번 이력에 없다.

### F342-016 — country-calendar-admin spec 명시 배치 누락

첫 실제 오류는 [Vitest Job124446062488](https://github.com/planner77/masterGantt/actions/runs/41170081603/job/124446062488)의 Run npm test Step, 2026-10-31T04:51:36Z이다.

```text
FAIL tests/scripts/e2e-shard-planner.test.ts:109
historical E2E shard planner > covers all current specs exactly once after #767 eight-shard escalation
AssertionError: expected [ …(142) ] to deeply equal [ …(143) ]
- "tests/e2e/country-calendar-admin.spec.ts"
Test Files 1 failed | 285 passed | 1 skipped (287)
Tests 1 failed | 3447 passed | 3 skipped (3451)
```

**분류 TEST_CONTRACT/명시 계획 등록 누락**: 신규6사례 관리자 E2E 파일은 존재하지만 기존 committed8-shard plan에 등록하지 않았다. 정확한 파일 집합/중복/샤드 수를 검사하는 기존 assertion이 의도대로 오류를 찾았다. source fallback으로누락을숨기거나exact-once assertion을삭제하지않는다. Calendar 제품 자체가새로실패했다는근거는없다.

| #3457 실제 Job | 결론 | 직접·파생 구분 |
| --- | --- | --- |
| [124445951199](https://github.com/planner77/masterGantt/actions/runs/41170081603/job/124445951199) · QA Final 신뢰 경계 확인 | SUCCESS | 실제 완료; 전체 CI/승인과 별개 |
| [124445951385](https://github.com/planner77/masterGantt/actions/runs/41170081603/job/124445951385) · 변경 경로 판정 | SUCCESS | 실제 완료; 전체 CI/승인과 별개 |
| [124446009186](https://github.com/planner77/masterGantt/actions/runs/41170081603/job/124446009186) · QA Preflight — 정책·문서 사전 검사 | SUCCESS | 실제 완료; 전체 CI/승인과 별개 |
| [124446010061](https://github.com/planner77/masterGantt/actions/runs/41170081603/job/124446010061) · PR metadata가 기존 전체 CI 증거를 보존하는지 검증 | SKIPPED | 실제 검증 NOT RUN |
| [124446010244](https://github.com/planner77/masterGantt/actions/runs/41170081603/job/124446010244) · Low E2E policy plan (trusted base) | SKIPPED | 실제 검증 NOT RUN |
| [124446062457](https://github.com/planner77/masterGantt/actions/runs/41170081603/job/124446062457) · TypeScript 타입 검사 | SUCCESS | 실제 완료; 전체 CI/승인과 별개 |
| [124446062459](https://github.com/planner77/masterGantt/actions/runs/41170081603/job/124446062459) · ESLint | SUCCESS | 실제 완료; 전체 CI/승인과 별개 |
| [124446062471](https://github.com/planner77/masterGantt/actions/runs/41170081603/job/124446062471) · 정책·저장소 계약 검사 | SUCCESS | 실제 완료; 전체 CI/승인과 별개 |
| [124446062488](https://github.com/planner77/masterGantt/actions/runs/41170081603/job/124446062488) · Vitest 단위·통합 테스트 | FAILURE | 직접 원인: 명시 계획142/실제143 불일치 |
| [124446063396](https://github.com/planner77/masterGantt/actions/runs/41170081603/job/124446063396) · github.event_name == 'pull_request' && 'Main Docker smoke (PR 비대상)' || 'Docker smoke 구현' | SKIPPED | 실제 검증 NOT RUN |
| [124446063429](https://github.com/planner77/masterGantt/actions/runs/41170081603/job/124446063429) · Chromium E2E shard ${{ matrix.shard }}/8 | SKIPPED | 실제 검증 NOT RUN |
| [124446063811](https://github.com/planner77/masterGantt/actions/runs/41170081603/job/124446063811) · Next.js production build | SKIPPED | 실제 검증 NOT RUN |
| [124446473564](https://github.com/planner77/masterGantt/actions/runs/41170081603/job/124446473564) · PR 빠른 검사 판정 | FAILURE | Unit실패 뒤 파생 차단 |
| [124446530998](https://github.com/planner77/masterGantt/actions/runs/41170081603/job/124446530998) · Chromium end-to-end tests | FAILURE | Unit실패 뒤 파생 차단 |
| [124446531006](https://github.com/planner77/masterGantt/actions/runs/41170081603/job/124446531006) · Docker build and runtime smoke test | FAILURE | Unit실패 뒤 파생 차단 |
| [124446531044](https://github.com/planner77/masterGantt/actions/runs/41170081603/job/124446531044) · Build, static checks, and unit tests | FAILURE | Unit실패 뒤 파생 차단 |
| [124446531437](https://github.com/planner77/masterGantt/actions/runs/41170081603/job/124446531437) · Chromium E2E shard ${{ matrix.shard }}/8 · PR | SKIPPED | 실제 검증 NOT RUN |
| [124446531619](https://github.com/planner77/masterGantt/actions/runs/41170081603/job/124446531619) · Low E2E targeted execution | SKIPPED | 실제 검증 NOT RUN |
| [124446531904](https://github.com/planner77/masterGantt/actions/runs/41170081603/job/124446531904) · Docker smoke 구현 | SKIPPED | 실제 검증 NOT RUN |
| [124446532037](https://github.com/planner77/masterGantt/actions/runs/41170081603/job/124446532037) · PR Next.js production build | SKIPPED | 실제 검증 NOT RUN |
| [124446551483](https://github.com/planner77/masterGantt/actions/runs/41170081603/job/124446551483) · 변경 영향 Shadow 계획 · advisory only (#770) | SUCCESS | 실제 완료; 전체 CI/승인과 별개 |
| [124446552715](https://github.com/planner77/masterGantt/actions/runs/41170081603/job/124446552715) · Main 임시 commit 이미지 게시·검증·정리 | SKIPPED | 실제 검증 NOT RUN |
| [124446552782](https://github.com/planner77/masterGantt/actions/runs/41170081603/job/124446552782) · QA Final — Automated | SKIPPED | 실제 검증 NOT RUN |

정책/typecheck/lint 및 Preflight는 PASS다. Unit 실패 뒤 PR Fast Gate124446473564와 quality124446531044/E2E124446530998/Docker124446531006 aggregate가 FAIL했다. 실제 PR production build/8Shard E2E/Docker smoke는 **NOT RUN**이다. Full E2E/Docker가 실행되어 제품 결함을 냈다고 해석하지 않는다.

누적 실패파일 합집합은 기존11개에 **tests/scripts/e2e-shard-planner.test.ts 1개**를 추가해12개다. 과거 E2E 실패파일8개는 그대로이고 새 application E2E 실패파일은 없다. 직접 plan/CLI selector/정적수집, 간접 PR/Main/Release 공용 plan·optimizer·trusted8-shard parser·release-reuse coverage, 음성 누락/중복/범위외샤드/권한·기존고유테스트 경계를 함께 검토했다.

### 명시 배치 결정과 불변 조건

Local RED를 먼저 실행해 실제 **5PASS/1FAIL**을 동일 spec에서 재현했다(`/tmp/issue342-rework2-planner-before.log`). 이후 Infra가 소유한2파일만 고쳤다.

- tests/config/e2e-shard-plan.json: country-calendar-admin.spec.ts를 **Shard1에1회** 추가했다. 기존142개 파일의 위치/순서·schemaVersion1·8샤드·generatedAt/sourceRunIds14/metrics/projectedMs와 기존 수동 배치 기록을 모두 보존했다.
- tests/scripts/e2e-shard-planner.test.ts: 파일 수 벡터만 **[18,18,18,18,17,18,17,18] → [19,18,18,18,17,18,17,18]**로 고치고 기존 destination 표에 country→1 단언을 추가했다. 기존 exact-once/duplicate/8샤드 단언은 유지했고 새 테스트 case는 만들지 않았다.
- Manager는 보존된 historical projectedMs 전체최소 **Shard1=1,265,283ms**를 선택했다(Shard3=1,265,366, Shard5=1,265,505). qa_docs의 파일개수 우선 대안 Shard5(17파일)도 검토했지만 이번은 전체 보존 historical 값 최소 기준을 택했다. 222ms 같은 미세 차이를 통계적 개선·실제 runner 시간·35분 이내 보장으로 주장하지 않는다.
- 신규 파일 비용은 **REMOTE_UNMEASURED**다. 기존 수치에 가짜 weight를 더하거나 과거 metrics를143개 최신 실측으로 바꾸지 않는다. plan의 issue342ExplicitPlacement에 실패 Run/Head·근거·범위·미검증을 기록한다.
- 실행 selector fallback/algorithm, workflow/events, PR/Main/Release8샤드, concurrency, workers1, timeout35분, PR fail-fast/Main 전체 수집, retry/skip/Required3/Trusted/보호 인간 QA·Owner/릴리스 권한은 변경하지 않는다.

### 보완 후 같은 후보 source 검증

동결2파일의 지문은 `/tmp/issue342-rework2-infra-manifest.json`에 보존했다. 모든 로컬 검증 후 다시 대조해 변동0을 확인했다.

| 파일 | bytes | SHA256 |
| --- | --- | --- |
| `tests/config/e2e-shard-plan.json` | 54508 | `5a9db6c0b7d35ca776c14f3283a43c63877d0b94b79d4e6b1b488856fa0fa528` |
| `tests/scripts/e2e-shard-planner.test.ts` | 6946 | `959662e5a2b004096e49133064611d0af994ba91265c71f4c6d0907fdbf00f98` |

| Local Fast Feedback | 실제 결과·범위 | 증거 |
| --- | --- | --- |
| 수정 전 planner 기존6case | 5PASS/1FAIL, 원격과 같은 신규spec누락 | /tmp/issue342-rework2-planner-before.log |
| 수정 후 planner/optimizer/config 기존3파일 | 26PASS/0FAIL | /tmp/issue342-rework2-planner-after.log |
| 공용 실제 selector CLI8회 | 현재143개 정확1회/중복0, country→1, 위count벡터, 기존142위치보존 | /tmp/issue342-rework2-selector-evidence.json |
| 실제 root/external cwd 수집 | 287Unit파일·867browsercase, Playwright143파일 동등 발견 PASS | /tmp/issue342-rework2-test-discovery.log |
| 전체 npm test 1회 | 286파일PASS/기존1파일SKIP; 3448PASS/기존3SKIP(총3451),30.19초,exit0 | /tmp/issue342-rework2-full-vitest.log |
| trusted8-shard 영향계획 Python | ci_impact_plan 27PASS | /tmp/issue342-rework2-impact-policy.log |
| 인접 release reuse coverage Python | 10PASS | /tmp/issue342-rework2-release-reuse-policy.log |
| Fast·Low 정책 Python | 11PASS+10PASS, 독립2suite | /tmp/issue342-rework2-fast-policy.log; /tmp/issue342-rework2-low-policy.log |
| 변경 TypeScript test lint·diff | PASS/exit0, 코드/guard완화 없음 | /tmp/issue342-rework2-infra-eslint.log |

선택26개는 전체Vitest3448개에 포함되므로3474개로 합산하지 않는다. Python58개는 별도 정책suite이며 원격 Required PASS를 대신하지 않는다. 전체 Unit 로그의 compare-ci-setup-metrics 중복 workload키 Error는 기존 음성 CLI case의 예상 출력이고 최종 suite exit0/3448PASS와 구분한다. 이번 실패가 실제 전체 Unit에서 발생했고 기존142개/신규plan의 소비자 회귀를 확인하기 위해 저비용 전체 Unit을1회 수행했다. plan등록만 바뀌어 원래 UI/서버 source는 동일하므로 전체 로컬 E2E/Docker를 반복하지 않는다. 이전 한정30개 UI·서버210개 영수증은 source 지문 동일성을 확인한 범위만 재사용하며 새 원격Head Gate는 다시 실행해야 한다.

수정후 주요 실제 명령:

```sh
npx vitest run --config tests/config/vitest.config.ts tests/scripts/e2e-shard-planner.test.ts tests/scripts/e2e-shard-optimizer-pr.test.ts tests/scripts/test-config-layout.test.ts
node scripts/verify-test-discovery.mjs
node scripts/e2e-shard-planner.mjs select --plan tests/config/e2e-shard-plan.json --shard <1..8> --total 8
npm test
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s tests/python -p test_ci_impact_plan.py
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s tests/python -p test_release_reuse_evidence.py
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s tests/python -p test_ci_fast_development.py
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s tests/python -p test_ci_low_policy.py
```

위 selector의 <1..8>은 실제로 정수1부터8까지 각8회 실행했다는 명령 표기다. shell에서 그대로 실행할 placeholder가 아니다.

### Artifact 무결성 및 다음 인계

새 Full과 metadata/Trusted의6개 ZIP을 읽기 전용 다운로드해 API digest와 직접SHA256 일치를 확인했다. 실행·무제한추출 없이 작은JSON만 읽었다.

| Artifact ID·이름 | ZIP bytes·SHA256 | 내용 |
| --- | --- | --- |
| 13030602700 · qa-preflight-41170081603-1 | 1245 · `7a788980ffbe9a960cade9b23e6b2eafce838a7068c39de4e22927158f1069a2` | Preflight 실제PASS/결정FAIL0/최종검증DEFERRED5. qa_required 교정 확인 |
| 13030447794 · ci-pr-source-41170081603-1 | 420 · `30e6023b6754c341ac5c54b738e412dd9545ee12344b17b1f5d3141bb4ca0db8` | Run3457/attempt1/PR864/Headfb93818a/basece8/testmerge95edd958 |
| 13031285186 · ci-impact-shadow-41170081603-1 | 326 · `c2475465d5f0379b535df5c45d53d9e75a5f21186776d2c1bd5156e1adfc00cf` | Shadow UNKNOWN/UNSAFE_DIFF_PATH/FULL_REQUIRED, 비권위참고 |
| 13030073187 · ci-pr-source-41170078618-1 | 419 · `c3cc211a890b36ee8ba7b6ad5146202c9b04e430d111eddb4665eee1c13691fd` | metadata3456 옛Headcf9458c1/testmerge978a89b2 출처 보존 |
| 13031006016 · qa-final-trusted-41170078618-41170130965-1 | 445 · `7e794a381848b1e5d956da00844cfaf0bde75d957635f03834ae8db96da821c8` | Trusted1102 BLOCKED: API pull_requests와 원본 artifact 불일치 |
| 13030771849 · qa-final-trusted-41170081603-41170302070-1 | 462 · `425387abdcd8de980af725c71be7b5499e40debb58766525b7876ed0370c8f56` | Trusted1103 FAIL: 원본 PR CI run 자체 미성공 |

이후 동일 branch/PR864에서 DOCUMENTATION_SYNC·별도사전검토·리뷰0/최신main 충돌 확인 후 **한 번의 commit/ref갱신으로 새 Full PR CI 시작**까지 진행한다. qa_required:true/HIGH/AGENT와 canonical Refs342는 이미 유효하므로 진행상태만을 위한 PR 본문 edited를 추가하지 않는다. #3455/#3456/#3457 및 Trusted의 기존 FAIL/BLOCKED를 덮거나 rerun으로 숨기지 않는다.

다음 정확 Head의 quality/e2e/docker·Full8 runtime·Trusted/보호 인간 QA_FINAL·Owner/Manager 승인은 **NOT TESTED**다. 새CI는 등록까지만 확인하고 결과를 모니터링하지 않는다. 병합·Main/GHCR·tag/release·Issue 종료는 범위 밖이며 version0.139.0/release_required=true/release_authorized=false를 유지한다.

### REWORK2 사전 도구의 BLOCKED와 수동 소비자 연결

- Manager의 새 실제 API PR/Issue snapshot·예정73변경경로·최신 Packet을 main과 동일한 qa_preflight.check로 replay한 결과는 **PASS/결정FAIL0/최종검증DEFERRED5**다. 실행 `/tmp/issue342-rework2-preflight.py`, stdout/result `/tmp/issue342-rework2-preflight.log`·`/tmp/issue342-rework2-preflight.json`에 보존한다. 원격 QA_FINAL/Required/Owner PASS가 아니다.
- Pre-PR dry-run `.prepr-reports/2026-10-31T05-00-24.264Z-490281-31d1160f`은 **NOT TESTED/BLOCKED, selected1/UNKNOWN1**이다. 실제 targeted `.prepr-reports/2026-10-31T05-00-43.753Z-491190-0b89984d`도 **BLOCKED/exit1**이며 tests/config/e2e-shard-plan.json 생산자의 자동 소비자 매핑이 UNKNOWN이다. LOCAL_VALIDATED/PASS로 보고하지 않는다.
- 이 미매핑에는 현재 planner/optimizer/config26개, 실제8CLI selector, root/external 수집, release coverage10/impact27 및 인접 Fast11/Low10, 전체Unit3448PASS의 수동 소비자 연결을 사용한다. Advisory 선택기를 바꾸거나 UNKNOWN을 성공으로 덮어 비용·QA gate를 낮추지 않는다. 기존48개 QA 정책 검사와 이번 인접58개 정책 suite의 역할을 구분하고 실제 실행한 범위만 기록한다.
- CI_CD/REMOTE_VALIDATION은 이번 공용 샤드 계획 변경의 required 문서이므로 초기 N/A를 그대로 재사용하지 않고 UPDATED로 갱신한다. 최종 문서/소스동결·독립 검토 영수증과 새 Run/Head는 Manager가 인계 후 추가한다.

### REWORK2 최종 동결·독립 검토

- Manager가backend34/frontend12와신규infra2파일의개별SHA256를모두재검사해일치를확인했다. 기존제품46경로지문은 `bdf3e91cf5a2672ee093fa78d667bedae09f2f997c9dfe45a74e374f4fb12b21`로동일하며, 48개검토경로의path+NUL+bytes 통합지문은 `53dcf8c8badada4c3eafc1e88259f8345a0949a850b5581e41ce6bcdffb5870f`다. infra2파일manifest SHA256는 `3eae929a6c662c231a018398c45e280d40b78f1994f4422976d78e554932a0f1`이다.
- Manager가 `npm run typecheck`를추가실행해exit0/PASS를확인했다(`/tmp/issue342-rework2-typecheck.log`). 최종391Markdown링크(`/tmp/issue342-rework2-links.log`), version0.139.0·CRLF-aware diff검사도PASS다. raw브라우저출력·기존artifact는추가게시하지않는다.
- 별도qa_docs의독립PRE_QA **PASS**: 원격Unit원문, 로컬RED5/6와수정2파일, 정확143/중복0/8CLI/기존142불변, history metadata deep-equality, 직접실행26Vitest·37Pythonconsumer 및누락/중복음성, 전체3448PASS/기존3SKIP로그와6문서정합성을대조했다. 중복테스트수를더하지않고자동prepr BLOCKED도그대로보존했다. 추가P1/P2사전지적은없다.
- 기존AC1~14의동일제품로컬증거와이번AC15 Unit보완을구별한다. 새Head의원격quality/e2e/docker·Full8/Trusted·보호된인간QA_FINAL/Manager ACCEPT는 **NOT TESTED**이며실제최종병합승인을만들지않는다. 게시직전미해결리뷰/충돌과main/Head를재조회하고이번8파일묶음Ref1회갱신으로새FullCI를등록한다. 새Head/Run/Attempt는운영댓글로연결하고결과를모니터링하지않는다.

최종게시직전Manager의원격재조회는Head `fb93818a7decea0bfc92d131381f663bb5f10bda` / base `ce8ca4ec7f0eb2ba63d883b7c22786c5d033aa14` 유지, PR864 Ready/open·mergeable=true·미해결thread0·qa_required:true 선언1개다. fetch한최신main도동일하다. 이번묶음은plan/test2개와문서6개이며그밖의tracked변경은없다. 최종본문은편집하지않고검증한같은branch를한번갱신하도록infra에인계한다.

## 14. PR #864 Full #3458.1 — 기준정보 인증 geometry 통합 회귀 (2026-10-31)

### 전체 누적 이력과 현재 출처

조사 전에 이 원장1~13절·현재 Work Packet·AGENTS·[공통 REWORK 지침](PR_CI_FAILURE_TRIAGE.md)을 전부 읽었다. 옛 PR346의54CI Run/36실패Job/109취소Job·11실패파일과 REWORK1 metadata누락/F342-015·REWORK2 명시계획누락/F342-016을 유지한다. 원본 옛 trace 만료 구간은 여전히 INCOMPLETE이며 재수집했다고 주장하지 않는다.

- 이번 branch API는 total_count=7/목록7로 Full3개(#3455/#3457/#3458), metadata1개(#3456), 참고용FAST3개(#235~237)다. 별도 default-branch workflow_run16개를 포함해 총23Run의 모든 Job을 다시 읽었고 전부 attempt1이다. per_page100보다 작고 목록 누락/추가 attempt는 없다.
- 구 branch도 이번에 다시 조회해 total_count=61/목록61·CI54개·attempt전부1·최신Run2086 동일을 확인했다. 원장에 없는 추가 옛 실행은 없으며 과거 trace 만료 제한은 유지한다.
- 현재 PR864 Ready/open, Head `ee3a0f1404c1748b18455ad6234b4d948ced0121`, main/base/validator `ce8ca4ec7f0eb2ba63d883b7c22786c5d033aa14`, test-merge `870d7d2e91287f88aefeb6153e5969a2c94157c3`. source artifact schema/repository/Run41171285334/attempt1/PR864/head/ref/base/test-merge와 API를 대조했고 commit→PR API도 유일한 PR864를 반환했다. 제목/Refs342/HIGH/AGENT/qa_required:true는 유효하다. 조사 시 mergeable=true이며 리뷰 thread0은 Manager의 최신 별도 조회를 따른다.
- [Full #3458.1](https://github.com/planner77/masterGantt/actions/runs/41171285334)은 2026-10-31T05:07:03Z 생성된 pull_request/synchronize이며 최종 FAIL이다. **전체30Job: SUCCESS13/FAIL2/CANCELLED7/SKIPPED8**다. 2FAIL 중 실제 구현 실패는 Shard1의1개이고 E2E aggregate1개는 파생이다.
- 정제 전체 보고서 `/tmp/issue342-rework3-ci.json`, 검증한 소형 Artifact `/tmp/issue342-rework3-artifacts.json`, 직접 실패 정제 로그 `/tmp/issue342-rework3-shard1-sanitized.log`를 보존한다. raw browser/runtime 로그·trace·signed URL/인증정보는 Git에 넣지 않는다.

| 현재 branch 및 후속 Run·attempt | workflow·Head | Job S/F/C/K | 실제 의미 |
| --- | --- | --- | --- |
| [#3458.1 / 41171285334](https://github.com/planner77/masterGantt/actions/runs/41171285334) | ci.yml · ee3a0f14 | 13/2/7/8 | FAIL; 인증 geometry1FAIL, quality/Docker PASS |
| [#237.1 / 41171285270](https://github.com/planner77/masterGantt/actions/runs/41171285270) | pr-fast-development.yml · ee3a0f14 | 0/0/0/1 | SKIPPED; Ready PR 참고 경로, Full 검증 아님 |
| [#236.1 / 41170081587](https://github.com/planner77/masterGantt/actions/runs/41170081587) | pr-fast-development.yml · fb93818a | 0/0/0/1 | SKIPPED; Ready PR 참고 경로, Full 검증 아님 |
| [#3457.1 / 41170081603](https://github.com/planner77/masterGantt/actions/runs/41170081603) | ci.yml · fb93818a | 7/5/0/11 | FAIL; 명시143/142 Unit, 중량 검사 NOT RUN |
| [#3456.1 / 41170078618](https://github.com/planner77/masterGantt/actions/runs/41170078618) | ci.yml · cf9458c1 | 5/1/0/17 | FAIL; stale metadata SUPERSEDED/N/A |
| [#235.1 / 41169048982](https://github.com/planner77/masterGantt/actions/runs/41169048982) | pr-fast-development.yml · cf9458c1 | 0/0/0/1 | SKIPPED; Ready PR 참고 경로, Full 검증 아님 |
| [#3455.1 / 41169048995](https://github.com/planner77/masterGantt/actions/runs/41169048995) | ci.yml · cf9458c1 | 3/5/0/15 | FAIL; qa_required 누락, 실제 제품 검사 NOT RUN |
| [#1045.1 / 41171744243](https://github.com/planner77/masterGantt/actions/runs/41171744243) | ci-setup-readiness.yml · ce8ca4ec | 0/0/0/1 | SKIPPED; 준비도 미실행 |
| [#1104.1 / 41171744255](https://github.com/planner77/masterGantt/actions/runs/41171744255) | qa-final-trusted.yml · ce8ca4ec | 0/1/0/0 | FAIL; 원본 CI 자체 미성공 |
| [#1004.1 / 41171744295](https://github.com/planner77/masterGantt/actions/runs/41171744295) | pr-metadata-reconcile.yml · ce8ca4ec | 1/0/0/0 | SUCCESS; 복구 Controller, 원본 Full PASS 아님 |
| [#299.1 / 41171744206](https://github.com/planner77/masterGantt/actions/runs/41171744206) | issue-752-diagnostics.yml · ce8ca4ec | 2/0/0/4 | SUCCESS; 비차단 권고, 실제 수동 E2E 진단 미실행 |
| [#1044.1 / 41170302038](https://github.com/planner77/masterGantt/actions/runs/41170302038) | ci-setup-readiness.yml · ce8ca4ec | 0/0/0/1 | SKIPPED; 준비도 미실행 |
| [#298.1 / 41170302084](https://github.com/planner77/masterGantt/actions/runs/41170302084) | issue-752-diagnostics.yml · ce8ca4ec | 2/0/0/4 | SUCCESS; 비차단 권고, 실제 수동 E2E 진단 미실행 |
| [#1103.1 / 41170302070](https://github.com/planner77/masterGantt/actions/runs/41170302070) | qa-final-trusted.yml · ce8ca4ec | 0/1/0/0 | FAIL; 원본 CI 자체 미성공 |
| [#1003.1 / 41170302048](https://github.com/planner77/masterGantt/actions/runs/41170302048) | pr-metadata-reconcile.yml · ce8ca4ec | 1/0/0/0 | SUCCESS; 복구 Controller, 원본 Full PASS 아님 |
| [#1102.1 / 41170130965](https://github.com/planner77/masterGantt/actions/runs/41170130965) | qa-final-trusted.yml · ce8ca4ec | 0/1/0/0 | BLOCKED; 원본 artifact/API 귀속 불일치 |
| [#1043.1 / 41170131008](https://github.com/planner77/masterGantt/actions/runs/41170131008) | ci-setup-readiness.yml · ce8ca4ec | 0/0/0/1 | SKIPPED; 준비도 미실행 |
| [#297.1 / 41170130969](https://github.com/planner77/masterGantt/actions/runs/41170130969) | issue-752-diagnostics.yml · ce8ca4ec | 1/0/0/5 | SUCCESS; 비차단 권고, 실제 수동 E2E 진단 미실행 |
| [#1002.1 / 41170130963](https://github.com/planner77/masterGantt/actions/runs/41170130963) | pr-metadata-reconcile.yml · ce8ca4ec | 1/0/0/0 | SUCCESS; 복구 Controller, 원본 Full PASS 아님 |
| [#1101.1 / 41169147423](https://github.com/planner77/masterGantt/actions/runs/41169147423) | qa-final-trusted.yml · ce8ca4ec | 0/1/0/0 | FAIL; 원본 CI 자체 미성공 |
| [#1042.1 / 41169144896](https://github.com/planner77/masterGantt/actions/runs/41169144896) | ci-setup-readiness.yml · ce8ca4ec | 0/0/0/1 | SKIPPED; 준비도 미실행 |
| [#296.1 / 41169144957](https://github.com/planner77/masterGantt/actions/runs/41169144957) | issue-752-diagnostics.yml · ce8ca4ec | 1/0/0/5 | SUCCESS; 비차단 권고, 실제 수동 E2E 진단 미실행 |
| [#1001.1 / 41169144927](https://github.com/planner77/masterGantt/actions/runs/41169144927) | pr-metadata-reconcile.yml · ce8ca4ec | 1/0/0/0 | SUCCESS; 복구 Controller, 원본 Full PASS 아님 |

### F342-017 — 기준정보 제목과 로그인 카드 사이에 추가된 링크

최초 직접 오류는 [Shard1 Job124450161450](https://github.com/planner77/masterGantt/actions/runs/41171285334/job/124450161450)의 E2E shard 실행 Step, 2026-10-31T05:11:06Z다.

```text
tests/e2e/admin-auth-layout.spec.ts:17:7
Issue #452: master authentication geometry and states
at tests/e2e/admin-auth-layout.spec.ts:68:56
expect(metrics.card.y - metrics.headingBottom).toBe(16)
Expected: 16
Received: 56
1 failed / 2 passed / 126 did not run (24.3s)
```

이는 cardPadding 자체가56px라는 뜻이 아니다. 앞의 cardPadding16px/cardGap12px 단언은 통과했고, 제목 블록 하단과 인증 카드 상단의 간격이40px 증가했다. 실제 실패 snapshot은 제목 다음에 국가 캘린더 관리 링크, 다음에 관리자 로그인 region이 놓인 순서를 보인다. resource/logistics 인증2사례는 PASS였고 master에서 최초 실패했다. **PRODUCT/통합 geometry 회귀**로 진단을 frontend에 배정하며 실제 RED·수정·동결 재검증은 후속 영수증으로 기록한다. 기준정보 탐색 진입 추가의 인증 화면 간접 소비자를 이전 한정 브라우저 검증에서 빠뜨린 범위 누락도 별도로 보완한다.

실제 Playwright report의 stats는 total129/expected2/unexpected1/flaky0/skipped126이다. 전역 errors의 `Testing stopped early after 1 maximum allowed failures.`는 기존 PR fail-fast 중단 통지이며 별도 제품 결함으로 중복 계산하지 않는다. country-calendar-admin은 계획에 포함됐지만 앞의 master 실패로 **NOT RUN**이며 이번 원격 country 전체 PASS를 주장하지 않는다.

### Full #3458 실제 Job 전체 행렬

| Job·표시 이름 | 결론 | 직접·파생/미실행 구분 |
| --- | --- | --- |
| [124449580873](https://github.com/planner77/masterGantt/actions/runs/41171285334/job/124449580873) · 변경 경로 판정 | SUCCESS | 실제 완료; 개별 역할 범위의 결과 |
| [124449581497](https://github.com/planner77/masterGantt/actions/runs/41171285334/job/124449581497) · QA Final 신뢰 경계 확인 | SUCCESS | 실제 완료; 개별 역할 범위의 결과 |
| [124449665778](https://github.com/planner77/masterGantt/actions/runs/41171285334/job/124449665778) · QA Preflight — 정책·문서 사전 검사 | SUCCESS | 실제 완료; 개별 역할 범위의 결과 |
| [124449667180](https://github.com/planner77/masterGantt/actions/runs/41171285334/job/124449667180) · PR metadata가 기존 전체 CI 증거를 보존하는지 검증 | SKIPPED | NOT RUN; 정당한 분기 skip도 실제 검증 PASS 아님 |
| [124449667298](https://github.com/planner77/masterGantt/actions/runs/41171285334/job/124449667298) · Low E2E policy plan (trusted base) | SKIPPED | NOT RUN; 정당한 분기 skip도 실제 검증 PASS 아님 |
| [124449735750](https://github.com/planner77/masterGantt/actions/runs/41171285334/job/124449735750) · Vitest 단위·통합 테스트 | SUCCESS | 실제 완료; 개별 역할 범위의 결과 |
| [124449735803](https://github.com/planner77/masterGantt/actions/runs/41171285334/job/124449735803) · TypeScript 타입 검사 | SUCCESS | 실제 완료; 개별 역할 범위의 결과 |
| [124449735804](https://github.com/planner77/masterGantt/actions/runs/41171285334/job/124449735804) · 정책·저장소 계약 검사 | SUCCESS | 실제 완료; 개별 역할 범위의 결과 |
| [124449735841](https://github.com/planner77/masterGantt/actions/runs/41171285334/job/124449735841) · ESLint | SUCCESS | 실제 완료; 개별 역할 범위의 결과 |
| [124449736819](https://github.com/planner77/masterGantt/actions/runs/41171285334/job/124449736819) · Chromium E2E shard ${{ matrix.shard }}/8 | SKIPPED | NOT RUN; 정당한 분기 skip도 실제 검증 PASS 아님 |
| [124449736855](https://github.com/planner77/masterGantt/actions/runs/41171285334/job/124449736855) · Next.js production build | SKIPPED | NOT RUN; 정당한 분기 skip도 실제 검증 PASS 아님 |
| [124449736877](https://github.com/planner77/masterGantt/actions/runs/41171285334/job/124449736877) · github.event_name == 'pull_request' && 'Main Docker smoke (PR 비대상)' \|\| 'Docker smoke 구현' | SKIPPED | NOT RUN; 정당한 분기 skip도 실제 검증 PASS 아님 |
| [124450103230](https://github.com/planner77/masterGantt/actions/runs/41171285334/job/124450103230) · PR 빠른 검사 판정 | SUCCESS | 실제 완료; 개별 역할 범위의 결과 |
| [124450161401](https://github.com/planner77/masterGantt/actions/runs/41171285334/job/124450161401) · Docker smoke 구현 | SUCCESS | 실제 완료; 개별 역할 범위의 결과 |
| [124450161424](https://github.com/planner77/masterGantt/actions/runs/41171285334/job/124450161424) · PR Next.js production build | SUCCESS | 실제 완료; 개별 역할 범위의 결과 |
| [124450161450](https://github.com/planner77/masterGantt/actions/runs/41171285334/job/124450161450) · Chromium E2E shard 1/8 · PR | FAILURE | 직접 FAIL: master 인증 geometry 기대16/실제56 |
| [124450161470](https://github.com/planner77/masterGantt/actions/runs/41171285334/job/124450161470) · Chromium E2E shard 7/8 · PR | CANCELLED | E2E 실행 중 취소; 내부 실제 FAIL 미관측, 전체 PASS 아님 |
| [124450161485](https://github.com/planner77/masterGantt/actions/runs/41171285334/job/124450161485) · Chromium E2E shard 2/8 · PR | CANCELLED | E2E 실행 중 취소; 내부 실제 FAIL 미관측, 전체 PASS 아님 |
| [124450161487](https://github.com/planner77/masterGantt/actions/runs/41171285334/job/124450161487) · Chromium E2E shard 6/8 · PR | CANCELLED | E2E 실행 중 취소; 내부 실제 FAIL 미관측, 전체 PASS 아님 |
| [124450161489](https://github.com/planner77/masterGantt/actions/runs/41171285334/job/124450161489) · Chromium E2E shard 3/8 · PR | CANCELLED | E2E 실행 중 취소; 내부 실제 FAIL 미관측, 전체 PASS 아님 |
| [124450161508](https://github.com/planner77/masterGantt/actions/runs/41171285334/job/124450161508) · Chromium E2E shard 8/8 · PR | CANCELLED | E2E 실행 중 취소; 내부 실제 FAIL 미관측, 전체 PASS 아님 |
| [124450161515](https://github.com/planner77/masterGantt/actions/runs/41171285334/job/124450161515) · Chromium E2E shard 4/8 · PR | CANCELLED | E2E 실행 중 취소; 내부 실제 FAIL 미관측, 전체 PASS 아님 |
| [124450161529](https://github.com/planner77/masterGantt/actions/runs/41171285334/job/124450161529) · Chromium E2E shard 5/8 · PR | CANCELLED | E2E 실행 중 취소; 내부 실제 FAIL 미관측, 전체 PASS 아님 |
| [124450162180](https://github.com/planner77/masterGantt/actions/runs/41171285334/job/124450162180) · Low E2E targeted execution | SKIPPED | NOT RUN; 정당한 분기 skip도 실제 검증 PASS 아님 |
| [124450525405](https://github.com/planner77/masterGantt/actions/runs/41171285334/job/124450525405) · Chromium end-to-end tests | FAILURE | 파생 FAIL: Shard1실패/나머지취소 집계 |
| [124450562959](https://github.com/planner77/masterGantt/actions/runs/41171285334/job/124450562959) · Build, static checks, and unit tests | SUCCESS | Required quality 실제 PASS |
| [124450898948](https://github.com/planner77/masterGantt/actions/runs/41171285334/job/124450898948) · Docker build and runtime smoke test | SUCCESS | Required Docker 실제 PASS |
| [124450913775](https://github.com/planner77/masterGantt/actions/runs/41171285334/job/124450913775) · 변경 영향 Shadow 계획 · advisory only (#770) | SUCCESS | 실제 완료; 개별 역할 범위의 결과 |
| [124450914642](https://github.com/planner77/masterGantt/actions/runs/41171285334/job/124450914642) · QA Final — Automated | SKIPPED | NOT RUN; 정당한 분기 skip도 실제 검증 PASS 아님 |
| [124450914846](https://github.com/planner77/masterGantt/actions/runs/41171285334/job/124450914846) · Main 임시 commit 이미지 게시·검증·정리 | SKIPPED | NOT RUN; 정당한 분기 skip도 실제 검증 PASS 아님 |

### 취소7Shard 내부 실제 실패 검사

7개 취소 Job의 원문 로그를 모두 읽었다. 아래 관측 PASS는 최종 suite PASS가 아니며 실행 중 취소/미완료/미실행을 성공0건으로 대체하지 않는다. ✘/실패 assertion/예외로 보고된 추가 실제 실패는0이다. 일부 정상 음성404 로그와 React key 경고를 실제 테스트 실패로 오분류하지 않는다.

| Shard·Job | 발견된 계획 case 수 | 관측 완료 PASS | 실제 FAIL 관측 | 최종 상태 |
| --- | --- | --- | --- | --- |
| Chromium E2E shard 2/8 · PR · 124450161485 | 102 | 0 | 0 | CANCELLED; 나머지 실행/완료 범위 INCOMPLETE |
| Chromium E2E shard 3/8 · PR · 124450161489 | 153 | 6 | 0 | CANCELLED; 나머지 실행/완료 범위 INCOMPLETE |
| Chromium E2E shard 4/8 · PR · 124450161515 | 93 | 1 | 0 | CANCELLED; 나머지 실행/완료 범위 INCOMPLETE |
| Chromium E2E shard 5/8 · PR · 124450161529 | 108 | 1 | 0 | CANCELLED; 나머지 실행/완료 범위 INCOMPLETE |
| Chromium E2E shard 6/8 · PR · 124450161487 | 100 | 6 | 0 | CANCELLED; 나머지 실행/완료 범위 INCOMPLETE |
| Chromium E2E shard 7/8 · PR · 124450161470 | 78 | 5 | 0 | CANCELLED; 나머지 실행/완료 범위 INCOMPLETE |
| Chromium E2E shard 8/8 · PR · 124450161508 | 104 | 1 | 0 | CANCELLED; 나머지 실행/완료 범위 INCOMPLETE |

총8Shard의 수집 예정 case는867개다. 이번 중단 Run 전체를867PASS나 실패1개 외 나머지PASS로 계산하지 않는다. Shard1의126NOT RUN과 취소Shard의진행중/미실행을 구분한다.

### 이전 보완과 Required/Trusted 분리

- F342-015의 qa_required 교정은 현재 Preflight Job124449665778 및 artifact에서 **PASS/결정FAIL0/최종DEFERRED5**로 다시 확인했다. HIGH/AGENT·보호 경로·독립 인간 QA/Owner 의무는 유지된다.
- F342-016의 누락 계획 교정은 Unit Job124449735750에서 **286파일PASS/기존1파일SKIP,3448PASS/기존3SKIP(총3451)**로 실제 확인됐다. 143개 명시 등록 assertion을 완화하지 않고 정상 통과했다. 이번 새 geometry실패와 이전 Unit 실패를 같은 원인으로 합치지 않는다.
- 정책/typecheck/lint/PR Fast Gate/Next build는 SUCCESS, Required quality124450562959와 Required Docker124450898948도 SUCCESS다. Docker 구현124450161401은 build 및 production HTTP/HTTPS Chromium2개·설정거부·Compose 관리자 인증/로그·재시작/재생성·SQLite volume영속성 검사를 실제 완료했다. PR read-only OCI build artifact가 있다는 사실은 GHCR 게시/main exact digest PASS가 아니다.
- [Trusted #1104.1](https://github.com/planner77/masterGantt/actions/runs/41171744255)/Job124450972558은 **FAIL: 원본 PR CI run 자체가 성공하지 않았습니다**다. validator는main ce8ca4ec이며 independent_qa/manager_decision은NOT TESTED다. 보호 인간 QA 영수증 검증단계에 도달하지 않았으므로 이번 직접 원인을 인간 승인 부재로 대체하지 않는다. 해당 최종 승인 의무는 이후에도 유지한다.

### Artifact 무결성·최초 실패 trace

| Artifact ID·이름 | ZIP bytes·SHA256 | 실제 확인 범위 |
| --- | --- | --- |
| 13030649031 · ci-pr-source.json | 419 · `761bf97a676992559e3e30b637cb0ddb42169a61d09d7659cf0b0d4622fc6e0d` | Run/attempt/PR/head/base/test-merge 대조 |
| 13031102911 · qa-preflight-report.json | 1288 · `5e13c9de2eb7c5ea5aa67d69aa266ef6699657606d06ec6a42bdb99e004f2c8f` | PASS/결정FAIL0/DEFERRED5 |
| 13031317578 · ci-impact-shadow.json | 326 · `e038fee5ac6d2a61546a0530b0481912c5e181ec781a1ad55bb16b2b15138dea` | UNKNOWN/FULL_REQUIRED, advisory |
| 13031342671 · qa-final-automated-report.json | 461 · `65b8c7ec4c0be1fc2abdf1543399fab13c190719c93a72566b4d7f4b7ca0f552` | 원본CI미성공 FAIL; 독립/Manager NOT TESTED |
| 13031038392 · e2e-timing-shard-1.json | 532 · `4973f59a7a45fdb2066a8115975ed2752f8db783d863f68eda52bf83806f50ff` | failed/앞2개 timing만; 전체143비용실측 아님 |
| 13031138479 · ci-image-build-contract.json | 1024 · `dce259787b76a4bb11224e5da3253efd7351749bc3f944fd29a2ba7096f43c0a` | test-merge source/tree/version0.139.0/OCI index 계약 |
| 13031382076 · playwright-report-shard-1 | 1518809 · `242e9895b7b32b05eeb0cf29e5b27666cdc33d4978328aafbd8444a23f131db7` | report 및 nested trace의 같은16/56실패 확인 |

모든 위 ZIP은 API digest와 직접SHA256가 일치한다. Playwright nested trace `data/43ffc04b9c749c8ac45ececac16984efb6418791.zip`은255076bytes이며 JSON trace/stack/snapshot을 읽었고 HTML/JS를 실행하거나 네트워크 요청/인증정보를 Git에 복사하지 않았다. 소형 artifact6개 외 전체 artifact18개의 ID/name/bytes/API digest도 정제JSON에 보존했다. 대형OCI117,060,921bytes는 재다운로드하지 않았고 API목록/build contract와 실제Docker Job결과 범위만 확인했다.

### 누적 실패 파일 합집합과 동결 검증 인계

기존12개에 tests/e2e/admin-auth-layout.spec.ts를 추가해 **13파일**이다. 전체 논리적 합집합을 자동 도구12파일 제한 때문에 축소하지 않는다.

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
- `tests/scripts/e2e-shard-planner.test.ts`
- `tests/e2e/admin-auth-layout.spec.ts`

직접 소비자는 기준정보 제목/진입링크/인증카드, 간접 소비자는 resource/logistics/master 공용 인증화면·모바일/PC geometry·공통 header4nav와 관리자 로그인/권한·국가Catalog 진입이다. 기존 과거8E2E와 Calendar/DB/명시planner 회귀를 유지하고, 새로운 제품 변경의 직접/간접/음성 소비자 범위를 frontend/Manager가 정한 뒤 같은동결source에서 검증한다. 기존 Calendar210Unit·브라우저고유30·명시계획/전체3448PASS를 새 geometry수정까지 무조건유효하다고 확대하지 않는다.

현재 frontend는 최초RED와제품/기존assertion보존수정을 담당한다. infra는 본절과원격증거만, Manager는Packet/TEST_PLAN/PLAN과최종통합/승인을 소유한다. 실제Local Fast Feedback·후보지문·독립사전검토영수증은 확정후아래에 추가한다. 초기원격수집시점의새후보검증은 **NOT TESTED**였으며 당시게시/본문편집/재실행은수행하지않았다. 이후실제결과는아래동결검증영수증으로구별한다. 리뷰/충돌·문서동기화·원장/검증후같은PR864에한번게시해새FullCI를등록할때도 Required3/Trusted/보호인간QA_FINAL/Owner승인은NOT TESTED다. CI결과모니터링·병합/Main/GHCR/tag/release/Issue종료는범위밖이다.

### REWORK3 실제 RED·제품 보완·동결 검증 영수증

frontend는 원격과 같은 기존 master 인증 case를 **수정 전 그대로 실행해 1FAIL**을 재현했다(`/tmp/issue342-rework3-frontend-red.log`, 기대16/실제56,390px). 기존 간격 계약은 유효하며 cardpadding오류·오래된assertion·환경flaky로 돌릴 근거가 없었다. 독립 링크row가 heading과 인증카드 사이에 들어가 gap16+row24+gap16=56이 된 **PRODUCT/페이지통합 회귀**로 확정했다.

- 제품: 국가 캘린더 진입링크를 기존 heading 내부 action영역으로 옮기고 route-local CSS module의 자연 줄바꿈·fine40px/coarse44px를 적용했다. 전역CSS/AdminAuth·4global메뉴·서버권한/API/DB/공식자료·8shard/Required/timeout/retry/skip/concurrency는 바꾸지 않았다.
- 기존테스트 확장: admin-auth-layout의 mastercase에 heading내링크/href·keyboard/focus·도움말비겹침·coarse44px를 추가했고 원래16px/인증실패·만료/중복제출·5폭 단언은 보존했다. country관리 기존openAdmin경로는 링크 keyboard Enter로 진입한다. 새고유case나테스트skip은 추가하지 않았다.
- 동결source4경로는 아래명시manifest에 포함된다. 새 CSS가 당시untracked였으므로 captureUi의 git-ls-files 기반 aggregate만으로 전체source결속을 주장하지 않는다. 직접manifest의개별bytes/hash가 GREEN 실행전후와최종대조에서동일했다.

| 동결 source | bytes | SHA256 |
| --- | --- | --- |
| src/app/project-master-admin/page.tsx | 1133 | `edabad1c6e99a00615ce7fdc10318e38a822527ef5145eae8cabebfa0d34f5c6` |
| src/app/project-master-admin/page.module.css | 316 | `1ead61b27b5ec3f599e530b9cf66ee497fb9ded5673dc9bd1214ae46301b4925` |
| tests/e2e/admin-auth-layout.spec.ts | 15055 | `7b4f859ea3f4965d0b568a75db6b7d8ad7b5d739f84763df753c91f567b8c8fc` |
| tests/e2e/country-calendar-admin.spec.ts | 30886 | `5a8f0c096d226ae8673cc7c3720481666499d0d2ef3513a450bedb71dc6d2910` |

manifest파일 `/tmp/issue342-rework3-frontend-manifest.json` SHA256는 `04f5154af44010c3d114873b25431fe4547f4e1b647924dbcee115fa7b9e7447`다. Manager의기존backend34/기존frontend12/infra2+새auth/CSS를포함한50경로 path+NUL+bytes 지문은 `8bed01fba9d00bdfe2773594d6291799ad01d7641a3e88428756e9d6815a41cb`(`/tmp/issue342-rework3-final-source-manifest.json`)다. 수정되지않은backend34·infra2개별hash는이전manifest와모두같다.

| Local Fast Feedback | 실제 결과·범위 | 증거 |
| --- | --- | --- |
| 수정전 master 기존case | 1FAIL; 원격과 같은16/56 | /tmp/issue342-rework3-frontend-red.log |
| 동결후 bounded 실제Chromium | **33PASS/0FAIL,5.1분**,12spec,workers1/retries0/max-failures0 | /tmp/issue342-rework3-frontend-green.log; selection.log |
| 최종 clean-config TypeScript·변경경로ESLint·diff | PASS/terminal30675 exit0 | /tmp/issue342-rework3-frontend-typecheck.log; frontend-eslint-final.log |
| Manager version·Markdown·diff | version0.139.0/391파일링크/CRLF-aware diff PASS | Manager 최종실행 영수증 |
| main Preflight 로컬예정후보재생 | 최종78경로 PASS/결정FAIL0/최종DEFERRED5 | /tmp/issue342-rework3-preflight-final.log |

33개는기존과거실패8E2E의bounded26+공통인증3(resource/logistics/master)+master입력밀도/분류CRUD2+관계1+legacy버튼간격1이다. 국가6개는26개안에포함되며 중복합산하지않는다. 기존13파일합집합 중옛서버3파일/새planner는소스가동일한기존서버210·전체Vitest3448/계획26로연결하고 이번새geometry까지전체Unit을다시실행했다고주장하지않는다. 33개실제Chromium사례에는국가관리happyflow의실제인증/HTTP/SQLite와공통인증·오류사례의route제어응답검증이함께포함된다. 인증3case의제어응답을실제서버권한검증으로확대하지않고각case의기존경계를유지한다. 별도기하probe는이33개밖의보조관찰이다. 전체로컬E2E/Docker는반복하지않았으며새Head Full8·Required3가여전히필수다.

### 보조 기하 증거의 환경·한계와 정제 파일

별도probe는합성session/catalog응답을intercept한읽기전용geometry관찰이며실제관리자로그인/DB mutation증거가아니다. 5폭390/768/1024/1440/1920px에서로그인전후 heading→content간격16px·H1위치보존·documentoverflow0·링크/도움말비겹침,390pxcoarse44px를확인했다. 390px는heading자연줄바꿈으로카드y223→231(+8px),768px이상은223→183(-40px)다. 모든폭의카드절대y/세로높이가감소했다고확대하지않는다. native125%/물리기기/스크린리더는NOT TESTED다.

| 게시하는 정제 증거 | bytes | 최종 SHA256 |
| --- | --- | --- |
| [390px 화면](evidence/issue342/rework3/master-auth-390.png) | 35792 | `c22c73f780db806049c8b174a09a1038c9cfe20e0341d91504e8fc87eaf0a511` |
| [1440px 화면](evidence/issue342/rework3/master-auth-1440.png) | 43323 | `564f0661a7268fdca3af920d6902433da0e75938fb0d1aa298727abcf53e76a3` |
| [기하 영수증](evidence/issue342/rework3/master-auth-geometry.json) | 14464 | `c6af9f0d0eff472462ddd28f5b0fbb87ebd216098e0a9d56701032fb4f9d134b` |

최초기하JSON지문f7b621757ebc35f19a0171c99f20f25846f7d818402ba70725aa86be87ff6d11은수동설명문구만한글로정합화하며위최종지문으로바뀌었다. 수치/키/브라우저원문/4source지문·PNG는동일하고geometry를재실행/새case로합산하지않는다. 원시trace/log/runtimeDB와전체자동생성화면은게시하지않는다. 생성된tracked Issue455/456출력30개는 `/tmp/issue342-rework3-generated-output`에보존후기준Head bytes로복원했고 next-env/tsconfig의dev생성차이도복원했다.

### 사전 도구의 미매핑·최종 인계 경계

- Pre-PR dry-run `.prepr-reports/2026-10-31T06-09-07.047Z-651557-f2153b26`은 **NOT TESTED/선정BLOCKED,selected2/UNKNOWN2**(pageTSX/newrouteCSS)이며실행명령0이다. 위실제33브라우저의직접·간접·음성수동매핑으로미매핑을보완했으며도구정책을바꿔녹색으로만들지않았다. 누적13파일이도구12파일제한을넘어도논리합집합을축소하지않는다.
- 처음74tracked경로의main Preflight재생PASS0/DEFERRED5는새untrackedCSS/증거가빠진중간후보검사였다(`/tmp/issue342-rework3-preflight.py/log/json`). 최종예정12파일(source4/docs5/evidence3)을stage한뒤 **전체예정PR78경로**로다시재생한위최종PASS를구별한다. 어느로컬재생도새Head원격출처인증/독립QA_FINAL·Owner승인이아니다.
- 독립문서검사준비에서 docs_gate harness의list인수를set으로교정한뒤구조PASS를확인했다. 도구호출TypeError준비관측이며제품/gate수정이나음성단언삭제가아니다.
- 조사원장1~13절의기존98490bytes는HEAD대비strict equality다. 원래지문 `6557d88ec1a5adb78b99ee2d32adb6c396f761ca7f93c76c65306d3b7bf65b04`를보존했다. 본14절의API표시명 `||`를표처리중 `//`로바꿨던P2는원문연산자와Markdownescape로바로잡았다.
- Manager의게시전최신PR재조회는Head ee3a0f14/basece8ca4ec/testmerge870d7d2e/Ready/open/mergeable=true/thread0/qa_required:true1개다. 독립PRE_QA최종판정·문서동결후원장소유권을Manager에게반환하며한번의GitData commit/ref게시를별도허가받는다. PR본문/제목상태편집·Draft왕복·이전FAILrerun은수행하지않는다. 새FullRun/attempt는등록까지만확인하고이후quality/E2E/Docker/Trusted/보호인간QA_FINAL/Manager는 **NOT TESTED**로남긴다.

실제최종33개명령(위실행영수증과동일):

```sh
npx playwright test --config tests/config/playwright.config.ts tests/e2e/admin-auth-layout.spec.ts tests/e2e/admin-legacy-button-spacing.spec.ts tests/e2e/master-controls-density.spec.ts tests/e2e/project-master-relations.spec.ts tests/e2e/country-calendar-admin.spec.ts tests/e2e/project-gantt-stability.spec.ts tests/e2e/project-grid-reorder-persistence.spec.ts tests/e2e/project-notifications.spec.ts tests/e2e/project-repeated-input-accessibility.spec.ts tests/e2e/project-status.spec.ts tests/e2e/task-editor-form-density.spec.ts tests/e2e/workspace-header-version.spec.ts --grep 'authentication geometry|empty project CTA|after 세 범주|category/filter 전환|관리자 관계 연결|SQLite 관리자|첫 조회 오류|412와 401|파일 UTF|412 후 canonical|날짜 편집 중 401|keeps the instance|첫 하위 작업|Grid DnD 확정|hit area|캘린더 반복|생성 기본값과 설정 변경|비기본 WBS fullscreen|공통 헤더' --project chromium --workers 1 --retries 0 --max-failures 0 --output output/playwright/issue342-rework3-green
```

frontend최종영수증 `/tmp/issue342-rework3-frontend-result.json` SHA256는 `340c1ad61fcf8f8a338a4b175bc329bb852858ca5a3289c23b704f06761925d6`다. RED/GREEN/static의실제명령·선정/지문·증거/복원경계를포함하며제품추가수정은없다.


REWORK3 별도 `/root/qa_docs`의최종독립 Agent **PRE_QA PASS**를확인했다. 원본직접FAIL·취소7로그·기존원장98490bytes보존,동결33PASS/정적검사·혼합실제/합성검증범위·5폭기하·source4/전체50지문·최종78경로DOCSYNC/AC/391링크를직접대조했고남은사전지적은없다. 이판정은보호인간QA_FINAL/새Head Required3·Trusted/Owner/Manager ACCEPT가아니다. 최신main ce8ca4ec와기준Head ee3a0f14는유지되고Ready/open·mergeable=true·미해결thread0이며canonical Refs342/qa_required:true1개다. 검토한12파일(source4/docs5/evidence3)을같은branch Ref1회갱신으로게시해새FullCI를등록한다. 새Head/Run/attempt는Issue/PR운영댓글에연결하고결과는모니터링하지않는다. MERGE_READY는BLOCKED다.

## 15. PR #864 Full #3459.1 — 국가관리 진입 링크 focus 검사 실패 (2026-10-31)

### 누적 원장 대조와 원격 출처

재개시 현재AGENTS·Work Packet·[REWORK 지침](PR_CI_FAILURE_TRIAGE.md)과원장1~14절의전체실패/보완을대조했다. 원장기존130091bytes/SHA256 `ef32fa5e9d275a46ae3a4309c239c6d6ea2654cdc3fedeb6d922f9d1c554065f`를불변prefix로보존한다. 옛PR346의54CI/36실패로그/109취소로그/trace만료제한과F342-015필수선언·F342-016명시계획·F342-017인증간격을삭제/소급PASS하지않는다.

- 최신branch API total_count=9/목록9: Full4개(#3455/#3457/#3458/#3459),metadata1개(#3456),참고FAST4개(#235~238)다. 별도default workflow_run20개와합쳐 **29Run의전체Job목록**을다시조회했고모두attempt1이다. 목록/attempt pagination누락은없다. 구branch도fresh조회61/61·CI54/attempt1로기존과동일하다.
- 현재PR864 Ready/open,Head `f95cdce9e70a5bd4bb416141dc78d9949b721b45`,main/base/validator `ce8ca4ec7f0eb2ba63d883b7c22786c5d033aa14`,test-merge `cf8fc71bed1f6604c333709044405d6e16342508`. sourceartifact/API의repository/schema/Run41176109491/attempt1/PR864/head/ref/base/test-merge를대조했고commit→PR도864단일귀속이다. canonical Refs342/HIGH/AGENT/qa_required:true유지·mergeable=true·unresolvedthread0·충돌0이다.
- [Full #3459.1](https://github.com/planner77/masterGantt/actions/runs/41176109491)은2026-10-31T06:19:16Z pull_request/synchronize이며원본FAIL이다. **30Job=SUCCESS13/FAIL2/CANCELLED7/SKIPPED8**. 직접실패는Shard1, E2Eaggregate는파생이며quality/Docker는실제SUCCESS다.
- 정제보고서 `/tmp/issue342-rework4-ci.json`,소형Artifact `/tmp/issue342-rework4-artifacts.json`,직접정제로그 `/tmp/issue342-rework4-shard1-sanitized.log`를보존한다. rawruntime/trace/DB·signed URL/인증정보는Git에추가하지않는다.

| 전체branch/후속Run·attempt | workflow·Head | Job S/F/C/K | 실제 의미 |
| --- | --- | --- | --- |
| [#238.1 / 41176109559](https://github.com/planner77/masterGantt/actions/runs/41176109559) | pr-fast-development.yml · f95cdce9 | 0/0/0/1 | SKIPPED; Ready 참고경로, Full 아님 |
| [#3459.1 / 41176109491](https://github.com/planner77/masterGantt/actions/runs/41176109491) | ci.yml · f95cdce9 | 13/2/7/8 | FAIL; 국가진입 focus검사 |
| [#3458.1 / 41171285334](https://github.com/planner77/masterGantt/actions/runs/41171285334) | ci.yml · ee3a0f14 | 13/2/7/8 | FAIL; master 인증간격회귀 |
| [#237.1 / 41171285270](https://github.com/planner77/masterGantt/actions/runs/41171285270) | pr-fast-development.yml · ee3a0f14 | 0/0/0/1 | SKIPPED; Ready 참고경로, Full 아님 |
| [#236.1 / 41170081587](https://github.com/planner77/masterGantt/actions/runs/41170081587) | pr-fast-development.yml · fb93818a | 0/0/0/1 | SKIPPED; Ready 참고경로, Full 아님 |
| [#3457.1 / 41170081603](https://github.com/planner77/masterGantt/actions/runs/41170081603) | ci.yml · fb93818a | 7/5/0/11 | FAIL; 명시계획누락 |
| [#3456.1 / 41170078618](https://github.com/planner77/masterGantt/actions/runs/41170078618) | ci.yml · cf9458c1 | 5/1/0/17 | FAIL; stale metadata SUPERSEDED/N/A |
| [#235.1 / 41169048982](https://github.com/planner77/masterGantt/actions/runs/41169048982) | pr-fast-development.yml · cf9458c1 | 0/0/0/1 | SKIPPED; Ready 참고경로, Full 아님 |
| [#3455.1 / 41169048995](https://github.com/planner77/masterGantt/actions/runs/41169048995) | ci.yml · cf9458c1 | 3/5/0/15 | FAIL; 필수선언누락 |
| [#1046.1 / 41176639915](https://github.com/planner77/masterGantt/actions/runs/41176639915) | ci-setup-readiness.yml · ce8ca4ec | 0/0/0/1 | SKIPPED; 준비도 미실행 |
| [#1005.1 / 41176639948](https://github.com/planner77/masterGantt/actions/runs/41176639948) | pr-metadata-reconcile.yml · ce8ca4ec | 1/0/0/0 | SUCCESS; 복구 Controller, Full PASS 아님 |
| [#1105.1 / 41176639889](https://github.com/planner77/masterGantt/actions/runs/41176639889) | qa-final-trusted.yml · ce8ca4ec | 0/1/0/0 | FAIL; 원본CI 미성공 |
| [#300.1 / 41176639895](https://github.com/planner77/masterGantt/actions/runs/41176639895) | issue-752-diagnostics.yml · ce8ca4ec | 2/0/0/4 | SUCCESS; 비차단 권고, 실제수동E2E 미실행 |
| [#1045.1 / 41171744243](https://github.com/planner77/masterGantt/actions/runs/41171744243) | ci-setup-readiness.yml · ce8ca4ec | 0/0/0/1 | SKIPPED; 준비도 미실행 |
| [#1104.1 / 41171744255](https://github.com/planner77/masterGantt/actions/runs/41171744255) | qa-final-trusted.yml · ce8ca4ec | 0/1/0/0 | FAIL; 원본CI 미성공 |
| [#1004.1 / 41171744295](https://github.com/planner77/masterGantt/actions/runs/41171744295) | pr-metadata-reconcile.yml · ce8ca4ec | 1/0/0/0 | SUCCESS; 복구 Controller, Full PASS 아님 |
| [#299.1 / 41171744206](https://github.com/planner77/masterGantt/actions/runs/41171744206) | issue-752-diagnostics.yml · ce8ca4ec | 2/0/0/4 | SUCCESS; 비차단 권고, 실제수동E2E 미실행 |
| [#1044.1 / 41170302038](https://github.com/planner77/masterGantt/actions/runs/41170302038) | ci-setup-readiness.yml · ce8ca4ec | 0/0/0/1 | SKIPPED; 준비도 미실행 |
| [#298.1 / 41170302084](https://github.com/planner77/masterGantt/actions/runs/41170302084) | issue-752-diagnostics.yml · ce8ca4ec | 2/0/0/4 | SUCCESS; 비차단 권고, 실제수동E2E 미실행 |
| [#1103.1 / 41170302070](https://github.com/planner77/masterGantt/actions/runs/41170302070) | qa-final-trusted.yml · ce8ca4ec | 0/1/0/0 | FAIL; 원본CI 미성공 |
| [#1003.1 / 41170302048](https://github.com/planner77/masterGantt/actions/runs/41170302048) | pr-metadata-reconcile.yml · ce8ca4ec | 1/0/0/0 | SUCCESS; 복구 Controller, Full PASS 아님 |
| [#1102.1 / 41170130965](https://github.com/planner77/masterGantt/actions/runs/41170130965) | qa-final-trusted.yml · ce8ca4ec | 0/1/0/0 | BLOCKED; artifact/API 귀속불일치 |
| [#1043.1 / 41170131008](https://github.com/planner77/masterGantt/actions/runs/41170131008) | ci-setup-readiness.yml · ce8ca4ec | 0/0/0/1 | SKIPPED; 준비도 미실행 |
| [#297.1 / 41170130969](https://github.com/planner77/masterGantt/actions/runs/41170130969) | issue-752-diagnostics.yml · ce8ca4ec | 1/0/0/5 | SUCCESS; 비차단 권고, 실제수동E2E 미실행 |
| [#1002.1 / 41170130963](https://github.com/planner77/masterGantt/actions/runs/41170130963) | pr-metadata-reconcile.yml · ce8ca4ec | 1/0/0/0 | SUCCESS; 복구 Controller, Full PASS 아님 |
| [#1101.1 / 41169147423](https://github.com/planner77/masterGantt/actions/runs/41169147423) | qa-final-trusted.yml · ce8ca4ec | 0/1/0/0 | FAIL; 원본CI 미성공 |
| [#1042.1 / 41169144896](https://github.com/planner77/masterGantt/actions/runs/41169144896) | ci-setup-readiness.yml · ce8ca4ec | 0/0/0/1 | SKIPPED; 준비도 미실행 |
| [#296.1 / 41169144957](https://github.com/planner77/masterGantt/actions/runs/41169144957) | issue-752-diagnostics.yml · ce8ca4ec | 1/0/0/5 | SUCCESS; 비차단 권고, 실제수동E2E 미실행 |
| [#1001.1 / 41169144927](https://github.com/planner77/masterGantt/actions/runs/41169144927) | pr-metadata-reconcile.yml · ce8ca4ec | 1/0/0/0 | SUCCESS; 복구 Controller, Full PASS 아님 |

### F342-018 — openAdmin의 새로운 focus→assert→Enter 경계

첫직접오류는 [Shard1 Job124464549374](https://github.com/planner77/masterGantt/actions/runs/41176109491/job/124464549374)의 E2E shard 실행Step,2026-10-31T06:24:14Z다.

```text
tests/e2e/country-calendar-admin.spec.ts:70:5
실제 SQLite 관리자 JSON/CSV 전체 교체·metadata·날짜 rename/delete와 Project Preview Save를 검증한다
openAdmin:24:44 / case77:3
await entry.focus(); await expect(entry).toBeFocused(); await entry.press("Enter");
Locator: getByRole('link', { name: '국가 캘린더 관리', exact: true })
Expected: focused
Received: inactive
Timeout: 5000ms; 14 × locator resolved; unexpected value inactive
1 failed / 3 passed / 125 did not run (54.9s)
```

REWORK3는openAdmin의기존click을keyboard focus/assert/Enter로바꿨다. 이번에는링크DOM은계속존재했지만focus단언이5초동안통과하지않았고Enter/국가관리화면진입이전실패했다. 실제JSON/CSV Apply·CRUD/Project Save가실행돼실패한것으로해석하지않는다. 과거F342-002 strictlocator나F342-010 국가전환draft실패와같은파일이어도실제원인경계는다르다.

**근본원인/분류는frontend 재현전 PENDING**이다. 초기화/hydration·포커스복구/DOM교체가능성은검토가설이며로그만으로제품/테스트/flaky를확정하지않는다. 원격trace의Focus호출후약59ms에toBeFocused를시작하고약5초후inactive로실패했다. timingreceipt는fixture/warmup각stage가ok,SQLerror0·beforeHooks18568ms/body7535ms로보고하며이성공이클라이언트상호작용준비완료를증명하지않는다.

report stats는total129/expected3/unexpected1/flaky0/skipped125이며globalerror `Testing stopped early after 1 maximum allowed failures.`는기존fail-fast중단통지다. 고유제품오류2건으로중복계산하지않는다. 보완은직접원인재현과음성/간접소비자대조후확정하고assert삭제·force/focus반복retry·timeout일괄확대로가리지않는다.

### 최신 Full30Job 전체 행렬

| Job·원본 표시 이름 | 결론 | 실제 역할·미실행 경계 |
| --- | --- | --- |
| [124463899635](https://github.com/planner77/masterGantt/actions/runs/41176109491/job/124463899635) · QA Final 신뢰 경계 확인 | SUCCESS | 실제 완료; 해당역할범위만PASS |
| [124463899831](https://github.com/planner77/masterGantt/actions/runs/41176109491/job/124463899831) · 변경 경로 판정 | SUCCESS | 실제 완료; 해당역할범위만PASS |
| [124463973765](https://github.com/planner77/masterGantt/actions/runs/41176109491/job/124463973765) · QA Preflight — 정책·문서 사전 검사 | SUCCESS | 실제 완료; 해당역할범위만PASS |
| [124463974518](https://github.com/planner77/masterGantt/actions/runs/41176109491/job/124463974518) · PR metadata가 기존 전체 CI 증거를 보존하는지 검증 | SKIPPED | NOT RUN; 검증PASS 아님 |
| [124463974954](https://github.com/planner77/masterGantt/actions/runs/41176109491/job/124463974954) · Low E2E policy plan (trusted base) | SKIPPED | NOT RUN; 검증PASS 아님 |
| [124464033266](https://github.com/planner77/masterGantt/actions/runs/41176109491/job/124464033266) · ESLint | SUCCESS | 실제 완료; 해당역할범위만PASS |
| [124464033313](https://github.com/planner77/masterGantt/actions/runs/41176109491/job/124464033313) · Vitest 단위·통합 테스트 | SUCCESS | 실제 완료; 해당역할범위만PASS |
| [124464033331](https://github.com/planner77/masterGantt/actions/runs/41176109491/job/124464033331) · TypeScript 타입 검사 | SUCCESS | 실제 완료; 해당역할범위만PASS |
| [124464033388](https://github.com/planner77/masterGantt/actions/runs/41176109491/job/124464033388) · 정책·저장소 계약 검사 | SUCCESS | 실제 완료; 해당역할범위만PASS |
| [124464034337](https://github.com/planner77/masterGantt/actions/runs/41176109491/job/124464034337) · Next.js production build | SKIPPED | NOT RUN; 검증PASS 아님 |
| [124464034354](https://github.com/planner77/masterGantt/actions/runs/41176109491/job/124464034354) · github.event_name == 'pull_request' && 'Main Docker smoke (PR 비대상)' \|\| 'Docker smoke 구현' | SKIPPED | NOT RUN; 검증PASS 아님 |
| [124464034479](https://github.com/planner77/masterGantt/actions/runs/41176109491/job/124464034479) · Chromium E2E shard ${{ matrix.shard }}/8 | SKIPPED | NOT RUN; 검증PASS 아님 |
| [124464478985](https://github.com/planner77/masterGantt/actions/runs/41176109491/job/124464478985) · PR 빠른 검사 판정 | SUCCESS | 실제 완료; 해당역할범위만PASS |
| [124464549297](https://github.com/planner77/masterGantt/actions/runs/41176109491/job/124464549297) · Docker smoke 구현 | SUCCESS | 실제 완료; 해당역할범위만PASS |
| [124464549309](https://github.com/planner77/masterGantt/actions/runs/41176109491/job/124464549309) · PR Next.js production build | SUCCESS | 실제 완료; 해당역할범위만PASS |
| [124464549354](https://github.com/planner77/masterGantt/actions/runs/41176109491/job/124464549354) · Chromium E2E shard 5/8 · PR | CANCELLED | E2E실행중취소/INCOMPLETE; 전체PASS 아님 |
| [124464549374](https://github.com/planner77/masterGantt/actions/runs/41176109491/job/124464549374) · Chromium E2E shard 1/8 · PR | FAILURE | 직접FAIL: entry focus검사 |
| [124464549408](https://github.com/planner77/masterGantt/actions/runs/41176109491/job/124464549408) · Chromium E2E shard 7/8 · PR | CANCELLED | E2E실행중취소/INCOMPLETE; 전체PASS 아님 |
| [124464549425](https://github.com/planner77/masterGantt/actions/runs/41176109491/job/124464549425) · Chromium E2E shard 8/8 · PR | CANCELLED | E2E실행중취소/INCOMPLETE; 전체PASS 아님 |
| [124464549435](https://github.com/planner77/masterGantt/actions/runs/41176109491/job/124464549435) · Chromium E2E shard 6/8 · PR | CANCELLED | E2E실행중취소/INCOMPLETE; 전체PASS 아님 |
| [124464549448](https://github.com/planner77/masterGantt/actions/runs/41176109491/job/124464549448) · Chromium E2E shard 2/8 · PR | CANCELLED | E2E실행중취소/INCOMPLETE; 전체PASS 아님 |
| [124464549464](https://github.com/planner77/masterGantt/actions/runs/41176109491/job/124464549464) · Chromium E2E shard 3/8 · PR | CANCELLED | E2E실행중취소/INCOMPLETE; 전체PASS 아님 |
| [124464549479](https://github.com/planner77/masterGantt/actions/runs/41176109491/job/124464549479) · Chromium E2E shard 4/8 · PR | CANCELLED | E2E실행중취소/INCOMPLETE; 전체PASS 아님 |
| [124464550143](https://github.com/planner77/masterGantt/actions/runs/41176109491/job/124464550143) · Low E2E targeted execution | SKIPPED | NOT RUN; 검증PASS 아님 |
| [124464823998](https://github.com/planner77/masterGantt/actions/runs/41176109491/job/124464823998) · Build, static checks, and unit tests | SUCCESS | 실제 완료; 해당역할범위만PASS |
| [124464997643](https://github.com/planner77/masterGantt/actions/runs/41176109491/job/124464997643) · Chromium end-to-end tests | FAILURE | 파생FAIL: Shard실패/취소집계 |
| [124465376255](https://github.com/planner77/masterGantt/actions/runs/41176109491/job/124465376255) · Docker build and runtime smoke test | SUCCESS | 실제 완료; 해당역할범위만PASS |
| [124465390332](https://github.com/planner77/masterGantt/actions/runs/41176109491/job/124465390332) · 변경 영향 Shadow 계획 · advisory only (#770) | SUCCESS | 실제 완료; 해당역할범위만PASS |
| [124465390939](https://github.com/planner77/masterGantt/actions/runs/41176109491/job/124465390939) · Main 임시 commit 이미지 게시·검증·정리 | SKIPPED | NOT RUN; 검증PASS 아님 |
| [124465391327](https://github.com/planner77/masterGantt/actions/runs/41176109491/job/124465391327) · QA Final — Automated | SKIPPED | NOT RUN; 검증PASS 아님 |

### 취소7Shard 내부 실제 오류·이전 보완의 교차 결과

| Shard·Job | 수집 예정case | 관측 완료PASS | 추가실제FAIL | 결론 |
| --- | --- | --- | --- | --- |
| Chromium E2E shard 2/8 · PR · 124464549448 | 102 | 1 | 0 | CANCELLED/INCOMPLETE; 미완료PASS 아님 |
| Chromium E2E shard 3/8 · PR · 124464549464 | 153 | 14 | 0 | CANCELLED/INCOMPLETE; 미완료PASS 아님 |
| Chromium E2E shard 4/8 · PR · 124464549479 | 93 | 1 | 0 | CANCELLED/INCOMPLETE; 미완료PASS 아님 |
| Chromium E2E shard 5/8 · PR · 124464549354 | 108 | 5 | 0 | CANCELLED/INCOMPLETE; 미완료PASS 아님 |
| Chromium E2E shard 6/8 · PR · 124464549435 | 100 | 16 | 0 | CANCELLED/INCOMPLETE; 미완료PASS 아님 |
| Chromium E2E shard 7/8 · PR · 124464549408 | 78 | 8 | 0 | CANCELLED/INCOMPLETE; 미완료PASS 아님 |
| Chromium E2E shard 8/8 · PR · 124464549425 | 104 | 2 | 0 | CANCELLED/INCOMPLETE; 미완료PASS 아님 |

취소7개원문로그를모두읽었고추가✘/실패assertion/테스트예외는없었다. 전체867개예정case를완료했다고추산하지않고Shard1의125NOT RUN과나머지진행중/미실행을구분한다. 취소Run에서완료된일부PASS가취소전체PASS를뜻하지않는다.

- **F342-017**: 이번Shard1의admin-auth-layout resource/logistics/master3개는원격실제PASS다. master의이전16/56간격문제는해당기존case에서재발하지않았다. REWORK3의로컬33PASS는그때한정증거로유지하되이번새focus실패를상쇄하지않는다.
- **F342-015/016**: QA Preflight124463973765는PASS/결정FAIL0/최종DEFERRED5다. Unit124464033313는286파일PASS/기존1파일SKIP·3448PASS/기존3SKIP(총3451)로명시143파일등록검사가실제통과했다.
- quality124464823998/Docker124465376255는SUCCESS이며Docker구현124464549297도실제build/production HTTP·HTTPS Chromium2개(12.4초)/Compose설정·인증/비밀정보비노출·재시작/재생성·SQLite volume영속성검사를완료했다. PR OCI는read-only build artifact이며GHCR/main exactdigestPASS가아니다.
- [Trusted #1105.1](https://github.com/planner77/masterGantt/actions/runs/41176639889)/Job124465453861은FAIL,사유 **원본 PR CI run 자체가 성공하지 않았습니다**다. independent_qa/manager_decision은NOT TESTED이며보호인간QA영수증단계에아직도달하지않았다. 이번직접원인을승인부재로대체하거나자체승인으로우회하지않는다.

### Artifact 무결성·trace 및 누적 실패 합집합

| Artifact ID·내용 | ZIP bytes·SHA256 | 확인 범위 |
| --- | --- | --- |
| 13033106639 · ci-pr-source.json | 420 · `b07f5061e4fe4ba6c534e961405039362cff39a2d0030b1cf4a7cce7fcd3f434` | 출처/API/commit→PR 단일귀속대조 |
| 13033305774 · qa-preflight-report.json | 1289 · `87ab7e39d839a75b705cad124c9bbc013bcb51d14f6fd3351bd917d585d1b38b` | PASS/0FAIL/5DEFERRED |
| 13033576979 · ci-impact-shadow.json | 326 · `a2931baa9bc8deec095a521c144818efee2da1cd94f8133bb24472d0ba6dfa57` | UNKNOWN/FULL_REQUIRED; advisory |
| 13033462155 · qa-final-automated-report.json | 462 · `793e76b926a38f8d7026b7fe3452ade1e461daeff4411a0f964c60d857b7d978` | 원본CI미성공FAIL/독립·Manager NOT TESTED |
| 13033117272 · e2e-timing-shard-1.json | 1249 · `1e49391ebdd5b32fdea06d96536d374769220a3b6f7ceff411ab2fb6c36e93ac` | 앞인증3PASS timing·실패fixture receipt; 전체성능실측아님 |
| 13033007678 · ci-image-build-contract.json | 1019 · `181e41b1b9d2cca619630aef345bc214591b623d053a6e668f28559c441bdf24` | source test-merge/tree/version0.139.0/PR OCI contract |
| 13032862651 · playwright-report-shard-1 | 1911772 · `bf6d23a615d61dec82040bb38a3de0a2eb8d33cf3a3ccd6498a4d1e608e4e421` | report/trace에서같은focus실패직접확인 |

위7개ZIP의API digest와직접SHA256가모두일치한다. nestedtrace `data/4305a7aa94df42c45f0c59a4189e6d1a04111a42.zip`은295150bytes이며JSON call/stack을읽었고실행하지않았다. 실패report archive는 `/tmp/issue342-rework4-artifact-13032862651.zip`이다. 전체Artifact18개목록/API digest도정제JSON에보존했다. 대형OCI117,059,005bytes는다시다운로드하지않았으며buildcontract/Job실행범위만증명한다.

새실패파일은기존country-calendar-admin.spec.ts이므로누적논리합집합은 **13파일 그대로**다. 아래전체범위를축소하지않고같은파일의서로다른case/setup경계를구분한다.

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
- `tests/scripts/e2e-shard-planner.test.ts`
- `tests/e2e/admin-auth-layout.spec.ts`

직접소비자는openAdmin의page.goto/링크focus/keyboard진입,간접은master초기session확인·Client hydration·auth autofocus/Next route복구와관리자공용인증3case·4globalnav·country6case이다. 기존과거8E2E·Calendar/DB/명시planner회귀를보존하고초기화지연/역순응답/권한음성에서테스트와제품계약을함께확인한다. frontend는실제RED/통제변형/보완/동결bounded회귀를,Manager는선정/문서/의미승인을담당한다. 현재추가후보검증은NOT TESTED이며세부명령/source지문/최종영수증을후속추가한다. 본문편집·ref/rerun/댓글·정책/gate변경은하지않았다.

### REWORK4 원본 비재현과 수정 전 통제 음성 실험

원본을바꾸지않은최초로컬case는 **1PASS/0FAIL**,case13.7초/총28.2초였다(`/tmp/issue342-rework4-frontend-red.log`). 파일명red가실패판정은아니며이를LOCAL RED나원본cold FAIL로기록하지않는다. 원격3459.1의실제focus FAIL은그대로유지하고로컬PASS가이를무효화하지않는다.

Manager는제품/테스트수정전에같은원본bytes로Next JavaScript응답16개만보류하는통제probe를실행했다. `/tmp/issue342-rework4-focus-probe.cjs`와json/log에수정전후지문·focus호출/event·DOM동일성을기록했다. 운영DB/권한/gate변경이나자동retry를하지않았다.

| 통제 관측 | 실제 결과 | 증명 범위 |
| --- | --- | --- |
| Next JS16응답보류후 SSR진입링크focus | A node1 focused/connected | 서버HTML링크가존재해도클라이언트초기화완료증거는아님 |
| JS해제후기존초기focus동작 | password INPUT node2 focus-call/focusin,link node1은같은DOM·connected유지 | 이통제조건에서초기passwordfocus가앞선링크focus를가져감 |
| 원래focused단언을그대로검사 | FAIL focused/inactive,5000ms·14locator resolutions | 원격과같은관측오류를통제된지연조건에서재현 |
| 초기passwordfocus확인→Shift+Tab도움말→Shift+Tab링크→nativeEnter | PASS·동일link node1·/country-calendar-admin진입 | 실제사용자초기화경계후keyboard동선은유효 |

따라서 **H1=TEST_CONTRACT/초기상호작용준비경쟁**은통제실험에서확인됐다. 원래helper는page.goto뒤SSR링크에focus를준즉시안정focus를요구했지만기존클라이언트password초기focus와순서를정하지않았다. **H2=link DOM교체**는동일node1/connected관측으로이통제실험에서는기각했다. 원격3459의정확한hydration시점/focus-call상대순서는당시계측이없어직접관측하지못했으며통제순서를원격확정타임라인으로바꾸지않는다.

통제전후source3경로 `project-master-admin.tsx`/`page.tsx`/`country-calendar-admin.spec.ts`의SHA256는모두같았다. 이실험은기존제품focus정책을변경하거나새고유회귀test를추가한것이아니다. 첫진단서버준비의health503/DATABASE_OPEN_FAILED는별도진단SQLite가준비되지않은환경오류였고격리DB에35migration을적용해복구했다. 제품수정/운영DB변경이나원격근본원인으로오분류하지않는다.

보완소유권은frontend의 **기존country-calendar-admin.spec.ts helper1경로**다. 기존초기passwordfocus를상호작용준비경계로확인한뒤도움말/링크로native keyboard이동하며focused/href/nativeEnter·4nav·국가관리/실제SQLite·권한assert를보존한다. 제품/CI/gate/source정책을바꾸지않고assert삭제·focus반복retry·임의sleep/timeout확대로초기화순서를감추지않는다. 수정후동결33사례/정적검사·정제probeJSON의최종지문은아직PENDING이며위원본PASS·통제음성FAIL/후속keyboardPASS와별도기록한다.


### REWORK4 수정 후보·동일 조건 비교·실제 검증

수정은 `tests/e2e/country-calendar-admin.spec.ts`의기존openAdmin helper1곳이다. 실제기존UX의초기password focus를먼저기다리고native Shift+Tab으로help·링크focus를각각확인한뒤기존focused/Enter·URL·global메뉴4검사를수행한다. href단언도명시했다. 반복focus/고정sleep/force·assertion삭제·retry/timeout/skip추가·제품hook은없고페이지/CSS/서버·권한/API/DB/CI/버전은바꾸지않았다. 직접호출자는첫실제SQLite happycase1개이며국가나머지5개는별도직접진입의인접회귀다.

- 원본일반로컬은1PASS(사례13.7초/전체28.2초)로원격실패를비재현했다. 파일이름frontend-red.log를FAIL판정으로해석하지않는다.
- 수정전원본제어는Next JS응답16개보류→SSR링크focus→해제후password focus를직접관측했고같은링크node가연결된채기존focused단언이inactive로실패했다. 원격의14회locator정상해석은node identity증거가아니며원격정확초점순서는미관측이다.
- 첫후보probe는baseURL누락의relativegoto 오류/locator wait30초와페이지로드비교조건불충분으로INCONCLUSIVE였다. `/tmp/issue342-rework4-candidate-probe-initial.{cjs,log}`에보존했고제품FAIL·후보검증PASS로계산하지않는다.
- 같은조건비교에서는probe에만양쪽goto(commit)wrapper를적용했다. 실제수정helper본문을추출/TypeScript변환해실행하고원래expect와5초기본단언을그대로전달한다. JS해제전에실제password focused guard에도달했다는관측으로단순goto대기와구별했다. 해제후초기password focus→nativehelp→동일링크→Enter→국가controls의실제helper전체가PASS다. 실제33브라우저는기존goto(load)를유지한다.
- help의tabIndex=-1 통제변형은양성help focused단언에서FAIL하여검증생존을확인했다. 의도한음성FAIL이며제품추가결함이나새고유사례가아니다. probe의country GET은합성응답이고실제SQLite/서버권한증거는별도normal실행이다.

[정제 제어 영수증](evidence/issue342/rework4/focus-readiness.json)은16192bytes/SHA256 `6cb80b92dd7149e833725ebea820f30d6dead8377a9a119f670d6de40383ae70`다. 원격/원본비재현/제어음성/수정실제helper/음성guard와준비오류·미확인을분리했고raw trace·URL·cookie·DB는게시하지않는다.

| 동결 검증 | 실제 결과와 출처 | 경계 |
| --- | --- | --- |
| 수정test1파일 | SHA256 `cb5b66721985634f06b8ae59d2332462882fb2f7ffb231128141b296c65b613e`; manifest파일 SHA256 `c7e0fb721e86fc8b53fdf2b8a6d2fdbd37084188946d696ca7417ccb333524ef` | 변경은helper1곳 |
| 50검토경로 | path+NUL+bytes SHA256 `f7d904d737d4e0fb1548790c9b802859d506f33ab7890178e5078f510a15b867` | 이전후보대비country test1개만변경,나머지49개hash동일 |
| 실제bounded33 | 33PASS/0FAIL,5.3분,12spec,terminal9487 exit0; /tmp/issue342-rework4-frontend-green.log | 기본goto(load),workers1/retries0/max-failures0; 직접happycase18.7초PASS |
| clean-config 정적검사 | terminal98376 exit0/PASS: typecheck·변경ESLint·diff | dev생성config복원뒤실행 |

33개는이전8실패E2E의bounded26+auth3+master인접4로같은목록이며국가직접1·인접5는26안에포함된다. 실제Chromium에는실제인증/HTTP/SQLite happyflow와route제어합성오류사례가혼합돼있고probe는추가관찰이다. 누적13파일합집합을유지하며변경없는서버/샤드소비자는기존지문에묶인서버210·전체Unit3448/plan26의한정로컬증거를재사용한다. 이번전체Unit/전체로컬E2E/Docker재실행을주장하지않으며새Head Full8/Required3는별도필수다.

### REWORK4 실제 Pre-PR 도구의 보호 차단

`npm run verify:prepr -- --mode=targeted --base=f95cdce9e70a5bd4bb416141dc78d9949b721b45 --issue=342 --pr=864 --risk=HIGH`를한번실행했다. `.prepr-reports/2026-10-31T08-49-14.473Z-1047079-01c32259/{SUMMARY.md,report.json}`은 **BLOCKED/exit1**,선정READY1/UNKNOWN0/missing0이나step0/NOT TESTED다. 기존 `.data/playwright.sqlite3`·wal/shm·`.next-e2e`·`test-results`·`playwright-report`가있어안전보호가차단했다. 기존산출물삭제/비소유서버종료/선정기·보호gate변경/두번째실행은하지않았다.

당시481working경로는임시진단dist/raw파일을포함해최종예정PR79경로와다르다. sourceStable=true는이실제시도중의경계이고이후본인소유새진단dist/DB만/tmp로이동한정리·최종문서반영과구별한다. 실제33/정적PASS로도구BLOCKED를소급PASS/LOCAL_VALIDATED로바꾸지않는다. 별도qa_docs의초기trace frame준비KeyError는실제file키로교정한열람준비관측이며제품/gate결함이아니다. 원장1~14절130091bytes는그대로보존한다.


REWORK4 frontend 최종영수증 `/tmp/issue342-rework4-frontend-result.json` SHA256는 `0298b885e81348d066154b60b8784ae8a6e8c6b2651e78a2d9707ebe77dac4b3`다. 실제33명령·원본비재현/제어양음성·1파일동결·정적/자동도구차단·원본보존정리를포함한다. Pre-PR 시도중 fingerprint는 `d65bdd0cb605e8b5f02e5e607220b2f6b05fdaf1d1e173aacbf42ac39478ac3b`로시작/끝동일하며해당경계만인정한다. 생성tracked출력30개는 `/tmp/issue342-rework4-generated-output`에보존후f95기준bytes로복원했고dev생성next-env/tsconfig도복원했다. 기존차단자원은유지하고이번새소유진단dist/DB만 `/tmp/issue342-rework4-diagnosis-runtime`으로이동보존했다. 최종제품/테스트/증거는변하지않았다.

실제동결33개명령:

```sh
npx playwright test --config tests/config/playwright.config.ts tests/e2e/admin-auth-layout.spec.ts tests/e2e/admin-legacy-button-spacing.spec.ts tests/e2e/master-controls-density.spec.ts tests/e2e/project-master-relations.spec.ts tests/e2e/country-calendar-admin.spec.ts tests/e2e/project-gantt-stability.spec.ts tests/e2e/project-grid-reorder-persistence.spec.ts tests/e2e/project-notifications.spec.ts tests/e2e/project-repeated-input-accessibility.spec.ts tests/e2e/project-status.spec.ts tests/e2e/task-editor-form-density.spec.ts tests/e2e/workspace-header-version.spec.ts --grep 'authentication geometry|empty project CTA|after 세 범주|category/filter 전환|관리자 관계 연결|SQLite 관리자|첫 조회 오류|412와 401|파일 UTF|412 후 canonical|날짜 편집 중 401|keeps the instance|첫 하위 작업|Grid DnD 확정|hit area|캘린더 반복|생성 기본값과 설정 변경|비기본 WBS fullscreen|공통 헤더' --project chromium --workers 1 --retries 0 --max-failures 0 --output output/playwright/issue342-rework4-green
```

최종정적명령:

```sh
npx tsc --noEmit --pretty false
npx eslint tests/e2e/country-calendar-admin.spec.ts
git -c core.whitespace=cr-at-eol diff --check
```


최종예정6파일(test1/docs4/evidence1)을stage하고신규정제JSON을포함한전체예정PR **79경로**로main과동일한 Preflight를로컬재생했다. 결과는 **PASS/결정FAIL0/최종DEFERRED5**(`/tmp/issue342-rework4-preflight-final.log`)다. 실제원격source/Required/QA_FINAL·Owner승인이아니며별도도구의BLOCKED도유지한다. version0.139.0/391Markdown링크/CRLF-aware diff도PASS다. 최신main `ce8ca4ec7f0eb2ba63d883b7c22786c5d033aa14`,Head `f95cdce9e70a5bd4bb416141dc78d9949b721b45`,testmerge `cf8fc71bed1f6604c333709044405d6e16342508` 유지와Ready/open·mergeable=true·미해결thread0·본문동일을최신API/fetch로확인했다. 별도최종PRE_QA후한번의commit/ref갱신으로같은PR의새FullCI등록까지만진행한다. 새Required3/Full8·Trusted·보호인간QA_FINAL·Manager ACCEPT는NOT TESTED이며MERGE_READY=BLOCKED다.


REWORK4 별도 `/root/qa_docs` 독립 Agent **PRE_QA 최종PASS**를확인했다. 실제원격/7취소·원본비재현/통제양음성·실제동결33/정적·미변경49경로·정제영수증과최종79경로DOCSYNC/AC/391링크를직접대조했고추가사전지적은없다. actual Pre-PR BLOCKED와원격정확focus이벤트미관측은유지한다. 이판정은보호인간QA_FINAL·새Head Required3/Trusted·Owner/Manager ACCEPT가아니다. 검토한6파일(test1/docs4/evidence1)을같은PR864에단일commit/ref로게시해새FullCI등록까지만확인한다. 새Head/Run/Attempt는운영댓글에연결하고결과는모니터링하지않는다. MERGE_READY는BLOCKED다.
