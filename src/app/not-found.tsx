import Link from "next/link";

export default function NotFound() {
  return (
    <section className="status-page" aria-labelledby="not-found-heading">
      <p className="eyebrow">404</p>
      <h1 id="not-found-heading">페이지를 찾을 수 없습니다.</h1>
      <p>주소를 확인하거나 프로젝트 화면으로 돌아가 주세요.</p>
      <Link className="text-link" href="/">
        프로젝트로 돌아가기
      </Link>
    </section>
  );
}
