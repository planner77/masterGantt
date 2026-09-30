# 국가 Calendar 데이터 운영 가이드

Issue #342의 국가 Calendar Catalog 운영 계약이다. 대상 국가는 KR/CN/VN/PH/TH/MX/US이고 관리 연도는 2026~2037이다.

## 1. 운영 원칙

- 런타임 Scheduling은 외부 휴일 API를 호출하지 않는다. 공식 자료는 운영자가 사전에 확인·변환하여 built-in fixture 또는 DB Catalog에 등록한다.
- 연도별 상태는 OFFICIAL, UNAVAILABLE, SUPERSEDED다. Scheduling은 OFFICIAL dataset만 사용한다.
- 정부가 아직 발표하지 않은 미래 일정을 관습, 전년도 일정, 계산식만으로 공식값처럼 생성하지 않는다.
- DB override가 존재하면 built-in fixture보다 우선한다. UNAVAILABLE 또는 SUPERSEDED override는 해당 연도를 Scheduling에서 제외한다.
- Catalog 변경은 기존 Project의 materialized work_calendar_dates와 Task 일정을 자동으로 변경하지 않는다. 사용자가 Project Calendar를 Preview/저장할 때 최신 OFFICIAL dataset을 다시 materialize한다.
- WORKING은 중국의 调休上班, 베트남의 교환근무처럼 원래 주말이지만 공식적으로 근무하는 날짜에 사용한다. 단순히 “휴일에 근무할 수 있음”이라는 일반 규정은 WORKING으로 등록하지 않는다.

## 2. Source와 확보 방법

| 국가 | 1차 공식/공공 Source | 형식 / 일반적인 갱신 | NON_WORKING / WORKING 판단 |
| --- | --- | --- | --- |
| KR | 공공데이터포털 한국천문연구원 특일 정보: https://www.data.go.kr/data/15012690/openapi.do, 국가법령정보센터: https://www.law.go.kr/LSW/lsInfoP.do?ancYnChk=0&lsId=014112 | REST/XML + 법령. 연도별 특일 API를 조회하고 선거일·임시공휴일 등 후속 공고를 재검증한다. | isHoliday=Y와 적용 법령/공고를 NON_WORKING 후보로 삼는다. 법령상 대체공휴일을 포함한다. 일반적인 주말 근무일 교환은 국가 단위 WORKING으로 추정하지 않는다. |
| CN | 중국 국무원 연간 节假日安排: https://www.gov.cn/zhengce/zhengceku/202511/content_7047091.htm | HTML/국무원 공고. 다음 연도 공식 일정 공고 뒤 등록한다. | 放假/调休 날짜를 NON_WORKING, 공고에 명시된 上班 토·일을 WORKING으로 함께 기록한다. |
| VN | 베트남 정부 정책 포털: https://xaydungchinhsach.chinhphu.vn/ | HTML/정부·관계부처 공고. Tet/Quốc khánh 교환휴무·보충근무 공고를 함께 확인한다. | 공식 휴무/교환휴무를 NON_WORKING, 명시적인 làm bù를 WORKING으로 기록한다. |
| PH | Presidential Communications Office: https://pco.gov.ph/ | Presidential Proclamation/후속 공고. 연간 regular/special non-working day proclamation 및 Eid 등 후속 선언을 확인한다. | regular holiday와 special non-working day를 NON_WORKING으로 기록한다. special working day는 실제 휴무가 아니므로 NON_WORKING으로 넣지 않는다. |
| TH | Bank of Thailand Financial Institutions Holiday: https://www.bot.or.th/en/financial-institutions-holiday.html | HTML + BOT notification. 다음 연도 금융기관 휴일과 후속 special holiday를 확인한다. | 전국 대상 금융기관 휴일/대체휴일을 NON_WORKING으로 기록한다. 방콕 등 지역 한정 공고는 국가 전체 dataset에 자동 포함하지 않는다. |
| MX | PROFEDET / Gobierno de México: https://www.gob.mx/profedet/ 및 Ley Federal del Trabajo Art. 74 | 법령 + 정부 안내. 법정 이동 휴일과 선거/정권이양 해당 연도를 확인한다. | Art. 74의 의무 휴일을 NON_WORKING으로 기록한다. 사업장이 휴일에 근무할 수 있다는 Art. 75 규정은 국가 WORKING override가 아니다. |
| US | U.S. Office of Personnel Management Federal Holidays: https://www.opm.gov/policy-data-oversight/pay-leave/federal-holidays/ | 공식 HTML 연도별 schedule. observed date 규칙을 OPM schedule 기준으로 확인한다. | OPM에 표시된 Federal holiday/observed date를 NON_WORKING으로 기록한다. 주·지방 휴일은 범위 밖이다. |

### 발표 시기 처리

정확한 발표일은 국가·연도별로 달라 고정 규칙으로 자동 판단하지 않는다. 운영자는 다음 연도 공식 페이지/공고가 게시되었는지 주기적으로 확인하고, 게시 전에는 UNAVAILABLE을 유지한다. 예를 들어 중국의 2026 일정은 국무원 공고 国办发明电〔2025〕7号로 발표되었고, 태국 BOT는 2026년 8월 27일에 2027 금융기관 휴일 공고를 게시했다. “통상 발표 시기”는 확인 우선순위를 위한 운영 참고일 뿐 공식 데이터 생성 근거가 아니다.

## 3. sourceVersion 규칙

sourceVersion은 동일 국가·연도 dataset이 어떤 공식 발표를 반영했는지 비교할 수 있어야 한다.

권장 형식:

    <COUNTRY>-<YEAR>-<authority-or-document>-<revision>

예:

    CN-2026-guoban-2025-7
    US-2026-opm-federal
    TH-2027-bot-37-2569
    KR-2030-kasi-2029-11-15

후속 공고로 내용이 바뀌면 같은 sourceVersion을 덮어쓰지 말고 새 식별자를 사용한다. source URL도 실제 검증한 공식 페이지/문서 URL로 저장한다.

## 4. Canonical JSON Import

연도 metadata는 document 상단에 한 번 기록하고 날짜를 배열로 둔다.

    {
      "countryCode": "CN",
      "year": 2030,
      "status": "OFFICIAL",
      "sourceVersion": "CN-2030-guoban-2030-1",
      "sourceUrl": "https://www.gov.cn/example",
      "dates": [
        {
          "date": "2030-01-01",
          "name": "元旦",
          "dayType": "NON_WORKING",
          "sourceKey": "new-year"
        },
        {
          "date": "2030-01-05",
          "name": "调休上班",
          "dayType": "WORKING",
          "sourceKey": "new-year-working"
        }
      ]
    }

Import status는 OFFICIAL만 허용한다. 아직 검증되지 않은 파일은 적용하지 않고 UI Preview까지만 수행한다.

## 5. CSV Import

UTF-8 CSV의 header는 아래 순서와 이름을 사용한다.

    countryCode,year,date,name,dayType,sourceKey,sourceVersion,sourceUrl

모든 row는 동일 국가·연도·sourceVersion·sourceUrl을 가져야 한다. 쉼표나 따옴표가 포함된 값은 RFC 4180 방식의 double quote escaping을 사용한다. XLSX는 Issue #342 범위에서 지원하지 않는다. Excel 사용자는 UTF-8 CSV로 저장한 뒤 Import한다.

## 6. 검증 절차

1. 공식 source에서 연도와 적용 범위(전국/지역/기관)를 확인한다.
2. 날짜를 ISO YYYY-MM-DD로 변환하고 파일의 year와 일치하는지 확인한다.
3. 같은 날짜가 두 번 존재하지 않는지 확인한다.
4. 휴무일은 NON_WORKING, 공식 보충 근무일은 WORKING으로 분류한다.
5. 대체휴일/교환휴무와 보충근무가 한 쌍인 국가에서는 둘을 함께 대조한다.
6. sourceVersion/sourceUrl을 기록하고 관리 UI의 업로드 전 검증을 수행한다.
7. Preview의 추가/변경/삭제 건수를 원본 자료와 대조한다.
8. 이상이 없으면 적용한다. Apply는 Catalog revision If-Match와 단일 DB transaction을 사용하므로 stale 변경이나 중간 실패 시 일부만 저장되지 않는다.
9. Project에서 실제 반영이 필요하면 해당 Project의 Calendar Preview를 수행하고 결과를 확인한 뒤 명시적으로 저장한다.

## 7. 수정·정정 정책

- 공식 후속 발표가 기존 dataset을 대체하면 기존 내용의 provenance를 운영 기록에 남기고 sourceVersion을 증가시킨 뒤 Import 또는 CRUD한다.
- 잘못 등록된 연도를 즉시 Scheduling에서 제외해야 하면 status를 UNAVAILABLE 또는 SUPERSEDED로 바꾼다.
- 날짜 삭제/대량 Import는 기존 Project를 자동 재계산하지 않는다.
- 지역 한정 휴일, 반일/시간 단위 휴일은 현재 Country Catalog 범위 밖이다.

## 8. 2026 built-in baseline과 2027~2037

Repository의 2026 fixture는 초기 설치용 검증 baseline으로 유지한다. 2027~2037은 모두 관리 가능한 슬롯이지만, DB에 검증된 OFFICIAL override가 등록되기 전에는 UNAVAILABLE이다. 이미 공식 발표가 나온 연도는 운영자가 위 절차로 등록할 수 있으며, 공식 자료가 없는 연도는 비워 둔다.
