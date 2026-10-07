import { CountryCalendarAdmin } from "@/features/country-calendars/country-calendar-admin";

export default function CountryCalendarAdminPage() {
  return <section className="workspace-section admin-page">
    <div className="section-heading"><div><p className="eyebrow">Global calendar data</p><h1>국가 근무 캘린더 관리</h1><p>2026~2037년 국가별 공식 자료와 날짜 예외를 관리합니다.</p></div></div>
    <CountryCalendarAdmin />
  </section>;
}
