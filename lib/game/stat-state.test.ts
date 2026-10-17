import { describe, expect, it } from "vitest";
import { applyDecay } from "./decay";
import { addPoints, resumeAfterSick, type StatState } from "./stat-state";

const TODAY = "2026-10-17";

function state(overrides: Partial<StatState> = {}): StatState {
  return {
    points: 100,
    bestGrade: "C",
    lastActiveOn: "2026-10-15",
    provisional: false,
    ...overrides,
  };
}

describe("addPoints", () => {
  it("adds points and marks the stat active today", () => {
    expect(addPoints(state(), 5, TODAY, null)).toEqual(
      state({ points: 105, lastActiveOn: TODAY }),
    );
  });

  it("raises the best grade on a rank-up", () => {
    expect(addPoints(state(), 20, TODAY, null)).toEqual(
      state({ points: 120, bestGrade: "B", lastActiveOn: TODAY }),
    );
  });

  it("applies any decay before adding", () => {
    // Inactive 10 days: 100 decays to 96, then +5.
    const result = addPoints(state({ lastActiveOn: "2026-10-07" }), 5, TODAY, null);
    expect(result.points).toBe(101);
  });

  it("does not count sick days when applying decay", () => {
    const result = addPoints(
      state({ lastActiveOn: "2026-10-07" }),
      5,
      TODAY,
      "2026-10-08",
    );
    expect(result.points).toBe(105);
  });

  it("removes points without going below zero or lowering the best grade", () => {
    expect(addPoints(state(), -20, TODAY, null)).toEqual(state({ points: 80 }));
    expect(addPoints(state({ points: 10 }), -20, TODAY, null).points).toBe(0);
  });

  it("does not mark the stat active when points are removed", () => {
    expect(addPoints(state(), -5, TODAY, null).lastActiveOn).toBe("2026-10-15");
  });

  it("leaves the best grade empty while provisional", () => {
    const result = addPoints(
      state({ provisional: true, bestGrade: null }),
      100,
      TODAY,
      null,
    );
    expect(result.bestGrade).toBeNull();
    expect(result.points).toBe(200);
  });

  it("sets a best grade if a calibrated stat has none", () => {
    expect(addPoints(state({ bestGrade: null }), 5, TODAY, null).bestGrade).toBe("C");
  });
});

describe("resumeAfterSick", () => {
  it("moves the last active day forward by the days spent sick", () => {
    // Active 10-01, sick 10-05 to today (12 days): becomes 10-13.
    const result = resumeAfterSick(
      state({ lastActiveOn: "2026-10-01" }),
      "2026-10-05",
      TODAY,
    );
    expect(result.lastActiveOn).toBe("2026-10-13");
  });

  it("keeps the same decay as during the sick spell", () => {
    const before = state({ lastActiveOn: "2026-09-20" });
    const sickSince = "2026-09-29";
    const decayWhileSick = applyDecay({
      ...before,
      today: TODAY,
      sickSince,
    });
    const after = resumeAfterSick(before, sickSince, TODAY);
    expect(
      applyDecay({ ...after, today: TODAY, sickSince: null }),
    ).toBe(decayWhileSick);
  });

  it("starts fresh if the user was already sick when last active", () => {
    const result = resumeAfterSick(
      state({ lastActiveOn: "2026-10-10" }),
      "2026-10-05",
      TODAY,
    );
    expect(result.lastActiveOn).toBe(TODAY);
  });

  it("leaves a never-active stat alone", () => {
    const result = resumeAfterSick(state({ lastActiveOn: null }), "2026-10-05", TODAY);
    expect(result.lastActiveOn).toBeNull();
  });
});
