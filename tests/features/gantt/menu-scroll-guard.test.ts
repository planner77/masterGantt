import { describe, expect, it } from "vitest";
import { captureMenuScrollChange } from "../../../src/features/gantt/menu-scroll-guard";

describe("작업 메뉴 스크롤 경계", () => {
  it("열기 전에 완료된 이동과 중복 알림은 변경으로 취급하지 않는다", () => {
    const chart = { scrollLeft: 418, scrollTop: 0, parentElement: null };
    const task = { scrollLeft: 0, scrollTop: 0, parentElement: chart };
    const changed = captureMenuScrollChange(task);
    expect(changed()).toBe(false);
    expect(changed()).toBe(false);
    expect(chart.scrollLeft).toBe(418);
  });

  it("메뉴를 연 뒤 실제 가로 이동은 즉시 감지한다", () => {
    const chart = { scrollLeft: 418, scrollTop: 0, parentElement: null };
    const task = { scrollLeft: 0, scrollTop: 0, parentElement: chart };
    const changed = captureMenuScrollChange(task);
    chart.scrollLeft = 468;
    expect(changed()).toBe(true);
  });

  it("상위 페이지의 세로 이동도 감지한다", () => {
    const page = { scrollLeft: 0, scrollTop: 120, parentElement: null };
    const chart = { scrollLeft: 0, scrollTop: 0, parentElement: page };
    const task = { scrollLeft: 0, scrollTop: 0, parentElement: chart };
    const changed = captureMenuScrollChange(task);
    page.scrollTop = 150;
    expect(changed()).toBe(true);
  });

  it("메뉴를 다시 열면 새로운 위치가 기준이 된다", () => {
    const chart = { scrollLeft: 0, scrollTop: 0, parentElement: null };
    const first = captureMenuScrollChange(chart);
    chart.scrollLeft = 50;
    const second = captureMenuScrollChange(chart);
    expect(first()).toBe(true);
    expect(second()).toBe(false);
    chart.scrollTop = 20;
    expect(second()).toBe(true);
  });
});
