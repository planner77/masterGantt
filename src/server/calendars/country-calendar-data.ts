import type {
  CountryCalendarDescriptorDto,
  WorkCalendarCountryCode,
  WorkCalendarDayType,
} from "../../contracts/work-calendar";

export interface CountryCalendarDate {
  date: string;
  dayType: WorkCalendarDayType;
  name: string;
  sourceKey: string;
}

export interface CountryCalendarDataset {
  descriptor: CountryCalendarDescriptorDto;
  dates: readonly CountryCalendarDate[];
}

const descriptors = {
  KR: {
    code: "KR", name: "대한민국", supportedYears: [2026],
    sourceVersion: "KR-2026-law-2026-05-11",
    sourceUrl: "https://www.law.go.kr/LSW/lsInfoP.do?ancYnChk=0&lsId=014112",
  },
  CN: {
    code: "CN", name: "중국", supportedYears: [2026],
    sourceVersion: "CN-2026-guoban-2025-7",
    sourceUrl: "https://www.gov.cn/zhengce/content/202511/content_7047098.htm",
  },
  VN: {
    code: "VN", name: "베트남", supportedYears: [2026],
    sourceVersion: "VN-2026-bnv",
    sourceUrl: "https://xaydungchinhsach.chinhphu.vn/de-xuat-phuong-an-nghi-tet-am-lich-nghi-le-quoc-khanh-nam-2026-119251002130522291.htm",
  },
  PH: {
    code: "PH", name: "필리핀", supportedYears: [2026],
    sourceVersion: "PH-2026-proclamation-1006+1189+1264",
    sourceUrl: "https://pco.gov.ph/news_releases/pbbm-issues-proclamation-declaring-regular-holidays-special-non-working-days-for-2026/",
  },
  TH: {
    code: "TH", name: "태국", supportedYears: [2026],
    sourceVersion: "TH-2026-bot-31-2568",
    sourceUrl: "https://www.bot.or.th/th/financial-institutions-holiday.html",
  },
  MX: {
    code: "MX", name: "멕시코", supportedYears: [2026],
    sourceVersion: "MX-2026-lft-art74",
    sourceUrl: "https://www.gob.mx/profedet/articulos/sabes-cuales-son-los-dias-de-descanso-obligatorio-para-este-2026",
  },
  US: {
    code: "US", name: "미국", supportedYears: [2026],
    sourceVersion: "US-2026-opm-federal",
    sourceUrl: "https://www.opm.gov/policy-data-oversight/pay-leave/federal-holidays/",
  },
} satisfies Record<WorkCalendarCountryCode, CountryCalendarDescriptorDto>;

function d(date:string,name:string,sourceKey:string,dayType:WorkCalendarDayType="NON_WORKING"):CountryCalendarDate {
  return Object.freeze({date,name,sourceKey,dayType});
}

const dates:Record<WorkCalendarCountryCode,readonly CountryCalendarDate[]> = {
  KR: Object.freeze([
    d("2026-01-01","신정","new-year"),
    d("2026-02-16","설날 연휴","seollal"),
    d("2026-02-17","설날","seollal"),
    d("2026-02-18","설날 연휴","seollal"),
    d("2026-03-01","삼일절","independence-movement"),
    d("2026-03-02","삼일절 대체공휴일","independence-movement-observed"),
    d("2026-05-01","노동절","labor-day"),
    d("2026-05-05","어린이날","childrens-day"),
    d("2026-05-24","부처님 오신 날","buddhas-birthday"),
    d("2026-05-25","부처님 오신 날 대체공휴일","buddhas-birthday-observed"),
    d("2026-06-03","제9회 전국동시지방선거","local-election"),
    d("2026-06-06","현충일","memorial-day"),
    d("2026-07-17","제헌절","constitution-day"),
    d("2026-08-15","광복절","liberation-day"),
    d("2026-08-17","광복절 대체공휴일","liberation-day-observed"),
    d("2026-09-24","추석 연휴","chuseok"),
    d("2026-09-25","추석","chuseok"),
    d("2026-09-26","추석 연휴","chuseok"),
    d("2026-10-03","개천절","national-foundation-day"),
    d("2026-10-05","개천절 대체공휴일","national-foundation-day-observed"),
    d("2026-10-09","한글날","hangul-day"),
    d("2026-12-25","기독탄신일","christmas"),
  ]),
  CN: Object.freeze([
    d("2026-01-01","元旦","new-year"), d("2026-01-02","元旦假期","new-year"), d("2026-01-03","元旦假期","new-year"),
    d("2026-01-04","元旦调休上班","new-year-working","WORKING"),
    d("2026-02-14","春节调休上班","spring-festival-working","WORKING"),
    d("2026-02-15","春节","spring-festival"), d("2026-02-16","春节","spring-festival"), d("2026-02-17","春节","spring-festival"),
    d("2026-02-18","春节","spring-festival"), d("2026-02-19","春节","spring-festival"), d("2026-02-20","春节","spring-festival"),
    d("2026-02-21","春节","spring-festival"), d("2026-02-22","春节","spring-festival"), d("2026-02-23","春节","spring-festival"),
    d("2026-02-28","春节调休上班","spring-festival-working","WORKING"),
    d("2026-04-04","清明节","qingming"), d("2026-04-05","清明节","qingming"), d("2026-04-06","清明节","qingming"),
    d("2026-05-01","劳动节","labor-day"), d("2026-05-02","劳动节","labor-day"), d("2026-05-03","劳动节","labor-day"),
    d("2026-05-04","劳动节","labor-day"), d("2026-05-05","劳动节","labor-day"),
    d("2026-05-09","劳动节调休上班","labor-day-working","WORKING"),
    d("2026-06-19","端午节","dragon-boat"), d("2026-06-20","端午节","dragon-boat"), d("2026-06-21","端午节","dragon-boat"),
    d("2026-09-20","国庆节调休上班","national-day-working","WORKING"),
    d("2026-09-25","中秋节","mid-autumn"), d("2026-09-26","中秋节","mid-autumn"), d("2026-09-27","中秋节","mid-autumn"),
    d("2026-10-01","国庆节","national-day"), d("2026-10-02","国庆节","national-day"), d("2026-10-03","国庆节","national-day"),
    d("2026-10-04","国庆节","national-day"), d("2026-10-05","国庆节","national-day"), d("2026-10-06","国庆节","national-day"),
    d("2026-10-07","国庆节","national-day"), d("2026-10-10","国庆节调休上班","national-day-working","WORKING"),
  ]),
  VN: Object.freeze([
    d("2026-01-01","Tết Dương lịch","new-year"),
    d("2026-02-16","Tết Nguyên đán","tet"), d("2026-02-17","Tết Nguyên đán","tet"),
    d("2026-02-18","Tết Nguyên đán","tet"), d("2026-02-19","Tết Nguyên đán","tet"), d("2026-02-20","Tết Nguyên đán","tet"),
    d("2026-04-26","Giỗ Tổ Hùng Vương","hung-kings"), d("2026-04-27","Nghỉ bù Giỗ Tổ Hùng Vương","hung-kings-observed"),
    d("2026-04-30","Ngày Giải phóng miền Nam","reunification-day"), d("2026-05-01","Ngày Quốc tế Lao động","labor-day"),
    d("2026-08-22","Làm bù Quốc khánh","national-day-working","WORKING"),
    d("2026-08-31","Nghỉ hoán đổi Quốc khánh","national-day-swap"),
    d("2026-09-01","Quốc khánh","national-day"), d("2026-09-02","Quốc khánh","national-day"),
  ]),
  PH: Object.freeze([
    d("2026-01-01","New Year's Day","new-year"),
    d("2026-02-17","Chinese New Year","chinese-new-year"),
    d("2026-02-25","EDSA People Power Revolution Anniversary","edsa-working","WORKING"),
    d("2026-03-20","Eid'l Fitr","eid-fitr"),
    d("2026-04-02","Maundy Thursday","maundy-thursday"), d("2026-04-03","Good Friday","good-friday"), d("2026-04-04","Black Saturday","black-saturday"),
    d("2026-04-09","Araw ng Kagitingan","valor-day"), d("2026-05-01","Labor Day","labor-day"), d("2026-05-27","Eid'l Adha","eid-adha"),
    d("2026-06-12","Independence Day","independence-day"), d("2026-08-21","Ninoy Aquino Day","ninoy-aquino"),
    d("2026-08-31","National Heroes Day","national-heroes"), d("2026-11-01","All Saints' Day","all-saints"),
    d("2026-11-02","All Souls' Day","all-souls"), d("2026-11-30","Bonifacio Day","bonifacio"),
    d("2026-12-08","Feast of the Immaculate Conception of Mary","immaculate-conception"),
    d("2026-12-24","Christmas Eve","christmas-eve"), d("2026-12-25","Christmas Day","christmas"),
    d("2026-12-30","Rizal Day","rizal"), d("2026-12-31","Last Day of the Year","last-day"),
  ]),
  TH: Object.freeze([
    d("2026-01-01","New Year's Day","new-year"), d("2026-01-02","Additional special holiday","special-holiday"),
    d("2026-03-03","Makha Bucha Day","makha-bucha"), d("2026-04-06","Chakri Memorial Day","chakri"),
    d("2026-04-13","Songkran Festival","songkran"), d("2026-04-14","Songkran Festival","songkran"), d("2026-04-15","Songkran Festival","songkran"),
    d("2026-05-01","National Labor Day","labor-day"), d("2026-05-04","Coronation Day","coronation"),
    d("2026-06-01","Substitution for Visakha Bucha Day","visakha-bucha-observed"), d("2026-06-03","H.M. Queen Suthida's Birthday","queen-suthida"),
    d("2026-07-28","H.M. King's Birthday","king-birthday"), d("2026-07-29","Asarnha Bucha Day","asarnha-bucha"),
    d("2026-08-12","Queen Mother's Birthday / Mother's Day","mothers-day"),
    d("2026-10-13","King Bhumibol Memorial Day","bhumibol-memorial"), d("2026-10-23","King Chulalongkorn Memorial Day","chulalongkorn"),
    d("2026-12-07","Substitution for National Day / Father's Day","national-day-observed"),
    d("2026-12-10","Constitution Day","constitution-day"), d("2026-12-31","New Year's Eve","new-years-eve"),
  ]),
  MX: Object.freeze([
    d("2026-01-01","Año Nuevo","new-year"), d("2026-02-02","Día de la Constitución (observado)","constitution"),
    d("2026-03-16","Natalicio de Benito Juárez (observado)","benito-juarez"), d("2026-05-01","Día del Trabajo","labor-day"),
    d("2026-09-16","Día de la Independencia","independence-day"), d("2026-11-16","Día de la Revolución (observado)","revolution"),
    d("2026-12-25","Navidad","christmas"),
  ]),
  US: Object.freeze([
    d("2026-01-01","New Year's Day","new-year"), d("2026-01-19","Birthday of Martin Luther King, Jr.","mlk"),
    d("2026-02-16","Washington's Birthday","washington"), d("2026-05-25","Memorial Day","memorial-day"),
    d("2026-06-19","Juneteenth National Independence Day","juneteenth"), d("2026-07-03","Independence Day (observed)","independence-day-observed"),
    d("2026-09-07","Labor Day","labor-day"), d("2026-10-12","Columbus Day","columbus-day"),
    d("2026-11-11","Veterans Day","veterans-day"), d("2026-11-26","Thanksgiving Day","thanksgiving"),
    d("2026-12-25","Christmas Day","christmas"),
  ]),
};

export function listCountryCalendarDescriptors():CountryCalendarDescriptorDto[] {
  return Object.values(descriptors).map((descriptor)=>({
    ...descriptor,
    supportedYears:[...descriptor.supportedYears],
  }));
}

export function getCountryCalendarDataset(code:WorkCalendarCountryCode,year:number):CountryCalendarDataset|undefined {
  const descriptor=descriptors[code];
  if(!descriptor.supportedYears.includes(year)) return undefined;
  return {
    descriptor:{...descriptor,supportedYears:[...descriptor.supportedYears]},
    dates:dates[code].filter((entry)=>entry.date.startsWith(`${year}-`)),
  };
}
