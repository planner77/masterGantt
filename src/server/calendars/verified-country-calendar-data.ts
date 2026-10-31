import type { CountryCalendarDataset } from "./country-calendar-data";

// Literal official rows, not recurrence calculations. OPM 2028 New Year is
// observed on 2027-12-31; keep sourceScheduleYear=2028 in the 2027 record.
export const VERIFIED_COUNTRY_CALENDAR_DATASETS = [
  {
    "descriptor": {
      "code": "US",
      "name": "미국",
      "supportedYears": [
        2027
      ],
      "sourceVersion": "US-2027+2028-OPM-federal-holidays-page-calendar-year-normalized-v2",
      "sourceUrl": "https://www.opm.gov/policy-data-oversight/pay-leave/federal-holidays/"
    },
    "dates": [
      {
        "date": "2027-01-01",
        "name": "New Year's Day",
        "dayType": "NON_WORKING",
        "sourceKey": "new-year"
      },
      {
        "date": "2027-01-18",
        "name": "Birthday of Martin Luther King, Jr.",
        "dayType": "NON_WORKING",
        "sourceKey": "mlk"
      },
      {
        "date": "2027-02-15",
        "name": "Washington's Birthday",
        "dayType": "NON_WORKING",
        "sourceKey": "washington"
      },
      {
        "date": "2027-05-31",
        "name": "Memorial Day",
        "dayType": "NON_WORKING",
        "sourceKey": "memorial-day"
      },
      {
        "date": "2027-06-18",
        "name": "Juneteenth National Independence Day",
        "dayType": "NON_WORKING",
        "sourceKey": "juneteenth-observed"
      },
      {
        "date": "2027-07-05",
        "name": "Independence Day",
        "dayType": "NON_WORKING",
        "sourceKey": "independence-day-observed"
      },
      {
        "date": "2027-09-06",
        "name": "Labor Day",
        "dayType": "NON_WORKING",
        "sourceKey": "labor-day"
      },
      {
        "date": "2027-10-11",
        "name": "Columbus Day",
        "dayType": "NON_WORKING",
        "sourceKey": "columbus-day"
      },
      {
        "date": "2027-11-11",
        "name": "Veterans Day",
        "dayType": "NON_WORKING",
        "sourceKey": "veterans-day"
      },
      {
        "date": "2027-11-25",
        "name": "Thanksgiving Day",
        "dayType": "NON_WORKING",
        "sourceKey": "thanksgiving"
      },
      {
        "date": "2027-12-24",
        "name": "Christmas Day",
        "dayType": "NON_WORKING",
        "sourceKey": "christmas-observed"
      },
      {
        "date": "2027-12-31",
        "name": "New Year's Day",
        "dayType": "NON_WORKING",
        "sourceKey": "new-year-2028-observed",
        "sourceScheduleYear": 2028
      }
    ]
  },
  {
    "descriptor": {
      "code": "US",
      "name": "미국",
      "supportedYears": [
        2028
      ],
      "sourceVersion": "US-2028-OPM-federal-holidays-page",
      "sourceUrl": "https://www.opm.gov/policy-data-oversight/pay-leave/federal-holidays/"
    },
    "dates": [
      {
        "date": "2028-01-17",
        "name": "Birthday of Martin Luther King, Jr.",
        "dayType": "NON_WORKING",
        "sourceKey": "mlk"
      },
      {
        "date": "2028-02-21",
        "name": "Washington's Birthday",
        "dayType": "NON_WORKING",
        "sourceKey": "washington"
      },
      {
        "date": "2028-05-29",
        "name": "Memorial Day",
        "dayType": "NON_WORKING",
        "sourceKey": "memorial-day"
      },
      {
        "date": "2028-06-19",
        "name": "Juneteenth National Independence Day",
        "dayType": "NON_WORKING",
        "sourceKey": "juneteenth"
      },
      {
        "date": "2028-07-04",
        "name": "Independence Day",
        "dayType": "NON_WORKING",
        "sourceKey": "independence-day"
      },
      {
        "date": "2028-09-04",
        "name": "Labor Day",
        "dayType": "NON_WORKING",
        "sourceKey": "labor-day"
      },
      {
        "date": "2028-10-09",
        "name": "Columbus Day",
        "dayType": "NON_WORKING",
        "sourceKey": "columbus-day"
      },
      {
        "date": "2028-11-10",
        "name": "Veterans Day",
        "dayType": "NON_WORKING",
        "sourceKey": "veterans-day-observed"
      },
      {
        "date": "2028-11-23",
        "name": "Thanksgiving Day",
        "dayType": "NON_WORKING",
        "sourceKey": "thanksgiving"
      },
      {
        "date": "2028-12-25",
        "name": "Christmas Day",
        "dayType": "NON_WORKING",
        "sourceKey": "christmas"
      }
    ]
  },
  {
    "descriptor": {
      "code": "US",
      "name": "미국",
      "supportedYears": [
        2029
      ],
      "sourceVersion": "US-2029-OPM-federal-holidays-page",
      "sourceUrl": "https://www.opm.gov/policy-data-oversight/pay-leave/federal-holidays/"
    },
    "dates": [
      {
        "date": "2029-01-01",
        "name": "New Year's Day",
        "dayType": "NON_WORKING",
        "sourceKey": "new-year"
      },
      {
        "date": "2029-01-15",
        "name": "Birthday of Martin Luther King, Jr.",
        "dayType": "NON_WORKING",
        "sourceKey": "mlk"
      },
      {
        "date": "2029-02-19",
        "name": "Washington's Birthday",
        "dayType": "NON_WORKING",
        "sourceKey": "washington"
      },
      {
        "date": "2029-05-28",
        "name": "Memorial Day",
        "dayType": "NON_WORKING",
        "sourceKey": "memorial-day"
      },
      {
        "date": "2029-06-19",
        "name": "Juneteenth National Independence Day",
        "dayType": "NON_WORKING",
        "sourceKey": "juneteenth"
      },
      {
        "date": "2029-07-04",
        "name": "Independence Day",
        "dayType": "NON_WORKING",
        "sourceKey": "independence-day"
      },
      {
        "date": "2029-09-03",
        "name": "Labor Day",
        "dayType": "NON_WORKING",
        "sourceKey": "labor-day"
      },
      {
        "date": "2029-10-08",
        "name": "Columbus Day",
        "dayType": "NON_WORKING",
        "sourceKey": "columbus-day"
      },
      {
        "date": "2029-11-12",
        "name": "Veterans Day",
        "dayType": "NON_WORKING",
        "sourceKey": "veterans-day-observed"
      },
      {
        "date": "2029-11-22",
        "name": "Thanksgiving Day",
        "dayType": "NON_WORKING",
        "sourceKey": "thanksgiving"
      },
      {
        "date": "2029-12-25",
        "name": "Christmas Day",
        "dayType": "NON_WORKING",
        "sourceKey": "christmas"
      }
    ]
  },
  {
    "descriptor": {
      "code": "US",
      "name": "미국",
      "supportedYears": [
        2030
      ],
      "sourceVersion": "US-2030-OPM-federal-holidays-page",
      "sourceUrl": "https://www.opm.gov/policy-data-oversight/pay-leave/federal-holidays/"
    },
    "dates": [
      {
        "date": "2030-01-01",
        "name": "New Year's Day",
        "dayType": "NON_WORKING",
        "sourceKey": "new-year"
      },
      {
        "date": "2030-01-21",
        "name": "Birthday of Martin Luther King, Jr.",
        "dayType": "NON_WORKING",
        "sourceKey": "mlk"
      },
      {
        "date": "2030-02-18",
        "name": "Washington's Birthday",
        "dayType": "NON_WORKING",
        "sourceKey": "washington"
      },
      {
        "date": "2030-05-27",
        "name": "Memorial Day",
        "dayType": "NON_WORKING",
        "sourceKey": "memorial-day"
      },
      {
        "date": "2030-06-19",
        "name": "Juneteenth National Independence Day",
        "dayType": "NON_WORKING",
        "sourceKey": "juneteenth"
      },
      {
        "date": "2030-07-04",
        "name": "Independence Day",
        "dayType": "NON_WORKING",
        "sourceKey": "independence-day"
      },
      {
        "date": "2030-09-02",
        "name": "Labor Day",
        "dayType": "NON_WORKING",
        "sourceKey": "labor-day"
      },
      {
        "date": "2030-10-14",
        "name": "Columbus Day",
        "dayType": "NON_WORKING",
        "sourceKey": "columbus-day"
      },
      {
        "date": "2030-11-11",
        "name": "Veterans Day",
        "dayType": "NON_WORKING",
        "sourceKey": "veterans-day"
      },
      {
        "date": "2030-11-28",
        "name": "Thanksgiving Day",
        "dayType": "NON_WORKING",
        "sourceKey": "thanksgiving"
      },
      {
        "date": "2030-12-25",
        "name": "Christmas Day",
        "dayType": "NON_WORKING",
        "sourceKey": "christmas"
      }
    ]
  },
  {
    "descriptor": {
      "code": "VN",
      "name": "베트남",
      "supportedYears": [
        2026
      ],
      "sourceVersion": "VN-2026-public-employees-12729+BNV-2025-10+3383+QH16-28+10065-v3",
      "sourceUrl": "https://baochinhphu.vn/cong-chuc-vien-chuc-duoc-nghi-4-ngay-dip-tet-duong-lich-2026-102251225111845247.htm"
    },
    "dates": [
      {
        "date": "2026-01-01",
        "name": "Tết Dương lịch",
        "dayType": "NON_WORKING",
        "sourceKey": "new-year"
      },
      {
        "date": "2026-01-02",
        "name": "Nghỉ hoán đổi Tết Dương lịch",
        "dayType": "NON_WORKING",
        "sourceKey": "new-year-swap"
      },
      {
        "date": "2026-01-10",
        "name": "Làm bù Tết Dương lịch",
        "dayType": "WORKING",
        "sourceKey": "new-year-working"
      },
      {
        "date": "2026-02-16",
        "name": "Tết Nguyên đán",
        "dayType": "NON_WORKING",
        "sourceKey": "tet"
      },
      {
        "date": "2026-02-17",
        "name": "Tết Nguyên đán",
        "dayType": "NON_WORKING",
        "sourceKey": "tet"
      },
      {
        "date": "2026-02-18",
        "name": "Tết Nguyên đán",
        "dayType": "NON_WORKING",
        "sourceKey": "tet"
      },
      {
        "date": "2026-02-19",
        "name": "Tết Nguyên đán",
        "dayType": "NON_WORKING",
        "sourceKey": "tet"
      },
      {
        "date": "2026-02-20",
        "name": "Tết Nguyên đán",
        "dayType": "NON_WORKING",
        "sourceKey": "tet"
      },
      {
        "date": "2026-04-26",
        "name": "Giỗ Tổ Hùng Vương",
        "dayType": "NON_WORKING",
        "sourceKey": "hung-kings"
      },
      {
        "date": "2026-04-27",
        "name": "Nghỉ bù Giỗ Tổ Hùng Vương",
        "dayType": "NON_WORKING",
        "sourceKey": "hung-kings-observed"
      },
      {
        "date": "2026-04-30",
        "name": "Ngày Giải phóng miền Nam",
        "dayType": "NON_WORKING",
        "sourceKey": "reunification-day"
      },
      {
        "date": "2026-05-01",
        "name": "Ngày Quốc tế Lao động",
        "dayType": "NON_WORKING",
        "sourceKey": "labor-day"
      },
      {
        "date": "2026-08-22",
        "name": "Làm bù Quốc khánh",
        "dayType": "WORKING",
        "sourceKey": "national-day-working"
      },
      {
        "date": "2026-08-31",
        "name": "Nghỉ hoán đổi Quốc khánh",
        "dayType": "NON_WORKING",
        "sourceKey": "national-day-swap"
      },
      {
        "date": "2026-09-01",
        "name": "Quốc khánh",
        "dayType": "NON_WORKING",
        "sourceKey": "national-day"
      },
      {
        "date": "2026-09-02",
        "name": "Quốc khánh",
        "dayType": "NON_WORKING",
        "sourceKey": "national-day"
      },
      {
        "date": "2026-11-24",
        "name": "Ngày Văn hóa Việt Nam",
        "dayType": "NON_WORKING",
        "sourceKey": "vietnam-culture-day"
      }
    ]
  },
  {
    "descriptor": {
      "code": "TH",
      "name": "태국",
      "supportedYears": [
        2027
      ],
      "sourceVersion": "TH-2027-bot-37-2569",
      "sourceUrl": "https://www.bot.or.th/content/dam/bot/fipcs/documents/FPG/2569/ThaiPDF/25690175.pdf"
    },
    "dates": [
      {
        "date": "2027-01-01",
        "name": "New Year's Day",
        "dayType": "NON_WORKING",
        "sourceKey": "new-year"
      },
      {
        "date": "2027-02-22",
        "name": "Substitution for Makha Bucha Day",
        "dayType": "NON_WORKING",
        "sourceKey": "makha-bucha-observed"
      },
      {
        "date": "2027-04-06",
        "name": "Chakri Memorial Day",
        "dayType": "NON_WORKING",
        "sourceKey": "chakri"
      },
      {
        "date": "2027-04-13",
        "name": "Songkran Festival",
        "dayType": "NON_WORKING",
        "sourceKey": "songkran"
      },
      {
        "date": "2027-04-14",
        "name": "Songkran Festival",
        "dayType": "NON_WORKING",
        "sourceKey": "songkran"
      },
      {
        "date": "2027-04-15",
        "name": "Songkran Festival",
        "dayType": "NON_WORKING",
        "sourceKey": "songkran"
      },
      {
        "date": "2027-05-03",
        "name": "Substitution for National Labor Day",
        "dayType": "NON_WORKING",
        "sourceKey": "labor-day-observed"
      },
      {
        "date": "2027-05-04",
        "name": "Coronation Day",
        "dayType": "NON_WORKING",
        "sourceKey": "coronation"
      },
      {
        "date": "2027-05-20",
        "name": "Visakha Bucha Day",
        "dayType": "NON_WORKING",
        "sourceKey": "visakha-bucha"
      },
      {
        "date": "2027-06-03",
        "name": "H.M. Queen Suthida Bajrasudhabimalalakshana's Birthday",
        "dayType": "NON_WORKING",
        "sourceKey": "queen-suthida"
      },
      {
        "date": "2027-07-19",
        "name": "Substitution for Asarnha Bucha Day",
        "dayType": "NON_WORKING",
        "sourceKey": "asarnha-bucha-observed"
      },
      {
        "date": "2027-07-28",
        "name": "H.M. King Maha Vajiralongkorn Phra Vajiraklaochaoyuhua's Birthday",
        "dayType": "NON_WORKING",
        "sourceKey": "king-birthday"
      },
      {
        "date": "2027-08-12",
        "name": "H.M. Queen Sirikit the Queen Mother's Birthday Anniversary and National Mother's Day",
        "dayType": "NON_WORKING",
        "sourceKey": "mothers-day"
      },
      {
        "date": "2027-10-13",
        "name": "H.M. King Bhumibol Adulyadej the Great Memorial Day",
        "dayType": "NON_WORKING",
        "sourceKey": "bhumibol-memorial"
      },
      {
        "date": "2027-10-25",
        "name": "Substitution for H.M. King Chulalongkorn the Great Memorial Day",
        "dayType": "NON_WORKING",
        "sourceKey": "chulalongkorn-observed"
      },
      {
        "date": "2027-12-06",
        "name": "Substitution for H.M. King Bhumibol Adulyadej the Great's Birthday, National Day and Father's Day",
        "dayType": "NON_WORKING",
        "sourceKey": "national-day-observed"
      },
      {
        "date": "2027-12-10",
        "name": "Constitution Day",
        "dayType": "NON_WORKING",
        "sourceKey": "constitution-day"
      },
      {
        "date": "2027-12-31",
        "name": "New Year's Eve",
        "dayType": "NON_WORKING",
        "sourceKey": "new-years-eve"
      }
    ]
  }
] as const satisfies readonly CountryCalendarDataset[];
