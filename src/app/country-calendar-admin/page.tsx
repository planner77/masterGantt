import Link from "next/link";
import helpStyles from "@/components/ui/context-help.module.css";
import { ContextHelp } from "@/components/ui/context-help";
import { CountryCalendarAdmin } from "@/features/country-calendars/country-calendar-admin";

export default function CountryCalendarAdminPage() {
  return <section className="workspace-section admin-page">
    <div className={`section-heading ${helpStyles.heading}`}><div><p className="eyebrow">Global calendar data</p><h1>국가 캘린더 관리</h1><p>2026~2037년 국가별 공식 자료</p></div>
      <ContextHelp label="국가 캘린더 관리 도움말">공식 원본과 업종별 적용 범위를 확인한 자료만 등록하세요. 날짜를 직접 변경하면 자료 상태가 미확보로 바뀌며, 기존 프로젝트 일정에는 자동 반영되지 않습니다.</ContextHelp>
    </div>
    <div><Link className="secondary-button" href="/project-master-admin">프로젝트 기준정보로 돌아가기</Link></div>
    <CountryCalendarAdmin />
  </section>;
}
