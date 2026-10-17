import { describe, expect, it } from "vitest";
import { applyDecay, countedInactiveDays, type DecayInput } from "./decay";

const TODAY = "2026-10-17";

// A calibrated stat at B (120 points), best grade B, last active today.
function input(overrides: Partial<DecayInput> = {}): DecayInput {
  return {
    points: 120,
    bestGrade: "B",
    lastActiveOn: TODAY,
    today: TODAY,
    sickSince: null,
    provisional: false,
    ...overrides,
  };
}

// The date `days` days before today.
function daysAgo(days: number): string {
  const d = new Date(`${TODAY}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

describe("countedInactiveDays", () => {
  it("counts the days since the stat was last active", () => {
    expect(countedInactiveDays(daysAgo(0), TODAY, null)).toBe(0);
    expect(countedInactiveDays(daysAgo(9), TODAY, null)).toBe(9);
  });

  it("stops counting on the day the user became sick or injured", () => {
    expect(countedInactiveDays(daysAgo(20), TODAY, daysAgo(11))).toBe(9);
  });

  it("counts nothing if the user was already sick when last active", () => {
    expect(countedInactiveDays(daysAgo(5), TODAY, daysAgo(10))).toBe(0);
  });

  it("ignores a sick date in the future", () => {
    expect(countedInactiveDays(daysAgo(9), TODAY, "2026-10-20")).toBe(9);
  });

  it("counts nothing for a stat that was never active", () => {
    expect(countedInactiveDays(null, TODAY, null)).toBe(0);
  });

  it("never counts below zero", () => {
    expect(countedInactiveDays("2026-10-20", TODAY, null)).toBe(0);
  });
});

describe("applyDecay", () => {
  it("loses nothing for up to 6 inactive days", () => {
    for (let days = 0; days <= 6; days++) {
      expect(applyDecay(input({ lastActiveOn: daysAgo(days) }))).toBe(120);
    }
  });

  it("starts losing points on the 7th inactive day", () => {
    expect(applyDecay(input({ lastActiveOn: daysAgo(7) }))).toBe(119);
  });

  it("loses one point for each further day", () => {
    expect(applyDecay(input({ lastActiveOn: daysAgo(10) }))).toBe(116);
  });

  it("never drops below the best grade minus two steps", () => {
    // Best A -> floor C (75 points). 30 days would otherwise lose 24.
    expect(
      applyDecay(input({ points: 80, bestGrade: "A", lastActiveOn: daysAgo(30) })),
    ).toBe(75);
    // Best B -> floor D (45 points).
    expect(applyDecay(input({ lastActiveOn: daysAgo(400) }))).toBe(45);
  });

  it("can fall all the way to zero when the best grade is F or E", () => {
    expect(
      applyDecay(input({ points: 10, bestGrade: "E", lastActiveOn: daysAgo(30) })),
    ).toBe(0);
    expect(
      applyDecay(input({ points: 5, bestGrade: "F", lastActiveOn: daysAgo(30) })),
    ).toBe(0);
  });

  it("uses the current grade when no best grade is stored", () => {
    // 120 points is B, so the floor is D (45 points).
    expect(
      applyDecay(input({ bestGrade: null, lastActiveOn: daysAgo(400) })),
    ).toBe(45);
  });

  it("uses the current grade when it is higher than the stored best", () => {
    // 160 points is A, so the floor is C (75), not F from a stale best of D.
    expect(
      applyDecay(input({ points: 160, bestGrade: "D", lastActiveOn: daysAgo(400) })),
    ).toBe(75);
  });

  it("never raises points that are already below the floor", () => {
    expect(
      applyDecay(input({ points: 50, bestGrade: "SS", lastActiveOn: daysAgo(30) })),
    ).toBe(50);
  });

  it("is paused while the user is sick or injured", () => {
    expect(
      applyDecay(input({ lastActiveOn: daysAgo(30), sickSince: daysAgo(30) })),
    ).toBe(120);
  });

  it("counts only the inactive days before the user became sick", () => {
    // Inactive 20 days, sick for the last 11: 9 days count, so 3 points go.
    expect(
      applyDecay(input({ lastActiveOn: daysAgo(20), sickSince: daysAgo(11) })),
    ).toBe(117);
  });

  it("loses nothing if the user was sick before the last active day", () => {
    expect(
      applyDecay(input({ lastActiveOn: daysAgo(20), sickSince: daysAgo(25) })),
    ).toBe(120);
  });

  it("never decays a provisional grade", () => {
    expect(
      applyDecay(input({ provisional: true, lastActiveOn: daysAgo(30) })),
    ).toBe(120);
  });

  it("never decays a stat that was never active", () => {
    expect(applyDecay(input({ lastActiveOn: null }))).toBe(120);
  });

  it("does not change its input and always gives the same answer", () => {
    const given = input({ lastActiveOn: daysAgo(12) });
    const copy = { ...given };
    const first = applyDecay(given);
    expect(applyDecay(given)).toBe(first);
    expect(given).toEqual(copy);
  });
});
