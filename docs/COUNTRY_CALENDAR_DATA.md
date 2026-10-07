# 국가 근무 캘린더 원본 관리

Issue #342는 국가 원본과 Project에 이미 저장된 근무 달력을 분리한다. 국가 원본을 수정해도 기존 Project 달력·Task 날짜·Project revision은 자동으로 바뀌지 않는다. 사용자가 Project 근무 규칙의 Preview와 Save를 실행할 때만 최신 원본을 적용한다.

## 관리 범위와 상태

KR/CN/VN/PH/TH/MX/US의 2026~2037을 국가·연도별로 관리한다. 84개 관리 슬롯이 모두 공식 날짜를 보유한다는 뜻은 아니다. 공식 발표와 전체 날짜를 대조한 자료만 OFFICIAL로 사용한다. 미확보·부분 발표 자료는 UNAVAILABLE이고, 새로운 공식 발표가 대체한 이전 자료는 SUPERSEDED다. 발표되지 않은 날짜를 주기·음력 계산·전년도 복사로 생성하지 않는다.

서버는 승인된 immutable builtin과 SQLite override를 읽으며 runtime 외부 휴일 API를 사용하지 않는다. override가 UNAVAILABLE 또는 SUPERSEDED이면 기존 builtin을 계산에 되살리지 않는다. 같은 국가·연도의 최신 상태와 출처는 API의 canonical 응답으로 확인한다.

국가별 범위는 서로 다르다. US는 연방 직원용 OPM 일정, TH는 BOT 금융기관 전국 공통 일정, MX는 연방노동법의 일반 의무 휴무일이다. 특정 지역·업종·종교 조건을 전국 공통 일정으로 확대하지 않는다. 필요한 Project별 예외는 기존 근무 규칙에서 별도로 설정한다.

## 기본 제공 자료

2026-10-07 검토 기준 builtin은 12개 OFFICIAL 슬롯과 72개 UNAVAILABLE 슬롯을 제공한다. DB override는 별도로 관리하므로 실제 사용 가능한 연도는 공개 API의 `supportedYears`와 연도별 상태를 확인한다.

| 국가 | builtin OFFICIAL 연도·날짜 수 | 검토 근거·주의사항 |
| --- | --- | --- |
| KR | 2026: 22개 | 연간 공휴일과 후속 법 개정·선거일. 2027 공식 공고는 존재하지만 첨부 다운로드가 오류 HTML을 반환했고 부처님오신날을 포함한 전체 원표를 검증하지 못해 2027은 UNAVAILABLE이다. |
| CN | 2026: 39개 | 국무원 공고의 연휴와 보충 출근일. |
| VN | 2026: 17개 | 주5일 공공기관 직원 일정. 연초 교환 휴무·근무일과 11월 24일 추가 휴일을 포함한다. |
| PH | 2026: 21개 | Proclamation 1006과 Eid 관련 1189/1264. 이후 연도는 별도 Eid 확정 등 전체 자료를 검증해야 한다. |
| TH | 2026: 19개, 2027: 18개 | 금융기관 전국 공통. 2027은 [공식 태국어 고시 37/2569](https://www.bot.or.th/content/dam/bot/fipcs/documents/FPG/2569/ThaiPDF/25690175.pdf) 원표를 전사했다. 영어 PDF는 비공식 편의 번역이다. |
| MX | 2026: 7개 | Article 74 일반 의무 휴무일의 공식 해당 연도 안내. |
| US | 2026: 11개, 2027: 12개, 2028: 10개, 2029: 11개, 2030: 11개 | OPM 연방 직원 일정. 원표 2028의 `2027-12-31`을 실제 연도 2027에 포함했고, 2029 Veterans Day는 원표의 `2029-11-12`다. |

위 목록 밖의 2026~2037 국가·연도는 UNAVAILABLE이다. 이는 완전한 검증 자료를 아직 제공하지 않는다는 뜻이며 정부의 미발표 여부와 동일하지 않다. KR 2027의 [공식 월력요항 공고](https://www.kasa.go.kr/bbs/BBSMSTR_000000000018/view.do?nttId=B000000003234Li6nD2)와 [공식 보도자료](https://www.kasa.go.kr/prog/plcyBrf/brief/kor/sub01_01_04/view.do?plcyBrfNo=431)를 확인했으나 일부 날짜의 직접 원표 근거가 부족해 OFFICIAL로 승격하지 않았다.

VN 2026은 [정부의 연초 교환 근무 결정](https://baochinhphu.vn/cong-chuc-vien-chuc-duoc-nghi-4-ngay-dip-tet-duong-lich-2026-102251225111845247.htm)에 따라 `2026-01-02 NON_WORKING`과 `2026-01-10 WORKING`을 포함한다. 11월 24일은 [Resolution 28/2026/QH16](https://xaydungchinhsach.chinhphu.vn/nghi-quyet-28-2026-qh16-ve-phat-trien-van-hoa-viet-nam-119260506165532877.htm)의 추가 휴일이며 실제 발행일은 2026-04-24, 시행일은 2026-07-01이다. 기사 게시일을 법률 발행일로 기록하지 않는다. [정부 최종 승인 안내](https://xaydungchinhsach.chinhphu.vn/de-xuat-2-phuong-an-nghi-tet-nguyen-dan-2027-tet-dinh-mui-11926080513033257.htm)의 공문 10065/VPCP-KGVX는 2026-10-02 발행이고 공공부문에 11월 24일 하루를 적용한다. 제안 단계의 11월 23일 휴무·28일 보충 출근은 추가하지 않는다.

정정한 builtin에는 새로운 sourceVersion을 사용한다. 기존 `VN-2026-bnv`로 materialize된 Project를 migration으로 재작성하지 않는다. OPM 2027의 version은 2027·2028 두 원표를 실제 날짜 연도로 합쳤음을 표시한다. 공식 자료의 출처·원표 식별자는 fixture와 이 문서에 보존하며 정부의 설명 문서 전체나 원첨부를 제품에 복제하지 않는다.

## 공식 자료 확보와 갱신

| 국가 | 공식 출처와 형식 | 확인 시점·휴무/근무 판정·변환 주의사항 |
| --- | --- | --- |
| KR | [우주항공청 2026 월력요항](https://www.kasa.go.kr/bbs/BBSMSTR_000000000010/view.do?nttId=B000000001860Pe2zT3), [국가법령정보센터](https://www.law.go.kr/LSW/lsInfoP.do?ancYnChk=0&lsId=014112); 공고 HTML와 첨부 문서·법령 | 연간 월력요항 발표 때와 법 개정·선거 공고 때 다시 확인한다. 공휴일·대체공휴일을 NON_WORKING으로 전사하고 후속 노동절·제헌절 등 법 개정이 반영됐는지 대조한다. 명절 날짜를 직접 계산하지 않는다. |
| CN | [국무원 2026 연간 휴일 공고](https://www.gov.cn/zhengce/content/202511/content_7047098.htm); HTML 공고 | 다음 연도 공고 및 후속 수정 때 확인한다. 발표한 연휴 구간의 각 날짜를 NON_WORKING으로, 명시한 보충 출근일을 WORKING으로 전사한다. 주말 보충 근무를 누락하거나 연휴만 복사하지 않는다. |
| VN | [정부 정책 공고](https://xaydungchinhsach.chinhphu.vn/), [정부 공식 보도](https://baochinhphu.vn/), [내무부](https://moha.gov.vn/); HTML 공지·공문 첨부 | 연간 설·국경일 결정과 연초 교환 근무, 후속 법 개정 때 확인한다. 확정 승인과 제안을 구분하고 공공기관 직원의 휴무 및 교환 출근을 함께 전사한다. 민간 사업장 선택을 공공기관 원본과 섞지 않는다. |
| PH | [PCO의 2026 Proclamation 안내](https://pco.gov.ph/news_releases/pbbm-issues-proclamation-declaring-regular-holidays-special-non-working-days-for-2026/); HTML와 Presidential Proclamation | 연간 proclamation 발표 뒤 Eid 등 별도 proclamation을 추가 확인한다. regular/special non-working은 NON_WORKING, special working은 WORKING이다. Eid 날짜가 미확정인 연간 목록만으로 전체 자료를 OFFICIAL로 등록하지 않는다. |
| TH | [BOT 공식 휴일 안내](https://www.bot.or.th/th/financial-institutions-holiday.html), [2026 Notification 31/2568 PDF](https://www.bot.or.th/content/dam/bot/fipcs/documents/FPG/2568/EngPDF/25680162.pdf); HTML·PDF 고시 | 다음 연도 고시와 추가 휴무 고시 때 확인한다. 전국 공통 금융기관 휴무만 NON_WORKING으로 전사한다. Bangkok 한정 `2026-10-16` 및 특정 남부 지점·기관 조건의 휴무를 전국 일정에 넣지 않는다. |
| MX | [PROFEDET 2026 의무 휴무일 안내](https://www.gob.mx/profedet/articulos/sabes-cuales-son-los-dias-de-descanso-obligatorio-para-este-2026?idiom=es); HTML와 연방노동법 | 해당 연도 공식 안내와 법 개정·선거 관련 공식 결정 때 확인한다. Article 74 일반 의무 휴무일을 NON_WORKING으로 전사한다. 조항의 반복 규칙만 계산해 미확보 미래 연도를 생성하지 않는다. |
| US | [OPM Federal Holidays](https://www.opm.gov/policy-data-oversight/pay-leave/federal-holidays/); 연도별 HTML 표 | OPM의 해당 연도 표 게시·수정 때 확인한다. 실제 관측 휴일 날짜를 NON_WORKING으로 전사한다. 표 제목 연도와 날짜 연도를 구분하고 DC 지역 Inauguration Day 같은 조건부 예외를 전국 일정에 확대하지 않는다. |

위 확인 시점은 운영자의 검토 계기이며 정해진 정부 발표 기한을 보장하지 않는다. HTML/PDF 원표를 내려받아 각 행을 JSON 또는 CSV로 변환한 뒤 독립 대조한다. 원문 공고 식별자와 후속 정정을 `sourceVersion`에 포함한다. 기본 식별자는 `국가-연도-공고식별자-정정버전` 형태이며 허용 문자는 [API](API.md)의 실제 제한을 따른다.

2027~2037 관리 범위에서 공식 연간 자료가 아직 코드에 완전히 확보되지 않은 국가·연도는 UNAVAILABLE이다. 공식 공고가 이미 존재해도 첨부 날짜를 완전히 추출·검증하지 못했다면 미발표라고 단정하지 않는다. 확보 상태와 정부 발표 여부는 별개다.

자료 검토자는 다음을 수행한다.

1. 해당 국가의 공식 발표 URL, 발표 식별자·일자, 대상 연도와 적용 범위를 확인한다. 민간 calendar API의 결과만으로 공식 상태를 부여하지 않는다.
2. 모든 날짜와 휴무/보충 근무일, 대체 휴일을 원표와 행별 대조한다. 전체 연도 확정에 필요한 후속 발표가 없으면 UNAVAILABLE을 유지한다.
3. 실제 날짜의 연도로 행을 분류한다. 예를 들어 OPM 2028 일정표의 New Year's Day 관측일은 `2027-12-31`이므로 2027 dataset에 넣고 원표 연도 2028을 출처 설명에 보존한다. 2028 dataset에 다른 연도 날짜를 넣지 않는다.
4. 새 `sourceVersion`과 검증된 source URL을 부여한다. 이전 version을 새 날짜로 조용히 바꾸지 않는다. 수동 날짜 변경은 공식 provenance를 무효화하므로 재대조와 명시적 OFFICIAL 확인이 필요하다.
5. 서버 Preview의 추가·변경·삭제 수와 출처를 검토한 뒤 Apply한다. Apply 후 canonical 국가·연도·status·revision·날짜를 다시 확인한다.
6. 기존 Project 변경 0을 확인한다. Project에 새 원본을 적용할 때는 해당 Project Preview의 일정 차이를 검토하고 별도로 Save한다.

부분 자료, 미래 연도 미확보, 적용 범위 차이와 알려진 정정은 출처별 검토 기록에 남긴다. URL 형식이 올바른 것만으로 내용의 공식성이 증명되지는 않는다. 서버는 source URL을 fetch하지 않는다.

## JSON과 CSV

국가 Import는 기존 Project JSON Import와 다른 계약이다. XLSX·Excel DRM·Project task schema를 처리하지 않는다. 파일은 UTF-8이며 국가·연도별 날짜 목록 전체를 대체한다. 잘못된 행을 건너뛰거나 일부만 저장하지 않는다.

완전한 예제 파일은 [US 2030 JSON](examples/country-calendar-us-2030.json)과 [동일 자료의 CSV](examples/country-calendar-us-2030.csv)다. OPM 연방 직원 일정 11행을 포함한다. 관리자에서 미국·2030을 선택한 뒤 파일을 Preview할 수 있다. 다른 연도로 파일의 year만 바꿔 등록하지 않는다.

JSON의 필드는 `countryCode`, `year`, `status`, `sourceVersion`, `sourceUrl`, `dates`다. `status`는 `OFFICIAL`이어야 하며 각 date에는 `date`, `name`, `dayType`, `sourceKey`가 필요하다. 알 수 없는 필드와 null, 중복 JSON key, 중복 날짜, 실제로 존재하지 않는 날짜, 다른 연도 날짜를 거부한다. `dayType`은 `NON_WORKING` 또는 `WORKING`이다.

CSV는 다음 헤더를 사용한다.

```csv
countryCode,year,date,name,dayType,sourceKey,sourceVersion,sourceUrl
```

모든 행의 국가·연도·출처 metadata는 일치해야 한다. 표준 CSV의 따옴표와 이중 따옴표 escape를 사용한다. cell 문자열을 수식으로 실행하지 않는다. 서버의 최신 크기·행 수·문자열 제한과 오류 계약은 [API](API.md)를 따른다.

Preview는 DB를 변경하지 않고 추가·변경·삭제·동일 수와 metadata 변경 여부를 반환한다. Apply는 같은 내용·format·대상·revision·관리자 session 및 유효한 Preview token을 요구한다. token이 만료되거나 하나라도 바뀌면 다시 Preview한다. no-op은 revision과 updatedAt을 바꾸지 않는다.

한 개의 선행 UTF-8 BOM을 허용하며 HMAC의 원본 내용에는 이를 보존한다. 문법 해석에서만 제거한다. 잘못된 UTF-8, 중복 BOM과 중간 BOM은 거부한다. Preview 유효 기간은 최대 10분이고 관리자 session 만료를 넘지 않는다.

## 권한과 복구

기존 Project Master 관리자 권한을 사용한다. 관리 화면 상태는 authorization 근거가 아니다. 서버는 session·Origin·If-Match를 검사하며 body 읽기 후에도 권한을 재확인한다. token·password·cookie를 URL, 로그, 저장소에 기록하지 않는다.

401은 재인증, 412는 최신 데이터 조회와 변경 재검토가 필요하다. 네트워크 오류로 Apply 결과가 불확실하면 자동 재시도하지 않고 canonical 조회로 결과를 확인한다. 삽입 중 오류는 transaction 전체 rollback이며 기존 dataset과 catalog revision을 보존한다.

신규 Project 기본 달력은 같은 UTC 연도의 effective KR OFFICIAL, 같은 연도의 검증된 builtin, 월~금 기본 근무주 순으로 초기화한다. 기본 근무주 fallback에는 국가 휴일을 만들지 않는다. 사용자가 명시적으로 국가 규칙을 선택한 Preview/Save는 미확보 자료를 상세 422로 거부한다.

구현·인수 기준·검증 단계는 [Issue #342 실행 계획](exec-plans/active/ISSUE_342.md), UI 상태·초안은 [PROJECT_UX](PROJECT_UX.md), 실제 검증은 [TEST_PLAN](TEST_PLAN.md)을 함께 따른다.
