import { CountryCalendarAdmin } from "@/features/calendars/country-calendar-admin";

export default function CalendarAdminPage() {
  return (
    <section className="workspace-section">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Global calendar catalog</p>
          <h1>국가 캘린더 관리</h1>
          <p>국가·연도별 공식 휴일과 보충 근무일을 검증·업로드하고 관리합니다.</p>
        </div>
      </div>
      <CountryCalendarAdmin />
    </section>
  );
}
