import { describe, expect, it } from "vitest";
import { POTENTIAL_BANDS } from "./constants";
import {
  calculatePotential,
  momentumOf,
  potentialBand,
  weeklyGain,
  type WeeklySnapshot,
} from "./potential";
import { GRADES } from "./stats";

// A snapshot where each of the four earned stats has `each` points.
function week(weekStart: string, each: number, potential = 75): WeeklySnapshot {
  return {
    weekStart,
    strength: each,
    speed: each,
    endurance: each,
    intelligence: each,
    potential,
  };
}

// Mondays, oldest first.
const W = [
  "2026-09-07",
  "2026-09-14",
  "2026-09-21",
  "2026-09-28",
  "2026-10-05",
  "2026-10-12",
];

describe("weeklyGain", () => {
  it("is unknown with no history or a single week", () => {
    expect(weeklyGain([])).toBeNull();
    expect(weeklyGain([week(W[0], 50)])).toBeNull();
  });

  it("adds up the gain of all four earned stats", () => {
    // Each stat +2.5 a week -> +10 a week combined.
    const history = [week(W[2], 50), week(W[3], 52.5), week(W[4], 55)];
    expect(weeklyGain(history)).toBe(10);
  });

  it("ignores Potential's own points", () => {
    const history = [week(W[3], 50, 75), week(W[4], 50, 330)];
    expect(weeklyGain(history)).toBe(0);
  });

  it("only looks at the last 4 weeks", () => {
    // A big jump long ago, then four flat weeks.
    const history = [
      week(W[0], 0),
      week(W[1], 100),
      week(W[2], 100),
      week(W[3], 100),
      week(W[4], 100),
      week(W[5], 100),
    ];
    expect(weeklyGain(history)).toBe(0);
  });

  it("is unknown when every other week is older than the window", () => {
    expect(weeklyGain([week(W[0], 0), week(W[5], 100)])).toBeNull();
  });

  it("divides by the real number of weeks when weeks are missing", () => {
    // +30 combined over 3 weeks, with no visit in between.
    expect(weeklyGain([week(W[2], 50), week(W[5], 57.5)])).toBe(10);
  });

  it("does not depend on the order the snapshots arrive in", () => {
    const history = [week(W[4], 55), week(W[2], 50), week(W[3], 52.5)];
    expect(weeklyGain(history)).toBe(10);
  });

  it("is negative when stats shrink", () => {
    expect(weeklyGain([week(W[4], 60), week(W[5], 55)])).toBe(-20);
  });
});

describe("potentialBand", () => {
  it("gives every band its grade exactly at its minimum", () => {
    for (const band of POTENTIAL_BANDS) {
      if (Number.isFinite(band.minWeeklyGain)) {
        expect(potentialBand(band.minWeeklyGain)).toBe(band.grade);
      }
    }
  });

  it("gives the lower band just below each minimum", () => {
    expect(potentialBand(4.9)).toBe("D");
    expect(potentialBand(-0.1)).toBe("E");
    expect(potentialBand(-10.1)).toBe("F");
  });

  it("covers the whole ladder from F to SSS", () => {
    expect(potentialBand(-1000)).toBe("F");
    expect(potentialBand(1000)).toBe("SSS");
    expect(new Set(POTENTIAL_BANDS.map((b) => b.grade))).toEqual(
      new Set(GRADES),
    );
  });
});

describe("calculatePotential", () => {
  it("starts at C with no history", () => {
    expect(calculatePotential([])).toBe("C");
    expect(calculatePotential([week(W[5], 50)])).toBe("C");
  });

  it("keeps the current grade while there is not enough history", () => {
    expect(calculatePotential([week(W[5], 50)], "A")).toBe("A");
  });

  it("drops to D after flat weeks", () => {
    expect(calculatePotential([week(W[4], 50), week(W[5], 50)], "C")).toBe("D");
  });

  it("holds at C with a steady +10 a week", () => {
    const history = [week(W[3], 50), week(W[4], 52.5), week(W[5], 55)];
    expect(calculatePotential(history, "C")).toBe("C");
  });

  it("rises with big gains, but only one step at a time", () => {
    // +80 a week combined would be S.
    const history = [week(W[4], 50), week(W[5], 70)];
    expect(calculatePotential(history, "C")).toBe("B");
    expect(calculatePotential(history, "B")).toBe("A");
  });

  it("falls when stats shrink, but only one step at a time", () => {
    const history = [week(W[4], 60), week(W[5], 50)];
    expect(calculatePotential(history, "A")).toBe("B");
  });

  it("stays put once it reaches the band", () => {
    const history = [week(W[4], 50), week(W[5], 70)];
    expect(calculatePotential(history, "S")).toBe("S");
  });

  it("always gives a grade on the ladder", () => {
    for (const gain of [-500, -10, 0, 7, 40, 99, 500]) {
      const history = [week(W[4], 100), week(W[5], 100 + gain / 4)];
      for (const current of GRADES) {
        expect(GRADES).toContain(calculatePotential(history, current));
      }
    }
  });
});

describe("momentumOf", () => {
  it("is unknown without enough history", () => {
    expect(momentumOf(null)).toBeNull();
  });

  it("describes the direction and the rounded weekly gain", () => {
    expect(momentumOf(12.4)).toEqual({ trend: "Rising", perWeek: 12 });
    expect(momentumOf(0)).toEqual({ trend: "Steady", perWeek: 0 });
    expect(momentumOf(0.4)).toEqual({ trend: "Steady", perWeek: 0 });
    expect(momentumOf(-3.6)).toEqual({ trend: "Slowing", perWeek: -4 });
  });
});
