import { describe, expect, it } from "vitest";
import { canTakeRestDay, isRestDay, restDayThisWeek, shouldAutoRest } from "./rest-day";

// 2026-10-12 is a Monday, 2026-10-18 the Sunday after.
describe("rest day", () => {
  it("finds this week's rest day only", () => {
    expect(restDayThisWeek(["2026-10-11", "2026-10-14"], "2026-10-16")).toBe("2026-10-14");
    expect(restDayThisWeek(["2026-10-11"], "2026-10-16")).toBeNull();
    expect(restDayThisWeek(["2026-10-19"], "2026-10-18")).toBeNull();
  });

  it("allows one rest day per week", () => {
    expect(canTakeRestDay([], "2026-10-13")).toBe(true);
    expect(canTakeRestDay(["2026-10-12"], "2026-10-13")).toBe(false);
    expect(canTakeRestDay(["2026-10-12"], "2026-10-19")).toBe(true);
  });

  it("makes Sunday the rest day when none was taken", () => {
    expect(shouldAutoRest([], "2026-10-18")).toBe(true);
    expect(shouldAutoRest(["2026-10-15"], "2026-10-18")).toBe(false);
    expect(shouldAutoRest([], "2026-10-17")).toBe(false);
  });

  it("knows whether today is the rest day", () => {
    expect(isRestDay(["2026-10-15"], "2026-10-15")).toBe(true);
    expect(isRestDay(["2026-10-15"], "2026-10-16")).toBe(false);
  });
});
