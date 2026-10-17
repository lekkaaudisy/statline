import { describe, expect, it } from "vitest";
import {
  activeDaysBetween,
  awakeningDay,
  comebackProgress,
  firstGapEnd,
} from "./awakening";
import { addDays } from "./dates";

const START = "2026-09-01";

// Active days from day `from` to day `to` after START (both included),
// skipping any in `off`.
function days(from: number, to: number, off: number[] = []): string[] {
  const result: string[] = [];
  for (let d = from; d <= to; d++) if (!off.includes(d)) result.push(addDays(START, d));
  return result;
}

function set(...lists: string[][]): Set<string> {
  return new Set(lists.flat());
}

const day = (n: number) => addDays(START, n);

describe("active days", () => {
  it("counts active days in a range, both ends included", () => {
    expect(activeDaysBetween(set(days(0, 4)), day(0), day(4))).toBe(5);
    expect(activeDaysBetween(set(days(0, 4)), day(3), day(9))).toBe(2);
  });
});

describe("the inactive gap", () => {
  it("ends on the 7th inactive day in a row", () => {
    // Active days 0-2, then nothing from day 3.
    expect(firstGapEnd(set(days(0, 2)), START, day(20))).toBe(day(9));
  });

  it("needs 7 days in a row, not 7 in total", () => {
    // 6 days off, one active day, 6 days off.
    const active = set(days(0, 0), days(7, 7), days(14, 14));
    expect(firstGapEnd(active, START, day(14))).toBeNull();
  });

  it("never counts days before the user started", () => {
    expect(firstGapEnd(set(days(0, 3)), day(0), day(5))).toBeNull();
  });

  it("counts sick days like any other inactive day", () => {
    // Nothing is recorded on sick days, so they are simply inactive.
    expect(firstGapEnd(new Set(), START, day(6))).toBe(day(6));
  });
});

describe("Awakening", () => {
  it("triggers after 7 inactive days then 14 steady days", () => {
    // Inactive days 0-6, active days 7-20.
    const active = set(days(7, 20));
    expect(awakeningDay(active, START, day(20))).toBe(day(20));
  });

  it("allows 2 days off in the 14 days", () => {
    const active = set(days(7, 20, [10, 15]));
    expect(awakeningDay(active, START, day(20))).toBe(day(20));
  });

  it("does not trigger with 3 days off in every 14-day window", () => {
    const active = set(days(7, 22, [10, 14, 18]));
    expect(awakeningDay(active, START, day(22))).toBeNull();
  });

  it("waits until the 14 days are over", () => {
    const active = set(days(7, 19));
    expect(awakeningDay(active, START, day(19))).toBeNull();
  });

  it("needs the gap first: steady days alone are not enough", () => {
    expect(awakeningDay(set(days(0, 40)), START, day(40))).toBeNull();
  });

  it("needs at least 7 inactive days, not 6", () => {
    // Inactive days 0-5 only.
    expect(awakeningDay(set(days(6, 30)), START, day(30))).toBeNull();
  });

  it("can find a steady window that starts after a slow return", () => {
    // Gap days 0-6, a slow week (days 7-13, only 2 active), then steady
    // days from 14. The window days 11-24 is the first with 12 active days.
    const active = set(days(8, 8), days(11, 11), days(14, 27));
    expect(awakeningDay(active, START, day(23))).toBeNull();
    expect(awakeningDay(active, START, day(27))).toBe(day(24));
  });
});

describe("comeback progress", () => {
  it("shows active days since the gap ended", () => {
    const active = set(days(7, 11, [9]));
    expect(comebackProgress(active, START, day(11))).toEqual({ days: 5, activeDays: 4 });
  });

  it("looks at the last 14 days at most", () => {
    const active = set(days(7, 30));
    expect(comebackProgress(active, START, day(30))).toEqual({ days: 14, activeDays: 14 });
  });

  it("is empty before any gap and while still inactive", () => {
    expect(comebackProgress(set(days(0, 10)), START, day(10))).toBeNull();
    expect(comebackProgress(new Set(), START, day(10))).toBeNull();
  });
});
